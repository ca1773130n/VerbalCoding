import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { parseKeyValueEnv } from './install_config.mjs';
import { applyLanguagePreset, languageStatus, normalizeLanguageKey } from './language_config.mjs';
import { AUTO_RESTART_ENV_KEY, autoRestartStatusText, normalizeAutoRestartCommand } from './restart_policy.mjs';

function quoteEnv(value) {
  return JSON.stringify(String(value ?? ''));
}

export function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return parseKeyValueEnv(fs.readFileSync(file, 'utf8'));
}

export function upsertEnvFile(file, updates) {
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
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${lines.filter((line, index, arr) => line !== '' || index < arr.length - 1).join('\n')}\n`, { mode: 0o600 });
}

function runCommand(command, args, { root, timeoutMs = 120000, env = process.env } = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 2 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    signal: result.signal,
    stdout: sanitizeOutput(result.stdout || ''),
    stderr: sanitizeOutput(result.stderr || ''),
  };
}

function sanitizeOutput(text) {
  return String(text || '')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, '[REDACTED_EMAIL]')
    .replace(/(token|api[_-]?key|password|secret|authorization|connection[_-]?string)\s*[:=]\s*\S+/gi, '$1=[REDACTED]')
    .replace(/[A-Za-z0-9_-]{40,}/g, '[REDACTED]');
}

function runningPids() {
  const result = spawnSync('ps', ['-axo', 'pid,command'], { encoding: 'utf8' });
  if (result.status !== 0) return [];
  return result.stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .map(line => /^(\d+)\s+(.+)$/.exec(line))
    .filter(Boolean)
    .filter(match => /node\s+app-node\/main\.mjs/.test(match[2]))
    .map(match => Number(match[1]));
}

function startBridge({ root, env = process.env } = {}) {
  const pids = runningPids();
  if (pids.length) return { ok: true, alreadyRunning: true, pids };
  fs.mkdirSync(path.join(root, '.cache'), { recursive: true });
  const child = spawn('./run.sh', {
    cwd: root,
    env: {
      ...env,
      BRIDGE_LOG_PATH: '/tmp/verbalcoding-node.log',
      NODE_AUDIO_DEBUG_DIR: '/tmp/verbalcoding-node-debug',
    },
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return { ok: true, started: true, pid: child.pid };
}

function stopBridge() {
  const pids = runningPids();
  for (const pid of pids) {
    try { process.kill(pid, 'SIGTERM'); } catch {}
  }
  return { ok: true, stoppedPids: pids };
}

export function createVerbalCodingMcpTools({ root = process.cwd(), envPath = path.join(root, '.env'), env = process.env } = {}) {
  const toolDefs = [
    {
      name: 'status',
      description: 'Return VerbalCoding runtime/config status without exposing secrets.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const values = readEnvFile(envPath);
        const lang = languageStatus(values);
        return {
          project: root,
          running: runningPids().length > 0,
          pids: runningPids(),
          backend: values.AGENT_BACKEND || 'hermes',
          ttsBackend: values.TTS_BACKEND || 'edge',
          sttLanguage: lang.sttLanguage,
          voiceLanguage: lang.voiceLanguage,
          ttsVoice: lang.ttsVoice,
          autoRestartAfterCommit: autoRestartStatusText(values),
          sessionFile: values.HERMES_SESSION_FILE || path.join(root, '.verbalcoding-session'),
        };
      },
    },
    {
      name: 'doctor',
      description: 'Run VerbalCoding doctor and return redacted output.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => runCommand('npm', ['run', 'doctor'], { root, env }),
    },
    {
      name: 'set_auto_restart',
      description: 'Enable or disable commit-time voice bot auto-restart. Defaults off unless explicitly enabled.',
      inputSchema: {
        type: 'object',
        properties: { enabled: { type: 'boolean', description: 'true to enable, false to disable' } },
        required: ['enabled'],
      },
      handler: async ({ enabled }) => {
        upsertEnvFile(envPath, { [AUTO_RESTART_ENV_KEY]: enabled ? '1' : '0' });
        const values = readEnvFile(envPath);
        return { ok: true, status: autoRestartStatusText(values), value: values[AUTO_RESTART_ENV_KEY] };
      },
    },
    {
      name: 'set_language',
      description: 'Set STT/progress/TTS language preset to ko, en, or auto.',
      inputSchema: {
        type: 'object',
        properties: { language: { type: 'string', enum: ['ko', 'en', 'auto'] } },
        required: ['language'],
      },
      handler: async ({ language }) => {
        const key = normalizeLanguageKey(language, '');
        if (!key) throw new Error(`Unknown language: ${language}`);
        const next = applyLanguagePreset(readEnvFile(envPath), key);
        upsertEnvFile(envPath, {
          VOICE_LANGUAGE: next.VOICE_LANGUAGE,
          WHISPER_CPP_LANGUAGE: next.WHISPER_CPP_LANGUAGE,
          STT_LANGUAGE: next.STT_LANGUAGE,
          TTS_BACKEND: next.TTS_BACKEND,
          TTS_VOICE: next.TTS_VOICE,
        });
        return { ok: true, status: languageStatus(next) };
      },
    },
    {
      name: 'start',
      description: 'Start the VerbalCoding Discord voice bridge if it is not already running.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => startBridge({ root, env }),
    },
    {
      name: 'stop',
      description: 'Gracefully stop the VerbalCoding Discord voice bridge.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => stopBridge(),
    },
    {
      name: 'restart',
      description: 'Restart the VerbalCoding Discord voice bridge with an optional short notice.',
      inputSchema: {
        type: 'object',
        properties: { notice: { type: 'string', description: 'Short user-facing restart notice detail' } },
      },
      handler: async ({ notice = 'MCP 요청으로 재시작해' } = {}) => {
        fs.mkdirSync(path.join(root, '.cache'), { recursive: true });
        fs.writeFileSync(path.join(root, '.cache', 'restart-notice.txt'), String(notice).replace(/\s+/g, ' ').trim().slice(0, 160));
        const stopped = stopBridge();
        const started = startBridge({ root, env });
        return { ok: Boolean(started.ok), stopped, started };
      },
    },
  ];
  const tools = new Map(toolDefs.map(tool => [tool.name, tool]));
  return { toolDefs, tools };
}

export function toolResultContent(value) {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }];
}
