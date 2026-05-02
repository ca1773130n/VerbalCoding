import crypto from 'node:crypto';
import path from 'node:path';

import { listInstanceEnvFiles, instanceNameFromEnvPath, readInstanceEnv } from './instances.mjs';

export function tokenFingerprint(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 12);
}

function effectiveInstanceValue(root, instance, key) {
  const value = String(instance.env[key] || '').trim();
  if (value) return value;
  if (key === 'PROJECT_SESSIONS_FILE') return path.join(root, 'config', 'project-sessions.json');
  if (key === 'BRIDGE_LOG_PATH') return `/tmp/verbalcoding-${instance.name}.log`;
  if (key === 'NODE_AUDIO_DEBUG_DIR') return '/tmp/verbalcoding-node-debug';
  if (key === 'HERMES_SESSION_FILE') return path.join(root, '.verbalcoding-session');
  return '';
}

function addCollisionIssues({ root, instances, key, messagePrefix }) {
  const buckets = new Map();
  for (const instance of instances) {
    const value = effectiveInstanceValue(root, instance, key);
    if (!value) continue;
    const normalized = key.endsWith('FILE') || key.endsWith('PATH') || key.endsWith('DIR')
      ? path.normalize(value)
      : value;
    if (!buckets.has(normalized)) buckets.set(normalized, []);
    buckets.get(normalized).push(instance.name);
  }
  const issues = [];
  for (const [value, names] of buckets.entries()) {
    if (names.length > 1) {
      issues.push(`${messagePrefix} ${key} collision: ${names.join(', ')} -> ${value}`);
    }
  }
  return { issues };
}

export function checkInstanceConfigs(root, options = {}) {
  const instancesDir = options.instancesDir || path.join(root, 'instances');
  const envFiles = listInstanceEnvFiles(instancesDir);
  const instances = envFiles.map(envPath => ({
    name: instanceNameFromEnvPath(envPath),
    envPath,
    env: readInstanceEnv(envPath),
  }));
  const errors = [];
  const warnings = [];

  for (const instance of instances) {
    const token = String(instance.env.DISCORD_BOT_TOKEN || instance.env.DISCORD_TOKEN || '').trim();
    if (!token || /^replace/i.test(token)) {
      errors.push(`${instance.name}: missing DISCORD_TOKEN or DISCORD_BOT_TOKEN`);
    }
    if (!String(instance.env.AUTO_JOIN_VOICE_CHANNELS || '').trim()) {
      errors.push(`${instance.name}: missing AUTO_JOIN_VOICE_CHANNELS`);
    }
    if (!String(instance.env.TRANSCRIPT_CHANNEL_ID || '').trim()) {
      errors.push(`${instance.name}: missing TRANSCRIPT_CHANNEL_ID`);
    }
  }

  const tokenBuckets = new Map();
  for (const instance of instances) {
    const token = String(instance.env.DISCORD_BOT_TOKEN || instance.env.DISCORD_TOKEN || '').trim();
    if (!token || /^replace/i.test(token)) continue;
    const fp = tokenFingerprint(token);
    if (!tokenBuckets.has(fp)) tokenBuckets.set(fp, []);
    tokenBuckets.get(fp).push(instance.name);
  }
  for (const [fp, names] of tokenBuckets.entries()) {
    if (names.length > 1) {
      errors.push(`duplicate Discord token fingerprint ${fp}: ${names.join(', ')}`);
    }
  }

  for (const key of ['PROJECT_SESSIONS_FILE', 'BRIDGE_LOG_PATH', 'NODE_AUDIO_DEBUG_DIR']) {
    const { issues } = addCollisionIssues({ root, instances, key, messagePrefix: 'instance' });
    errors.push(...issues);
  }
  const { issues: sessionWarnings } = addCollisionIssues({ root, instances, key: 'HERMES_SESSION_FILE', messagePrefix: 'instance' });
  warnings.push(...sessionWarnings);

  return { errors, warnings, instances: instances.map(({ name, envPath }) => ({ name, envPath })) };
}

export function formatInstanceDoctor(result) {
  const lines = [];
  if (result.instances.length === 0) {
    lines.push('• No per-instance env files found in instances/*.env');
  } else {
    lines.push(`• Instance env files: ${result.instances.map(i => i.name).join(', ')}`);
  }
  for (const error of result.errors) lines.push(`✗ ${error}`);
  for (const warning of result.warnings) lines.push(`• Warning: ${warning}`);
  if (result.errors.length === 0) lines.push('✓ Instance configuration checks passed');
  return lines;
}
