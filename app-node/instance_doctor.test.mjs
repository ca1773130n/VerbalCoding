import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { checkInstanceConfigs, tokenFingerprint } from './instance_doctor.mjs';

const __tempRoots = [];
test.after(() => {
  for (const root of __tempRoots) try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
});

function tempRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-instance-doctor-'));
  fs.mkdirSync(path.join(root, 'instances'), { recursive: true });
  __tempRoots.push(root);
  return root;
}

function writeInstance(root, name, content) {
  fs.writeFileSync(path.join(root, 'instances', `${name}.env`), content);
}

test('tokenFingerprint is stable and does not expose token contents', () => {
  const fp = tokenFingerprint('super-secret-token');
  assert.match(fp, /^[a-f0-9]{12}$/);
  assert.equal(fp, tokenFingerprint('super-secret-token'));
  assert.equal(fp.includes('secret'), false);
});

test('checkInstanceConfigs returns no issues when no instance env files exist', () => {
  const root = tempRepo();
  const result = checkInstanceConfigs(root);
  assert.deepEqual(result, { errors: [], warnings: [], instances: [] });
});

test('checkInstanceConfigs requires token, voice channel, transcript target, and isolated runtime paths', () => {
  const root = tempRepo();
  writeInstance(root, 'llm-wiki', 'DISCORD_TOKEN=token-a\nAUTO_JOIN_VOICE_CHANNELS=LLM-Wiki\nTRANSCRIPT_CHANNEL_ID=111\nPROJECT_SESSIONS_FILE=config/llm.json\nBRIDGE_LOG_PATH=/tmp/llm.log\nNODE_AUDIO_DEBUG_DIR=/tmp/llm-debug\nHERMES_SESSION_FILE=.agent-sessions/llm.session\n');
  writeInstance(root, 'bad', 'DISCORD_TOKEN=\nAUTO_JOIN_VOICE_CHANNELS=\nTRANSCRIPT_CHANNEL_ID=\nPROJECT_SESSIONS_FILE=config/llm.json\nBRIDGE_LOG_PATH=/tmp/llm.log\nNODE_AUDIO_DEBUG_DIR=/tmp/llm-debug\nHERMES_SESSION_FILE=.agent-sessions/llm.session\n');

  const result = checkInstanceConfigs(root);
  assert.deepEqual(result.instances.map(i => i.name), ['bad', 'llm-wiki']);
  assert(result.errors.some(e => e.includes('bad: missing DISCORD_TOKEN or DISCORD_BOT_TOKEN')));
  assert(result.errors.some(e => e.includes('bad: missing AUTO_JOIN_VOICE_CHANNELS')));
  assert(result.errors.some(e => e.includes('bad: missing TRANSCRIPT_CHANNEL_ID')));
  assert(result.errors.some(e => e.includes('PROJECT_SESSIONS_FILE collision')));
  assert(result.errors.some(e => e.includes('BRIDGE_LOG_PATH collision')));
  assert(result.errors.some(e => e.includes('NODE_AUDIO_DEBUG_DIR collision')));
  assert(result.warnings.some(e => e.includes('HERMES_SESSION_FILE collision')));
});

test('checkInstanceConfigs detects duplicate token fingerprints without printing tokens', () => {
  const root = tempRepo();
  writeInstance(root, 'one', 'DISCORD_TOKEN=same-token\nAUTO_JOIN_VOICE_CHANNELS=One\nTRANSCRIPT_CHANNEL_ID=1\nPROJECT_SESSIONS_FILE=config/one.json\nBRIDGE_LOG_PATH=/tmp/one.log\nNODE_AUDIO_DEBUG_DIR=/tmp/one-debug\n');
  writeInstance(root, 'two', 'DISCORD_BOT_TOKEN=same-token\nAUTO_JOIN_VOICE_CHANNELS=Two\nTRANSCRIPT_CHANNEL_ID=2\nPROJECT_SESSIONS_FILE=config/two.json\nBRIDGE_LOG_PATH=/tmp/two.log\nNODE_AUDIO_DEBUG_DIR=/tmp/two-debug\n');

  const result = checkInstanceConfigs(root);
  assert(result.errors.some(e => e.includes('duplicate Discord token fingerprint')));
  assert.equal(result.errors.join('\n').includes('same-token'), false);
});

test('checkInstanceConfigs treats omitted runtime paths as effective default collisions', () => {
  const root = tempRepo();
  writeInstance(root, 'one', 'DISCORD_TOKEN=token-one\nAUTO_JOIN_VOICE_CHANNELS=One\nTRANSCRIPT_CHANNEL_ID=1\n');
  writeInstance(root, 'two', 'DISCORD_TOKEN=token-two\nAUTO_JOIN_VOICE_CHANNELS=Two\nTRANSCRIPT_CHANNEL_ID=2\n');

  const result = checkInstanceConfigs(root);
  assert(result.errors.some(e => e.includes('PROJECT_SESSIONS_FILE collision')));
  assert(result.errors.some(e => e.includes('NODE_AUDIO_DEBUG_DIR collision')));
  assert(result.warnings.some(e => e.includes('HERMES_SESSION_FILE collision')));
});

test('checkInstanceConfigs warns when HERMES_HOME points at a missing profile', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-doctor-'));
  __tempRoots.push(root);
  const instancesDir = path.join(root, 'instances');
  fs.mkdirSync(instancesDir, { recursive: true });
  fs.writeFileSync(path.join(instancesDir, 'llm-wiki.env'), [
    'DISCORD_TOKEN="t"',
    'AUTO_JOIN_VOICE_CHANNELS="LLM-Wiki"',
    'TRANSCRIPT_CHANNEL_ID="1"',
    'AGENT_CWD="/projects/llm-wiki"',
    'HERMES_HOME="/nonexistent/.hermes/profiles/llm-wiki"',
    '',
  ].join('\n'));
  const result = checkInstanceConfigs(root, { instancesDir });
  assert.ok(result.warnings.some(w => /HERMES_HOME points at .* missing/.test(w)));
});

test('checkInstanceConfigs errors when profile terminal.cwd differs from AGENT_CWD', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-doctor-'));
  __tempRoots.push(root);
  const instancesDir = path.join(root, 'instances');
  const profileDir = path.join(root, '.hermes', 'profiles', 'llm-wiki');
  fs.mkdirSync(instancesDir, { recursive: true });
  fs.mkdirSync(profileDir, { recursive: true });
  fs.writeFileSync(path.join(profileDir, 'config.yaml'), 'terminal:\n  cwd: /elsewhere\n');
  fs.writeFileSync(path.join(instancesDir, 'llm-wiki.env'), [
    'DISCORD_TOKEN="t"',
    'AUTO_JOIN_VOICE_CHANNELS="LLM-Wiki"',
    'TRANSCRIPT_CHANNEL_ID="1"',
    'AGENT_CWD="/projects/llm-wiki"',
    `HERMES_HOME="${profileDir}"`,
    '',
  ].join('\n'));
  const result = checkInstanceConfigs(root, {
    instancesDir,
    readTerminalCwd: () => '/elsewhere',
  });
  assert.ok(result.errors.some(e => /terminal\.cwd .* does not match AGENT_CWD/.test(e)));
});

test('checkInstanceConfigs reads only terminal.cwd, ignoring sibling cwd keys', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-doctor-'));
  __tempRoots.push(root);
  const instancesDir = path.join(root, 'instances');
  const profileDir = path.join(root, '.hermes', 'profiles', 'llm-wiki');
  fs.mkdirSync(instancesDir, { recursive: true });
  fs.mkdirSync(profileDir, { recursive: true });
  // git.cwd appears BEFORE terminal.cwd; old regex would match git.cwd.
  fs.writeFileSync(path.join(profileDir, 'config.yaml'),
    'git:\n  cwd: /elsewhere\n' +
    'terminal:\n  cwd: /projects/llm-wiki\n');
  fs.writeFileSync(path.join(instancesDir, 'llm-wiki.env'), [
    'DISCORD_TOKEN="t"',
    'AUTO_JOIN_VOICE_CHANNELS="LLM-Wiki"',
    'TRANSCRIPT_CHANNEL_ID="1"',
    'AGENT_CWD="/projects/llm-wiki"',
    `HERMES_HOME="${profileDir}"`,
    '',
  ].join('\n'));
  const result = checkInstanceConfigs(root, { instancesDir });
  assert.equal(result.errors.filter(e => /terminal\.cwd/.test(e)).length, 0,
    `expected no terminal.cwd errors but got: ${result.errors.join(' | ')}`);
});
