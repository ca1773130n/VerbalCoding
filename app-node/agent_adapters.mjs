import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { agentAdapterCapabilities, createAgentRunResult } from './agent_contract.mjs';

export function shellSplit(s) {
  const out = [];
  let cur = '', quote = null, esc = false;
  for (const ch of String(s || '')) {
    if (esc) { cur += ch; esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (quote) { if (ch === quote) quote = null; else cur += ch; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (/\s/.test(ch)) { if (cur) { out.push(cur); cur = ''; } continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

export function voiceBridgePrompt(text, options = {}) {
  const english = /^en/i.test(String(options.language || ''));
  const lines = english ? [
    'This is a user utterance from a Discord voice call.',
    'Answer in English. For simple conversation/status questions, do not use tools; answer directly in 1-3 sentences.',
    'Use tools only for real work requests such as file edits, command execution, log checks, or web/search tasks.',
    'If code changes are made, do not read diffs or full code aloud; summarize outcome and next checks briefly.',
    'Do not include CLI metadata or session_id in the answer.',
  ] : [
    'Discord 음성 대화로 들어온 사용자 발화다.',
    '단순 대화/상태 질문이면 도구를 쓰지 말고 1~3문장으로 바로 한국어 답변해라.',
    '파일 수정, 실행, 로그 확인, 검색 같은 실제 작업 지시일 때만 필요한 도구를 사용해라.',
    '코드 변경을 수행했다면 음성 답변에는 diff나 코드 전문을 읽지 말고, 작업 결과와 다음 확인 사항만 짧게 말해라.',
    'CLI 메타정보나 session_id는 답변에 포함하지 마라.',
  ];
  if (options.verboseProgress) {
    if (english) {
      lines.push(
        'VERBOSE progress sharing mode is enabled.',
        'For important intermediate steps during long work, output one line in the format `VERBALCODING_PROGRESS: <short English step>`.',
        'Examples: `VERBALCODING_PROGRESS: reading files app-node/main.mjs`, `VERBALCODING_PROGRESS: searching web VerbalCoding setup`, `VERBALCODING_PROGRESS: running terminal commands npm test`, `VERBALCODING_PROGRESS: using tools read_file`, `VERBALCODING_PROGRESS: loading skills discord-voice-hermes-bridge`.',
        'Never include tokens, API keys, passwords, connection strings, or personal identifiers in progress logs.',
        'Keep progress logs short: reading files, searching web, running terminal commands, running tests, using tools, or loading skills.',
      );
    } else {
      lines.push(
        'VERBOSE 진행 공유 모드가 켜져 있다.',
        '긴 작업에서 중요한 중간 동작을 할 때마다 한 줄로 `VERBALCODING_PROGRESS: <짧은 한국어 단계>` 형식을 출력해라.',
        '예: `VERBALCODING_PROGRESS: 파일 읽기 app-node/main.mjs`, `VERBALCODING_PROGRESS: 웹 검색 VerbalCoding setup`, `VERBALCODING_PROGRESS: 터미널 실행 npm test`, `VERBALCODING_PROGRESS: 툴 사용 read_file`, `VERBALCODING_PROGRESS: 스킬 사용 discord-voice-hermes-bridge`.',
        '토큰, API 키, 비밀번호, 연결 문자열, 개인 식별자는 절대 진행 로그에 쓰지 마라.',
        '진행 로그는 파일 읽기, 웹 검색, 터미널 실행, 테스트 실행, 툴 사용, 스킬 사용 같은 항목만 짧게 써라.',
      );
    }
  }
  if (options.projectContext) {
    lines.push(english ? 'Route this turn through the following project/session context:' : '이 턴은 아래 프로젝트/세션 컨텍스트로 처리해라.');
    lines.push(String(options.projectContext).trim());
  }
  return lines.concat(['', text]).join('\n');
}

export function sanitizeAgentOutput(text) {
  const raw = stripAnsi(String(text || ''));
  const boxed = extractHermesBoxedResponse(raw);
  return String(boxed || raw)
    .split(/\r?\n/)
    .filter(line => !/^session_id:\s*\S+\s*$/.test(line.trim()))
    .filter(line => !/^Session:\s*\S+\s*$/.test(line.trim()))
    .filter(line => !/^↻\s*Resumed session\s+\S+/.test(line.trim()))
    .filter(line => !/^VERBALCODING_PROGRESS\s*:/i.test(line.trim()))
    .filter(line => !/^Resume this session with:/i.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripAnsi(text) {
  return String(text || '').replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '');
}

function extractHermesBoxedResponse(text) {
  const lines = String(text || '').split(/\r?\n/);
  const start = lines.findIndex(line => /╭─\s*⚕\s*Hermes\s*─/.test(line));
  if (start < 0) return '';
  const body = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^╰/.test(line)) break;
    body.push(line.replace(/^\s*│\s?/, '').replace(/\s*│\s*$/, '').trimEnd());
  }
  return body.join('\n').trim();
}

function compactProgressText(text) {
  return String(text || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[`"']/g, '')
    .replace(/\b(?:token|api[_-]?key|password|secret|authorization)\b\s*[:=]?\s*\S+/gi, '$1 [REDACTED]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

export function extractVerboseProgressEvents(text, { language = 'ko' } = {}) {
  const events = [];
  const seen = new Set();
  const english = /^en/i.test(String(language || ''));
  const labels = english ? {
    web: 'searching web', skill: 'loading skills', read: 'reading files', edit: 'editing files', terminal: 'running terminal commands', tool: 'using tools',
  } : {
    web: '웹 검색 실행', skill: '스킬 사용', read: '파일 읽기', edit: '파일 수정', terminal: '터미널 명령 실행', tool: '툴 사용',
  };
  function add(event) {
    const cleaned = compactProgressText(event);
    if (!cleaned || seen.has(cleaned)) return;
    seen.add(cleaned);
    events.push(cleaned);
  }
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const explicit = /^VERBALCODING_PROGRESS\s*:\s*(.+)$/i.exec(line);
    if (explicit) { add(explicit[1]); continue; }
    const hermesPreview = /┊\s*(?:[^\s]+\s+)?(?:\$\s*)?([a-zA-Z_][\w-]*)\b/.exec(line);
    if (hermesPreview) { add(toolProgressLabel(hermesPreview[1], { language })); continue; }
    const lower = line.toLowerCase();
    if (/web_search|browser_search|web search|search web|functions\.web_search/.test(lower)) add(labels.web);
    else if (/skill_view|skills_list|skill_manage|functions\.skill_|스킬 사용|스킬 확인/.test(lower)) add(labels.skill);
    else if (/read_file|functions\.read_file|reading file|file read|파일 읽/.test(lower)) add(labels.read);
    else if (/write_file|patch|functions\.patch|editing file|파일 수정|파일 쓰/.test(lower)) add(labels.edit);
    else if (/terminal|execute_code|shell|command=|npm test|pytest|터미널|명령 실행/.test(lower)) add(labels.terminal);
    else if (/tool_use|calling tool|functions\./.test(lower)) add(labels.tool);
  }
  return events;
}

function toolProgressLabel(name, { language = 'ko' } = {}) {
  const tool = String(name || '').trim();
  const english = /^en/i.test(String(language || ''));
  if (/^(web_search|web_extract|browser_)/.test(tool)) return english ? 'searching web' : '웹 검색 실행';
  if (/^(read_file|search_files)$/.test(tool)) return english ? `using file tool ${tool}` : `파일 도구 사용 ${tool}`;
  if (/^(write_file|patch)$/.test(tool)) return english ? `editing files with ${tool}` : `파일 수정 도구 사용 ${tool}`;
  if (/^(terminal|execute_code|process)$/.test(tool)) return english ? `running terminal tool ${tool}` : `터미널 도구 사용 ${tool}`;
  if (/^(skill_view|skills_list|skill_manage)$/.test(tool)) return english ? `loading skills with ${tool}` : `스킬 도구 사용 ${tool}`;
  return english ? `using tool ${tool}` : `툴 사용 ${tool}`;
}

export function isPatchLikeOutput(text) {
  const s = String(text || '');
  if (!s.trim()) return false;
  const patchMarkers = [
    /^\s*┊\s*review diff\b/m,
    /^diff --git\b/m,
    /^@@\s+-\d+/m,
    /^a\/[^\n]+\s+→\s+b\//m,
    /^[-+]{3}\s+[ab]\//m,
  ];
  const markerHit = patchMarkers.some(re => re.test(s));
  const changedLines = s.split(/\r?\n/).filter(line => /^[+-](?![+-])/.test(line)).length;
  return markerHit || changedLines >= 8;
}

export function interruptedAgentMessage(label, hadPatchLikeOutput = false, language = 'ko') {
  const english = /^en/i.test(String(language || ''));
  if (hadPatchLikeOutput) {
    if (english) return `${label} was interrupted or timed out, and the partial output looked like a code diff. I will not read the diff aloud; check the text channel for files and test status.`;
    return `${label} 작업이 제한 시간에 걸렸고 코드 diff 출력이 감지됐어. diff는 음성으로 읽지 않을게. 변경 파일과 테스트 상태를 확인해서 이어서 정리할게.`;
  }
  if (english) return `${label} was interrupted or timed out before I could verify the final result.`;
  return `${label} 작업이 제한 시간이나 끼어들기로 중단됐어. 출력이 비어 있어서 결과를 확인하지 못했어.`;
}

function agentProgressEvent(label, kind, language = 'ko') {
  const english = /^en/i.test(String(language || ''));
  if (kind === 'start') return english ? `calling the agent ${label}` : `${label} 호출 시작`;
  if (kind === 'done') return english ? `received agent response ${label}` : `${label} 응답 수신`;
  return english ? `agent ${label}` : `${label}`;
}

function emptyAgentMessage(language = 'ko') {
  return /^en/i.test(String(language || '')) ? 'The response was empty.' : '응답이 비어 있어.';
}

function failedAgentMessage(label, detail, language = 'ko') {
  return /^en/i.test(String(language || ''))
    ? `${label} failed: ${detail}`
    : `${label} 실행에 실패했어: ${detail}`;
}

export function extractHermesSessionId(text) {
  return /^session_id:\s*(\S+)/m.exec(text || '')?.[1]
    || /^Session:\s*(\S+)/m.exec(text || '')?.[1]
    || null;
}

export function resolveExecTimeout(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function buildHermesSpawnOptions({ parentEnv = process.env, instanceEnv = {} } = {}) {
  const env = { ...parentEnv };
  if (instanceEnv.HERMES_HOME) env.HERMES_HOME = instanceEnv.HERMES_HOME;
  return { env };
}

export function buildAgentSettings({ ROOT, env = process.env } = {}) {
  const root = ROOT || process.cwd();
  const backend = String(env.AGENT_BACKEND || env.AGENT_PROVIDER || 'hermes').trim().toLowerCase();
  const defaults = {
    hermes: {
      label: 'Hermes Agent',
      command: env.HERMES_COMMAND || 'hermes chat -Q -q',
      sessionFile: env.HERMES_SESSION_FILE || path.join(root, '.verbalcoding-session'),
      supportsHermesSession: true,
    },
    claude: {
      label: 'Claude Code',
      command: env.CLAUDE_COMMAND || 'claude -p',
      sessionFile: env.AGENT_SESSION_FILE || path.join(root, '.agent-sessions', 'claude'),
      supportsHermesSession: false,
    },
    'claude-code': {
      label: 'Claude Code',
      command: env.CLAUDE_COMMAND || 'claude -p',
      sessionFile: env.AGENT_SESSION_FILE || path.join(root, '.agent-sessions', 'claude'),
      supportsHermesSession: false,
    },
    codex: {
      label: 'Codex',
      command: env.CODEX_COMMAND || 'codex exec',
      sessionFile: env.AGENT_SESSION_FILE || path.join(root, '.agent-sessions', 'codex'),
      supportsHermesSession: false,
    },
    gemini: {
      label: 'Gemini',
      command: env.GEMINI_COMMAND || 'gemini -p',
      sessionFile: env.AGENT_SESSION_FILE || path.join(root, '.agent-sessions', 'gemini'),
      supportsHermesSession: false,
    },
    opencode: {
      label: 'OpenCode',
      command: env.OPENCODE_COMMAND || 'opencode run',
      sessionFile: env.AGENT_SESSION_FILE || path.join(root, '.agent-sessions', 'opencode'),
      supportsHermesSession: false,
    },
    openclaw: {
      label: 'OpenClaw',
      command: env.OPENCLAW_COMMAND || 'openclaw run',
      sessionFile: env.AGENT_SESSION_FILE || path.join(root, '.agent-sessions', 'openclaw'),
      supportsHermesSession: false,
    },
    custom: {
      label: env.AGENT_LABEL || 'Custom Agent',
      command: env.AGENT_COMMAND || '',
      sessionFile: env.AGENT_SESSION_FILE || path.join(root, '.agent-sessions', 'custom'),
      supportsHermesSession: false,
    },
  };
  const selected = defaults[backend] || defaults.custom;
  const label = env.AGENT_LABEL || selected.label;
  const command = env.AGENT_COMMAND || selected.command;
  if (!command) throw new Error('AGENT_COMMAND is required when AGENT_BACKEND=custom');
  return {
    backend,
    label,
    command,
    sessionFile: selected.sessionFile,
    supportsHermesSession: selected.supportsHermesSession,
    cwd: env.AGENT_WORKDIR || env.AGENT_CWD || env.HERMES_WORKDIR || root,
    projectContext: env.AGENT_PROJECT_CONTEXT || env.HERMES_PROJECT_CONTEXT || '',
    taskTimeoutMs: Number(env.AGENT_TASK_TIMEOUT_MS || env.HERMES_TASK_TIMEOUT_MS || '0'),
    chatTimeoutMs: Number(env.AGENT_CHAT_TIMEOUT_MS || env.HERMES_CHAT_TIMEOUT_MS || '45000'),
    verboseProgress: ['1', 'true', 'yes', 'on'].includes(String(env.AGENT_VERBOSE_PROGRESS || env.VERBALCODING_VERBOSE_PROGRESS || '0').toLowerCase()),
  };
}

export function createAgentAdapter(settings, deps = {}) {
  settings = {
    ...settings,
      supportsHermesSession: settings.supportsHermesSession ?? settings.backend === 'hermes',
  };
  const execFileAsync = deps.execFileAsync;
  if (!execFileAsync) throw new Error('execFileAsync dependency is required');
  const fileApi = {
    readFileSync: deps.readFileSync || fs.readFileSync,
    writeFileSync: deps.writeFileSync || fs.writeFileSync,
    mkdirSync: deps.mkdirSync || fs.mkdirSync,
  };
  const log = deps.log || (() => {});
  const warn = deps.warn || (() => {});
  const env = deps.env || process.env;
  const hermesSessionsDir = deps.hermesSessionsDir || path.join(os.homedir(), '.hermes', 'sessions');
  const spawnProcess = deps.spawn;
  const onProgress = deps.onProgress || (() => {});
  const emittedProgress = new Set();
  let activeProgressLanguage = settings.language;
  const capabilities = agentAdapterCapabilities(settings);

  function emitVerboseProgress(text) {
    if (!text) return;
    for (const event of extractVerboseProgressEvents(text, { language: activeProgressLanguage })) {
      if (emittedProgress.has(event)) continue;
      emittedProgress.add(event);
      try { onProgress(event); } catch (e) { warn('verbose progress callback failed', e?.stack || e); }
    }
  }

  function execWithOptionalProgress(cmd, args, options, verbose) {
    if (!verbose || !spawnProcess) return execFileAsync(cmd, args, options);
    return new Promise((resolve, reject) => {
      const child = spawnProcess(cmd, args, {
        env: options.env,
        cwd: options.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      let settled = false;
      let timeoutId = null;
      function finishError(error) {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
      if (options.signal) {
        if (options.signal.aborted) {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          finishError(err);
          return;
        }
        options.signal.addEventListener('abort', () => {
          try { child.kill('SIGTERM'); } catch {}
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          err.code = 'ABORT_ERR';
          finishError(err);
        }, { once: true });
      }
      if (options.timeout) {
        timeoutId = setTimeout(() => {
          try { child.kill('SIGTERM'); } catch {}
          const err = new Error(`Command timed out after ${options.timeout}ms`);
          err.signal = 'SIGTERM';
          finishError(err);
        }, options.timeout);
      }
      child.stdout?.on('data', chunk => {
        const s = chunk.toString();
        stdout += s;
        emitVerboseProgress(s);
        if (stdout.length + stderr.length > options.maxBuffer) {
          const err = new Error('maxBuffer exceeded');
          err.code = 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
          try { child.kill('SIGTERM'); } catch {}
          finishError(err);
        }
      });
      child.stderr?.on('data', chunk => {
        const s = chunk.toString();
        stderr += s;
        emitVerboseProgress(s);
        if (stdout.length + stderr.length > options.maxBuffer) {
          const err = new Error('maxBuffer exceeded');
          err.code = 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
          try { child.kill('SIGTERM'); } catch {}
          finishError(err);
        }
      });
      child.on('error', finishError);
      child.on('close', (code, signal) => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (code === 0) resolve({ stdout, stderr });
        else {
          const err = new Error(`Command failed: ${cmd}`);
          err.code = code;
          err.signal = signal;
          err.stdout = stdout;
          err.stderr = stderr;
          reject(err);
        }
      });
    });
  }

  function makeCodexOutputPath() {
    const base = deps.tmpdir || os.tmpdir();
    return path.join(base, `verbalcoding-codex-last-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`);
  }

  function addCodexOutputCapture(args) {
    if (settings.backend !== 'codex') return { args, outputPath: null };
    if (args.includes('-o') || args.includes('--output-last-message')) return { args, outputPath: null };
    const outputPath = makeCodexOutputPath();
    return { args: args.slice(0, -1).concat(['--output-last-message', outputPath, args.at(-1)]), outputPath };
  }

  function readAndCleanupCodexOutput(outputPath) {
    if (!outputPath) return '';
    try {
      return fileApi.readFileSync(outputPath, 'utf8');
    } catch {
      return '';
    } finally {
      try { fs.rmSync(outputPath, { force: true }); } catch {}
    }
  }

  function readSessionId() {
    if (!settings.supportsHermesSession || !settings.sessionFile) return null;
    try {
      const id = fileApi.readFileSync(settings.sessionFile, 'utf8').trim();
      return id || null;
    } catch {
      return null;
    }
  }

  function writeSessionId(id) {
    if (!settings.supportsHermesSession || !settings.sessionFile || !id) return;
    try {
      fileApi.mkdirSync(path.dirname(settings.sessionFile), { recursive: true });
      fileApi.writeFileSync(settings.sessionFile, `${id}\n`, { mode: 0o600 });
    } catch (e) {
      warn('write agent session id failed', e?.stack || e);
    }
  }

  function contentToText(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content.map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return item.text || item.content || '';
        return '';
      }).filter(Boolean).join('\n');
    }
    if (content && typeof content === 'object') return content.text || content.content || '';
    return '';
  }

  function readHermesSessionFinalAnswer(sessionId) {
    if (!settings.supportsHermesSession || !sessionId) return '';
    try {
      const sessionPath = path.join(hermesSessionsDir, `session_${sessionId}.json`);
      const data = JSON.parse(fileApi.readFileSync(sessionPath, 'utf8'));
      const messages = Array.isArray(data.messages) ? data.messages : [];
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (message?.role !== 'assistant') continue;
        const text = sanitizeAgentOutput(contentToText(message.content));
        if (text) return text;
      }
    } catch (e) {
      warn('read Hermes session final answer failed', sessionId, e?.message || e);
    }
    return '';
  }

  function buildArgs(text, options = {}) {
    const argv = shellSplit(settings.command);
    const cmd = argv[0];
    const query = voiceBridgePrompt(text, { verboseProgress: options.verboseProgress, language: options.language, projectContext: options.projectContext });
    let args = argv.slice(1);
    if (settings.backend === 'hermes' && options.verboseProgress) {
      // Hermes quiet mode intentionally suppresses tool previews.  In verbose
      // voice mode we drop only the quiet flag so stdout can stream safe `┊ ...`
      // progress lines; final-answer cleanup below extracts the Hermes box.
      args = args.filter(arg => arg !== '-Q' && arg !== '--quiet');
    }
    args = args.concat([query]);
    const sessionId = readSessionId();
    if (sessionId) {
      const qIndex = args.lastIndexOf('-q');
      const insertAt = qIndex >= 0 ? qIndex : args.length - 1;
      args = args.slice(0, insertAt).concat(['--resume', sessionId], args.slice(insertAt));
    }
    return { cmd, args, sessionId };
  }

  async function run(request, signal, plan = { task: true, label: settings.label }) {
    const text = typeof request === 'string' ? request : request?.text;
    const verboseProgress = Boolean(plan.verboseProgress ?? settings.verboseProgress);
    const language = plan.language || settings.language;
    activeProgressLanguage = language;
    const projectContext = plan.projectContext || settings.projectContext || '';
    emittedProgress.clear();
    const { cmd, args, sessionId } = buildArgs(text, { verboseProgress, language, projectContext });
    const start = Date.now();
    const label = plan.label || settings.label;
    const { args: finalArgs, outputPath } = addCodexOutputCapture(args);
    log('Agent CLI start', label, cmd, finalArgs.slice(0, -1).join(' '), sessionId ? `resume=${sessionId}` : 'new-session', 'verbose', verboseProgress);
    if (verboseProgress) onProgress(agentProgressEvent(label, 'start', language));
    try {
      const { env: hermesEnv } = buildHermesSpawnOptions({ instanceEnv: env });
      const { stdout, stderr } = await execWithOptionalProgress(cmd, finalArgs, {
        timeout: resolveExecTimeout(plan.task ? settings.taskTimeoutMs : settings.chatTimeoutMs),
        maxBuffer: 4 * 1024 * 1024,
        env: { ...hermesEnv, PYTHONUNBUFFERED: '1' },
        cwd: plan.cwd || settings.cwd || process.cwd(),
        signal,
      }, verboseProgress);
      const codexLastMessage = readAndCleanupCodexOutput(outputPath);
      const combined = `${stdout || ''}\n${stderr || ''}`;
      const newSessionId = extractHermesSessionId(combined);
      if (newSessionId) {
        writeSessionId(newSessionId);
        log('Agent session saved', settings.backend, newSessionId);
      }
      log('Agent CLI done', label, 'ms', Date.now() - start);
      if (verboseProgress) onProgress(agentProgressEvent(label, 'done', language));
      const stdoutAnswer = sanitizeAgentOutput(codexLastMessage) || sanitizeAgentOutput(stdout) || sanitizeAgentOutput(stderr);
      if (stdoutAnswer) return createAgentRunResult({ status: 'ok', answer: stdoutAnswer, backend: settings.backend, label, elapsedMs: Date.now() - start, sessionId: newSessionId || sessionId });
      const sessionAnswer = readHermesSessionFinalAnswer(newSessionId || sessionId);
      if (sessionAnswer) {
        log('Agent answer recovered from Hermes session file', label, 'chars', sessionAnswer.length);
        return createAgentRunResult({ status: 'ok', answer: sessionAnswer, backend: settings.backend, label, elapsedMs: Date.now() - start, sessionId: newSessionId || sessionId, recoveredFromSession: true });
      }
      warn('Agent CLI produced empty sanitized answer', 'stdoutLen', stdout.length, 'stderrLen', stderr.length, 'stdoutTail', stdout.slice(-500), 'stderrTail', stderr.slice(-500));
      return createAgentRunResult({ status: 'empty', answer: emptyAgentMessage(language), backend: settings.backend, label, elapsedMs: Date.now() - start, sessionId: newSessionId || sessionId });
    } catch (e) {
      if (e?.name === 'AbortError' || e?.code === 'ABORT_ERR') throw e;
      const stderr = (e.stderr || '').toString().trim();
      const stdout = (e.stdout || '').toString().trim();
      const combined = `${stdout || ''}\n${stderr || ''}`;
      const codexLastMessage = readAndCleanupCodexOutput(outputPath);
      const newSessionId = extractHermesSessionId(combined);
      if (newSessionId) {
        writeSessionId(newSessionId);
        log('Agent session saved after failure', settings.backend, newSessionId);
      }
      const cleanedPartial = sanitizeAgentOutput(stdout) || sanitizeAgentOutput(stderr);
      const patchLikePartial = isPatchLikeOutput(cleanedPartial);
      const message = String(e.message || '');
      warn('Agent CLI failed', 'backend', settings.backend, 'label', label, 'ms', Date.now() - start, 'code', e.code, 'signal', e.signal, 'stdout', stdout.slice(-500), 'stderr', stderr.slice(-500), 'message', message.slice(-500));
      if ((e.signal === 'SIGINT' || e.signal === 'SIGTERM') && cleanedPartial && !patchLikePartial) {
        log('Agent CLI returned partial output after signal; using sanitized partial answer', 'chars', cleanedPartial.length);
        return createAgentRunResult({ status: 'partial', answer: cleanedPartial, backend: settings.backend, label, elapsedMs: Date.now() - start, sessionId: newSessionId || sessionId, error: { signal: e.signal } });
      }
      if (e.signal === 'SIGINT' || e.signal === 'SIGTERM') {
        return createAgentRunResult({ status: 'interrupted', answer: interruptedAgentMessage(label, patchLikePartial, language), backend: settings.backend, label, elapsedMs: Date.now() - start, sessionId: newSessionId || sessionId, error: { signal: e.signal } });
      }
      return createAgentRunResult({
        status: 'error',
        answer: failedAgentMessage(label, sanitizeAgentOutput(stderr || stdout || message || e.code || 'unknown error').slice(0, 700), language),
        backend: settings.backend,
        label,
        elapsedMs: Date.now() - start,
        sessionId: newSessionId || sessionId,
        error: { code: e.code, signal: e.signal },
      });
    }
  }

  async function ask(text, signal, plan = { task: true, label: settings.label }) {
    const result = await run(text, signal, plan);
    return result.answer;
  }

  return {
    backend: settings.backend,
    label: settings.label,
    capabilities,
    run,
    ask,
    buildArgs,
    readSessionId,
  };
}
