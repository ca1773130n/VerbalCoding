const CATEGORY_LABELS = {
  ko: {
    test: '테스트 실행', edit: '파일 수정', read: '파일 읽기', search: '검색', terminal: '터미널 실행',
    skill: '스킬 사용', browser: '브라우저 확인', tool: '툴 사용', agent: '에이전트 처리', work: '작업 처리',
  },
  en: {
    test: 'running tests', edit: 'editing files', read: 'reading files', search: 'searching', terminal: 'running terminal commands',
    skill: 'loading skills', browser: 'checking the browser', tool: 'using tools', agent: 'calling the agent', work: 'working',
  },
};

const CATEGORY_RULES = [
  { key: 'test', pattern: /(테스트|test|pytest|npm test|node --test)/i },
  { key: 'edit', pattern: /(파일\s*수정|수정|patch|write_file|쓰기|변경|edit)/i },
  { key: 'read', pattern: /(파일\s*읽기|read_file|읽기|열람)/i },
  { key: 'search', pattern: /(웹\s*검색|검색|web_search|search_files|찾기)/i },
  { key: 'terminal', pattern: /(터미널|명령|terminal|shell|실행)/i },
  { key: 'skill', pattern: /(스킬|skill)/i },
  { key: 'browser', pattern: /(브라우저|browser)/i },
  { key: 'tool', pattern: /(툴|도구|tool)/i },
  { key: 'agent', pattern: /(에이전트|agent|hermes)/i },
];

function labelsFor(language = 'ko') {
  return /^en/i.test(String(language || '')) ? CATEGORY_LABELS.en : CATEGORY_LABELS.ko;
}

export function progressCategory(event, { language = 'ko' } = {}) {
  const text = String(event || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const labels = labelsFor(language);
  const found = CATEGORY_RULES.find(rule => rule.pattern.test(text));
  return found ? { key: found.key, label: labels[found.key] } : { key: 'work', label: labels.work };
}

export function progressDetail(event, { language = 'ko' } = {}) {
  const text = String(event || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const category = progressCategory(text, { language });
  let detail = text
    .replace(/^VERBALCODING_PROGRESS:\s*/i, '')
    .replace(/^(파일\s*읽기|파일\s*수정|웹\s*검색|터미널\s*(명령\s*)?실행|테스트\s*실행|스킬\s*사용|툴\s*사용|브라우저\s*확인|에이전트\s*(호출|처리|응답\s*수신)?|Hermes Agent\s*(호출\s*시작|응답\s*수신)?)\s*/i, '')
    .replace(/^(read_file|write_file|patch|web_search|search_files|terminal|skill_view|tool)\s*/i, '')
    .replace(/[`*_#>\[\](){}]/g, '')
    .replace(/\b[a-zA-Z0-9_.\/-]+\.(mjs|js|py|md|json|txt|sh|yaml|yml)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!detail || detail.length < 2) return category?.label || '';
  if (detail.length > 28) detail = detail.slice(0, 27).replace(/[\s,.;:，。]+$/u, '');
  return `${category?.label || labelsFor(language).work} ${detail}`.trim();
}

export function formatProgressMessage(event, { language = 'ko' } = {}) {
  const text = String(event || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const category = progressCategory(text, { language });
  const detail = progressDetail(text, { language });
  const english = /^en/i.test(String(language || ''));
  const safeDetail = english && /\p{Script=Hangul}/u.test(detail) ? '' : detail;
  const body = english ? (safeDetail || category?.label || 'working') : (safeDetail || category?.label || '작업 처리');
  const emoji = {
    test: '🧪',
    edit: '✏️',
    read: '📖',
    search: '🔎',
    terminal: '💻',
    skill: '📚',
    browser: '🌐',
    agent: '🤖',
    tool: '🛠️',
    work: '⚙️',
  }[category?.key || 'work'] || '⚙️';
  return `${emoji} ${body}`.trim();
}

export function summarizeProgressEvents(events, { maxCategories = 3, language = 'ko' } = {}) {
  const seenDetails = new Set();
  const details = [];
  const seenCategories = new Set();
  const labels = [];
  for (const event of events || []) {
    const category = progressCategory(event, { language });
    if (category && !seenCategories.has(category.key)) {
      seenCategories.add(category.key);
      labels.push(category.label);
    }
    const detail = progressDetail(event, { language });
    if (detail && !seenDetails.has(detail)) {
      seenDetails.add(detail);
      details.push(detail);
    }
  }
  const items = details.length ? details : labels;
  if (!items.length) return '';
  const english = /^en/i.test(String(language || ''));
  if (items.length === 1) return english ? `${items[0]}.` : `${items[0]} 중이야.`;
  const shown = items.slice(0, Math.max(1, maxCategories));
  if (items.length > shown.length) {
    return english ? `${shown.join(', ')}, and ${items.length - shown.length} more.` : `${shown.join(', ')} 외 ${items.length - shown.length}개 작업 중이야.`;
  }
  return english ? `${shown.join(', ')}.` : `${shown.join(', ')} 중이야.`;
}
