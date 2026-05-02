import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createVerbalCodingMcpTools, readEnvFile } from './mcp_tools.mjs';
import { AUTO_RESTART_ENV_KEY } from './restart_policy.mjs';

test('MCP tool definitions expose VerbalCoding control surface', () => {
  const { toolDefs, tools } = createVerbalCodingMcpTools({ root: process.cwd() });
  const names = toolDefs.map(tool => tool.name).sort();
  assert.deepEqual(names, ['doctor', 'restart', 'set_auto_restart', 'set_language', 'start', 'status', 'stop']);
  assert.equal(tools.get('set_auto_restart').inputSchema.required[0], 'enabled');
});

test('set_auto_restart MCP tool writes the default-off restart flag', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-mcp-'));
  const envPath = path.join(dir, '.env');
  const { tools } = createVerbalCodingMcpTools({ root: dir, envPath });
  const off = await tools.get('set_auto_restart').handler({ enabled: false });
  assert.equal(off.value, '0');
  assert.equal(readEnvFile(envPath)[AUTO_RESTART_ENV_KEY], '0');
  const on = await tools.get('set_auto_restart').handler({ enabled: true });
  assert.equal(on.value, '1');
  assert.equal(readEnvFile(envPath)[AUTO_RESTART_ENV_KEY], '1');
});

test('set_language MCP tool updates STT, progress, and TTS language together', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-mcp-lang-'));
  const envPath = path.join(dir, '.env');
  const { tools } = createVerbalCodingMcpTools({ root: dir, envPath });
  const result = await tools.get('set_language').handler({ language: 'en' });
  assert.equal(result.ok, true);
  const values = readEnvFile(envPath);
  assert.equal(values.VOICE_LANGUAGE, 'en');
  assert.equal(values.WHISPER_CPP_LANGUAGE, 'en');
  assert.match(values.TTS_VOICE, /^en-/);
});
