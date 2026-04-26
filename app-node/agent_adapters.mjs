import fs from 'node:fs';
import path from 'node:path';

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

export function voiceBridgePrompt(text) {
  return [
    'Discord 음성 대화로 들어온 사용자 발화다.',
    '단순 대화/상태 질문이면 도구를 쓰지 말고 1~3문장으로 바로 한국어 답변해라.',
    '파일 수정, 실행, 로그 확인, 검색 같은 실제 작업 지시일 때만 필요한 도구를 사용해라.',
    '코드 변경을 수행했다면 음성 답변에는 diff나 코드 전문을 읽지 말고, 작업 결과와 다음 확인 사항만 짧게 말해라.',
    'CLI 메타정보나 session_id는 답변에 포함하지 마라.',
    '',
    text,
  ].join('\n');
}

export function sanitizeAgentOutput(text) {
  return String(text || '')
    .split(/\r?\n/)
    .filter(line => !/^session_id:\s*\S+\s*$/.test(line.trim()))
    .filter(line => !/^↻\s*Resumed session\s+\S+/.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

export function interruptedAgentMessage(label, hadPatchLikeOutput = false) {
  if (hadPatchLikeOutput) {
    return `${label} 작업이 제한 시간에 걸렸고 코드 diff 출력이 감지됐어. diff는 음성으로 읽지 않을게. 변경 파일과 테스트 상태를 확인해서 이어서 정리할게.`;
  }
  return `${label} 작업이 제한 시간이나 끼어들기로 중단됐어. 출력이 비어 있어서 결과를 확인하지 못했어.`;
}

export function extractHermesSessionId(text) {
  return /^session_id:\s*(\S+)/m.exec(text || '')?.[1] || null;
}

export function buildAgentSettings({ ROOT, env = process.env } = {}) {
  const root = ROOT || process.cwd();
  const backend = String(env.AGENT_BACKEND || env.AGENT_PROVIDER || 'hermes').trim().toLowerCase();
  const defaults = {
    hermes: {
      label: 'Hermes Agent',
      command: env.HERMES_COMMAND || 'hermes chat -Q -q',
      sessionFile: env.HERMES_SESSION_FILE || path.join(root, '.hermes-discord-session'),
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
    taskTimeoutMs: Number(env.AGENT_TASK_TIMEOUT_MS || env.HERMES_TASK_TIMEOUT_MS || '300000'),
    chatTimeoutMs: Number(env.AGENT_CHAT_TIMEOUT_MS || env.HERMES_CHAT_TIMEOUT_MS || '45000'),
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

  function buildArgs(text) {
    const argv = shellSplit(settings.command);
    const cmd = argv[0];
    const query = voiceBridgePrompt(text);
    let args = argv.slice(1).concat([query]);
    const sessionId = readSessionId();
    if (sessionId) {
      const qIndex = args.lastIndexOf('-q');
      const insertAt = qIndex >= 0 ? qIndex : args.length - 1;
      args = args.slice(0, insertAt).concat(['--resume', sessionId], args.slice(insertAt));
    }
    return { cmd, args, sessionId };
  }

  async function ask(text, signal, plan = { task: true, label: settings.label }) {
    const { cmd, args, sessionId } = buildArgs(text);
    const start = Date.now();
    const label = plan.label || settings.label;
    log('Agent CLI start', label, cmd, args.slice(0, -1).join(' '), sessionId ? `resume=${sessionId}` : 'new-session');
    try {
      const { stdout, stderr } = await execFileAsync(cmd, args, {
        timeout: plan.task ? settings.taskTimeoutMs : settings.chatTimeoutMs,
        maxBuffer: 4 * 1024 * 1024,
        env: { ...env, PYTHONUNBUFFERED: '1' },
        signal,
      });
      const combined = `${stdout || ''}\n${stderr || ''}`;
      const newSessionId = extractHermesSessionId(combined);
      if (newSessionId) {
        writeSessionId(newSessionId);
        log('Agent session saved', settings.backend, newSessionId);
      }
      log('Agent CLI done', label, 'ms', Date.now() - start);
      return sanitizeAgentOutput(stdout) || sanitizeAgentOutput(stderr) || '응답이 비어 있어.';
    } catch (e) {
      if (e?.name === 'AbortError' || e?.code === 'ABORT_ERR') throw e;
      const stderr = (e.stderr || '').toString().trim();
      const stdout = (e.stdout || '').toString().trim();
      const msg = (e.message || '').toString().trim();
      const combined = `${stdout || ''}\n${stderr || ''}`;
      const newSessionId = extractHermesSessionId(combined);
      if (newSessionId) {
        writeSessionId(newSessionId);
        log('Agent session saved after failure', settings.backend, newSessionId);
      }
      const cleanedPartial = sanitizeAgentOutput(stdout) || sanitizeAgentOutput(stderr);
      const patchLikePartial = isPatchLikeOutput(cleanedPartial);
      warn('Agent CLI failed', 'backend', settings.backend, 'label', label, 'ms', Date.now() - start, 'code', e.code, 'signal', e.signal, 'stdout', stdout.slice(-500), 'stderr', stderr.slice(-500), 'message', msg.slice(-500));
      if ((e.signal === 'SIGINT' || e.signal === 'SIGTERM') && cleanedPartial && !patchLikePartial) {
        log('Agent CLI returned partial output after signal; using sanitized partial answer', 'chars', cleanedPartial.length);
        return cleanedPartial;
      }
      if (e.signal === 'SIGINT' || e.signal === 'SIGTERM') {
        return interruptedAgentMessage(label, patchLikePartial);
      }
      return `${label} 실행에 실패했어: ${sanitizeAgentOutput(stderr || stdout || msg || e.code || 'unknown error').slice(0, 700)}`;
    }
  }

  return {
    backend: settings.backend,
    label: settings.label,
    ask,
    buildArgs,
    readSessionId,
  };
}
