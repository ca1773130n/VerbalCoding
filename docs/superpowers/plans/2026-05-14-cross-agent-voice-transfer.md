Cross-Agent Voice Routing — Implementation Plan

**Status: shipped** (commits `ab5bd93` → `60d50bc`, hardened through `a674d87`). User-facing docs: [docs/USAGE.md § Cross-agent voice routing](../../USAGE.md#cross-agent-voice-routing). This file is preserved for historical/design reference.

---

Goal: Route a VerbalCoding voice turn to any installed CLI agent (Codex, Aider, Claude Code, Gemini, OpenCode, OpenClaw, Cursor, Hermes) by voice — either explicitly ("ask Codex", "switch to Aider") or via a which_agent slot in the agent's DECISIONS_BEGIN/END block — with graceful fallback when the routed agent isn't installed.

Architecture: New pure module agent_routing.mjs. plan_mode.mjs preamble update. main.mjs gets a per-backend adapter cache + routing state. Single-turn default; "switch to X" makes it sticky. TTS prefixes the agent's name only on backend change.

Files created: app-node/agent_routing.mjs, app-node/agent_routing.test.mjs, app-node/cross_agent_routing.test.mjs.
Files modified: app-node/plan_mode.mjs, app-node/plan_mode.test.mjs, app-node/main.mjs, app-node/agent_adapters.test.mjs.

Design decisions resolved:

Single-turn for "ask X"; sticky for "switch to X"; "back to default" restores.
Context-passing = prefix block prepended to the prompt string each adapter already accepts.
Cross-agent session log = in-memory ring buffer (last 4 utterances) + last resolved-decisions set. Persistence deferred to feedback-loop research.
TTS prefix only when backend changes. EN: "Codex says: ". KO: "코덱스: ".
Backward compat: existing plans/sessions/decisions unchanged. parseAgentRoutingCommand returns {type: 'none'} for unrelated input.
Task 1 — Create agent_routing.mjs with parseAgentRoutingCommand + resolveBackendAlias
Test file (app-node/agent_routing.test.mjs):

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAgentRoutingCommand, resolveBackendAlias } from './agent_routing.mjs';

test('parseAgentRoutingCommand recognizes "ask X" as single-turn', () => {
  assert.deepEqual(parseAgentRoutingCommand('ask Codex what it thinks', 'en'),
    { type: 'route', backend: 'codex', sticky: false });
  assert.deepEqual(parseAgentRoutingCommand('ask aider to write the test', 'en'),
    { type: 'route', backend: 'aider', sticky: false });
});

test('parseAgentRoutingCommand recognizes "switch to X" as sticky', () => {
  assert.deepEqual(parseAgentRoutingCommand('switch to Aider', 'en'),
    { type: 'route', backend: 'aider', sticky: true });
  assert.deepEqual(parseAgentRoutingCommand('switch to claude code', 'en'),
    { type: 'route', backend: 'claude', sticky: true });
});

test('parseAgentRoutingCommand recognizes Korean routing phrases', () => {
  assert.deepEqual(parseAgentRoutingCommand('코덱스한테 물어봐', 'ko'),
    { type: 'route', backend: 'codex', sticky: false });
  assert.deepEqual(parseAgentRoutingCommand('aider로 전환해', 'ko'),
    { type: 'route', backend: 'aider', sticky: true });
});

test('parseAgentRoutingCommand recognizes restore-default phrases', () => {
  assert.deepEqual(parseAgentRoutingCommand('back to default', 'en'),
    { type: 'restore' });
  assert.deepEqual(parseAgentRoutingCommand('use the default agent', 'en'),
    { type: 'restore' });
  assert.deepEqual(parseAgentRoutingCommand('기본으로 돌아가', 'ko'),
    { type: 'restore' });
});

test('parseAgentRoutingCommand returns none on unrelated input', () => {
  assert.deepEqual(parseAgentRoutingCommand('just write the function', 'en'),
    { type: 'none' });
  assert.deepEqual(parseAgentRoutingCommand('plan it first', 'en'),
    { type: 'none' });
});

test('resolveBackendAlias maps user-facing names to canonical backends', () => {
  assert.equal(resolveBackendAlias('Claude Code'), 'claude');
  assert.equal(resolveBackendAlias('claude'), 'claude');
  assert.equal(resolveBackendAlias('cursor cli'), 'cursor');
  assert.equal(resolveBackendAlias('gemini cli'), 'gemini');
  assert.equal(resolveBackendAlias('코덱스'), 'codex');
  assert.equal(resolveBackendAlias('unknown'), null);
});
Implementation (app-node/agent_routing.mjs):

const BACKEND_ALIASES = {
  hermes: ['hermes'],
  claude: ['claude code', 'claude-code', 'claude'],
  codex: ['codex', '코덱스'],
  gemini: ['gemini cli', 'gemini-cli', 'gemini', '제미나이'],
  opencode: ['opencode', 'open code'],
  openclaw: ['openclaw', 'open claw'],
  aider: ['aider', '에이더'],
  cursor: ['cursor cli', 'cursor-cli', 'cursor agent', 'cursor-agent', 'cursor'],
};

const BACKEND_LOOKUP = (() => {
  const pairs = [];
  for (const [backend, aliases] of Object.entries(BACKEND_ALIASES)) {
    for (const alias of aliases) pairs.push([alias.toLowerCase(), backend]);
  }
  pairs.sort((a, b) => b[0].length - a[0].length);
  return pairs;
})();

const ASK_EN = /\bask\s+([a-z][a-z0-9 \-]{1,30}?)(?:\s+(?:to|what|if|whether)\b|[?,.]|$)/i;
const SWITCH_EN = /\bswitch\s+to\s+([a-z][a-z0-9 \-]{1,30}?)(?:[?,.]|$)/i;
const LET_FINISH_EN = /\blet\s+([a-z][a-z0-9 \-]{1,30}?)\s+(?:finish|handle|do)\b/i;
const RESTORE_EN = /\b(back\s+to\s+default|use\s+the\s+default\s+agent|default\s+agent)\b/i;

const ASK_KO = /([가-힣A-Za-z][가-힣A-Za-z0-9\-]{1,30})(?:한테|에게|에)\s*(물어|질문)/;
const SWITCH_KO = /([가-힣A-Za-z][가-힣A-Za-z0-9\-]{1,30})(?:로|으로)\s*(전환|바꿔|바꿔줘)/;
const RESTORE_KO = /(기본(?:으로)?\s*(?:돌아|복귀)|기본\s*에이전트)/;

export function resolveBackendAlias(rawName) {
  const needle = String(rawName || '').toLowerCase().trim();
  if (!needle) return null;
  for (const [alias, backend] of BACKEND_LOOKUP) {
    if (needle === alias) return backend;
  }
  for (const [alias, backend] of BACKEND_LOOKUP) {
    if (needle.includes(alias)) return backend;
  }
  return null;
}

export function parseAgentRoutingCommand(text, language = 'en') {
  const t = String(text || '').trim();
  if (!t) return { type: 'none' };
  if (RESTORE_EN.test(t) || RESTORE_KO.test(t)) return { type: 'restore' };
  const switchMatch = t.match(SWITCH_EN) || t.match(LET_FINISH_EN);
  if (switchMatch) {
    const backend = resolveBackendAlias(switchMatch[1]);
    if (backend) return { type: 'route', backend, sticky: true };
  }
  const switchKo = t.match(SWITCH_KO);
  if (switchKo) {
    const backend = resolveBackendAlias(switchKo[1]);
    if (backend) return { type: 'route', backend, sticky: true };
  }
  const askMatch = t.match(ASK_EN);
  if (askMatch) {
    const backend = resolveBackendAlias(askMatch[1]);
    if (backend) return { type: 'route', backend, sticky: false };
  }
  const askKo = t.match(ASK_KO);
  if (askKo) {
    const backend = resolveBackendAlias(askKo[1]);
    if (backend) return { type: 'route', backend, sticky: false };
  }
  return { type: 'none' };
}
Verify: node --test app-node/agent_routing.test.mjs → 6 tests PASS.
Commit: feat(agent-routing): parseAgentRoutingCommand + resolveBackendAlias

Task 2 — Append isAgentRoutingDecision and renderAgentPrefix
Tests (append to agent_routing.test.mjs):

import {
  isAgentRoutingDecision,
  renderAgentPrefix,
} from './agent_routing.mjs';

test('isAgentRoutingDecision detects which_agent slot', () => {
  assert.equal(isAgentRoutingDecision({ slot: 'which_agent', options: ['codex', 'aider'] }), true);
  assert.equal(isAgentRoutingDecision({ slot: 'oauth_provider', options: ['google', 'github'] }), false);
  assert.equal(isAgentRoutingDecision({ slot: 'agent', options: ['codex', 'aider'] }), true);
  assert.equal(isAgentRoutingDecision(null), false);
});

test('renderAgentPrefix uses English label for en', () => {
  assert.equal(renderAgentPrefix('codex', 'en'), 'Codex says: ');
  assert.equal(renderAgentPrefix('claude', 'en'), 'Claude Code says: ');
});

test('renderAgentPrefix uses Korean label for ko', () => {
  assert.equal(renderAgentPrefix('codex', 'ko'), '코덱스: ');
  assert.equal(renderAgentPrefix('claude', 'ko'), 'Claude Code: ');
});

test('renderAgentPrefix returns empty when backend unknown', () => {
  assert.equal(renderAgentPrefix('', 'en'), '');
  assert.equal(renderAgentPrefix(null, 'en'), '');
  assert.equal(renderAgentPrefix('unknownbackend', 'en'), '');
});
Implementation (append to agent_routing.mjs):

const ROUTING_SLOT_NAMES = new Set(['which_agent', 'agent', 'who_answers', 'router_agent']);

const BACKEND_LABELS = {
  hermes: { en: 'Hermes', ko: '헤르메스' },
  claude: { en: 'Claude Code', ko: 'Claude Code' },
  codex: { en: 'Codex', ko: '코덱스' },
  gemini: { en: 'Gemini', ko: 'Gemini' },
  opencode: { en: 'OpenCode', ko: 'OpenCode' },
  openclaw: { en: 'OpenClaw', ko: 'OpenClaw' },
  aider: { en: 'Aider', ko: 'Aider' },
  cursor: { en: 'Cursor CLI', ko: 'Cursor CLI' },
};

export function isAgentRoutingDecision(decision) {
  if (!decision || typeof decision !== 'object') return false;
  const slot = String(decision.slot || '').toLowerCase();
  return ROUTING_SLOT_NAMES.has(slot);
}

export function renderAgentPrefix(backend, language = 'en') {
  const key = String(backend || '').toLowerCase();
  if (!BACKEND_LABELS[key]) return '';
  const en = /^en/i.test(String(language || ''));
  const label = BACKEND_LABELS[key][en ? 'en' : 'ko'];
  return en ? `${label} says: ` : `${label}: `;
}
Commit: feat(agent-routing): which_agent detection + localized TTS prefix

Task 3 — Append buildCrossAgentPrompt
Tests (append):

import { buildCrossAgentPrompt } from './agent_routing.mjs';

test('buildCrossAgentPrompt prepends handoff block in English', () => {
  const out = buildCrossAgentPrompt({
    prompt: 'Refactor the login route to use OAuth.',
    fromBackend: 'claude', toBackend: 'codex',
    resolvedDecisions: { oauth_provider: 'github' },
    priorUtterances: ['plan it first', 'skip step 2'],
    language: 'en',
  });
  assert.match(out, /Cross-agent handoff from Claude Code to Codex/);
  assert.match(out, /Prior decisions: oauth_provider=github/);
  assert.match(out, /Recent user voice: plan it first \| skip step 2/);
  assert.match(out, /User request: Refactor the login route to use OAuth\./);
});

test('buildCrossAgentPrompt omits empty sections', () => {
  const out = buildCrossAgentPrompt({
    prompt: 'do it', fromBackend: 'claude', toBackend: 'codex',
    resolvedDecisions: {}, priorUtterances: [], language: 'en',
  });
  assert.doesNotMatch(out, /Prior decisions:/);
  assert.doesNotMatch(out, /Recent user voice:/);
  assert.match(out, /User request: do it/);
});

test('buildCrossAgentPrompt renders Korean header for ko', () => {
  const out = buildCrossAgentPrompt({
    prompt: '로그인 라우트 리팩토링해줘',
    fromBackend: 'claude', toBackend: 'codex',
    resolvedDecisions: {}, priorUtterances: [], language: 'ko',
  });
  assert.match(out, /에이전트 핸드오프: Claude Code → 코덱스/);
  assert.match(out, /사용자 요청: 로그인 라우트 리팩토링해줘/);
});
Implementation (append):

function labelFor(backend, language) {
  const key = String(backend || '').toLowerCase();
  if (!BACKEND_LABELS[key]) return key || 'agent';
  return BACKEND_LABELS[key][/^en/i.test(String(language || '')) ? 'en' : 'ko'];
}

export function buildCrossAgentPrompt({
  prompt, fromBackend, toBackend,
  resolvedDecisions = {}, priorUtterances = [], language = 'en',
}) {
  const en = /^en/i.test(String(language || ''));
  const fromLabel = labelFor(fromBackend, language);
  const toLabel = labelFor(toBackend, language);
  const lines = [];
  lines.push(en
    ? `[Cross-agent handoff from ${fromLabel} to ${toLabel}]`
    : `[에이전트 핸드오프: ${fromLabel} → ${toLabel}]`);
  const decKeys = Object.keys(resolvedDecisions || {});
  if (decKeys.length) {
    const parts = decKeys.map(k => `${k}=${resolvedDecisions[k] === null ? '(agent picks)' : resolvedDecisions[k]}`);
    lines.push(en ? `Prior decisions: ${parts.join(', ')}` : `이전 결정: ${parts.join(', ')}`);
  }
  const utterances = (priorUtterances || []).filter(Boolean).slice(-4);
  if (utterances.length) {
    lines.push(en
      ? `Recent user voice: ${utterances.join(' | ')}`
      : `최근 사용자 음성: ${utterances.join(' | ')}`);
  }
  lines.push(en ? `User request: ${prompt}` : `사용자 요청: ${prompt}`);
  return lines.join('\n');
}
Commit: feat(agent-routing): buildCrossAgentPrompt for handoff context

Task 4 — Teach plan_mode.mjs preamble about which_agent
Tests (append to plan_mode.test.mjs):

import { isAgentRoutingDecision } from './agent_routing.mjs';

test('parsePlanOutput tags which_agent decision via isAgentRoutingDecision', () => {
  const text = [
    'PLAN_BEGIN',
    '1. Survey the codebase',
    'PLAN_END',
    'DECISIONS_BEGIN',
    '- which_agent | Who should answer? | codex | aider',
    'DECISIONS_END',
  ].join('\n');
  const out = parsePlanOutput(text);
  assert.equal(out.decisions[0].slot, 'which_agent');
  assert.equal(isAgentRoutingDecision(out.decisions[0]), true);
});

test('planModePreamble in English mentions which_agent', () => {
  assert.match(planModePreamble('en'), /which_agent/);
});

test('planModePreamble in Korean mentions which_agent', () => {
  assert.match(planModePreamble('ko'), /which_agent/);
});
Edit app-node/plan_mode.mjs — insert one line into each preamble:

English branch (replace existing array):

  return [
    'You are in PLAN MODE. Do NOT modify any files.',
    'Reply with a short plan AND list any forks/decisions you would normally pick yourself.',
    'PLAN_BEGIN', '1. ...', '2. ...', 'PLAN_END',
    'DECISIONS_BEGIN',
    '- <slot> | <one-sentence question> | <option1> | <option2> | ...',
    'DECISIONS_END',
    'Each step under 12 words. slot is a short snake_case key (e.g. oauth_provider).',
    'Use slot "which_agent" when the choice is which CLI agent should answer next (options: codex, aider, claude, gemini, opencode, openclaw, cursor, hermes).',
    'Omit the DECISIONS block entirely if there is nothing to ask.',
  ].join('\n');
Korean branch — insert this line before the final '결정이 필요 없으면...':

      'slot이 "which_agent"이면 다음에 답할 CLI 에이전트를 묻는 분기다 (options: codex, aider, claude, gemini, opencode, openclaw, cursor, hermes).',
Commit: feat(plan-mode): preamble teaches the which_agent slot

Task 5 — Per-backend adapter cache + routing state in main.mjs
Add buildAgentSettings to the existing from './agent_adapters.mjs' import.

Insert immediately after const agentAdaptersBySession = new Map(); (~line 505):

const agentAdaptersByBackend = new Map();
let activeRouting = { backend: settings.agent.backend, sticky: false };
let lastUsedBackend = settings.agent.backend;
let lastResolvedDecisions = {};
let pendingFallbackPrompt = null;
const recentUtterances = [];
function recordUtterance(text) {
  if (!text) return;
  recentUtterances.push(text);
  while (recentUtterances.length > 4) recentUtterances.shift();
}
function adapterForBackend(backend, session = null) {
  const key = `${backend}::${session ? (session.slug || session.name) : '_default'}`;
  if (agentAdaptersByBackend.has(key)) return agentAdaptersByBackend.get(key);
  const baseEnv = { ...process.env, AGENT_BACKEND: backend };
  let routedSettings;
  try {
    routedSettings = buildAgentSettings({ ROOT: settings.agent.cwd || process.cwd(), env: baseEnv });
  } catch (e) {
    warn(`adapterForBackend: cannot build settings for ${backend}: ${e?.message || e}`);
    return null;
  }
  if (session) {
    routedSettings = {
      ...routedSettings,
      label: `${routedSettings.label} · ${session.name}`,
      sessionFile: session.sessionFile,
      cwd: session.workdir || routedSettings.cwd,
    };
  }
  const adapter = createBridgeAgentAdapter(routedSettings);
  agentAdaptersByBackend.set(key, adapter);
  return adapter;
}
Commit: feat(main): per-backend adapter cache + routing state

Task 6 — Wire explicit voice routing into the main dispatch
Add import near the existing from './plan_mode.mjs':

import {
  parseAgentRoutingCommand,
  renderAgentPrefix,
  buildCrossAgentPrompt,
  isAgentRoutingDecision,
} from './agent_routing.mjs';
Insert just above const planOutcome = await dispatchPlanModeUtterance(prompt, signal); (~line 1510):

      const routing = parseAgentRoutingCommand(prompt, settings.voiceLanguage);
      if (routing.type === 'restore') {
        activeRouting = { backend: settings.agent.backend, sticky: false };
        const msg = /^en/i.test(String(settings.voiceLanguage || ''))
          ? `Back to the default agent (${settings.agent.label}).`
          : `기본 에이전트로 돌아갈게 (${settings.agent.label}).`;
        await sendText(`↩ ${msg}`);
        await speakText(msg, signal, null);
        return;
      }
      if (routing.type === 'route') {
        const session = resolveProjectSessionForChannel(planChannelKey());
        const candidate = adapterForBackend(routing.backend, session);
        if (!candidate) {
          const msg = /^en/i.test(String(settings.voiceLanguage || ''))
            ? `${routing.backend} is not installed. Want me to use ${settings.agent.label} instead?`
            : `${routing.backend}이(가) 설치되어 있지 않아. ${settings.agent.label}로 대신 진행할까?`;
          await sendText(`⚠️ ${msg}`);
          await speakText(msg, signal, null);
          pendingFallbackPrompt = { requestedBackend: routing.backend, originalPrompt: prompt };
          return;
        }
        activeRouting = { backend: routing.backend, sticky: routing.sticky };
      }
      recordUtterance(prompt);
Replace adapter resolution where the prompt finally runs against agentAdapter:

const session = resolveProjectSessionForChannel(planChannelKey());
const routedBackend = activeRouting.backend;
const routedAdapter = adapterForBackend(routedBackend, session) || adapterForProjectSession(session);
const isHandoff = lastUsedBackend !== routedBackend;
const finalPrompt = isHandoff
  ? buildCrossAgentPrompt({
      prompt: promptForAgent,
      fromBackend: lastUsedBackend,
      toBackend: routedBackend,
      resolvedDecisions: lastResolvedDecisions || {},
      priorUtterances: recentUtterances.slice(0, -1),
      language: settings.voiceLanguage,
    })
  : promptForAgent;
const ttsPrefix = isHandoff ? renderAgentPrefix(routedBackend, settings.voiceLanguage) : '';
lastUsedBackend = routedBackend;
if (!activeRouting.sticky) activeRouting = { backend: settings.agent.backend, sticky: false };
const result = await routedAdapter.run(finalPrompt, signal, plan);
Where TTS is spoken, prepend ttsPrefix. (If narration comes from the streaming sentencer, leave // TODO(bet-1.1): wire ttsPrefix into streaming path for now.)

Create app-node/cross_agent_routing.test.mjs:

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAgentRoutingCommand, resolveBackendAlias,
  renderAgentPrefix, buildCrossAgentPrompt,
} from './agent_routing.mjs';

test('routing pipeline: ask Codex resolves to single-turn route', () => {
  const cmd = parseAgentRoutingCommand('ask Codex what it thinks', 'en');
  assert.equal(cmd.type, 'route'); assert.equal(cmd.backend, 'codex'); assert.equal(cmd.sticky, false);
});

test('routing pipeline: switch to Aider resolves to sticky route', () => {
  const cmd = parseAgentRoutingCommand('switch to Aider', 'en');
  assert.equal(cmd.type, 'route'); assert.equal(cmd.backend, 'aider'); assert.equal(cmd.sticky, true);
});

test('routing pipeline: alias resolves Claude Code to claude', () => {
  assert.equal(resolveBackendAlias('Claude Code'), 'claude');
});

test('routing pipeline: prefix changes only when backend changes', () => {
  let last = 'claude', next = 'codex';
  let prefix = last === next ? '' : renderAgentPrefix(next, 'en');
  assert.equal(prefix, 'Codex says: ');
  last = next; next = 'codex';
  prefix = last === next ? '' : renderAgentPrefix(next, 'en');
  assert.equal(prefix, '');
});

test('routing pipeline: cross-agent prompt carries prior decisions', () => {
  const out = buildCrossAgentPrompt({
    prompt: 'finish the OAuth wire-up',
    fromBackend: 'claude', toBackend: 'codex',
    resolvedDecisions: { oauth_provider: 'github' },
    priorUtterances: ['plan it first'], language: 'en',
  });
  assert.match(out, /from Claude Code to Codex/);
  assert.match(out, /oauth_provider=github/);
});
Commit: feat(main): voice-driven cross-agent routing in dispatch

Task 7 — which_agent decision routes the executing turn
Append tests to cross_agent_routing.test.mjs:

import { parseDecisionAnswer } from './plan_mode.mjs';

test('which_agent decision: voice answer maps to backend name', () => {
  const decision = { slot: 'which_agent', question: 'Who?', options: ['codex', 'aider'] };
  assert.equal(parseDecisionAnswer('codex', decision, 'en').choice, 'codex');
});

test('which_agent decision: ordinal answer maps to backend', () => {
  const decision = { slot: 'which_agent', question: 'Who?', options: ['codex', 'aider', 'claude'] };
  assert.equal(parseDecisionAnswer('the third one', decision, 'en').choice, 'claude');
});
In dispatchPlanModeUtterance (in main.mjs, ~line 380), after next = { ...existing, resolvedDecisions: ..., pendingDecisionIndex: ... }; add:

    if (isAgentRoutingDecision(decision) && answer.choice) {
      const candidate = adapterForBackend(answer.choice, resolveProjectSessionForChannel(key));
      if (candidate) {
        activeRouting = { backend: answer.choice, sticky: true };
      } else {
        const msg = /^en/i.test(String(language || ''))
          ? `${answer.choice} is not installed; staying with ${settings.agent.label}.`
          : `${answer.choice}이(가) 설치되어 있지 않아. ${settings.agent.label}로 진행할게.`;
        await sendText(`⚠️ ${msg}`);
        await speakText(msg, signal, null);
      }
    }
In the cmd.type === 'approve' branch (~line 409), add one line right before const promptToRun = [...]:

      lastResolvedDecisions = existing.resolvedDecisions || {};
Commit: feat(plan-mode): which_agent decision routes the executing turn

Task 8 — Missing-agent fallback with yes/no grammar
Append tests to agent_routing.test.mjs:

import { buildFallbackDecision } from './agent_routing.mjs';

test('buildFallbackDecision yields a yes/no shape', () => {
  const d = buildFallbackDecision('codex', 'Claude Code', 'en');
  assert.equal(d.slot, 'fallback');
  assert.deepEqual(d.options, ['yes', 'no']);
  assert.match(d.question, /codex/);
  assert.match(d.question, /Claude Code/);
});

test('buildFallbackDecision yields a Korean prompt for ko', () => {
  const d = buildFallbackDecision('codex', 'Claude Code', 'ko');
  assert.match(d.question, /codex/);
  assert.match(d.question, /Claude Code/);
});
Append to agent_routing.mjs:

export function buildFallbackDecision(missingBackend, fallbackLabel, language = 'en') {
  const en = /^en/i.test(String(language || ''));
  const question = en
    ? `${missingBackend} is not installed. Use ${fallbackLabel} instead?`
    : `${missingBackend}이(가) 설치되어 있지 않아. ${fallbackLabel}로 대신 진행할까?`;
  return { slot: 'fallback', question, options: ['yes', 'no'] };
}
Add buildFallbackDecision to the routing import in main.mjs. Ensure parseDecisionAnswer is imported from ./plan_mode.mjs in scope.

At the very top of the user-voice handler (above the Task 6 routing block):

      if (pendingFallbackPrompt) {
        const decision = buildFallbackDecision(
          pendingFallbackPrompt.requestedBackend || 'agent',
          settings.agent.label,
          settings.voiceLanguage,
        );
        const answer = parseDecisionAnswer(prompt, decision, settings.voiceLanguage);
        if (answer.type === 'unknown') {
          const msg = /^en/i.test(String(settings.voiceLanguage || ''))
            ? 'Please answer yes or no.'
            : '예 또는 아니오로 대답해줘.';
          await sendText(`⚠️ ${msg}`);
          await speakText(msg, signal, null);
          return;
        }
        const accepted = answer.type === 'auto' || answer.choice === 'yes';
        const previous = pendingFallbackPrompt;
        pendingFallbackPrompt = null;
        if (!accepted) {
          const msg = /^en/i.test(String(settings.voiceLanguage || '')) ? 'Cancelled.' : '취소했어.';
          await sendText(`❎ ${msg}`);
          await speakText(msg, signal, null);
          return;
        }
        activeRouting = { backend: settings.agent.backend, sticky: false };
        prompt = previous.originalPrompt;
      }
Commit: feat(agent-routing): yes/no fallback when routed agent is missing

Task 9 — Lock minimum adapter contract for every backend
Append to app-node/agent_adapters.test.mjs (add import { test } from 'node:test'; and import assert from 'node:assert/strict'; at the top if not already imported):

import { assertAgentAdapterContract } from './agent_contract.mjs';
import { buildAgentSettings, createAgentAdapter } from './agent_adapters.mjs';

test('createAgentAdapter satisfies the agent adapter contract for every known backend', () => {
  const backends = ['hermes', 'claude', 'codex', 'gemini', 'opencode', 'openclaw', 'aider', 'cursor'];
  for (const backend of backends) {
    const s = buildAgentSettings({
      ROOT: '/tmp/vc-test',
      env: { AGENT_BACKEND: backend, AGENT_COMMAND: 'echo test' },
    });
    const adapter = createAgentAdapter(s, { execFileAsync: async () => ({ stdout: '', stderr: '' }) });
    assert.doesNotThrow(() => assertAgentAdapterContract(adapter), `${backend} should satisfy contract`);
    assert.equal(adapter.backend, backend);
  }
});
Commit: test(agent-adapters): lock minimum contract for every backend

Task 10 — E2E composition test
Append to cross_agent_routing.test.mjs:

test('e2e composition: ask Codex single-turn, then back to default', () => {
  const turn1 = parseAgentRoutingCommand('ask Codex what it thinks', 'en');
  assert.equal(turn1.type, 'route'); assert.equal(turn1.sticky, false);
  const prompt = buildCrossAgentPrompt({
    prompt: 'ask Codex what it thinks', fromBackend: 'claude', toBackend: turn1.backend,
    resolvedDecisions: {}, priorUtterances: [], language: 'en',
  });
  assert.match(prompt, /from Claude Code to Codex/);
  const turn2 = parseAgentRoutingCommand('also add a test', 'en');
  assert.equal(turn2.type, 'none');
});

test('e2e composition: switch sticky until restore', () => {
  assert.equal(parseAgentRoutingCommand('switch to Aider', 'en').sticky, true);
  assert.equal(parseAgentRoutingCommand('write the test', 'en').type, 'none');
  assert.equal(parseAgentRoutingCommand('back to default', 'en').type, 'restore');
});
Commit: test(routing): e2e composition for single-turn, sticky, restore

Task 11 — Surface routing in vc status (optional)
Grep app-node/main.mjs for the status renderer. Inside it:

const routingLine = `Routing: ${activeRouting.backend}${activeRouting.sticky ? ' (sticky)' : ''}`;
// push into existing status array
If no clear status builder, leave // TODO(bet-1.2): expose activeRouting in status output.

Commit: feat(main): surface active routing in vc status

Task 12 — Final verification
npm test          # all green
npm run lint 2>/dev/null || echo "no lint"
Backward-compat audit:

Plan without DECISIONS_BEGIN/END still parses.
Plan with non-which_agent slot still resolves normally.
Session that never uses routing utterances still uses settings.agent.
All existing tests pass with only the appended ones added.
Self-Review Notes
Spec coverage: all 4 features (agent in fork, explicit routing, cross-agent context, missing-agent fallback) have at least one task.
Type consistency: activeRouting = {backend, sticky}, pendingFallbackPrompt = {requestedBackend, originalPrompt}, parseAgentRoutingCommand returns {type: 'route'|'restore'|'none', backend?, sticky?} — all consistent across tasks.
Placeholder scan: only two explicit deferred markers (bet-1.1 streaming-prefix anchor, bet-1.2 status output). Both bounded.
Non-goals preserved: bets 2 (diff review), 3 (phone-as-device), feedback-loop research thread, smart-progress demotion — all out of scope here.

