const RESEARCH_EN = /^(?:please\s+)?(?:(?:ask|tell|have|let)\s+[a-z][a-z0-9 \-]{1,30}?\s+(?:to\s+)?)?(?:deep\s+)?(?:research|look\s+up|find\s+out\s+about)\s+(.+)$/i;
const RESEARCH_KO = /^(.+?)\s*(?:리서치(?:해줘?)?|조사(?:해줘?)?|찾아봐)\s*$/;

export function parseResearchCommand(text, language = 'en') {
  const t = String(text || '').trim();
  if (!t) return { type: 'none' };
  const normalized = t.replace(/[.,!?]+$/u, '').trim();
  const en = normalized.match(RESEARCH_EN);
  if (en) {
    const query = en[1].trim();
    if (query.length >= 3) return { type: 'research', query, depth: /\bdeep\b/i.test(normalized) ? 'deep' : 'quick' };
  }
  const ko = normalized.match(RESEARCH_KO);
  if (ko) {
    const query = ko[1].trim();
    if (query.length >= 2 && !/^(this|that|it|이거|저거|그거)$/i.test(query)) {
      return { type: 'research', query, depth: 'quick' };
    }
  }
  return { type: 'none' };
}

function ensureUrl(url) { try { return new URL(url).toString(); } catch { return null; } }

async function tavilySearch(query, { apiKey, fetchImpl, signal, maxResults = 5 }) {
  const res = await fetchImpl('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, max_results: maxResults, search_depth: 'basic', include_answer: true, include_raw_content: false }),
    signal,
  });
  if (!res.ok) throw new Error(`tavily ${res.status}`);
  const data = await res.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  return {
    answer: String(data?.answer || '').trim(),
    sources: results.map(r => ({ title: String(r.title || '').slice(0, 120), url: ensureUrl(r.url), snippet: String(r.content || '').slice(0, 400) })).filter(r => r.url),
  };
}

async function braveSearch(query, { apiKey, fetchImpl, signal, maxResults = 5 }) {
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(maxResults));
  const res = await fetchImpl(url.toString(), {
    headers: { 'x-subscription-token': apiKey, accept: 'application/json' },
    signal,
  });
  if (!res.ok) throw new Error(`brave ${res.status}`);
  const data = await res.json();
  const results = Array.isArray(data?.web?.results) ? data.web.results : [];
  return {
    answer: '',
    sources: results.map(r => ({ title: String(r.title || '').slice(0, 120), url: ensureUrl(r.url), snippet: String(r.description || '').slice(0, 400) })).filter(r => r.url),
  };
}

async function searxngSearch(query, { baseUrl, fetchImpl, signal, maxResults = 5 }) {
  const u = new URL(String(baseUrl).replace(/\/$/, '') + '/search');
  u.searchParams.set('q', query);
  u.searchParams.set('format', 'json');
  u.searchParams.set('safesearch', '1');
  const res = await fetchImpl(u.toString(), { signal, headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`searxng ${res.status}`);
  const data = await res.json();
  const raw = Array.isArray(data?.results) ? data.results : [];
  const seen = new Set();
  const sources = [];
  for (const r of raw) {
    const u2 = ensureUrl(r?.url);
    if (!u2 || seen.has(u2)) continue;
    seen.add(u2);
    sources.push({
      title: String(r.title || '').slice(0, 120),
      url: u2,
      snippet: String(r.content || '').replace(/\s+/g, ' ').slice(0, 400),
    });
    if (sources.length >= maxResults) break;
  }
  return { answer: '', sources };
}

export function selectSearchBackend(env = process.env) {
  const explicit = String(env.SEARCH_BACKEND || '').toLowerCase().trim();
  if (explicit === 'agent') return { kind: 'agent' };
  if (explicit === 'tavily' && env.TAVILY_API_KEY) return { kind: 'tavily', apiKey: env.TAVILY_API_KEY };
  if (explicit === 'brave' && (env.BRAVE_SEARCH_API_KEY || env.BRAVE_API_KEY)) {
    return { kind: 'brave', apiKey: env.BRAVE_SEARCH_API_KEY || env.BRAVE_API_KEY };
  }
  if (explicit === 'searxng' && env.SEARXNG_URL) return { kind: 'searxng', baseUrl: env.SEARXNG_URL };
  if (env.TAVILY_API_KEY) return { kind: 'tavily', apiKey: env.TAVILY_API_KEY };
  const braveKey = env.BRAVE_SEARCH_API_KEY || env.BRAVE_API_KEY;
  if (braveKey) return { kind: 'brave', apiKey: braveKey };
  if (env.SEARXNG_URL) return { kind: 'searxng', baseUrl: env.SEARXNG_URL };
  if (/^1|true|yes|on$/i.test(String(env.SEARCH_BACKEND_AGENT_FALLBACK || ''))) return { kind: 'agent' };
  return { kind: 'none' };
}

export async function performSearch(query, { env = process.env, fetchImpl = globalThis.fetch, signal, maxResults = 5 } = {}) {
  if (!fetchImpl) throw new Error('fetch is not available');
  const backend = selectSearchBackend(env);
  if (backend.kind === 'tavily') return tavilySearch(query, { apiKey: backend.apiKey, fetchImpl, signal, maxResults });
  if (backend.kind === 'brave') return braveSearch(query, { apiKey: backend.apiKey, fetchImpl, signal, maxResults });
  if (backend.kind === 'searxng') return searxngSearch(query, { baseUrl: backend.baseUrl, fetchImpl, signal, maxResults });
  if (backend.kind === 'agent') throw new Error('agent_delegated');
  throw new Error('no_search_backend');
}

export function buildSynthesisPrompt({ query, sources, language = 'en' }) {
  const en = /^en/i.test(String(language || ''));
  const lines = [];
  lines.push(en ? `You are summarizing web research for a voice answer. Be concise: 3 bullets total, each a single complete sentence, no markdown, no URLs in the spoken text.` : `웹 리서치 결과를 음성 답변용으로 요약해줘. 마크다운 없이 3개 불릿, 각 한 문장으로, 음성에는 URL 넣지 마.`);
  lines.push(en ? `Query: ${query}` : `질문: ${query}`);
  lines.push(en ? `Sources (numbered for your reference, do not read numbers aloud):` : `참고 자료 (번호는 참고용, 음성으로 읽지 마):`);
  sources.slice(0, 5).forEach((s, i) => {
    lines.push(`[${i + 1}] ${s.title} — ${s.snippet.replace(/\s+/g, ' ').slice(0, 240)}`);
  });
  lines.push(en
    ? `Output exactly three bullet lines starting with "- ". Then a blank line. Then "SOURCES:" followed by each source on its own line as "[n] title".`
    : `정확히 세 줄의 "- "로 시작하는 불릿을 출력해. 빈 줄 하나 후 "SOURCES:" 와 함께 각 자료를 "[n] 제목" 형식으로 한 줄씩.`);
  return lines.join('\n');
}

export function parseSynthesisOutput(text) {
  const t = String(text || '').replace(/\r/g, '');
  const sourcesIdx = t.search(/^SOURCES:/m);
  const head = sourcesIdx >= 0 ? t.slice(0, sourcesIdx) : t;
  const tail = sourcesIdx >= 0 ? t.slice(sourcesIdx) : '';
  const bullets = head.split(/\n/).map(l => l.trim()).filter(l => /^[-•]\s+/.test(l)).map(l => l.replace(/^[-•]\s+/, '').trim()).filter(Boolean).slice(0, 3);
  const sourcesText = tail.replace(/^SOURCES:\s*/m, '').trim();
  const sourceLines = sourcesText.split(/\n/).map(l => l.trim()).filter(Boolean);
  return { bullets, sourceLines };
}

export function renderResearchSpeech(bullets, language = 'en') {
  if (!bullets || !bullets.length) {
    return /^en/i.test(String(language || ''))
      ? 'Research finding: I could not find useful sources for that query.'
      : '리서치 결과: 쓸 만한 자료를 찾지 못했어.';
  }
  const en = /^en/i.test(String(language || ''));
  const intro = en ? 'Research finding: here is what I found.' : '리서치 결과: 찾은 내용 정리할게.';
  return [intro, ...bullets].join(' ');
}

export function buildResearchEmbed({ query, bullets, sources, language = 'en' } = {}) {
  const en = /^en/i.test(String(language || ''));
  const description = (bullets || []).map(b => `• ${b}`).join('\n').slice(0, 4000) || (en ? '(no synthesis)' : '(요약 없음)');
  const fields = (sources || []).slice(0, 5).map((s, i) => ({
    name: `[${i + 1}] ${(s.title || 'source').slice(0, 240)}`,
    value: (s.url || '').slice(0, 1000),
    inline: false,
  }));
  return {
    title: `${en ? '🔎 Research:' : '🔎 리서치:'} ${String(query || '').slice(0, 240)}`,
    description,
    color: 0x4F46E5,
    fields,
    footer: { text: en ? 'VerbalCoding research turn' : 'VerbalCoding 리서치 턴' },
    timestamp: new Date().toISOString(),
  };
}

export function buildAgentDelegatedResearchPrompt({ query, language = 'en' } = {}) {
  const en = /^en/i.test(String(language || ''));
  const lines = [];
  lines.push(en
    ? 'You have web access. Research the topic below using your available tools (web_search, browser, fetch, etc.) and synthesize a voice-friendly answer.'
    : '너는 웹에 접근할 수 있어. 아래 주제를 가용한 도구로 (web_search, browser, fetch 등) 리서치해서 음성용 답변으로 정리해줘.');
  lines.push(en ? `Topic: ${query}` : `주제: ${query}`);
  lines.push(en
    ? 'Output format (strict):\n- Three bullet lines starting with "- ", each one complete sentence, no markdown inside the bullet, no URLs spoken.\n- One blank line.\n- "SOURCES:" header followed by up to 5 lines as "[n] Title | https://url"'
    : '출력 형식 (엄수):\n- "- "로 시작하는 불릿 3개, 각 한 문장, 불릿 안에 마크다운/URL 금지.\n- 빈 줄 1개.\n- "SOURCES:" 헤더 후 최대 5줄, "[n] 제목 | https://url" 형식.');
  lines.push(en ? 'Do not preface the answer with explanations or apologies. Just emit the bullets and SOURCES block.' : '답변에 설명이나 사과 문구 붙이지 마. 불릿과 SOURCES 블록만 출력.');
  return lines.join('\n\n');
}

export function parseAgentDelegatedOutput(text) {
  const t = String(text || '').replace(/\r/g, '');
  const sourcesIdx = t.search(/^SOURCES:/m);
  const head = sourcesIdx >= 0 ? t.slice(0, sourcesIdx) : t;
  const tail = sourcesIdx >= 0 ? t.slice(sourcesIdx) : '';
  const bullets = head.split(/\n/)
    .map(l => l.trim())
    .filter(l => /^[-•]\s+/.test(l))
    .map(l => l.replace(/^[-•]\s+/, '').trim())
    .filter(Boolean)
    .slice(0, 3);
  const sources = [];
  const sourcesText = tail.replace(/^SOURCES:\s*/m, '');
  for (const raw of sourcesText.split(/\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^\[\d+\]\s*(.+?)\s*(?:\||—|-)\s*(https?:\/\/\S+)/);
    if (m) {
      const url = ensureUrl(m[2]);
      if (url) sources.push({ title: m[1].slice(0, 120), url, snippet: '' });
      continue;
    }
    const urlMatch = line.match(/(https?:\/\/\S+)/);
    if (urlMatch) {
      const url = ensureUrl(urlMatch[1]);
      if (url) sources.push({ title: line.replace(urlMatch[1], '').replace(/^\[\d+\]\s*/, '').replace(/[|—-]\s*$/, '').trim().slice(0, 120) || url, url, snippet: '' });
    }
  }
  return { bullets, sources };
}

export function renderResearchMarkdown({ query, bullets, sources, language = 'en' }) {
  const en = /^en/i.test(String(language || ''));
  const lines = [];
  lines.push(en ? `🔎 **Research:** ${query}` : `🔎 **리서치:** ${query}`);
  if (bullets && bullets.length) {
    lines.push('');
    for (const b of bullets) lines.push(`- ${b}`);
  }
  if (sources && sources.length) {
    lines.push('');
    lines.push(en ? '**Sources**' : '**자료**');
    sources.slice(0, 5).forEach((s, i) => lines.push(`${i + 1}. [${s.title || s.url}](${s.url})`));
  }
  return lines.join('\n');
}

export async function runResearchTurn({ query, language = 'en', env = process.env, fetchImpl = globalThis.fetch, signal, synthesize, maxResults = 5 } = {}) {
  if (!query || typeof query !== 'string') throw new Error('query is required');
  if (typeof synthesize !== 'function') throw new Error('synthesize callback is required');
  let searchResult;
  try {
    searchResult = await performSearch(query, { env, fetchImpl, signal, maxResults });
  } catch (e) {
    if (e?.message === 'no_search_backend') {
      return { status: 'no_backend', error: 'no_search_backend', query };
    }
    if (e?.message === 'agent_delegated') {
      let agentOut;
      try {
        agentOut = await synthesize(buildAgentDelegatedResearchPrompt({ query, language }), { signal, task: true });
      } catch (synthErr) {
        return { status: 'synth_failed', error: synthErr?.message || String(synthErr), query, sources: [] };
      }
      const { bullets, sources } = parseAgentDelegatedOutput(agentOut);
      if (!bullets.length && !sources.length) {
        return {
          status: 'empty',
          query,
          speech: renderResearchSpeech([], language),
          markdown: renderResearchMarkdown({ query, bullets: [], sources: [], language }),
        };
      }
      return {
        status: 'ok',
        query,
        speech: renderResearchSpeech(bullets, language),
        markdown: renderResearchMarkdown({ query, bullets, sources, language }),
        embed: buildResearchEmbed({ query, bullets, sources, language }),
        bullets,
        sources,
        backend: 'agent',
      };
    }
    return { status: 'search_failed', error: e?.message || String(e), query };
  }
  if (!searchResult.sources.length) {
    return { status: 'empty', query, speech: renderResearchSpeech([], language), markdown: renderResearchMarkdown({ query, bullets: [], sources: [], language }) };
  }
  const prompt = buildSynthesisPrompt({ query, sources: searchResult.sources, language });
  let synthText;
  try { synthText = await synthesize(prompt, { signal }); }
  catch (e) { return { status: 'synth_failed', error: e?.message || String(e), query, sources: searchResult.sources }; }
  const { bullets } = parseSynthesisOutput(synthText);
  const useBullets = bullets.length ? bullets : (searchResult.answer ? [searchResult.answer] : []);
  return {
    status: 'ok',
    query,
    speech: renderResearchSpeech(useBullets, language),
    markdown: renderResearchMarkdown({ query, bullets: useBullets, sources: searchResult.sources, language }),
    embed: buildResearchEmbed({ query, bullets: useBullets, sources: searchResult.sources, language }),
    bullets: useBullets,
    sources: searchResult.sources,
  };
}
