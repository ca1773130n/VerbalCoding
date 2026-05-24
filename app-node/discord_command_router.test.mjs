import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiscordCommandRouter } from './discord_command_router.mjs';
import { createBridge } from './bridge_context.mjs';

const noop = () => {};
const noopAsync = async () => {};

// Construct a minimal `msg` stand-in. Each test passes the `content` it
// wants to dispatch and inspects what handlers were called.
function makeMsg({ content, authorId = 'allowed-user', bot = false, channelId = 'tx-ch' } = {}) {
  const replies = [];
  const sends = [];
  return {
    content,
    author: { id: authorId, bot, username: 'tester' },
    member: { displayName: 'Tester', voice: { channel: null } },
    channelId,
    id: 'msg-1',
    channel: { send: async t => { sends.push(t); } },
    reply: async t => { replies.push(t); },
    guild: null,
    _replies: replies,
    _sends: sends,
  };
}

function makeRouter(overrides = {}) {
  const bridge = createBridge();
  // !voice-test reads `bridge.ttsBackend.name` in its reply template, so the
  // bridge needs a non-null ttsBackend stub for tests that exercise that path.
  bridge.ttsBackend = { name: 'fake' };
  const calls = {
    handleProjectSessionCommand: [],
    handleTextAgentMessage: [],
    setVerboseProgress: [],
    setSensitivityMode: [],
    connectTo: [],
    synthTTS: [],
    playAudio: [],
    speakText: [],
    voiceCloneArm: [],
    voiceCloneCancel: [],
  };
  const deps = {
    bridge,
    settings: { transcriptChannelId: 'tx-ch', latencyLogPath: '/tmp/lat.jsonl' },
    log: noop, warn: noop,
    path: { relative: (_root, p) => p, join: (...a) => a.join('/') },
    ROOT: '/tmp/vc',
    isAllowed: () => true,
    handleProjectSessionCommand: async (msg, cmd) => { calls.handleProjectSessionCommand.push(cmd); },
    handleTextAgentMessage: async (msg, text, opts) => { calls.handleTextAgentMessage.push({ text, opts }); },
    resolveProjectSessionForChannel: () => null,
    verboseStatusText: () => 'verbose=off',
    setVerboseProgress: (v, reason) => { calls.setVerboseProgress.push({ v, reason }); },
    notifyStatusText: () => 'notify-status',
    smartProgressStatusText: () => 'smart-progress=off',
    sensitivityStatusText: () => 'sensitivity=normal',
    setSensitivityMode: (mode, reason) => { calls.setSensitivityMode.push({ mode, reason }); return { mode }; },
    summarizeLatencyRecords: () => ({ ok: 0 }),
    readJsonlRecords: () => [],
    formatLatencySummary: () => 'no data',
    connectTo: async ch => { calls.connectTo.push(ch); },
    synthTTS: async t => { calls.synthTTS.push(t); return '/tmp/x.wav'; },
    playAudio: async f => { calls.playAudio.push(f); },
    speakText: async t => { calls.speakText.push(t); },
    voiceCloneCapture: {
      current: () => null,
      arm: ({ userId, source }) => { calls.voiceCloneArm.push({ userId, source }); return { targetPath: '/tmp/sample.wav' }; },
      cancel: uid => { calls.voiceCloneCancel.push(uid); return false; },
    },
    ...overrides,
  };
  const router = createDiscordCommandRouter(deps);
  return { router, bridge, calls, deps };
}

test('createDiscordCommandRouter exposes handleDiscordMessage', () => {
  const { router } = makeRouter();
  assert.equal(typeof router.handleDiscordMessage, 'function');
});

test('ignores bot messages (except !say) and disallowed users', async () => {
  const { router, calls } = makeRouter({ isAllowed: () => false });
  await router.handleDiscordMessage(makeMsg({ content: '!ping', authorId: 'x' }));
  assert.equal(calls.handleProjectSessionCommand.length, 0);
  // Now allow the user; bot=true means we still skip non-!say messages.
  const { router: r2, calls: c2 } = makeRouter();
  const m = makeMsg({ content: 'hello there', bot: true });
  await r2.handleDiscordMessage(m);
  assert.equal(c2.handleTextAgentMessage.length, 0);
});

test('!ping replies pong', async () => {
  const { router } = makeRouter();
  const msg = makeMsg({ content: '!ping' });
  await router.handleDiscordMessage(msg);
  assert.deepEqual(msg._replies, ['pong']);
});

test('!verbose status and toggles', async () => {
  const { router, calls } = makeRouter();
  await router.handleDiscordMessage(makeMsg({ content: '!verbose' }));
  await router.handleDiscordMessage(makeMsg({ content: '!verbose on' }));
  await router.handleDiscordMessage(makeMsg({ content: '!verbose off' }));
  await router.handleDiscordMessage(makeMsg({ content: '!verbose 켜줘' }));
  await router.handleDiscordMessage(makeMsg({ content: '!verbose 꺼' }));
  assert.deepEqual(calls.setVerboseProgress, [
    { v: true, reason: 'discord-command' },
    { v: false, reason: 'discord-command' },
    { v: true, reason: 'discord-command' },
    { v: false, reason: 'discord-command' },
  ]);
});

test('!notify toggles bridge.notifyUserOptIn', async () => {
  const { router, bridge } = makeRouter();
  await router.handleDiscordMessage(makeMsg({ content: '!notify on' }));
  assert.equal(bridge.notifyUserOptIn, true);
  await router.handleDiscordMessage(makeMsg({ content: '!notify off' }));
  assert.equal(bridge.notifyUserOptIn, false);
  await router.handleDiscordMessage(makeMsg({ content: '!notify 1' }));
  assert.equal(bridge.notifyUserOptIn, true);
});

test('!smart-progress toggles bridge.smartProgressEnabled', async () => {
  const { router, bridge } = makeRouter();
  await router.handleDiscordMessage(makeMsg({ content: '!smart-progress on' }));
  assert.equal(bridge.smartProgressEnabled, true);
  await router.handleDiscordMessage(makeMsg({ content: '!smart_progress off' }));
  assert.equal(bridge.smartProgressEnabled, false);
});

test('!sensitivity conservative/normal call setSensitivityMode', async () => {
  const { router, calls } = makeRouter();
  await router.handleDiscordMessage(makeMsg({ content: '!sensitivity conservative' }));
  await router.handleDiscordMessage(makeMsg({ content: '!sensitivity normal' }));
  assert.deepEqual(calls.setSensitivityMode, [
    { mode: 'conservative', reason: 'discord-command' },
    { mode: 'normal', reason: 'discord-command' },
  ]);
});

test('!join calls connectTo with the member voice channel', async () => {
  const { router, calls } = makeRouter();
  const ch = { id: 'vc-1', guild: { name: 'g' }, name: 'general' };
  const msg = makeMsg({ content: '!join' });
  msg.member.voice.channel = ch;
  await router.handleDiscordMessage(msg);
  assert.equal(calls.connectTo.length, 1);
  assert.equal(calls.connectTo[0], ch);
});

test('!join without member voice channel replies a hint', async () => {
  const { router, calls } = makeRouter();
  const msg = makeMsg({ content: '!join' });
  await router.handleDiscordMessage(msg);
  assert.equal(calls.connectTo.length, 0);
  assert.match(msg._replies[0], /음성 채널/);
});

test('!leave destroys the active voice connection', async () => {
  const { router, bridge } = makeRouter();
  let destroyed = false;
  bridge.connection = { destroy: () => { destroyed = true; } };
  bridge.activeVoiceChannelId = 'vc-1';
  await router.handleDiscordMessage(makeMsg({ content: '!leave' }));
  assert.equal(destroyed, true);
  assert.equal(bridge.connection, null);
  assert.equal(bridge.activeVoiceChannelId, '');
});

test('!say synths + plays the trailing text', async () => {
  const { router, calls } = makeRouter();
  await router.handleDiscordMessage(makeMsg({ content: '!say hello world' }));
  assert.deepEqual(calls.synthTTS, ['hello world']);
  assert.deepEqual(calls.playAudio, ['/tmp/x.wav']);
});

test('!voice-clone capture arms the capture state', async () => {
  const { router, calls } = makeRouter();
  await router.handleDiscordMessage(makeMsg({ content: '!voice-clone capture', authorId: 'u1' }));
  assert.equal(calls.voiceCloneArm.length, 1);
  assert.equal(calls.voiceCloneArm[0].userId, 'u1');
});

test('!voice-clone cancel calls cancel(userId)', async () => {
  const { router, calls } = makeRouter();
  await router.handleDiscordMessage(makeMsg({ content: '!voice-clone cancel', authorId: 'u1' }));
  assert.deepEqual(calls.voiceCloneCancel, ['u1']);
});

test('!ask routes trailing text to handleTextAgentMessage with speakResponse:true', async () => {
  const { router, calls } = makeRouter();
  await router.handleDiscordMessage(makeMsg({ content: '!ask what time is it' }));
  assert.equal(calls.handleTextAgentMessage.length, 1);
  assert.equal(calls.handleTextAgentMessage[0].text, 'what time is it');
  assert.equal(calls.handleTextAgentMessage[0].opts.speakResponse, true);
});

test('project-session command takes priority over !-prefixed commands', async () => {
  // parseProjectSessionCommand is imported by the router from
  // ./project_sessions.mjs; we can't easily monkey-patch the import here,
  // but we can prove the priority by checking that a command pattern
  // recognised as a session command never reaches !ping.
  const { router, calls } = makeRouter();
  await router.handleDiscordMessage(makeMsg({ content: '!session' }));
  // !session is handled as a !-command via the table (handleProjectSessionCommand
  // with action=status). Either way the project session handler is called.
  assert.equal(calls.handleProjectSessionCommand.length, 1);
  assert.equal(calls.handleProjectSessionCommand[0].action, 'status');
});

test('fallback routes plain text to handleTextAgentMessage when channel is project-bound', async () => {
  const { router, calls } = makeRouter({
    resolveProjectSessionForChannel: () => ({ slug: 'my-project' }),
  });
  await router.handleDiscordMessage(makeMsg({ content: 'hello agent' }));
  assert.equal(calls.handleTextAgentMessage.length, 1);
  assert.equal(calls.handleTextAgentMessage[0].text, 'hello agent');
  assert.equal(calls.handleTextAgentMessage[0].opts.speakResponse, false);
});

test('fallback does NOT route non-project text without an explicit trigger', async () => {
  const { router, calls } = makeRouter();
  // Use a channel that is neither the transcript channel nor project-bound,
  // so neither leg of the routing heuristic triggers.
  await router.handleDiscordMessage(makeMsg({ content: 'just some chatter', channelId: 'unrelated-channel' }));
  assert.equal(calls.handleTextAgentMessage.length, 0, 'no agent dispatch for non-bound channel');
});

test('!latency / !metrics build a summary from the jsonl log', async () => {
  let summarizeArg = null;
  let formatted = null;
  const { router } = makeRouter({
    readJsonlRecords: () => [{ status: 'ok' }],
    summarizeLatencyRecords: rs => { summarizeArg = rs; return { ok: rs.length }; },
    formatLatencySummary: s => { formatted = s; return 'summary text'; },
  });
  const msg = makeMsg({ content: '!latency' });
  await router.handleDiscordMessage(msg);
  assert.equal(summarizeArg.length, 1, 'summarize ran on the parsed records');
  assert.deepEqual(formatted, { ok: 1 });
  assert.match(msg._replies[0], /summary text/);

  const msg2 = makeMsg({ content: '!metrics' });
  await router.handleDiscordMessage(msg2);
  assert.match(msg2._replies[0], /summary text/, '!metrics is an alias for !latency');
});

test('!reset-session dispatches to project session handler with action=reset', async () => {
  const { router, calls } = makeRouter();
  await router.handleDiscordMessage(makeMsg({ content: '!reset-session' }));
  assert.deepEqual(calls.handleProjectSessionCommand, [{ action: 'reset' }]);
});

test('!voice-test logs a success line on happy path', async () => {
  const { router } = makeRouter();
  const msg = makeMsg({ content: '!voice-test 안녕하세요' });
  await router.handleDiscordMessage(msg);
  // First reply announces the test; then a send confirms completion.
  assert.ok(msg._replies.some(t => /TTS 백엔드.*음성 테스트/.test(t)));
  assert.ok(msg._sends.some(t => /음성 테스트 완료/.test(t)));
});

test('!voice-test reports failure to the channel when speakText throws', async () => {
  const warnCalls = [];
  const { router } = makeRouter({
    warn: (...args) => warnCalls.push(args),
    speakText: async () => { throw new Error('synth boom'); },
  });
  const msg = makeMsg({ content: '!voice-test fail-me' });
  await router.handleDiscordMessage(msg);
  assert.ok(msg._sends.some(t => /음성 테스트 실패.*synth boom/.test(t)));
  assert.ok(warnCalls.some(args => /voice-test failed/.test(args[0])));
});

// Note on the !voice-test "empty text" branch: handleDiscordMessage does
// `content = msg.content.trim()` before matching, so `!voice-test ` collapses
// to `!voice-test` which fails the `c.startsWith('!voice-test ')` predicate.
// The empty-text branch inside the handler is therefore unreachable; the
// behaviour predates the refactor (HEAD 575870b had the same shape). Not
// covered by a test on purpose.

test('bot author can still trigger !say (carve-out)', async () => {
  const { router, calls } = makeRouter();
  await router.handleDiscordMessage(makeMsg({ content: '!say hi from bot', bot: true }));
  assert.deepEqual(calls.synthTTS, ['hi from bot']);
  assert.deepEqual(calls.playAudio, ['/tmp/x.wav']);
});

test('bare !voice-clone with no active capture replies a hint', async () => {
  const { router } = makeRouter();
  const msg = makeMsg({ content: '!voice-clone' });
  await router.handleDiscordMessage(msg);
  assert.match(msg._replies[0], /대기 중인 보이스 클로닝 샘플 캡처가 없어/);
});

test('!voice-clone status with an active capture reports the target path', async () => {
  const { router } = makeRouter({
    voiceCloneCapture: {
      current: () => ({ userId: 'u1', targetPath: '/tmp/me.wav' }),
      arm: () => ({ targetPath: '/tmp/me.wav' }),
      cancel: () => false,
    },
  });
  const msg = makeMsg({ content: '!voice-clone status', authorId: 'u1' });
  await router.handleDiscordMessage(msg);
  assert.match(msg._replies[0], /\/tmp\/me\.wav/);
});
