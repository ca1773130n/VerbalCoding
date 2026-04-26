import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAgentSettings,
  createAgentAdapter,
  interruptedAgentMessage,
  isPatchLikeOutput,
  sanitizeAgentOutput,
  voiceBridgePrompt,
} from './agent_adapters.mjs';

test('buildAgentSettings defaults to Hermes backend and uses MouthCode session file', () => {
  const settings = buildAgentSettings({ ROOT: '/project', env: {} });

  assert.equal(settings.backend, 'hermes');
  assert.equal(settings.label, 'Hermes Agent');
  assert.equal(settings.command, 'hermes chat -Q -q');
  assert.equal(settings.sessionFile, '/project/.mouthcode-session');
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
});

test('voiceBridgePrompt keeps voice-specific operating instructions with user text', () => {
  const prompt = voiceBridgePrompt('파일 수정해줘');

  assert.match(prompt, /Discord 음성 대화/);
  assert.match(prompt, /파일 수정, 실행, 로그 확인/);
  assert.match(prompt, /파일 수정해줘/);
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
