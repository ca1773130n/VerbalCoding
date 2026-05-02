#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyLanguagePreset, languageStatus, normalizeLanguageKey } from '../app-node/language_config.mjs';
import { parseKeyValueEnv } from '../app-node/install_config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = path.join(ROOT, '.env');

function usage() {
  return `VerbalCoding CLI

Usage:
  verbalcoding status
  verbalcoding language <ko|en|auto>
  verbalcoding language status
  verbalcoding doctor

Examples:
  npm run vc -- language en
  npm run vc -- language ko
  npm run vc -- language auto
`;
}

function readEnvFile(file = ENV_PATH) {
  if (!fs.existsSync(file)) return {};
  return parseKeyValueEnv(fs.readFileSync(file, 'utf8'));
}

function quoteEnv(value) {
  return JSON.stringify(String(value ?? ''));
}

function upsertEnvFile(file, updates) {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const seen = new Set();
  const lines = existing.split(/\r?\n/).map(raw => {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) return raw;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim().replace(/^export\s+/, '');
    if (!(key in updates)) return raw;
    seen.add(key);
    return `${key}=${quoteEnv(updates[key])}`;
  });
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) lines.push(`${key}=${quoteEnv(value)}`);
  }
  const text = `${lines.filter((line, index, arr) => line !== '' || index < arr.length - 1).join('\n')}\n`;
  fs.writeFileSync(file, text, { mode: 0o600 });
}

function printLanguageStatus(values) {
  const s = languageStatus(values);
  console.log(`STT language: ${s.sttLanguage}`);
  console.log(`Progress/voice language: ${s.voiceLanguage}`);
  console.log(`TTS voice: ${s.ttsVoice}`);
}

async function main(argv = process.argv.slice(2)) {
  const [command, subcommand] = argv;
  if (!command || ['help', '-h', '--help'].includes(command)) {
    console.log(usage());
    return;
  }
  if (command === 'doctor') {
    const { spawnSync } = await import('node:child_process');
    const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'doctor.mjs')], { stdio: 'inherit', cwd: ROOT });
    process.exitCode = result.status ?? 1;
    return;
  }
  if (command === 'status') {
    printLanguageStatus(readEnvFile());
    return;
  }
  if (command === 'language') {
    if (!subcommand || subcommand === 'status') {
      printLanguageStatus(readEnvFile());
      return;
    }
    const key = normalizeLanguageKey(subcommand, '');
    if (!key) {
      console.error(`Unknown language: ${subcommand}`);
      console.error('Use ko, en, or auto.');
      process.exitCode = 2;
      return;
    }
    const current = readEnvFile();
    const next = applyLanguagePreset(current, key);
    upsertEnvFile(ENV_PATH, {
      VOICE_LANGUAGE: next.VOICE_LANGUAGE,
      WHISPER_CPP_LANGUAGE: next.WHISPER_CPP_LANGUAGE,
      STT_LANGUAGE: next.STT_LANGUAGE,
      TTS_BACKEND: next.TTS_BACKEND,
      TTS_VOICE: next.TTS_VOICE,
    });
    console.log(`Updated ${ENV_PATH}`);
    printLanguageStatus(next);
    console.log('Restart the bridge for this to take effect.');
    return;
  }
  console.error(`Unknown command: ${command}`);
  console.error(usage());
  process.exitCode = 2;
}

main().catch(err => {
  console.error(err?.stack || err);
  process.exit(1);
});
