import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { parseKeyValueEnv } from './install_config.mjs';

export function instanceNameFromEnvPath(file) {
  return path.basename(file).replace(/\.env$/i, '');
}

export function listInstanceEnvFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => name.endsWith('.env') && name !== 'example.env')
    .sort()
    .map(name => path.join(dir, name));
}

export function instanceRuntimePaths(root, name) {
  return {
    pidFile: path.join(root, '.run', 'instances', `${name}.pid`),
    defaultLogPath: `/tmp/verbalcoding-${name}.log`,
  };
}

export function readInstanceEnv(file) {
  try {
    return parseKeyValueEnv(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

export function readPidFile(pidFile) {
  try {
    const value = Number.parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err?.code === 'EPERM';
  }
}

export function statusForInstance(root, envPath) {
  const name = instanceNameFromEnvPath(envPath);
  const runtime = instanceRuntimePaths(root, name);
  const env = readInstanceEnv(envPath);
  const pid = readPidFile(runtime.pidFile);
  const alive = pid !== null && isPidAlive(pid);
  return {
    name,
    envPath,
    pid: alive ? pid : null,
    status: alive ? 'running' : 'stopped',
    logPath: env.BRIDGE_LOG_PATH || runtime.defaultLogPath,
    pidFile: runtime.pidFile,
  };
}

export function listInstanceStatuses(root, instancesDir = path.join(root, 'instances')) {
  return listInstanceEnvFiles(instancesDir).map(envPath => statusForInstance(root, envPath));
}

export function resolveInstanceEnvPath(root, name) {
  const clean = String(name || '').trim();
  if (!/^[A-Za-z0-9_.-]+$/.test(clean) || clean.startsWith('.') || clean.endsWith('.env')) {
    throw new Error(`invalid instance name: ${name}`);
  }
  const candidate = path.join(root, 'instances', `${clean}.env`);
  if (!fs.existsSync(candidate)) {
    throw new Error(`instance env file not found: ${candidate}`);
  }
  return candidate;
}

export function startInstance(root, name, options = {}) {
  const envPath = resolveInstanceEnvPath(root, name);
  const instanceName = instanceNameFromEnvPath(envPath);
  const runtime = instanceRuntimePaths(root, instanceName);
  const currentPid = readPidFile(runtime.pidFile);
  if (currentPid && isPidAlive(currentPid)) {
    throw new Error(`${instanceName} is already running pid=${currentPid}`);
  }
  fs.mkdirSync(path.dirname(runtime.pidFile), { recursive: true });
  const instanceEnv = readInstanceEnv(envPath);
  const child = spawn(path.join(root, 'run.sh'), [envPath], {
    cwd: root,
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
    env: {
      ...process.env,
      BRIDGE_LOG_PATH: instanceEnv.BRIDGE_LOG_PATH || runtime.defaultLogPath,
      NODE_AUDIO_DEBUG_DIR: instanceEnv.NODE_AUDIO_DEBUG_DIR || `/tmp/verbalcoding-${instanceName}-debug`,
      PROJECT_SESSIONS_FILE: instanceEnv.PROJECT_SESSIONS_FILE || path.join(root, 'config', `project-sessions.${instanceName}.json`),
      HERMES_SESSION_FILE: instanceEnv.HERMES_SESSION_FILE || path.join(root, '.agent-sessions', 'hermes', `${instanceName}.session`),
      VERBALCODING_INSTANCE_NAME: instanceName,
      VERBALCODING_INSTANCE_ENV: envPath,
      ...(options.env || {}),
    },
  });
  child.unref();
  fs.writeFileSync(runtime.pidFile, `${child.pid}\n`);
  const status = statusForInstance(root, envPath);
  return { ...status, pid: child.pid, status: 'running' };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function stopInstance(root, name, options = {}) {
  const envPath = resolveInstanceEnvPath(root, name);
  const instanceName = instanceNameFromEnvPath(envPath);
  const runtime = instanceRuntimePaths(root, instanceName);
  const pid = readPidFile(runtime.pidFile);
  if (!pid || !isPidAlive(pid)) {
    fs.rmSync(runtime.pidFile, { force: true });
    return { name: instanceName, pid: null, status: 'stopped', alreadyStopped: true };
  }
  const timeoutMs = options.timeoutMs ?? 10_000;
  const intervalMs = options.intervalMs ?? 250;
  try {
    process.kill(pid, 'SIGTERM');
  } catch (err) {
    if (err?.code !== 'ESRCH') throw err;
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) {
      fs.rmSync(runtime.pidFile, { force: true });
      return { name: instanceName, pid, status: 'stopped', killed: false };
    }
    await sleep(intervalMs);
  }
  if (isPidAlive(pid)) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch (err) {
      if (err?.code !== 'ESRCH') throw err;
    }
  }
  fs.rmSync(runtime.pidFile, { force: true });
  return { name: instanceName, pid, status: 'stopped', killed: true };
}
