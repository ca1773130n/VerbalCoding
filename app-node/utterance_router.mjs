// Voice utterance dispatch chain extracted from main.mjs (Phase 4a + 4b).
//
// createUtteranceRouter(deps) closes over the bridge and ~90 helpers and
// returns the dispatch handlers main.mjs used to own, plus handleRecording,
// the per-turn orchestrator (STT -> command routing -> agent -> TTS).
//
// Circular dep with voice_io: voice_io.flushUtterance calls into
// handleRecording, but handleRecording calls voice_io.transcribe. main.mjs
// resolves this by constructing voiceIO first (passing a thunk for
// handleRecording) and then the router with the now-bound transcribe.

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
    // Phase 4b additions for handleRecording
    transcribe,
    beginStreamingTurn,
    endStreamingTurn,
    client,
    isAllowed,
    isAbortError,
    sleep,
    sendEmbed,
    speakImmediateNotice,
    reloadRuntimeLanguageFromEnv,
    drainDeferredProcessingUtterances,
    maybeNotifyTaskComplete,
    ontologyStateFor,
    captureOntologyFromTurn,
    queueProgressSpeechText,
    stopProgressSpeech,
    agentAnswerHeader,
    emptyAgentAnswer,
    formatRecentDiscordContext,
    formatSttResultMessage,
    formatSttStartMessage,
    formatVoiceErrorMessage,
    formatWakeRejectedMessage,
    spokenResultOnly,
    stripWake,
    acceptsWake,
    sensitivityChangedSpeech,
    sensitivityModeFromTranscript,
    sensitivityStatusText,
    setSensitivityMode,
    isSensitivityOnlyRequest,
    verboseChangedSpeech,
    verboseModeFromTranscript,
    verboseStatusText,
    setVerboseProgress,
    isVerboseOnlyRequest,
    isRoutingOnlyUtterance,
    parseAgentRoutingCommand,
    renderAgentPrefix,
    buildCrossAgentPrompt,
    buildFallbackDecision,
    parseResearchCommand,
    runResearchTurn,
    PROGRESS_IDLE_CHECK_MS,
    PROGRESS_IDLE_NOTICE_INITIAL_MS,
    PROGRESS_IDLE_NOTICE_LIMIT,
    PROGRESS_IDLE_NOTICE_MAX_MS,
    PROGRESS_IDLE_NOTICE_MULTIPLIER,
    STT_START_VOICE_NOTICE,
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
async function handleRecording(userId, wavPath, pcmBytes, segments = 1, metricsTurn = null) {
  if (bridge.processing) { log('drop while processing', userId); metricsTurn?.finish({ status: 'drop_processing' }); return; }
  if (!isAllowed(userId)) { warn('ignore unauthorized', userId); metricsTurn?.finish({ status: 'unauthorized' }); return; }
  bridge.processing = true;
  const turnId = ++bridge.activeTurnId;
  const controller = new AbortController();
  bridge.currentAbortController = controller;
  const signal = controller.signal;
  const sessionForVoice = resolveProjectSessionForChannel(bridge.activeVoiceChannelId || settings.transcriptChannelId);
  const previousTranscriptChannelId = bridge.activeTranscriptChannelId;
  bridge.activeTranscriptChannelId = sessionForVoice?.transcriptChannelId || settings.transcriptChannelId;
  try {
    const runtimeLanguage = reloadRuntimeLanguageFromEnv();
    if (runtimeLanguage.changed) {
      log('drop current utterance because language changed before STT', userId, 'turn', turnId, 'language', runtimeLanguage.voiceLanguage);
      fs.rm(wavPath, { force: true }, () => {});
      metricsTurn?.finish({ status: 'drop_stale_language_change' });
      return;
    }
    const session = resolveProjectSessionForChannel(bridge.activeVoiceChannelId || settings.transcriptChannelId);
    bridge.activeTranscriptChannelId = session?.transcriptChannelId || settings.transcriptChannelId;
    log('voice turn text target', session ? `project=${session.slug}` : 'project=default', 'channel', bridge.activeTranscriptChannelId ? 'project-or-default' : 'none');
    log('transcribing', userId, wavPath, 'pcmBytes', pcmBytes, 'segments', segments, 'turn', turnId);
    const sttNotice = formatSttStartMessage(settings.voiceLanguage);
    await sendText(sttNotice);
    const sttNoticeSpeech = STT_START_VOICE_NOTICE
      ? speakImmediateNotice(sttNotice.replace(/^🎧\s*/u, ''), signal, 'stt-start')
      : Promise.resolve();
    const sttStart = Date.now();
    const text = await transcribe(wavPath);
    await sttNoticeSpeech;
    metricsTurn?.stage('stt', Date.now() - sttStart, { transcriptChars: String(text || '').length });
    if (bridge.interruptedTurns.has(turnId) || signal.aborted) { metricsTurn?.finish({ status: 'aborted_after_stt' }); return; }
    if (!text) { log('empty transcript', userId, wavPath); metricsTurn?.finish({ status: 'empty_transcript' }); return; }
    log(`user ${userId} said: ${text}`);
    await sendText(formatSttResultMessage(settings.voiceLanguage, userId, text));
    if (!acceptsWake(text)) { await sendText(formatWakeRejectedMessage(settings.voiceLanguage)); metricsTurn?.finish({ status: 'wake_rejected' }); return; }

    let prompt = stripWake(text);
    if (await handleLanguageCommand(prompt, signal)) {
      metricsTurn?.finish({ status: 'language_command' });
      return;
    }
    if (await handleTtsVoiceCommand(prompt, signal)) {
      metricsTurn?.finish({ status: 'voice_command' });
      return;
    }
    if (await handleVoiceCloneCommand(userId, prompt, signal)) {
      metricsTurn?.finish({ status: 'voice_clone_command' });
      return;
    }
    const sensitivityRequest = sensitivityModeFromTranscript(prompt);
    if (sensitivityRequest) {
      const thresholds = setSensitivityMode(sensitivityRequest.mode, sensitivityRequest.reason);
      await sendText(`🎚️ ${sensitivityStatusText()}`);
      if (isSensitivityOnlyRequest(prompt)) {
        await speakText(sensitivityChangedSpeech(thresholds.mode, settings.voiceLanguage), signal, metricsTurn);
        metricsTurn?.finish({ status: 'sensitivity_only' });
        return;
      }
    }
    const verboseRequest = verboseModeFromTranscript(prompt);
    if (verboseRequest !== null) {
      setVerboseProgress(verboseRequest, 'voice-command');
      await sendText(`🔎 ${verboseStatusText()}`);
      if (isVerboseOnlyRequest(prompt)) {
        await speakText(verboseChangedSpeech(verboseRequest, settings.voiceLanguage), signal, metricsTurn);
        metricsTurn?.finish({ status: 'verbose_only' });
        return;
      }
    }
    const routingKey = planChannelKey();
    const routingState = routingStateFor(routingKey);
    if (routingState.pendingFallbackPrompt) {
      const decision = buildFallbackDecision(
        routingState.pendingFallbackPrompt.requestedBackend || 'agent',
        settings.agent.label,
        settings.voiceLanguage,
      );
      const fallbackAnswer = parseDecisionAnswer(prompt, decision, settings.voiceLanguage);
      if (fallbackAnswer.type === 'unknown') {
        const msg = /^en/i.test(String(settings.voiceLanguage || ''))
          ? 'Please answer yes or no.'
          : '예 또는 아니오로 대답해줘.';
        await sendText(`⚠️ ${msg}`);
        await speakText(msg, signal, null);
        metricsTurn?.finish({ status: 'fallback_pending' });
        return;
      }
      const accepted = fallbackAnswer.type === 'auto' || fallbackAnswer.choice === 'yes';
      const previous = routingState.pendingFallbackPrompt;
      routingState.pendingFallbackPrompt = null;
      if (!accepted) {
        const msg = /^en/i.test(String(settings.voiceLanguage || '')) ? 'Cancelled.' : '취소했어.';
        await sendText(`❎ ${msg}`);
        await speakText(msg, signal, null);
        metricsTurn?.finish({ status: 'fallback_declined' });
        return;
      }
      routingState.activeRouting = { backend: settings.agent.backend, sticky: false };
      prompt = previous.originalPrompt;
    }

    const researchCmd = parseResearchCommand(prompt, settings.voiceLanguage);
    if (researchCmd.type === 'research') {
      const preemptiveRouting = parseAgentRoutingCommand(prompt, settings.voiceLanguage);
      let researchBackend = routingState.activeRouting.backend;
      if (preemptiveRouting.type === 'route') {
        const routedCandidate = adapterForBackend(preemptiveRouting.backend, session);
        if (routedCandidate) {
          researchBackend = preemptiveRouting.backend;
          if (preemptiveRouting.sticky) routingState.activeRouting = { backend: preemptiveRouting.backend, sticky: true };
        } else {
          const en = /^en/i.test(String(settings.voiceLanguage || ''));
          const msg = en
            ? `${preemptiveRouting.backend} is not installed. Want me to research with ${settings.agent.label} instead?`
            : `${preemptiveRouting.backend}이(가) 설치되어 있지 않아. ${settings.agent.label}로 리서치할까?`;
          await sendText(`⚠️ ${msg}`);
          await speakText(msg, signal, null);
          routingState.pendingFallbackPrompt = {
            requestedBackend: preemptiveRouting.backend,
            originalPrompt: `research ${researchCmd.query}`,
          };
          metricsTurn?.finish({ status: 'research_routing_fallback_pending' });
          return;
        }
      }
      const en = /^en/i.test(String(settings.voiceLanguage || ''));
      const startMsg = en ? `Researching ${researchCmd.query}.` : `${researchCmd.query} 리서치할게.`;
      await sendText(`🔎 ${startMsg}`);
      await speakText(startMsg, signal, null);
      const adapter = adapterForBackend(researchBackend, session) || adapterForProjectSession(session);
      const synthesize = async (synthPrompt, opts = {}) => {
        const out = await adapter.ask(synthPrompt, signal, {
          task: Boolean(opts.task),
          label: adapter.label,
          language: settings.voiceLanguage,
        });
        return String(out || '');
      };
      const result = await runResearchTurn({ query: researchCmd.query, language: settings.voiceLanguage, synthesize, signal })
        .catch(e => ({ status: 'error', error: e?.message || String(e), query: researchCmd.query }));
      if (result.status === 'ok') {
        const sentEmbed = await sendEmbed(result.embed);
        if (!sentEmbed) await sendText(result.markdown);
        await speakText(result.speech, signal, null);
        captureOntologyFromTurn(routingKey, { prompt, answer: result.bullets.join('\n'), backend: 'research' });
      } else if (result.status === 'empty') {
        await sendText(result.markdown);
        await speakText(result.speech, signal, null);
      } else if (result.status === 'no_backend') {
        const msg = en
          ? 'No search backend is configured. Set TAVILY_API_KEY, BRAVE_SEARCH_API_KEY, SEARXNG_URL, or SEARCH_BACKEND_AGENT_FALLBACK=1 to delegate research to the active agent.'
          : '검색 백엔드가 설정돼 있지 않아. TAVILY_API_KEY, BRAVE_SEARCH_API_KEY, SEARXNG_URL 중 하나를 설정하거나 SEARCH_BACKEND_AGENT_FALLBACK=1로 활성 에이전트에게 위임할 수 있어.';
        await sendText(`⚠️ ${msg}`);
        await speakText(msg, signal, null);
      } else {
        const msg = en ? `Research failed: ${result.error || result.status}` : `리서치 실패: ${result.error || result.status}`;
        await sendText(`⚠️ ${msg}`);
        await speakText(en ? 'Research failed.' : '리서치 실패.', signal, null);
      }
      if (preemptiveRouting.type === 'route' && !preemptiveRouting.sticky && researchBackend !== settings.agent.backend) {
        routingState.activeRouting = { backend: settings.agent.backend, sticky: false };
      }
      metricsTurn?.finish({ status: `research_${result.status}` });
      return;
    }

    const routing = parseAgentRoutingCommand(prompt, settings.voiceLanguage);
    if (routing.type === 'restore') {
      routingState.activeRouting = { backend: settings.agent.backend, sticky: false };
      const msg = /^en/i.test(String(settings.voiceLanguage || ''))
        ? `Back to the default agent (${settings.agent.label}).`
        : `기본 에이전트로 돌아갈게 (${settings.agent.label}).`;
      await sendText(`↩ ${msg}`);
      await speakText(msg, signal, null);
      metricsTurn?.finish({ status: 'routing_restore' });
      return;
    }
    if (routing.type === 'route') {
      const candidate = adapterForBackend(routing.backend, session);
      if (!candidate) {
        const msg = /^en/i.test(String(settings.voiceLanguage || ''))
          ? `${routing.backend} is not installed. Want me to use ${settings.agent.label} instead?`
          : `${routing.backend}이(가) 설치되어 있지 않아. ${settings.agent.label}로 대신 진행할까?`;
        await sendText(`⚠️ ${msg}`);
        await speakText(msg, signal, null);
        routingState.pendingFallbackPrompt = { requestedBackend: routing.backend, originalPrompt: prompt };
        metricsTurn?.finish({ status: 'routing_fallback_pending' });
        return;
      }
      routingState.activeRouting = { backend: routing.backend, sticky: routing.sticky };
      if (isRoutingOnlyUtterance(prompt)) {
        const en = /^en/i.test(String(settings.voiceLanguage || ''));
        const label = candidate.label || routing.backend;
        const msg = routing.sticky
          ? (en ? `Switched to ${label}.` : `${label}로 전환했어.`)
          : (en ? `Asking ${label} this turn.` : `이번 턴은 ${label}로 진행할게.`);
        await sendText(`↪ ${msg}`);
        await speakText(msg, signal, null);
        metricsTurn?.finish({ status: 'routing_only' });
        return;
      }
    }
    recordUtterance(routingKey, prompt);

    let promptForAgent = prompt;
    try {
      const planOutcome = await dispatchPlanModeUtterance(prompt, signal);
      if (planOutcome.handled) {
        metricsTurn?.finish({ status: 'plan_mode' });
        return;
      }
      if (planOutcome.prompt) promptForAgent = planOutcome.prompt;
    } catch (e) {
      warn('plan mode dispatch failed', e?.stack || e);
    }
    const routedBackend = routingState.activeRouting.backend;
    const selectedAgentAdapter = adapterForBackend(routedBackend, session) || adapterForProjectSession(session);
    const isHandoff = routingState.lastUsedBackend !== routedBackend;
    const ttsPrefix = isHandoff ? renderAgentPrefix(routedBackend, settings.voiceLanguage) : '';
    if (isHandoff) {
      const ontologyStore = ontologyStateFor(routingKey);
      const ontologyBlock = ontologyStore.nodeCount > 0
        ? ontologyStore.serializeForHandoff({ language: settings.voiceLanguage })
        : '';
      promptForAgent = buildCrossAgentPrompt({
        prompt: promptForAgent,
        fromBackend: routingState.lastUsedBackend,
        toBackend: routedBackend,
        resolvedDecisions: routingState.lastResolvedDecisions || {},
        priorUtterances: routingState.recentUtterances.slice(0, -1),
        language: settings.voiceLanguage,
      });
      if (ontologyBlock) {
        const header = /^en/i.test(String(settings.voiceLanguage || '')) ? '\n\n[Session ontology]\n' : '\n\n[세션 온톨로지]\n';
        promptForAgent = `${promptForAgent}${header}${ontologyBlock}`;
      }
    }
    routingState.lastUsedBackend = routedBackend;
    if (!routingState.activeRouting.sticky) routingState.activeRouting = { backend: settings.agent.backend, sticky: false };
    const projectContext = projectSessionContextText(session);
    const recentDiscordContext = formatRecentDiscordContext(bridge.recentDiscordTextByChannel, {
      channelId: bridge.activeTranscriptChannelId,
    });
    const plan = {
      task: true,
      label: selectedAgentAdapter.label,
      verboseProgress: bridge.verboseProgress,
      language: settings.voiceLanguage,
      cwd: session?.workdir,
      projectContext,
      recentDiscordContext,
    };
    log('Agent plan', plan.label, 'backend', selectedAgentAdapter.backend, 'task', plan.task, 'language', plan.language, session ? `project=${session.slug}` : 'project=default');
    const agentStart = Date.now();
    const progressController = new AbortController();
    bridge.activeProgressAbortController = progressController;
    bridge.activeProgressSignal = progressController.signal;
    bridge.activeProgressLastEventAt = Date.now();
    const streamingTurnActive = beginStreamingTurn(signal);
    if (streamingTurnActive && ttsPrefix && bridge.activeStreamingQueue) {
      bridge.activeStreamingQueue.enqueue(ttsPrefix.replace(/[:\s]+$/u, '.'));
    }
    const agentPromise = selectedAgentAdapter.ask(promptForAgent, signal, plan);
    let done = false;
    // Status announcements share one queue with verbose progress so they never
    // talk over each other. In verbose mode, skip the generic initial prompt;
    // the detailed tool/file/test events are the initial progress voice.
    const progressLoop = (async () => {
      if (!bridge.verboseProgress) {
        await sleep(2500);
        if (!done && !signal.aborted && !bridge.interruptedTurns.has(turnId)) {
          const initial = /^en/i.test(String(settings.voiceLanguage || ''))
            ? 'calling the agent.'
            : '에이전트 호출했어. 응답 기다리는 중.';
          queueProgressSpeechText(initial, progressController.signal, 'generic-initial');
        }
      }
      let idleNotices = 0;
      let nextIdleNoticeMs = PROGRESS_IDLE_NOTICE_INITIAL_MS;
      let lastObservedProgressAt = bridge.activeProgressLastEventAt;
      while (!done && !signal.aborted && !bridge.interruptedTurns.has(turnId) && idleNotices < PROGRESS_IDLE_NOTICE_LIMIT) {
        await sleep(Math.min(PROGRESS_IDLE_CHECK_MS, nextIdleNoticeMs));
        if (done || signal.aborted || bridge.interruptedTurns.has(turnId)) break;
        if (bridge.activeProgressLastEventAt !== lastObservedProgressAt) {
          lastObservedProgressAt = bridge.activeProgressLastEventAt;
          nextIdleNoticeMs = PROGRESS_IDLE_NOTICE_INITIAL_MS;
          continue;
        }
        const idleMs = Date.now() - bridge.activeProgressLastEventAt;
        if (idleMs < nextIdleNoticeMs) continue;
        idleNotices += 1;
        bridge.activeProgressLastEventAt = Date.now();
        lastObservedProgressAt = bridge.activeProgressLastEventAt;
        const idle = /^en/i.test(String(settings.voiceLanguage || ''))
          ? 'still working on that.'
          : '아직 작업 중이야.';
        queueProgressSpeechText(idle, progressController.signal, `idle-${idleNotices}-${Math.round(nextIdleNoticeMs / 1000)}s`);
        nextIdleNoticeMs = Math.min(
          PROGRESS_IDLE_NOTICE_MAX_MS,
          Math.max(nextIdleNoticeMs + 1000, Math.round(nextIdleNoticeMs * PROGRESS_IDLE_NOTICE_MULTIPLIER)),
        );
      }
    })().catch(e => {
      if (!isAbortError(e)) warn('progress loop failed', e?.stack || e);
    });
    const answer = await agentPromise.finally(() => { done = true; });
    if (streamingTurnActive) await endStreamingTurn();
    metricsTurn?.stage('agent', Date.now() - agentStart, { answerChars: String(answer || '').length, backend: selectedAgentAdapter.backend });
    void progressLoop;
    if (bridge.interruptedTurns.has(turnId) || signal.aborted) { metricsTurn?.finish({ status: 'aborted_after_agent' }); return; }

    log('Agent answer', selectedAgentAdapter.label, answer.slice(0, 200));
    captureOntologyFromTurn(routingKey, { prompt, answer, backend: routedBackend });
    const spokenAnswerCore = spokenResultOnly(prompt, answer, settings.voiceLanguage);
    const spokenAnswer = ttsPrefix ? `${ttsPrefix}${spokenAnswerCore}` : spokenAnswerCore;
    const fullAnswerText = `${agentAnswerHeader(settings.voiceLanguage, selectedAgentAdapter.label)}\n${answer || emptyAgentAnswer(settings.voiceLanguage)}`;
    log('send agent answer text', 'chars', fullAnswerText.length);
    const answerTextDelivered = await sendText(fullAnswerText);
    if (!answerTextDelivered) {
      warn('agent answer text delivery failed; still speaking answer');
    }
    log('spoken answer', spokenAnswer.slice(0, 200));
    stopProgressSpeech(progressController.signal, 'agent-answer-ready');
    if (streamingTurnActive && bridge.streamingSpeechDelivered) {
      log('skipping post-run speakText; streaming already delivered audio');
    } else {
      await speakText(spokenAnswer, signal, metricsTurn, { mirrorText: !answerTextDelivered });
    }
    try {
      const guildId = client.channels.cache.get(bridge.activeVoiceChannelId)?.guild?.id || '';
      await maybeNotifyTaskComplete({
        answer: spokenAnswer || answer,
        label: selectedAgentAdapter.label,
        elapsedMs: Date.now() - agentStart,
        guildId,
      });
    } catch (e) { warn('maybeNotifyTaskComplete failed', e?.message || e); }
    metricsTurn?.finish({ status: 'ok' });
  } catch (e) {
    if (isAbortError(e) || bridge.interruptedTurns.has(turnId)) {
      log('turn aborted', userId, 'turn', turnId);
      clearTransientRouting(planChannelKey());
      metricsTurn?.finish({ status: 'aborted' });
      return;
    }
    warn('handleRecording failed', e?.stack || e);
    const shortMsg = String(e?.message || e).slice(0, 800);
    metricsTurn?.finish({ status: 'error', error: shortMsg });
    await sendText(formatVoiceErrorMessage(settings.voiceLanguage, shortMsg));
  } finally {
    if (bridge.activeProgressAbortController && !bridge.activeProgressAbortController.signal.aborted) {
      try { bridge.activeProgressAbortController.abort(); } catch (e) { warn('abort progress speech in cleanup failed', e?.stack || e); }
    }
    if (bridge.activeProgressSignal === bridge.activeProgressAbortController?.signal) bridge.activeProgressSignal = null;
    bridge.activeProgressAbortController = null;
    if (bridge.currentAbortController === controller) bridge.currentAbortController = null;
    bridge.activeTranscriptChannelId = previousTranscriptChannelId;
    bridge.interruptedTurns.delete(turnId);
    if (bridge.activeTurnId === turnId) bridge.activeTurnId = 0;
    bridge.processing = false;
    if (bridge.bridgeState.deferredSize() > 0) {
      setImmediate(() => drainDeferredProcessingUtterances().catch(e => warn('drain deferred utterance failed', e?.stack || e)));
    }
  }
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
    handleRecording,
  };
}
