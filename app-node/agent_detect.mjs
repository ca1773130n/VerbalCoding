import fs from 'node:fs';
import path from 'node:path';

const PROBES = [
  { backend: 'hermes', bin: 'hermes', defaultCommand: 'hermes chat -Q -q', envCommand: 'HERMES_COMMAND', label: 'Hermes Agent' },
  { backend: 'claude', bin: 'claude', defaultCommand: 'claude -p', envCommand: 'CLAUDE_COMMAND', label: 'Claude Code' },
  { backend: 'codex', bin: 'codex', defaultCommand: 'codex exec', envCommand: 'CODEX_COMMAND', label: 'Codex' },
  { backend: 'gemini', bin: 'gemini', defaultCommand: 'gemini -p', envCommand: 'GEMINI_COMMAND', label: 'Gemini' },
  { backend: 'opencode', bin: 'opencode', defaultCommand: 'opencode run', envCommand: 'OPENCODE_COMMAND', label: 'OpenCode' },
  { backend: 'openclaw', bin: 'openclaw', defaultCommand: 'openclaw run', envCommand: 'OPENCLAW_COMMAND', label: 'OpenClaw' },
  { backend: 'aider', bin: 'aider', defaultCommand: 'aider --no-pretty --yes-always --message', envCommand: 'AIDER_COMMAND', label: 'Aider' },
  { backend: 'cursor', bin: 'cursor-agent', defaultCommand: 'cursor-agent --print --prompt', envCommand: 'CURSOR_COMMAND', label: 'Cursor CLI' },
];

function defaultWhich(bin, { env = process.env, accessSync = fs.accessSync } = {}) {
  const pathVar = env.PATH || '';
  const sep = process.platform === 'win32' ? ';' : ':';
  const exts = process.platform === 'win32' ? (env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
  for (const dir of pathVar.split(sep)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, bin + ext);
      try {
        accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch { /* not here */ }
    }
  }
  return null;
}

export async function detectInstalledAgents(env = process.env, { which } = {}) {
  const probe = which || ((bin) => defaultWhich(bin, { env }));
  return Promise.all(PROBES.map(async (p) => {
    const located = await probe(p.bin);
    return {
      backend: p.backend,
      label: p.label,
      bin: p.bin,
      path: located || null,
      present: Boolean(located),
      command: env[p.envCommand] || p.defaultCommand,
    };
  }));
}

export function listKnownBackends() {
  return PROBES.map(p => ({ backend: p.backend, label: p.label, bin: p.bin }));
}
