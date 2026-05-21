import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  bindProjectSessionToChannel,
  createProjectSession,
  loadProjectSessions,
  parseNaturalVoiceAttachCommand,
  parseProjectSessionCommand,
  projectSessionContextText,
  projectSessionForChannel,
  saveProjectSessions,
  slugifySessionName,
} from './project_sessions.mjs';

const __tempRoots = [];
test.after(() => {
  for (const root of __tempRoots) try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
});

test('project sessions map Discord text and voice channel ids to isolated Hermes session files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-sessions-'));
  __tempRoots.push(root);
  const state = loadProjectSessions(path.join(root, 'sessions.json'));
  const session = createProjectSession({ root, state, name: 'LLM Wiki', workdir: '/tmp/llm-wiki', channelId: 'text-1', voiceChannelId: 'voice-1', mcpContext: 'llm-wiki graph' });
  assert.equal(session.slug, 'llm-wiki');
  assert.equal(session.voiceChannelId, 'voice-1');
  assert.equal(session.sessionFile, path.join(root, '.agent-sessions', 'hermes', 'llm-wiki.session'));
  assert.equal(projectSessionForChannel(state, 'text-1').name, 'LLM Wiki');
  assert.equal(projectSessionForChannel(state, 'voice-1').name, 'LLM Wiki');
  assert.match(projectSessionContextText(session), /Working directory: \/tmp\/llm-wiki/);
});

test('project sessions persist and can be rebound to another channel', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-sessions-persist-'));
  __tempRoots.push(root);
  const configPath = path.join(root, 'sessions.json');
  const state = loadProjectSessions(configPath);
  createProjectSession({ root, state, name: 'Other Project', workdir: root, channelId: 'a' });
  saveProjectSessions(configPath, state);
  const loaded = loadProjectSessions(configPath);
  bindProjectSessionToChannel({ state: loaded, nameOrSlug: 'other-project', channelId: 'b' });
  assert.equal(projectSessionForChannel(loaded, 'b').name, 'Other Project');
});

test('project session command parser supports new/use/status/list/reset', () => {
  assert.deepEqual(parseProjectSessionCommand('!session new wiki /tmp/wiki graph'), {
    action: 'new', name: 'wiki', workdir: '/tmp/wiki', mcpContext: 'graph', voice: '',
  });
  assert.deepEqual(parseProjectSessionCommand('!project-session use wiki'), { action: 'use', name: 'wiki', voice: '' });
  assert.equal(parseProjectSessionCommand('!session status').action, 'status');
  assert.equal(slugifySessionName('한글 Project!'), '한글-project');
});

test('project session command parser supports explicit voice channel selection', () => {
  assert.deepEqual(parseProjectSessionCommand('!session new wiki /tmp/wiki graph --voice "LLM Wiki Voice"'), {
    action: 'new', name: 'wiki', workdir: '/tmp/wiki', mcpContext: 'graph', voice: 'LLM Wiki Voice',
  });
  assert.deepEqual(parseProjectSessionCommand('!session use wiki --voice=LLM-Voice'), {
    action: 'use', name: 'wiki', voice: 'LLM-Voice',
  });
  assert.deepEqual(parseProjectSessionCommand('!session attach-voice --voice "LLM-Wiki"'), {
    action: 'attach-voice', name: '', voice: 'LLM-Wiki',
  });
  assert.deepEqual(parseProjectSessionCommand('!session voice LLM-Wiki'), {
    action: 'attach-voice', name: '', voice: 'LLM-Wiki',
  });
  assert.deepEqual(parseProjectSessionCommand('!session voice llm-wiki --voice "LLM-Wiki"'), {
    action: 'attach-voice', name: 'llm-wiki', voice: 'LLM-Wiki',
  });
});

test('project session parser treats natural voice attach requests as control commands', () => {
  assert.deepEqual(parseProjectSessionCommand('이 쓰레드에 음성 채널 붙여줘'), {
    action: 'attach-voice', voice: '',
  });
  assert.deepEqual(parseNaturalVoiceAttachCommand('보이스 세션 연결해줘 --voice "LLM Wiki"'), {
    action: 'attach-voice', voice: 'LLM Wiki',
  });
  assert.equal(parseNaturalVoiceAttachCommand('음성 채널 상태가 어때?'), null);
});
