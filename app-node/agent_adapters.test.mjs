import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAgentSettings,
  createAgentAdapter,
  extractVerboseProgressEvents,
  interruptedAgentMessage,
  isPatchLikeOutput,
  resolveExecTimeout,
  sanitizeAgentOutput,
  voiceBridgePrompt,
} from './agent_adapters.mjs';
import { assertAgentAdapterContract } from './agent_contract.mjs';

test('buildAgentSettings defaults to Hermes backend and uses VerbalCoding session file', () => {
  const settings = buildAgentSettings({ ROOT: '/project', env: {} });

  assert.equal(settings.backend, 'hermes');
  assert.equal(settings.label, 'Hermes Agent');
  assert.equal(settings.command, 'hermes chat -Q -q');
  assert.equal(settings.sessionFile, '/project/.verbalcoding-session');
  assert.equal(settings.cwd, '/project');
  assert.equal(settings.taskTimeoutMs, 0);
});

test('Hermes adapter resumes and saves Hermes CLI session ids', async () => {
  const calls = [];
  const files = new Map([['/tmp/hermes-session', 'old-session\n']]);
  const adapter = createAgentAdapter({
    backend: 'hermes',
    label: 'Hermes Agent',
    command: 'hermes chat -Q -q',
    sessionFile: '/tmp/hermes-session',
    taskTimeoutMs: 300000,
    chatTimeoutMs: 45000,
  }, {
    readFileSync: path => files.get(path),
    writeFileSync: (path, value) => files.set(path, value),
    execFileAsync: async (cmd, args) => {
      calls.push({ cmd, args });
      return { stdout: '좋아, 처리했어.\n', stderr: 'session_id: new-session\n' };
    },
    log: () => {},
    warn: () => {},
  });

  const answer = await adapter.ask('테스트해줘');

  assert.equal(answer, '좋아, 처리했어.');
  assert.equal(calls[0].cmd, 'hermes');
  assert.deepEqual(calls[0].args.slice(0, 5), ['chat', '-Q', '--resume', 'old-session', '-q']);
  assert.match(calls[0].args.at(-1), /Discord 음성 대화로 들어온 사용자 발화다/);
  assert.match(calls[0].args.at(-1), /테스트해줘/);
  assert.equal(files.get('/tmp/hermes-session'), 'new-session\n');
  assert.equal(assertAgentAdapterContract(adapter), true);
  assert.equal(adapter.capabilities.supportsSessionResume, true);
});

test('adapter passes project context prompt and cwd for project sessions', async () => {
  const calls = [];
  const adapter = createAgentAdapter({
    backend: 'hermes',
    label: 'Hermes Agent · Wiki',
    command: 'hermes chat -Q -q',
    sessionFile: '/tmp/wiki-session',
    cwd: '/tmp/wiki-workdir',
    taskTimeoutMs: 300000,
    chatTimeoutMs: 45000,
  }, {
    readFileSync: () => '',
    writeFileSync: () => {},
    execFileAsync: async (cmd, args, options) => {
      calls.push({ cmd, args, options });
      return { stdout: '처리했어.\n', stderr: 'session_id: wiki-session\n' };
    },
    log: () => {},
    warn: () => {},
  });

  const result = await adapter.run('프로젝트 상태 봐줘', undefined, {
    language: 'ko',
    projectContext: 'Project session: Wiki\nWorking directory: /tmp/wiki-workdir\nMCP/project context: wiki graph',
  });

  assert.equal(result.answer, '처리했어.');
  assert.equal(calls[0].options.cwd, '/tmp/wiki-workdir');
  assert.match(calls[0].args.at(-1), /Project session: Wiki/);
  assert.match(calls[0].args.at(-1), /MCP\/project context: wiki graph/);
});

test('buildAgentSettings accepts per-instance AGENT_CWD and AGENT_PROJECT_CONTEXT aliases', () => {
  const settings = buildAgentSettings({ ROOT: '/repo', env: {
    AGENT_BACKEND: 'hermes',
    AGENT_CWD: '/repo/llm-wiki',
    AGENT_PROJECT_CONTEXT: 'Project session: LLM-Wiki',
  } });

  assert.equal(settings.cwd, '/repo/llm-wiki');
  assert.equal(settings.projectContext, 'Project session: LLM-Wiki');
});

test('adapter uses default project context from settings when plan omits it', async () => {
  const calls = [];
  const adapter = createAgentAdapter({
    backend: 'codex',
    label: 'Codex · Wiki',
    command: 'codex exec',
    sessionFile: '/tmp/codex-session',
    cwd: '/tmp/wiki-workdir',
    projectContext: 'Project session: LLM-Wiki',
    taskTimeoutMs: 300000,
    chatTimeoutMs: 45000,
  }, {
    execFileAsync: async (cmd, args, options) => {
      calls.push({ cmd, args, options });
      return { stdout: 'done\n', stderr: '' };
    },
    log: () => {},
    warn: () => {},
  });

  await adapter.run('status?', undefined, { language: 'en' });
  assert.equal(calls[0].options.cwd, '/tmp/wiki-workdir');
  assert.match(calls[0].args.at(-1), /Project session: LLM-Wiki/);
});

test('adapter run returns formal result while ask keeps string compatibility', async () => {
  const adapter = createAgentAdapter({
    backend: 'hermes',
    label: 'Hermes Agent',
    command: 'hermes chat -Q -q',
    sessionFile: '/tmp/hermes-session',
    taskTimeoutMs: 300000,
    chatTimeoutMs: 45000,
  }, {
    readFileSync: () => '',
    writeFileSync: () => {},
    execFileAsync: async () => ({ stdout: 'Done.\n', stderr: 'session_id: new-session\n' }),
    log: () => {},
    warn: () => {},
  });

  const result = await adapter.run({ text: 'do it' }, undefined, { language: 'en' });
  assert.equal(result.contractVersion, 1);
  assert.equal(result.status, 'ok');
  assert.equal(result.answer, 'Done.');
  assert.equal(result.backend, 'hermes');
  assert.equal(result.sessionId, 'new-session');
  assert.equal(await adapter.ask('do it', undefined, { language: 'en' }), 'Done.');
});

test('Hermes verbose progress drops quiet flag and parses rich CLI final response', async () => {
  const calls = [];
  const progress = [];
  const files = new Map([['/tmp/hermes-session', 'old-session\n']]);
  const adapter = createAgentAdapter({
    backend: 'hermes',
    label: 'Hermes Agent',
    command: 'hermes chat -Q -q',
    sessionFile: '/tmp/hermes-session',
    taskTimeoutMs: 300000,
    chatTimeoutMs: 45000,
  }, {
    readFileSync: path => files.get(path),
    writeFileSync: (path, value) => files.set(path, value),
    spawn: (_cmd, args) => {
      calls.push({ args });
      const listeners = {};
      const child = {
        stdout: { on: (event, cb) => { listeners[`stdout:${event}`] = cb; } },
        stderr: { on: (event, cb) => { listeners[`stderr:${event}`] = cb; } },
        on: (event, cb) => { listeners[event] = cb; },
        kill: () => {},
      };
      queueMicrotask(() => {
        listeners['stdout:data']?.(Buffer.from('  ┊ 💻 $         terminal  0.8s\n'));
        listeners['stdout:data']?.(Buffer.from('╭─ ⚕ Hermes ─╮\n    완료했어.\n╰────────────╯\n\nSession: new-session\n'));
        listeners.close?.(0, null);
      });
      return child;
    },
    execFileAsync: async () => { throw new Error('spawn should be used for verbose progress'); },
    onProgress: event => progress.push(event),
    log: () => {},
    warn: () => {},
  });

  const answer = await adapter.ask('테스트해줘', undefined, { verboseProgress: true });

  assert.equal(calls[0].args.includes('-Q'), false);
  assert.deepEqual(calls[0].args.slice(0, 4), ['chat', '--resume', 'old-session', '-q']);
  assert.equal(answer, '완료했어.');
  assert.equal(files.get('/tmp/hermes-session'), 'new-session\n');
  assert.ok(progress.includes('Hermes Agent 호출 시작'));
  assert.ok(progress.includes('터미널 도구 사용 terminal'));
});

test('Hermes verbose progress uses English lifecycle events when language is English', async () => {
  const progress = [];
  const adapter = createAgentAdapter({
    backend: 'hermes',
    label: 'Hermes Agent',
    command: 'hermes chat -Q -q',
    sessionFile: '/tmp/hermes-session',
    taskTimeoutMs: 300000,
    chatTimeoutMs: 45000,
  }, {
    readFileSync: () => '',
    writeFileSync: () => {},
    spawn: () => {
      const listeners = {};
      const child = {
        stdout: { on: (event, cb) => { listeners[`stdout:${event}`] = cb; } },
        stderr: { on: (event, cb) => { listeners[`stderr:${event}`] = cb; } },
        on: (event, cb) => { listeners[event] = cb; },
        kill: () => {},
      };
      queueMicrotask(() => {
        listeners['stdout:data']?.(Buffer.from('╭─ ⚕ Hermes ─╮\n    Done.\n╰────────────╯\n'));
        listeners.close?.(0, null);
      });
      return child;
    },
    execFileAsync: async () => { throw new Error('spawn should be used'); },
    onProgress: event => progress.push(event),
    log: () => {},
    warn: () => {},
  });

  const answer = await adapter.ask('do it', undefined, { verboseProgress: true, language: 'en' });

  assert.equal(answer, 'Done.');
  assert.ok(progress.includes('calling the agent Hermes Agent'));
  assert.ok(progress.includes('received agent response Hermes Agent'));
});

test('Hermes adapter falls back to saved session final answer when verbose CLI output omits it', async () => {
  const files = new Map([
    ['/tmp/hermes-session', 'old-session\n'],
    ['/tmp/hermes-sessions/session_new-session.json', JSON.stringify({
      messages: [
        { role: 'user', content: '질문' },
        { role: 'assistant', content: 'VERBALCODING_PROGRESS: 로그 확인' },
        { role: 'assistant', content: '실제 최종 답변이야.' },
      ],
    })],
  ]);
  const adapter = createAgentAdapter({
    backend: 'hermes',
    label: 'Hermes Agent',
    command: 'hermes chat -Q -q',
    sessionFile: '/tmp/hermes-session',
    taskTimeoutMs: 300000,
    chatTimeoutMs: 45000,
  }, {
    hermesSessionsDir: '/tmp/hermes-sessions',
    readFileSync: path => files.get(path),
    writeFileSync: (path, value) => files.set(path, value),
    spawn: (_cmd, _args) => {
      const listeners = {};
      const child = {
        stdout: { on: (event, cb) => { listeners[`stdout:${event}`] = cb; } },
        stderr: { on: (event, cb) => { listeners[`stderr:${event}`] = cb; } },
        on: (event, cb) => { listeners[event] = cb; },
        kill: () => {},
      };
      queueMicrotask(() => {
        listeners['stdout:data']?.(Buffer.from('VERBALCODING_PROGRESS: 로그 확인\nSession: new-session\n'));
        listeners.close?.(0, null);
      });
      return child;
    },
    execFileAsync: async () => { throw new Error('spawn should be used'); },
    log: () => {},
    warn: () => {},
  });

  const answer = await adapter.ask('분석해줘', undefined, { verboseProgress: true });

  assert.equal(answer, '실제 최종 답변이야.');
});

test('Claude, Codex, and Gemini adapters use backend-specific default commands without Hermes resume', async () => {
  const cases = [
    { backend: 'claude', command: ['claude', '-p'], label: 'Claude Code' },
    { backend: 'codex', command: ['codex', 'exec'], label: 'Codex' },
    { backend: 'gemini', command: ['gemini', '-p'], label: 'Gemini' },
    { backend: 'opencode', command: ['opencode', 'run'], label: 'OpenCode' },
    { backend: 'openclaw', command: ['openclaw', 'run'], label: 'OpenClaw' },
  ];

  for (const item of cases) {
    const calls = [];
    const settings = buildAgentSettings({ ROOT: '/project', env: { AGENT_BACKEND: item.backend } });
    assert.equal(settings.label, item.label);

    const adapter = createAgentAdapter(settings, {
      execFileAsync: async (cmd, args) => {
        calls.push({ cmd, args });
        return { stdout: `${item.label} 응답\n`, stderr: '' };
      },
      log: () => {},
      warn: () => {},
    });

    const answer = await adapter.ask('작업해줘');

    assert.equal(answer, `${item.label} 응답`);
    assert.equal(calls[0].cmd, item.command[0]);
    assert.deepEqual(calls[0].args.slice(0, item.command.length - 1), item.command.slice(1));
    assert.equal(calls[0].args.includes('--resume'), false);
    assert.match(calls[0].args.at(-1), /작업해줘/);
  }
});

test('custom adapter uses AGENT_COMMAND and AGENT_LABEL', async () => {
  const settings = buildAgentSettings({
    ROOT: '/project',
    env: { AGENT_BACKEND: 'custom', AGENT_COMMAND: 'my-agent --ask', AGENT_LABEL: 'My Agent' },
  });
  const calls = [];
  const adapter = createAgentAdapter(settings, {
    execFileAsync: async (cmd, args) => {
      calls.push({ cmd, args });
      return { stdout: '완료\n', stderr: '' };
    },
    log: () => {},
    warn: () => {},
  });

  const answer = await adapter.ask('해줘');

  assert.equal(settings.label, 'My Agent');
  assert.equal(answer, '완료');
  assert.equal(calls[0].cmd, 'my-agent');
  assert.deepEqual(calls[0].args.slice(0, -1), ['--ask']);
});

test('sanitizeAgentOutput strips CLI metadata from spoken/text answer', () => {
  assert.equal(
    sanitizeAgentOutput('↻ Resumed session abc\nsession_id: xyz\n진짜 답변\n'),
    '진짜 답변',
  );
  assert.equal(
    sanitizeAgentOutput('╭─ ⚕ Hermes ─╮\n    박스 답변\n╰────────────╯\nSession: abc\n'),
    '박스 답변',
  );
});

test('voiceBridgePrompt keeps voice-specific operating instructions with user text', () => {
  const prompt = voiceBridgePrompt('파일 수정해줘');

  assert.match(prompt, /Discord 음성 대화/);
  assert.match(prompt, /파일 수정, 실행, 로그 확인/);
  assert.match(prompt, /파일 수정해줘/);
});

test('voiceBridgePrompt adds optional verbose progress instructions only when enabled', () => {
  const normal = voiceBridgePrompt('파일 수정해줘');
  const verbose = voiceBridgePrompt('파일 수정해줘', { verboseProgress: true });

  assert.doesNotMatch(normal, /VERBALCODING_PROGRESS/);
  assert.match(verbose, /VERBALCODING_PROGRESS/);
  assert.match(verbose, /파일 읽기|웹 검색|터미널 실행|툴 사용/);
});

test('voiceBridgePrompt uses English instructions and progress language when requested', () => {
  const prompt = voiceBridgePrompt('test this', { verboseProgress: true, language: 'en' });

  assert.match(prompt, /Answer in English/);
  assert.match(prompt, /VERBALCODING_PROGRESS: reading files/);
  assert.doesNotMatch(prompt, /짧은 한국어 단계/);
});

test('extractVerboseProgressEvents summarizes tool activity without leaking raw logs', () => {
  const events = extractVerboseProgressEvents([
    'VERBALCODING_PROGRESS: 파일 읽기 app-node/main.mjs',
    'Calling tool functions.web_search with query secret token abcdef',
    'tool_use: terminal command="npm test"',
    'Calling tool functions.skill_view with name discord-voice-hermes-bridge',
    '  ┊ 🔎           web_search  1.2s',
    'unrelated verbose log line that should not be included',
  ].join('\n'));

  assert.deepEqual(events, [
    '파일 읽기 app-node/main.mjs',
    '웹 검색 실행',
    '터미널 명령 실행',
    '스킬 사용',
  ]);
});

test('resolveExecTimeout disables timeout for zero or invalid task timeout values', () => {
  assert.equal(resolveExecTimeout(0), undefined);
  assert.equal(resolveExecTimeout(-1), undefined);
  assert.equal(resolveExecTimeout(Infinity), undefined);
  assert.equal(resolveExecTimeout(45000), 45000);
});

test('signal failure with patch-like output returns a concise interruption message instead of diff', async () => {
  const adapter = createAgentAdapter({
    backend: 'hermes',
    label: 'Hermes Agent',
    command: 'hermes chat -Q -q',
    sessionFile: '/tmp/hermes-session',
    taskTimeoutMs: 1,
    chatTimeoutMs: 1,
  }, {
    readFileSync: () => '',
    writeFileSync: () => {},
    execFileAsync: async () => {
      const err = new Error('Command failed');
      err.signal = 'SIGINT';
      err.stdout = '┊ review diff\na/file → b/file\n@@ -1 +1 @@\n-old\n+new\n+more\n+more\n+more\n+more\n+more\n+more\n+more\n+more\n';
      err.stderr = '';
      throw err;
    },
    log: () => {},
    warn: () => {},
  });

  const answer = await adapter.ask('수정해줘');

  assert.equal(isPatchLikeOutput('┊ review diff\na/file → b/file\n@@ -1 +1 @@\n-old\n+new'), true);
  assert.equal(answer, interruptedAgentMessage('Hermes Agent', true));
  assert.doesNotMatch(answer, /@@|review diff|old|new/);
});
