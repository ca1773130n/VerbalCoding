// TTS runtime helpers: on-demand backend installation and binary lookup.
//
// Phase 5c extraction from main.mjs.
//   - ensureSelectedTtsBackendInstalled triggers per-backend install scripts
//     (mlxaudio, fireredtts2, mossttsnano) when their python venv / binary
//     is missing, then persists the resolved env paths.
//   - commandIsInstalled walks PATH (with Windows PATHEXT support) and
//     caches results on bridge.installedBinaryCache.
//
// refreshTtsRuntimeConfig deliberately stays in main.mjs because it
// references ttsFallbackNotice (also in main.mjs) which itself references
// speakText from ttsPlayer — moving it here would force a thunk dance.

import fs from 'node:fs';
import path from 'node:path';

export function createTtsRuntime(deps) {
  const {
    bridge,
    ROOT,
    execFileAsync,
    speakText,
    warn,
    persistEnvValues,
  } = deps;

  async function ensureSelectedTtsBackendInstalled(selection, signal) {
    if (selection.backend === 'mlxaudio') {
      const mlxPython = process.env.MLXAUDIO_PYTHON || './.venv-mlxaudio/bin/python';
      const mlxPath = path.isAbsolute(mlxPython) ? mlxPython : path.resolve(ROOT, mlxPython);
      if (fs.existsSync(mlxPath)) return { ok: true, installed: false };
      await speakText('MLX Audio가 아직 설치 안 돼 있어서 지금 설치할게. 처음엔 모델 다운로드가 걸릴 수 있어.', signal, null, { mirrorText: true });
      try {
        await execFileAsync('bash', [path.join(ROOT, 'scripts', 'install_mlxaudio.sh'), '--yes'], {
          cwd: ROOT,
          timeout: Number(process.env.MLXAUDIO_INSTALL_TIMEOUT_MS || '1800000'),
          maxBuffer: 1024 * 1024,
        });
        process.env.MLXAUDIO_PYTHON = './.venv-mlxaudio/bin/python';
        persistEnvValues({ MLXAUDIO_PYTHON: './.venv-mlxaudio/bin/python' });
        return { ok: true, installed: true };
      } catch (error) {
        const tail = String(error?.stderr || error?.stdout || error?.message || error).slice(-900);
        warn('MLX Audio auto-install failed', tail);
        await speakText(`MLX Audio 자동 설치가 실패했어. Edge fallback은 유지할게. 로그 꼬리: ${tail}`, signal, null, { mirrorText: true });
        return { ok: false, installed: false, error };
      }
    }
    if (selection.backend === 'fireredtts2') {
      const fireCommand = process.env.FIREREDTTS2_COMMAND || './.local/bin/fireredtts2';
      const firePath = path.isAbsolute(fireCommand) ? fireCommand : path.resolve(ROOT, fireCommand);
      const fireModel = path.resolve(ROOT, process.env.FIREREDTTS2_PRETRAINED_DIR || 'pretrained_models/FireRedTTS2');
      if (fs.existsSync(firePath) && fs.existsSync(fireModel)) return { ok: true, installed: false };
      await speakText('FireRedTTS-2가 아직 설치 안 돼 있어서 지금 설치할게. 모델 다운로드 때문에 오래 걸릴 수 있어.', signal, null, { mirrorText: true });
      try {
        await execFileAsync('bash', [path.join(ROOT, 'scripts', 'install_fireredtts2.sh'), '--yes'], {
          cwd: ROOT,
          timeout: Number(process.env.FIREREDTTS2_INSTALL_TIMEOUT_MS || '3600000'),
          maxBuffer: 1024 * 1024,
        });
        process.env.FIREREDTTS2_COMMAND = './.local/bin/fireredtts2';
        process.env.FIREREDTTS2_PRETRAINED_DIR = 'pretrained_models/FireRedTTS2';
        persistEnvValues({
          FIREREDTTS2_COMMAND: './.local/bin/fireredtts2',
          FIREREDTTS2_PRETRAINED_DIR: 'pretrained_models/FireRedTTS2',
        });
        return { ok: true, installed: true };
      } catch (error) {
        const tail = String(error?.stderr || error?.stdout || error?.message || error).slice(-900);
        warn('FireRedTTS-2 auto-install failed', tail);
        await speakText(`FireRedTTS-2 자동 설치가 실패했어. Edge fallback은 유지할게. 로그 꼬리: ${tail}`, signal, null, { mirrorText: true });
        return { ok: false, installed: false, error };
      }
    }
    if (selection.backend === 'mossttsnano') {
      const mossCommand = process.env.MOSSTTSNANO_COMMAND || './.local/bin/mossttsnano';
      const mossPath = path.isAbsolute(mossCommand) ? mossCommand : path.resolve(ROOT, mossCommand);
      const mossScript = path.resolve(ROOT, process.env.MOSSTTSNANO_SCRIPT || 'vendor/MOSS-TTS-Nano/infer.py');
      if (fs.existsSync(mossPath) && fs.existsSync(mossScript)) return { ok: true, installed: false };
      await speakText('MOSS-TTS-Nano가 아직 설치 안 돼 있어서 지금 설치할게. 처음엔 모델 다운로드가 걸릴 수 있어.', signal, null, { mirrorText: true });
      try {
        await execFileAsync('bash', [path.join(ROOT, 'scripts', 'install_mossttsnano.sh'), '--yes'], {
          cwd: ROOT,
          timeout: Number(process.env.MOSSTTSNANO_INSTALL_TIMEOUT_MS || '1800000'),
          maxBuffer: 1024 * 1024,
        });
        process.env.MOSSTTSNANO_COMMAND = './.venv-mossttsnano/bin/python';
        process.env.MOSSTTSNANO_SCRIPT = 'vendor/MOSS-TTS-Nano/infer.py';
        persistEnvValues({
          MOSSTTSNANO_COMMAND: './.venv-mossttsnano/bin/python',
          MOSSTTSNANO_SCRIPT: 'vendor/MOSS-TTS-Nano/infer.py',
        });
        return { ok: true, installed: true };
      } catch (error) {
        const tail = String(error?.stderr || error?.stdout || error?.message || error).slice(-900);
        warn('MOSS-TTS-Nano auto-install failed', tail);
        await speakText(`MOSS-TTS-Nano 자동 설치가 실패했어. Edge fallback은 유지할게. 로그 꼬리: ${tail}`, signal, null, { mirrorText: true });
        return { ok: false, installed: false, error };
      }
    }
    return { ok: true, installed: false };
  }

  function commandIsInstalled(binary, { cwd = process.cwd() } = {}) {
    if (!binary) return false;
    const isWindows = process.platform === 'win32';
    const exts = isWindows
      ? String(process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
      : [''];
    function existsExecutable(candidate) {
      try { fs.accessSync(candidate, fs.constants.X_OK); return true; } catch { return false; }
    }
    function existsAnyExt(candidate) {
      if (existsExecutable(candidate)) return true;
      if (isWindows && !/\.[^\\/.]+$/.test(candidate)) {
        return exts.some(ext => existsExecutable(candidate + ext));
      }
      return false;
    }
    if (path.isAbsolute(binary)) return existsAnyExt(binary);
    const hasPathSep = binary.includes('/') || (isWindows && binary.includes('\\'));
    if (hasPathSep) return existsAnyExt(path.resolve(cwd, binary));
    if (bridge.installedBinaryCache.has(binary)) return bridge.installedBinaryCache.get(binary);
    const pathEntries = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
    const found = pathEntries.some(dir => existsAnyExt(path.join(dir, binary)));
    bridge.installedBinaryCache.set(binary, found);
    return found;
  }

  return {
    ensureSelectedTtsBackendInstalled,
    commandIsInstalled,
  };
}
