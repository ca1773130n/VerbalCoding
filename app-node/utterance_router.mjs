// Voice utterance dispatch chain: tts/lang/clone command handlers,
// routing state, adapter selection, and barge-in interrupt. handleRecording
// (Phase 7a) and plan-mode dispatch (Phase 7b) moved out to their own
// modules — this module is now pure command dispatch.
//
// createUtteranceRouter(deps) returns the small handlers main.mjs and
// voice_turn_runner consume.

export function createUtteranceRouter(deps) {
  const {
    bridge,
    log,
    warn,
    agentAdapter,
    settings,
    projectSessionContextText,
    createBridgeAgentAdapter,
    buildAgentSettings,
    commandIsInstalled,
    shellSplit,
    sendText,
    speakText,
    TTS_VOICE_CONFIG_PATH,
    ensureTtsVoiceConfig,
    updateTtsVoiceConfig,
    writeTtsVoiceConfig,
    applyVoiceConfigToProcessEnv,
    ensureSelectedTtsBackendInstalled,
    rebuildTtsRuntimeSettings,
    voiceCommandFromTranscript,
    voiceChangedText,
    voiceLanguageCommandFromTranscript,
    voiceCloneCommandFromText,
    voiceCloneCapture,
    notifyVoiceCloneSampleGapIfNeeded,
    languageChangedText,
    applyRuntimeLanguage,
    persistEnvValues,
    discardVoiceInputQueues,
    path,
    ROOT,
  } = deps;

function adapterForProjectSession(session) {
  if (!session) return agentAdapter;
  const key = session.slug || session.name;
  if (!bridge.agentAdaptersBySession.has(key)) {
    bridge.agentAdaptersBySession.set(key, createBridgeAgentAdapter({
      ...settings.agent,
      label: `${settings.agent.label} · ${session.name}`,
      sessionFile: session.sessionFile,
      cwd: session.workdir,
      projectContext: projectSessionContextText(session),
    }));
  }
  return bridge.agentAdaptersBySession.get(key);
}

function routingStateFor(channelKey) {
  const key = String(channelKey || 'default');
  let state = bridge.routingStateByChannel.get(key);
  if (!state) {
    state = {
      activeRouting: { backend: settings.agent.backend, sticky: false },
      lastUsedBackend: settings.agent.backend,
      lastResolvedDecisions: {},
      pendingFallbackPrompt: null,
      recentUtterances: [],
    };
    bridge.routingStateByChannel.set(key, state);
  }
  return state;
}

function recordUtterance(channelKey, text) {
  if (!text) return;
  const state = routingStateFor(channelKey);
  state.recentUtterances.push(text);
  while (state.recentUtterances.length > 4) state.recentUtterances.shift();
}

function clearTransientRouting(channelKey) {
  const state = routingStateFor(channelKey);
  state.pendingFallbackPrompt = null;
  if (!state.activeRouting?.sticky) {
    state.activeRouting = { backend: settings.agent.backend, sticky: false };
  }
}

function adapterForBackend(backend, session = null) {
  const normalized = String(backend || '').toLowerCase();
  if (!normalized || normalized === settings.agent.backend) {
    return session ? adapterForProjectSession(session) : agentAdapter;
  }
  const key = `${normalized}::${session ? (session.slug || session.name) : '_default'}`;
  if (bridge.agentAdaptersByBackend.has(key)) return bridge.agentAdaptersByBackend.get(key);
  let routedSettings;
  try {
    const scrubbed = { ...process.env };
    for (const key of ['AGENT_BACKEND', 'AGENT_LABEL', 'AGENT_COMMAND', 'AGENT_SESSION_FILE']) {
      delete scrubbed[key];
    }
    scrubbed.AGENT_BACKEND = normalized;
    routedSettings = buildAgentSettings({
      ROOT: settings.agent.cwd || process.cwd(),
      env: scrubbed,
    });
  } catch (e) {
    warn(`adapterForBackend: cannot build settings for ${normalized}: ${e?.message || e}`);
    return null;
  }
  if (session) {
    routedSettings = {
      ...routedSettings,
      label: `${routedSettings.label} · ${session.name}`,
      sessionFile: session.sessionFile,
      cwd: session.workdir || routedSettings.cwd,
      projectContext: projectSessionContextText(session),
    };
  }
  const argv = shellSplit(String(routedSettings.command || ''));
  const binary = argv[0];
  if (binary && !commandIsInstalled(binary, { cwd: routedSettings.cwd || settings.agent.cwd || process.cwd() })) {
    warn(`adapterForBackend: ${normalized} binary not found on PATH: ${binary}`);
    return null;
  }
  const adapter = createBridgeAgentAdapter(routedSettings);
  bridge.agentAdaptersByBackend.set(key, adapter);
  return adapter;
}

async function handleTtsVoiceCommand(prompt, signal) {
  const request = voiceCommandFromTranscript(prompt);
  if (!request) return false;
  discardVoiceInputQueues('voice-change');
  let config = ensureTtsVoiceConfig();
  config = updateTtsVoiceConfig(config, request);
  writeTtsVoiceConfig(TTS_VOICE_CONFIG_PATH, config);
  const { selection } = applyVoiceConfigToProcessEnv(config);
  await ensureSelectedTtsBackendInstalled(selection, signal);
  rebuildTtsRuntimeSettings(selection);
  if (selection.voice?.language) settings.voiceLanguage = selection.voice.language;
  persistEnvValues({
    TTS_BACKEND: selection.backend,
    TTS_VOICE_TYPE: selection.voiceType,
    TTS_VOICE: selection.backend === 'edge' ? selection.voice.voice : process.env.TTS_VOICE,
    VOICE_LANGUAGE: settings.voiceLanguage,
    MLXAUDIO_PYTHON: selection.backend === 'mlxaudio' ? (process.env.MLXAUDIO_PYTHON || './.venv-mlxaudio/bin/python') : process.env.MLXAUDIO_PYTHON,
    MLXAUDIO_VOICE: selection.backend === 'mlxaudio' ? (process.env.MLXAUDIO_VOICE || selection.voice?.voice) : process.env.MLXAUDIO_VOICE,
    FIREREDTTS2_COMMAND: selection.backend === 'fireredtts2' ? (process.env.FIREREDTTS2_COMMAND || './.local/bin/fireredtts2') : process.env.FIREREDTTS2_COMMAND,
    FIREREDTTS2_PRETRAINED_DIR: selection.backend === 'fireredtts2' ? (process.env.FIREREDTTS2_PRETRAINED_DIR || 'pretrained_models/FireRedTTS2') : process.env.FIREREDTTS2_PRETRAINED_DIR,
  });
  await speakText(voiceChangedText(selection), signal);
  notifyVoiceCloneSampleGapIfNeeded(selection, signal).catch(e => warn('voice clone gap notice failed', e?.message || e));
  return true;
}

async function handleLanguageCommand(prompt, signal) {
  const request = voiceLanguageCommandFromTranscript(prompt);
  if (!request) return false;
  const preset = applyRuntimeLanguage(request.language);
  await speakText(languageChangedText(preset), signal);
  return true;
}

async function handleVoiceCloneCommand(userId, prompt, signal = null) {
  const command = voiceCloneCommandFromText(prompt);
  if (!command) return false;
  if (command.action === 'cancel') {
    const cancelled = voiceCloneCapture.cancel(userId);
    await sendText(cancelled ? '🎙️ 보이스 클로닝 샘플 캡처를 취소했어.' : '🎙️ 대기 중인 보이스 클로닝 샘플 캡처가 없어.');
    await speakText(cancelled ? '목소리 샘플 녹음 대기를 취소했어.' : '대기 중인 목소리 샘플 녹음은 없어.', signal);
    return true;
  }
  if (command.action === 'status') {
    const current = voiceCloneCapture.current();
    const status = current?.userId === String(userId)
      ? `🎙️ 다음 유효한 음성을 ${path.relative(ROOT, current.targetPath)}에 저장할게.`
      : '🎙️ 지금 대기 중인 보이스 클로닝 샘플 캡처는 없어.';
    await sendText(status);
    await speakText(current?.userId === String(userId) ? '다음에 말하는 목소리를 샘플로 저장할게.' : '대기 중인 목소리 샘플 녹음은 없어.', signal);
    return true;
  }
  const armed = voiceCloneCapture.arm({ userId, source: 'voice-command' });
  await sendText(`🎙️ 보이스 클로닝 샘플 캡처 대기 중. 다음 10초에서 30초 정도 말하면 ${path.relative(ROOT, armed.targetPath)}에 저장할게.`);
  await speakText('좋아. 다음에 10초에서 30초 정도 말하면 그 음성을 목소리 샘플로 저장할게.', signal);
  return true;
}

function interruptCurrentResponse(userId, reason = 'barge-in') {
  if (!bridge.speaking && !bridge.processing) return false;
  const turnId = bridge.activeTurnId;
  if (turnId) bridge.interruptedTurns.add(turnId);
  log('interrupt current response', 'byUser', userId, 'reason', reason, 'speaking', bridge.speaking, 'processing', bridge.processing, 'turn', turnId);
  if (bridge.currentAbortController && !bridge.currentAbortController.signal.aborted) {
    try { bridge.currentAbortController.abort(); } catch (e) { warn('abort current response failed', e?.stack || e); }
  }
  try { bridge.player.stop(true); } catch (e) { warn('stop playback failed', e?.stack || e); }
  bridge.speaking = false;
  bridge.processing = false;
  return true;
}

  return {

    adapterForProjectSession,
    routingStateFor,
    recordUtterance,
    clearTransientRouting,
    adapterForBackend,
    handleTtsVoiceCommand,
    handleLanguageCommand,
    handleVoiceCloneCommand,
    interruptCurrentResponse,
  };
}
