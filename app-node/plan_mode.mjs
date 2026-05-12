const PLAN_RE = /PLAN_BEGIN\s*\n([\s\S]*?)\nPLAN_END/;

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
  const match = String(text || '').match(PLAN_RE);
  if (!match) return [];
  return match[1]
    .split(/\r?\n/)
    .map(line => line.match(/^\s*(\d+)\.\s*(.+)$/))
    .filter(Boolean)
    .map(m => ({ id: Number(m[1]), text: m[2].trim(), status: 'pending' }));
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
    const out = [];
    for (const s of steps) {
      out.push(s);
      if (s.id === cmd.after) {
        out.push({ id: s.id + 0.5, text: cmd.text, status: 'added' });
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
      '아래 형식으로 짧은 계획만 답해라.',
      'PLAN_BEGIN',
      '1. ...',
      '2. ...',
      'PLAN_END',
      '각 단계는 12단어 이하 한국어 한 줄로 써라.',
    ].join('\n');
  }
  return [
    'You are in PLAN MODE. Do NOT modify any files.',
    'Reply ONLY with a plan in this exact format:',
    'PLAN_BEGIN',
    '1. ...',
    '2. ...',
    'PLAN_END',
    'Each step must be under 12 words.',
  ].join('\n');
}

export function planExecutionPreamble(language = 'en') {
  if (language === 'ko') return '아래 계획에 따라 작업을 실행해라. 각 단계가 끝나면 다음으로 진행해라.';
  return 'Execute the following plan. Move to the next step as each one completes.';
}
