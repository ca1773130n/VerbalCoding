const BACKEND_ALIASES = {
  hermes: ['hermes', '헤르메스'],
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

const ROUTING_SLOT_NAMES = new Set(['which_agent', 'agent', 'who_answers', 'router_agent']);

const ASK_EN = /\bask\s+([a-z][a-z0-9 \-]{1,30}?)(?:\s+(?:to|what|if|whether)\b|[?,.]|$)/i;
const SWITCH_EN = /\bswitch\s+to\s+([a-z][a-z0-9 \-]{1,30}?)(?:[?,.]|$)/i;
const LET_FINISH_EN = /\blet\s+([a-z][a-z0-9 \-]{1,30}?)\s+(?:finish|handle|do)\b/i;
const RESTORE_EN = /\b(back\s+to\s+default|use\s+the\s+default\s+agent|default\s+agent)\b/i;

const ASK_KO = /([가-힣A-Za-z][가-힣A-Za-z0-9\-]{1,30})(?:한테|에게|에)\s*(물어|질문)/;
const SWITCH_KO = /([가-힣A-Za-z][가-힣A-Za-z0-9\-]{1,30})(?:로|으로)\s*(전환|바꿔|바꿔줘)/;
const RESTORE_KO = /(기본(?:으로)?\s*(?:돌아|복귀)|기본\s*에이전트)/;

export function isRoutingOnlyUtterance(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  const normalized = t.toLowerCase().replace(/[.,!?]+$/u, '').trim();
  if (/^(?:please\s+)?(?:back\s+to\s+default|use\s+the\s+default\s+agent|default\s+agent)$/i.test(normalized)) return true;
  if (/^기본(?:으로)?\s*(?:돌아(?:가|가줘)?|복귀)$/.test(normalized)) return true;
  const en = normalized.match(/^(?:please\s+)?(?:switch\s+to|use)\s+(.+)$/i);
  if (en) return resolveBackendAlias(en[1], { strict: true }) !== null;
  const ko = normalized.match(/^(.+?)(?:로|으로)\s*(?:전환|바꿔|바꿔줘)$/);
  if (ko) return resolveBackendAlias(ko[1], { strict: true }) !== null;
  return false;
}

export function resolveBackendAlias(rawName, { strict = false } = {}) {
  const needle = String(rawName || '').toLowerCase().trim();
  if (!needle) return null;
  for (const [alias, backend] of BACKEND_LOOKUP) {
    if (needle === alias) return backend;
  }
  if (strict) return null;
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

function labelFor(backend, language) {
  const key = String(backend || '').toLowerCase();
  if (!BACKEND_LABELS[key]) return key || 'agent';
  return BACKEND_LABELS[key][/^en/i.test(String(language || '')) ? 'en' : 'ko'];
}

export function buildCrossAgentPrompt({
  prompt, fromBackend, toBackend,
  resolvedDecisions = {}, priorUtterances = [], language = 'en',
} = {}) {
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

export function buildFallbackDecision(missingBackend, fallbackLabel, language = 'en') {
  const en = /^en/i.test(String(language || ''));
  const question = en
    ? `${missingBackend} is not installed. Use ${fallbackLabel} instead?`
    : `${missingBackend}이(가) 설치되어 있지 않아. ${fallbackLabel}로 대신 진행할까?`;
  return { slot: 'fallback', question, options: ['yes', 'no'] };
}
