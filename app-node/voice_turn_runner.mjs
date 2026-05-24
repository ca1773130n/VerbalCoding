// Per-turn agent execution: takes a Discord voice utterance from voice_io,
// runs it through dispatch (wake/language/voice/clone/sensitivity/verbose/
// research/cross-agent/plan-mode), invokes the selected agent adapter, drives
// the progress idle loop while waiting, then sends + speaks the answer.
//
// Phase 7a extraction from utterance_router.mjs. handleRecording was the
// single biggest function in the codebase (~365 LOC) and was the reason
// utterance_router had a 90-key dep list. Pulling it into its own module
// lets utterance_router go back to being plain command dispatch + adapter
// selection.
//
// Voice IO calls handleRecording via main.mjs's forward-declared
// `voiceTurnRunner` and a thunk:
//   handleRecording: (...args) => voiceTurnRunner.handleRecording(...args)
// At runtime the thunk resolves through the closure after createVoiceTurnRunner
// has been constructed.

export function createVoiceTurnRunner(deps) {
  const {
    bridge,
    agentTurnLifecycle,
    settings,
    client,
    log,
    warn,
    fs,
    transcribe,
    beginStreamingTurn,
    endStreamingTurn,
    speakText,
    queueProgressSpeechText,
    stopProgressSpeech,
    speakImmediateNotice,
    maybeNotifyTaskComplete,
    handleLanguageCommand,
    handleTtsVoiceCommand,
    handleVoiceCloneCommand,
    dispatchPlanModeUtterance,
    adapterForBackend,
    adapterForProjectSession,
    planChannelKey,
    routingStateFor,
    recordUtterance,
    clearTransientRouting,
    isAllowed,
    isAbortError,
    sleep,
    sendText,
    sendEmbed,
    reloadRuntimeLanguageFromEnv,
    drainDeferredProcessingUtterances,
    resolveProjectSessionForChannel,
    projectSessionContextText,
    ontologyStateFor,
    captureOntologyFromTurn,
    formatRecentDiscordContext,
    formatSttResultMessage,
    formatSttStartMessage,
    formatVoiceErrorMessage,
    formatWakeRejectedMessage,
    agentAnswerHeader,
    emptyAgentAnswer,
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
    parseDecisionAnswer,
    parseResearchCommand,
    runResearchTurn,
    PROGRESS_IDLE_CHECK_MS,
    PROGRESS_IDLE_NOTICE_INITIAL_MS,
    PROGRESS_IDLE_NOTICE_LIMIT,
    PROGRESS_IDLE_NOTICE_MAX_MS,
    PROGRESS_IDLE_NOTICE_MULTIPLIER,
    STT_START_VOICE_NOTICE,
  } = deps;

async function handleRecording(userId, wavPath, pcmBytes, segments = 1, metricsTurn = null) {
  if (bridge.processing) { log('drop while processing', userId); metricsTurn?.finish({ status: 'drop_processing' }); return; }
  if (!isAllowed(userId)) { warn('ignore unauthorized', userId); metricsTurn?.finish({ status: 'unauthorized' }); return; }
  const turn = agentTurnLifecycle.start({ withTurnId: true });
  const { controller, signal, turnId } = turn;
  const sessionForVoice = resolveProjectSessionForChannel(bridge.activeVoiceChannelId || settings.transcriptChannelId);
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
    // agentTurnLifecycle.start() already seeded bridge.activeProgressAbortController
    // and bridge.activeProgressSignal at the top of the turn. Reuse the lifecycle's
    // progressController so cleanup ownership stays consistent.
    const progressController = turn.progressController;
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
    agentTurnLifecycle.finish(turn);
    if (bridge.bridgeState.deferredSize() > 0) {
      setImmediate(() => drainDeferredProcessingUtterances().catch(e => warn('drain deferred utterance failed', e?.stack || e)));
    }
  }
}

  return { handleRecording };
}
