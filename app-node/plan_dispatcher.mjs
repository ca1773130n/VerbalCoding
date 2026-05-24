// Plan-mode dispatcher: STATEFUL plan-mode logic that builds on
// ./plan_mode.mjs's pure parsers/renderers. Owns the per-channel plan
// state lifecycle on bridge.planStates and the multi-turn decision UX.
//
// Phase 7b extraction from utterance_router.mjs. Five functions:
//   - planChannelKey: which channel-id keys the plan state. Kept here
//     because plan state, routing state, and ontology state all share
//     this key shape.
//   - askNextDecision / finalizePlanReady / planNarrationLines: the
//     narration helpers used to prompt the user for next decisions or
//     confirm a plan is ready to run.
//   - dispatchPlanModeUtterance: the multi-turn state machine. Detects
//     plan-entry utterances, processes voice approve/skip/insert/cancel
//     commands, resolves decisions one at a time, and either re-prompts
//     or returns { handled, prompt? } for the caller to feed to the agent.
//
// Caller integration: voice_turn_runner consumes dispatchPlanModeUtterance
// as a dep. The Discord text path doesn't touch plan mode (no plan-mode
// integration in text agent messages today).

export function createPlanDispatcher(deps) {
  const {
    bridge,
    settings,
    sendText,
    speakText,
    routingStateFor,
    adapterForBackend,
    adapterForProjectSession,
    resolveProjectSessionForChannel,
    isAgentRoutingDecision,
    parseDecisionAnswer,
    parsePlanVoiceCommand,
    applyPlanCommand,
    parsePlanOutput,
    renderDecisionPrompt,
    renderResolvedDecisions,
    renderFinalPlan,
    planModePreamble,
    planExecutionPreamble,
    isPlanEntryUtterance,
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

  return {
    planChannelKey,
    askNextDecision,
    finalizePlanReady,
    dispatchPlanModeUtterance,
    planNarrationLines,
  };
}
