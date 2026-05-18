const PLAN_RE = /PLAN_BEGIN\s*\n([\s\S]*?)\nPLAN_END/g;
const DECISIONS_RE = /DECISIONS_BEGIN\s*\n([\s\S]*?)\nDECISIONS_END/g;

function lastMatch(text, regex) {
  const matches = Array.from(String(text || '').matchAll(regex));
  return matches.length ? matches[matches.length - 1] : null;
}

const SKIP_EN = /\bskip\s+step\s+(\d+)\b/i;
const SKIP_KO = /step\s*(\d+)\s*건너뛰/i;
const ADD_EN = /\badd\s+(.+?)\s+after\s+step\s+(\d+)\b/i;
const ADD_KO = /step\s*(\d+)\s*다음에\s+(.+?)\s*추가/i;
const APPROVE_EN = /\b(approve|go\s*ahead|let'?s\s+go|run\s+it|proceed)\b/i;
const APPROVE_KO = /(실행|진행|승인)/i;
const CANCEL_EN = /\b(cancel|stop|nevermind|never\s+mind)\b/i;
const CANCEL_KO = /(취소|그만)/i;
const ENTER_EN = /\b(plan\s+(it\s+)?first|make\s+a\s+plan)\b/i;
const ENTER_KO = /(먼저\s*계획|계획\s*먼저|계획부터)/i;

export function parsePlanOutput(text) {
  const planMatch = lastMatch(text, PLAN_RE);
  if (!planMatch) return { steps: [], decisions: [] };
  const steps = planMatch[1]
    .split(/\r?\n/)
    .map(line => line.match(/^\s*(\d+)\.\s*(.+)$/))
    .filter(Boolean)
    .map(m => ({ id: Number(m[1]), text: m[2].trim(), status: 'pending' }));
  const decisions = parseDecisions(String(text || ''));
  return { steps, decisions };
}

export function parseDecisions(text) {
  const match = lastMatch(text, DECISIONS_RE);
  if (!match) return [];
  const out = [];
  let counter = 1;
  for (const raw of match[1].split(/\r?\n/)) {
    const line = raw.replace(/^\s*-\s*/, '').trim();
    if (!line) continue;
    const parts = line.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length < 3) continue;
    const [slot, question, ...options] = parts;
    out.push({
      slot: slot || `decision_${counter++}`,
      question,
      options: options.filter(Boolean),
    });
  }
  return out;
}

const ORDINAL_EN = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, '1st': 1, '2nd': 2, '3rd': 3 };
const ORDINAL_KO = { '첫': 1, '첫번째': 1, '첫 번째': 1, '두번째': 2, '두 번째': 2, '세번째': 3, '세 번째': 3, '네번째': 4 };
const DEFER_RE = /\b(either|whatever|you\s+(decide|pick|choose)|agent\s+(decides|picks)|up\s+to\s+you|no\s+preference)\b|아무거나|네가\s*골라|마음대로|상관없|알아서/i;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function optionMatchesText(text, optionLower) {
  if (!optionLower || optionLower.length < 2) return false;
  const asciiOnly = /^[\x00-\x7f]+$/.test(optionLower);
  if (asciiOnly) {
    const pattern = new RegExp(`(^|\\W)${escapeRegex(optionLower)}(\\W|$)`, 'i');
    return pattern.test(text);
  }
  return text.includes(optionLower);
}

export function parseDecisionAnswer(utterance, decision, language = 'en') {
  const text = String(utterance || '').trim();
  if (!text || !decision || !Array.isArray(decision.options) || decision.options.length === 0) {
    return { type: 'unknown', choice: null };
  }
  const lower = text.toLowerCase();
  if (DEFER_RE.test(text)) return { type: 'auto', choice: null };
  for (const opt of decision.options) {
    const optLower = String(opt).toLowerCase();
    if (optionMatchesText(lower, optLower)) return { type: 'option', choice: opt };
  }
  const numMatch = text.match(/\b(\d+)\b/);
  if (numMatch) {
    const idx = Number(numMatch[1]);
    if (idx >= 1 && idx <= decision.options.length) return { type: 'option', choice: decision.options[idx - 1] };
  }
  for (const [word, idx] of Object.entries(ORDINAL_EN)) {
    if (lower.includes(word)) {
      if (idx <= decision.options.length) return { type: 'option', choice: decision.options[idx - 1] };
    }
  }
  for (const [word, idx] of Object.entries(ORDINAL_KO)) {
    if (text.includes(word)) {
      if (idx <= decision.options.length) return { type: 'option', choice: decision.options[idx - 1] };
    }
  }
  return { type: 'unknown', choice: null };
}

export function renderDecisionPrompt(decision, language = 'en') {
  if (!decision) return '';
  const opts = decision.options.map((o, i) => `${i + 1}) ${o}`).join('  ');
  if (/^en/i.test(String(language || ''))) {
    return `${decision.question} Options: ${opts}. Or say "either" to let me pick.`;
  }
  return `${decision.question} 옵션: ${opts}. "아무거나"라고 하면 내가 고를게.`;
}

export function renderResolvedDecisions(resolved, language = 'en') {
  const keys = Object.keys(resolved || {});
  if (!keys.length) return '';
  const parts = keys.map(k => `${k}=${resolved[k] === null ? '(agent picks)' : resolved[k]}`);
  return /^en/i.test(String(language || ''))
    ? `Resolved decisions: ${parts.join(', ')}.`
    : `결정 사항: ${parts.join(', ')}.`;
}

export function isPlanEntryUtterance(text, language = 'en') {
  const t = String(text || '');
  if (language === 'ko') return ENTER_KO.test(t) || ENTER_EN.test(t);
  return ENTER_EN.test(t) || ENTER_KO.test(t);
}

export function parseVoiceCommand(text, language = 'en') {
  const t = String(text || '').trim();
  let m = t.match(SKIP_EN) || t.match(SKIP_KO);
  if (m) return { type: 'skip', index: Number(m[1]) };
  m = t.match(ADD_EN);
  if (m) return { type: 'insert', after: Number(m[2]), text: m[1].trim() };
  m = t.match(ADD_KO);
  if (m) return { type: 'insert', after: Number(m[1]), text: m[2].trim() };
  if (APPROVE_EN.test(t) || APPROVE_KO.test(t)) return { type: 'approve' };
  if (CANCEL_EN.test(t) || CANCEL_KO.test(t)) return { type: 'cancel' };
  return { type: 'unknown' };
}

export function applyCommand(steps, cmd) {
  if (!Array.isArray(steps)) return [];
  if (cmd.type === 'skip') {
    return steps.map(s => (s.id === cmd.index ? { ...s, status: 'skipped' } : s));
  }
  if (cmd.type === 'insert') {
    const usedIds = new Set(steps.map(s => s.id));
    let fraction = 0.5;
    let proposed = cmd.after + fraction;
    while (usedIds.has(proposed)) {
      fraction /= 2;
      proposed = cmd.after + fraction;
    }
    const out = [];
    for (const s of steps) {
      out.push(s);
      if (s.id === cmd.after) {
        out.push({ id: proposed, text: cmd.text, status: 'added' });
      }
    }
    return out;
  }
  return steps;
}

export function renderFinalPlan(steps) {
  const active = (steps || []).filter(s => s.status !== 'skipped');
  return active.map((s, i) => `${i + 1}. ${s.text}`).join('\n');
}

export function planModePreamble(language = 'en') {
  if (language === 'ko') {
    return [
      '지금은 PLAN MODE다. 파일을 절대 수정하지 마라.',
      '아래 형식으로 짧은 계획을 답하고, 결정이 필요한 분기마다 DECISIONS 블록에 질문을 적어라.',
      'PLAN_BEGIN',
      '1. ...',
      '2. ...',
      'PLAN_END',
      'DECISIONS_BEGIN',
      '- <slot> | <한 문장 질문> | <옵션1> | <옵션2> | ...',
      'DECISIONS_END',
      '각 단계는 12단어 이하 한국어 한 줄. slot은 oauth_provider, session_store 같은 짧은 영문 키.',
      'slot이 "which_agent"이면 다음에 답할 CLI 에이전트를 묻는 분기다 (options: codex, aider, claude, gemini, opencode, openclaw, cursor, hermes).',
      '결정이 필요 없으면 DECISIONS 블록 자체를 생략해라.',
    ].join('\n');
  }
  return [
    'You are in PLAN MODE. Do NOT modify any files.',
    'Reply with a short plan AND list any forks/decisions you would normally pick yourself.',
    'PLAN_BEGIN',
    '1. ...',
    '2. ...',
    'PLAN_END',
    'DECISIONS_BEGIN',
    '- <slot> | <one-sentence question> | <option1> | <option2> | ...',
    'DECISIONS_END',
    'Each step under 12 words. slot is a short snake_case key (e.g. oauth_provider).',
    'Use slot "which_agent" when the choice is which CLI agent should answer next (options: codex, aider, claude, gemini, opencode, openclaw, cursor, hermes).',
    'Omit the DECISIONS block entirely if there is nothing to ask.',
  ].join('\n');
}

export function planExecutionPreamble(language = 'en') {
  if (language === 'ko') return '아래 계획에 따라 작업을 실행해라. 각 단계가 끝나면 다음으로 진행해라.';
  return 'Execute the following plan. Move to the next step as each one completes.';
}
