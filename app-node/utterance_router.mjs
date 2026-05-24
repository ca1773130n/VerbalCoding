// Voice utterance dispatch chain extracted from main.mjs (Phase 4a).
//
// createUtteranceRouter(deps) closes over the bridge and ~40 helpers and
// returns the dispatch handlers main.mjs used to own: dispatchPlanModeUtterance,
// handleTtsVoiceCommand, handleLanguageCommand, handleVoiceCloneCommand, plus
// the routing/plan/adapter helpers that only the dispatch chain touched.
// handleRecording (the orchestrator) stays in main.mjs for Phase 4b.

export function createUtteranceRouter(deps) {
  const {
    bridge,
    log,
    warn,
    path,
    fs,
    ROOT,
    TTS_VOICE_CONFIG_PATH,
    agentAdapter,
    settings,
    isPlanEntryUtterance,
    parsePlanOutput,
    parsePlanVoiceCommand,
    applyPlanCommand,
    renderFinalPlan,
    planModePreamble,
    planExecutionPreamble,
    parseDecisionAnswer,
    renderDecisionPrompt,
    renderResolvedDecisions,
    isAgentRoutingDecision,
    projectSessionContextText,
    resolveProjectSessionForChannel,
    createBridgeAgentAdapter,
    buildAgentSettings,
    commandIsInstalled,
    shellSplit,
    sendText,
    speakText,
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
  } = deps;

function planChannelKey() {
  return bridge.activeVoiceChannelId || settings.transcriptChannelId || 'default';
}

async function askNextDecision(state, signal) {
  const decision = state.decisions[state.pendingDecisionIndex];
  if (!decision) return;
  const text = renderDecisionPrompt(decision, state.language);
  await sendText(`❓ ${text}`);
  await speakText(text, signal, null);
}

async function finalizePlanReady(state, signal) {
  const language = state.language;
  const resolvedLine = renderResolvedDecisions(state.resolvedDecisions, language);
  const plan = planNarrationLines(state.steps, language);
  const tail = /^en/i.test(String(language || ''))
    ? `${plan}\n${resolvedLine}\nSay "approve" to run, or edit with skip/insert.`
    : `${plan}\n${resolvedLine}\n"실행"이라고 하면 시작할게. skip/insert로 수정도 돼.`;
  await sendText(`📝 ${tail}`);
  await speakText(tail, signal, null);
}

async function dispatchPlanModeUtterance(prompt, signal) {
  const language = settings.voiceLanguage;
  const key = planChannelKey();
  const existing = bridge.planStates.get(key);

  if (existing && existing.pendingDecisionIndex < existing.decisions.length) {
    const controlCommand = parsePlanVoiceCommand(prompt, language);
    if (controlCommand.type === 'cancel') {
      const cancelState = routingStateFor(key);
      if (existing.routingSnapshot) cancelState.activeRouting = { ...existing.routingSnapshot };
      cancelState.pendingFallbackPrompt = null;
      cancelState.lastResolvedDecisions = {};
      bridge.planStates.delete(key);
      const msg = /^en/i.test(String(language || '')) ? 'Plan cancelled.' : '계획을 취소했어.';
      await sendText(`❎ ${msg}`);
      await speakText(msg, signal, null);
      return { handled: true };
    }
    const decision = existing.decisions[existing.pendingDecisionIndex];
    const answer = parseDecisionAnswer(prompt, decision, language);
    if (answer.type === 'unknown') {
      await sendText(/^en/i.test(String(language || ''))
        ? '⚠️ I did not catch that. Please pick an option.'
        : '⚠️ 못 알아들었어. 옵션 중에 하나 골라줘.');
      await askNextDecision(existing, signal);
      return { handled: true };
    }
    const next = {
      ...existing,
      resolvedDecisions: { ...existing.resolvedDecisions, [decision.slot]: answer.choice },
      pendingDecisionIndex: existing.pendingDecisionIndex + 1,
    };
    bridge.planStates.set(key, next);
    if (isAgentRoutingDecision(decision) && answer.choice) {
      const candidate = adapterForBackend(answer.choice, resolveProjectSessionForChannel(key));
      if (candidate) {
        routingStateFor(key).activeRouting = { backend: answer.choice, sticky: true };
      } else {
        const msg = /^en/i.test(String(language || ''))
          ? `${answer.choice} is not installed; staying with ${settings.agent.label}.`
          : `${answer.choice}이(가) 설치되어 있지 않아. ${settings.agent.label}로 진행할게.`;
        await sendText(`⚠️ ${msg}`);
        await speakText(msg, signal, null);
      }
    }
    if (next.pendingDecisionIndex < next.decisions.length) {
      await askNextDecision(next, signal);
    } else {
      await finalizePlanReady(next, signal);
    }
    return { handled: true };
  }

  if (existing) {
    const cmd = parsePlanVoiceCommand(prompt, language);
    if (cmd.type === 'skip' || cmd.type === 'insert') {
      const nextSteps = applyPlanCommand(existing.steps, cmd);
      bridge.planStates.set(key, { ...existing, steps: nextSteps });
      await finalizePlanReady({ ...existing, steps: nextSteps }, signal);
      return { handled: true };
    }
    if (cmd.type === 'cancel') {
      const cancelState = routingStateFor(key);
      if (existing.routingSnapshot) cancelState.activeRouting = { ...existing.routingSnapshot };
      cancelState.pendingFallbackPrompt = null;
      cancelState.lastResolvedDecisions = {};
      bridge.planStates.delete(key);
      const msg = /^en/i.test(String(language || '')) ? 'Plan cancelled.' : '계획을 취소했어.';
      await sendText(`❎ ${msg}`);
      await speakText(msg, signal, null);
      return { handled: true };
    }
    if (cmd.type === 'approve') {
      routingStateFor(key).lastResolvedDecisions = existing.resolvedDecisions || {};
      const finalPlan = renderFinalPlan(existing.steps);
      const resolvedLine = renderResolvedDecisions(existing.resolvedDecisions, language);
      const promptToRun = [
        planExecutionPreamble(language),
        '',
        finalPlan,
        resolvedLine,
        '',
        `Original user request: ${existing.originalPrompt}`,
      ].filter(Boolean).join('\n');
      bridge.planStates.delete(key);
      const note = /^en/i.test(String(language || '')) ? 'Running the plan now.' : '계획대로 실행할게.';
      await sendText(`▶ ${note}`);
      await speakText(note, signal, null);
      return { handled: false, prompt: promptToRun };
    }
    bridge.planStates.delete(key);
    return { handled: false, prompt };
  }

  if (isPlanEntryUtterance(prompt, language)) {
    const planPrompt = `${planModePreamble(language)}\n\nUser request: ${prompt}`;
    const adapter = adapterForProjectSession(resolveProjectSessionForChannel(planChannelKey()));
    const plan = { task: false, label: adapter.label, verboseProgress: false, language, projectContext: '' };
    const result = await adapter.run(planPrompt, signal, plan).catch(e => ({ answer: '', error: e }));
    const { steps, decisions } = parsePlanOutput(result.answer || '');
    if (!steps.length) {
      const failMsg = /^en/i.test(String(language || ''))
        ? 'I could not produce a plan. Continuing as a regular turn.'
        : '계획을 만들지 못했어. 일반 작업으로 진행할게.';
      await sendText(`⚠️ ${failMsg}`);
      return { handled: false, prompt };
    }
    const planKey = planChannelKey();
    const routingSnapshot = { ...routingStateFor(planKey).activeRouting };
    const state = {
      steps,
      decisions,
      resolvedDecisions: {},
      pendingDecisionIndex: 0,
      originalPrompt: prompt,
      language,
      routingSnapshot,
    };
    bridge.planStates.set(planKey, state);
    const narration = planNarrationLines(steps, language);
    await sendText(`📝 ${narration}`);
    await speakText(narration, signal, null);
    if (decisions.length) {
      await askNextDecision(state, signal);
    } else {
      await finalizePlanReady(state, signal);
    }
    return { handled: true };
  }
  return { handled: false, prompt };
}

function planNarrationLines(steps, language) {
  const visible = steps.filter(s => s.status !== 'skipped');
  const header = /^en/i.test(String(language || ''))
    ? `Plan with ${visible.length} steps. Say "skip step N", "add X after step N", or "approve" to run.`
    : `${visible.length}단계 계획. "step N 건너뛰어", "step N 다음에 X 추가", "실행"이라고 말해줘.`;
  const body = visible.map((s, i) => `${i + 1}. ${s.text}`).join('\n');
  return `${header}\n${body}`;
}

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
    planChannelKey,
    askNextDecision,
    finalizePlanReady,
    dispatchPlanModeUtterance,
    planNarrationLines,
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
