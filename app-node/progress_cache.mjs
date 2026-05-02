import { createHash } from 'node:crypto';

export function progressTtsCacheFileName({ backendKeyParts, text, ext }) {
  const key = `${(backendKeyParts || []).join('\n')}\n${String(text || '')}`;
  const digest = createHash('sha256').update(key, 'utf8').digest('hex');
  return `${digest}.${ext || 'mp3'}`;
}
