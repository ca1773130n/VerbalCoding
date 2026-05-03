export class InvalidProfileName extends Error {
  constructor(name) {
    super(`invalid Hermes profile name ${JSON.stringify(name)}: must match ^[a-z0-9][a-z0-9_-]{0,63}$`);
    this.name = 'InvalidProfileName';
  }
}

const PROFILE_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function validateProfileName(name) {
  if (typeof name !== 'string' || !PROFILE_NAME_RE.test(name)) {
    throw new InvalidProfileName(name);
  }
  return name;
}

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function defaultDeps(deps = {}) {
  return {
    homedir: deps.homedir || os.homedir,
    fs: deps.fs || fs,
    env: deps.env || process.env,
  };
}

export function hermesProfilesRoot(deps = {}) {
  const { homedir, env } = defaultDeps(deps);
  if (env && env.HERMES_PROFILES_ROOT) return env.HERMES_PROFILES_ROOT;
  return path.join(homedir(), '.hermes', 'profiles');
}

export function hermesProfileDir(name, deps = {}) {
  validateProfileName(name);
  return path.join(hermesProfilesRoot(deps), name);
}

export function profileExists(name, deps = {}) {
  const { fs: fsDep } = defaultDeps(deps);
  const dir = hermesProfileDir(name, deps);
  return fsDep.existsSync(path.join(dir, 'config.yaml'));
}

import { execFile as nodeRunner } from 'node:child_process';
import { promisify } from 'node:util';

export class HermesCliMissing extends Error {
  constructor() {
    super('hermes CLI not found on PATH; install Hermes (>= 0.6.0) and re-run `vc instance setup`');
    this.name = 'HermesCliMissing';
  }
}

function resolveRunner(deps = {}) {
  const raw = deps.execFile || nodeRunner;
  return promisify(raw);
}

export async function assertHermesAvailable(deps = {}) {
  const run = resolveRunner(deps);
  try {
    await run('hermes', ['--version'], { timeout: 5000 });
  } catch (err) {
    if (err && err.code === 'ENOENT') throw new HermesCliMissing();
    throw err;
  }
}

async function runHermes(run, args, { extraEnv } = {}) {
  const env = { ...process.env, ...(extraEnv || {}) };
  return run('hermes', args, { env, timeout: 60000 });
}

export class ProfileBoundElsewhere extends Error {
  constructor(name, expected, actual) {
    super(`Hermes profile ${name} already binds terminal.cwd to ${actual}; expected ${expected}. Pick a different instance name or rebind with hermes config set terminal.cwd in that profile.`);
    this.name = 'ProfileBoundElsewhere';
    this.expected = expected;
    this.actual = actual;
  }
}

export class ProfileConfigFailed extends Error {
  constructor(stderr) {
    super(`hermes config set terminal.cwd failed: ${stderr}`);
    this.name = 'ProfileConfigFailed';
  }
}

async function readTerminalCwd(run, dir) {
  try {
    const out = await run('hermes', ['config', 'get', 'terminal.cwd'], { env: { ...process.env, HERMES_HOME: dir }, timeout: 10000 });
    return String(out.stdout || '').trim();
  } catch {
    return '';
  }
}

export async function ensureHermesProfile({ name, workdir, projectContext, cloneFrom = 'default', deps = {} } = {}) {
  validateProfileName(name);
  const { fs: fsDep, homedir, env } = defaultDeps(deps);
  const run = resolveRunner(deps);
  const dir = hermesProfileDir(name, { homedir, env });
  const warnings = [];

  if (profileExists(name, { homedir, env, fs: fsDep })) {
    const actualCwd = await readTerminalCwd(run, dir);
    if (actualCwd && actualCwd !== workdir) {
      throw new ProfileBoundElsewhere(name, workdir, actualCwd);
    }
    if (projectContext) applyProjectContextToSoul(path.join(dir, 'SOUL.md'), String(projectContext), fsDep);
    return { created: false, dir, name, configPath: path.join(dir, 'config.yaml'), updatedConfig: false, warnings };
  }

  await assertHermesAvailable({ execFile: run });

  try {
    await runHermes(run, ['profile', 'create', name, '--clone-from', cloneFrom]);
  } catch (err) {
    if (cloneFrom === 'default') {
      warnings.push(`hermes profile create --clone-from default failed (${err.message || err.code}); retrying without clone`);
      await runHermes(run, ['profile', 'create', name]);
    } else {
      throw err;
    }
  }

  try {
    await runHermes(run, ['config', 'set', 'terminal.cwd', workdir], { extraEnv: { HERMES_HOME: dir } });
  } catch (err) {
    throw new ProfileConfigFailed(String(err.stderr || err.message || err.code));
  }

  const soulPath = path.join(dir, 'SOUL.md');
  if (projectContext) applyProjectContextToSoul(soulPath, String(projectContext), fsDep);

  return { created: true, dir, name, configPath: path.join(dir, 'config.yaml'), updatedConfig: true, warnings };
}

export const VC_SOUL_MARKER_START = '<!-- vc:project-context:start -->';
export const VC_SOUL_MARKER_END = '<!-- vc:project-context:end -->';

export function applyProjectContextToSoul(soulPath, projectContext, fsDep = fs) {
  const trimmed = String(projectContext || '').trim();
  if (!trimmed) return;
  const block = `${VC_SOUL_MARKER_START}\n## Project context\n\n${trimmed}\n${VC_SOUL_MARKER_END}`;
  let body;
  if (fsDep.existsSync(soulPath)) {
    const existing = fsDep.readFileSync(soulPath, 'utf8');
    const re = new RegExp(`${escapeRegExp(VC_SOUL_MARKER_START)}[\\s\\S]*?${escapeRegExp(VC_SOUL_MARKER_END)}`);
    body = re.test(existing)
      ? existing.replace(re, block)
      : `${existing.replace(/\s*$/, '')}\n\n${block}\n`;
  } else {
    body = `${block}\n`;
  }
  fsDep.writeFileSync(soulPath, body);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
