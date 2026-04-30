import fs from 'node:fs';
import path from 'node:path';

function compact(text) {
  return String(text || '').replace(/\s+/g, '').toLowerCase();
}

export function voiceCloneCommandFromText(text) {
  const c = compact(text);
  const mentionsVoiceClone = /(목소리|음성|보이스|voice).*(클론|클로닝|clone|샘플|sample|참조|reference)|(클론|클로닝|clone).*(목소리|음성|보이스|voice)/u.test(c);
  if (!mentionsVoiceClone) return null;
  if (/(취소|cancel|그만|중지|멈춰)/u.test(c)) return { action: 'cancel' };
  if (/(상태|status|확인|됐|준비)/u.test(c)) return { action: 'status' };
  if (/(녹음|저장|캡처|capture|record|따|시작|받아|만들)/u.test(c)) return { action: 'start' };
  return null;
}

export function createVoiceCloneCaptureState({ defaultTargetPath }) {
  let armed = null;
  return {
    arm({ userId, targetPath = defaultTargetPath, source = 'command' }) {
      armed = { userId: String(userId), targetPath, source, armedAt: Date.now() };
      return armed;
    },
    cancel(userId = null) {
      if (!armed) return null;
      if (userId != null && String(userId) !== armed.userId) return null;
      const previous = armed;
      armed = null;
      return previous;
    },
    current() {
      return armed;
    },
    consume(userId) {
      if (!armed || String(userId) !== armed.userId) return null;
      const previous = armed;
      armed = null;
      return previous;
    },
  };
}

export function isVoiceCloneCaptureArmedFor(state, userId) {
  return state.current()?.userId === String(userId);
}

export async function saveVoiceCloneReference({
  sourceWav,
  targetPath,
  execFileAsync,
  mkdirSync = fs.mkdirSync,
  existsSync = fs.existsSync,
  statSync = fs.statSync,
}) {
  mkdirSync(path.dirname(targetPath), { recursive: true });
  await execFileAsync('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    sourceWav,
    '-ac',
    '1',
    '-ar',
    '16000',
    '-sample_fmt',
    's16',
    targetPath,
  ], { timeout: 30000, maxBuffer: 1024 * 1024 });
  if (!existsSync(targetPath) || statSync(targetPath).size <= 0) {
    throw new Error(`voice clone reference was not written: ${targetPath}`);
  }
  return targetPath;
}
