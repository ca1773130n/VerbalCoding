import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  instanceNameFromEnvPath,
  instanceRuntimePaths,
  isPidAlive,
  listInstanceEnvFiles,
  readPidFile,
  resolveInstanceEnvPath,
  statusForInstance,
} from './instances.mjs';

const __tempRoots = [];
test.after(() => {
  for (const root of __tempRoots) try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
});

function tempDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-instances-'));
  __tempRoots.push(root);
  return root;
}

test('listInstanceEnvFiles finds env files except example', () => {
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, 'example.env'), '');
  fs.writeFileSync(path.join(dir, 'llm-wiki.env'), '');
  fs.writeFileSync(path.join(dir, 'verbalcoding.env'), '');
  fs.writeFileSync(path.join(dir, 'notes.txt'), '');

  assert.deepEqual(listInstanceEnvFiles(dir).map(p => path.basename(p)), ['llm-wiki.env', 'verbalcoding.env']);
});

test('listInstanceEnvFiles returns empty for missing directory', () => {
  const dir = path.join(tempDir(), 'missing');
  assert.deepEqual(listInstanceEnvFiles(dir), []);
});

test('instanceNameFromEnvPath strips only the env extension', () => {
  assert.equal(instanceNameFromEnvPath('/repo/instances/llm-wiki.env'), 'llm-wiki');
  assert.equal(instanceNameFromEnvPath('/repo/instances/foo.local.env'), 'foo.local');
});

test('instanceRuntimePaths derives pid and log paths', () => {
  assert.deepEqual(instanceRuntimePaths('/repo', 'llm-wiki'), {
    pidFile: '/repo/.run/instances/llm-wiki.pid',
    defaultLogPath: '/tmp/verbalcoding-llm-wiki.log',
  });
});

test('readPidFile returns null for missing or invalid pid file', () => {
  const dir = tempDir();
  assert.equal(readPidFile(path.join(dir, 'missing.pid')), null);
  const file = path.join(dir, 'bad.pid');
  fs.writeFileSync(file, 'not-a-pid');
  assert.equal(readPidFile(file), null);
});

test('readPidFile parses a numeric pid', () => {
  const dir = tempDir();
  const file = path.join(dir, 'ok.pid');
  fs.writeFileSync(file, '12345\n');
  assert.equal(readPidFile(file), 12345);
});

test('isPidAlive treats current process as alive and impossible pid as dead', () => {
  assert.equal(isPidAlive(process.pid), true);
  assert.equal(isPidAlive(99999999), false);
});

test('statusForInstance reports stopped when no pid file exists', () => {
  const root = tempDir();
  const envPath = path.join(root, 'instances', 'llm-wiki.env');
  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  fs.writeFileSync(envPath, 'INSTANCE_NAME=llm-wiki\n');

  assert.deepEqual(statusForInstance(root, envPath), {
    name: 'llm-wiki',
    envPath,
    pid: null,
    status: 'stopped',
    logPath: '/tmp/verbalcoding-llm-wiki.log',
    pidFile: path.join(root, '.run', 'instances', 'llm-wiki.pid'),
  });
});

test('statusForInstance prefers BRIDGE_LOG_PATH from env file', () => {
  const root = tempDir();
  const envPath = path.join(root, 'instances', 'verbalcoding.env');
  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  fs.writeFileSync(envPath, 'BRIDGE_LOG_PATH=/tmp/custom-vc.log\n');

  const status = statusForInstance(root, envPath);
  assert.equal(status.logPath, '/tmp/custom-vc.log');
});

test('resolveInstanceEnvPath accepts only safe instance names under instances directory', () => {
  const root = tempDir();
  fs.mkdirSync(path.join(root, 'instances'), { recursive: true });
  fs.writeFileSync(path.join(root, 'instances', 'llm-wiki.env'), '');
  assert.equal(resolveInstanceEnvPath(root, 'llm-wiki'), path.join(root, 'instances', 'llm-wiki.env'));
  assert.throws(() => resolveInstanceEnvPath(root, '../.env'), /invalid instance name/);
  assert.throws(() => resolveInstanceEnvPath(root, '/tmp/other.env'), /invalid instance name/);
  assert.throws(() => resolveInstanceEnvPath(root, 'bad name'), /invalid instance name/);
});
