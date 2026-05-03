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
