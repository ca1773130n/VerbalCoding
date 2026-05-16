#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.env.VERBALCODING_SKIP_POSTINSTALL === '1') process.exit(0);

function log(message) {
  console.log(`[verbalcoding] ${message}`);
}

function run(cmd, args, options = {}) {
  return spawnSync(cmd, args, { cwd: ROOT, stdio: options.stdio || 'inherit', env: process.env });
}

try {
  if (!fs.existsSync(path.join(ROOT, '.venv-tts', 'bin', 'edge-tts'))) {
    const py = spawnSync('python3', ['--version'], { stdio: 'ignore' });
    if (py.status === 0) {
      log('installing local Edge TTS helper (.venv-tts)');
      run('python3', ['-m', 'venv', path.join(ROOT, '.venv-tts')]);
      run(path.join(ROOT, '.venv-tts', 'bin', 'python'), ['-m', 'pip', 'install', '--upgrade', 'pip'], { stdio: 'ignore' });
      const result = run(path.join(ROOT, '.venv-tts', 'bin', 'python'), ['-m', 'pip', 'install', 'edge-tts']);
      if (result.status !== 0) log('edge-tts helper install failed; run `vc setup` later');
    } else {
      log('python3 not found; skipping Edge TTS helper install');
    }
  }
  log('postinstall complete. Run `vc setup` for Discord tokens and heavier optional TTS backends.');
} catch (error) {
  log(`postinstall skipped after error: ${error?.message || error}`);
}
