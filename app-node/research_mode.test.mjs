import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseResearchCommand,
  buildSynthesisPrompt,
  parseSynthesisOutput,
  renderResearchSpeech,
  renderResearchMarkdown,
  buildResearchEmbed,
  runResearchTurn,
  selectSearchBackend,
  buildAgentDelegatedResearchPrompt,
  parseAgentDelegatedOutput,
} from './research_mode.mjs';

test('parseResearchCommand picks up English "research X"', () => {
  const c = parseResearchCommand('research the latest on STORM', 'en');
  assert.equal(c.type, 'research');
  assert.match(c.query, /STORM/);
  assert.equal(c.depth, 'quick');
});

test('parseResearchCommand flags deep mode', () => {
  const c = parseResearchCommand('deep research GraphRAG community detection', 'en');
  assert.equal(c.type, 'research');
  assert.equal(c.depth, 'deep');
});

test('parseResearchCommand recognizes Korean phrasing', () => {
  const c = parseResearchCommand('Mem0 한번 리서치해줘', 'ko');
  assert.equal(c.type, 'research');
  assert.match(c.query, /Mem0/);
});

test('parseResearchCommand returns none for unrelated input', () => {
  assert.equal(parseResearchCommand('write a unit test for parseDecisionAnswer', 'en').type, 'none');
  assert.equal(parseResearchCommand('hi how are you', 'en').type, 'none');
});

test('parseResearchCommand does not hijack coding utterances containing the word "research"', () => {
  assert.equal(parseResearchCommand('implement research mode', 'en').type, 'none');
  assert.equal(parseResearchCommand('fix the research_mode regex', 'en').type, 'none');
  assert.equal(parseResearchCommand('add docs about research turn', 'en').type, 'none');
  assert.equal(parseResearchCommand('리서치 모드 코드 좀 봐', 'ko').type, 'none');
  assert.equal(parseResearchCommand('리서치 코드 리팩토링해줘', 'ko').type, 'none');
});

test('parseResearchCommand still triggers on agent-routed forms', () => {
  const c = parseResearchCommand('ask codex to research Node.js streams', 'en');
  assert.equal(c.type, 'research');
  assert.equal(c.query, 'Node.js streams');
});

test('parseResearchCommand preserves internal punctuation in technical queries', () => {
  const cases = [
    ['research Node.js streams', 'Node.js streams'],
    ['look up GPT-4.1 vs Claude 4.7', 'GPT-4.1 vs Claude 4.7'],
    ['research https://example.com/foo?bar=1', 'https://example.com/foo?bar=1'],
    ['research what is 1.5 vs 2.0', 'what is 1.5 vs 2.0'],
  ];
  for (const [input, expected] of cases) {
    const c = parseResearchCommand(input, 'en');
    assert.equal(c.type, 'research', `failed parse for ${input}`);
    assert.equal(c.query, expected, `expected '${expected}' from '${input}', got '${c.query}'`);
  }
});

test('parseResearchCommand strips only trailing sentence punctuation', () => {
  const c = parseResearchCommand('research Node.js streams.', 'en');
  assert.equal(c.query, 'Node.js streams');
  const q = parseResearchCommand('research GPT-4.1?', 'en');
  assert.equal(q.query, 'GPT-4.1');
});

test('buildSynthesisPrompt embeds query and sources', () => {
  const p = buildSynthesisPrompt({
    query: 'STORM autoresearch',
    sources: [{ title: 'STORM paper', url: 'https://arxiv.org/abs/2402.14207', snippet: 'Wikipedia-style writing' }],
    language: 'en',
  });
  assert.match(p, /STORM autoresearch/);
  assert.match(p, /\[1\] STORM paper/);
});

test('parseSynthesisOutput extracts bullets and sources block', () => {
  const text = [
    '- STORM uses perspective-grounded Q&A to draft long-form articles.',
    '- It outperforms naive RAG on outline organization metrics.',
    '- Known failure mode is over-association of unrelated facts.',
    '',
    'SOURCES:',
    '[1] STORM paper',
    '[2] STORM repo',
  ].join('\n');
  const { bullets, sourceLines } = parseSynthesisOutput(text);
  assert.equal(bullets.length, 3);
  assert.equal(sourceLines.length, 2);
  assert.match(bullets[0], /STORM uses/);
});

test('renderResearchSpeech joins intro plus bullets and tags with prefix', () => {
  const speech = renderResearchSpeech(['A.', 'B.', 'C.'], 'en');
  assert.match(speech, /^Research finding:/);
  assert.match(speech, /A\./);
});

test('renderResearchSpeech uses Korean prefix for ko', () => {
  const speech = renderResearchSpeech(['ㄱ.', 'ㄴ.', 'ㄷ.'], 'ko');
  assert.match(speech, /^리서치 결과:/);
});

test('renderResearchMarkdown numbers sources', () => {
  const md = renderResearchMarkdown({
    query: 'GraphRAG',
    bullets: ['one'],
    sources: [{ title: 'MS GraphRAG', url: 'https://example.com/g' }],
    language: 'en',
  });
  assert.match(md, /1\. \[MS GraphRAG\]\(https:\/\/example\.com\/g\)/);
});

test('runResearchTurn happy path with mocked fetch and synth', async () => {
  const env = { TAVILY_API_KEY: 'fake' };
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      answer: '',
      results: [
        { title: 'STORM Stanford', url: 'https://arxiv.org/abs/2402.14207', content: 'Wikipedia-style article generation.' },
        { title: 'STORM Repo', url: 'https://github.com/stanford-oval/storm', content: 'Open-source implementation.' },
      ],
    }),
  });
  const synthesize = async () => '- STORM is a Wikipedia-style article writer.\n- Uses perspective-grounded Q&A.\n- Self-hostable and MIT-licensed.\n\nSOURCES:\n[1] STORM Stanford\n[2] STORM Repo';
  const result = await runResearchTurn({ query: 'STORM autoresearch', env, fetchImpl, synthesize, language: 'en' });
  assert.equal(result.status, 'ok');
  assert.equal(result.bullets.length, 3);
  assert.equal(result.sources.length, 2);
  assert.match(result.speech, /STORM is a Wikipedia-style/);
  assert.match(result.markdown, /arxiv\.org/);
});

test('runResearchTurn reports no_backend when both keys missing', async () => {
  const result = await runResearchTurn({ query: 'x', env: {}, fetchImpl: async () => {}, synthesize: async () => '' });
  assert.equal(result.status, 'no_backend');
});

test('buildResearchEmbed numbers source fields', () => {
  const embed = buildResearchEmbed({
    query: 'GraphRAG',
    bullets: ['summary'],
    sources: [
      { title: 'MS GraphRAG', url: 'https://example.com/g' },
      { title: 'LightRAG', url: 'https://example.com/l' },
    ],
    language: 'en',
  });
  assert.match(embed.title, /Research: GraphRAG/);
  assert.equal(embed.fields.length, 2);
  assert.match(embed.fields[0].name, /^\[1\] MS GraphRAG/);
  assert.equal(embed.fields[1].value, 'https://example.com/l');
});

test('selectSearchBackend honors explicit SEARCH_BACKEND override', () => {
  assert.equal(selectSearchBackend({ SEARCH_BACKEND: 'agent' }).kind, 'agent');
  assert.equal(selectSearchBackend({ SEARCH_BACKEND: 'tavily', TAVILY_API_KEY: 'k' }).kind, 'tavily');
  // explicit pick without matching key falls through to discovery order
  assert.equal(selectSearchBackend({ SEARCH_BACKEND: 'brave' }).kind, 'none');
  assert.equal(selectSearchBackend({ SEARCH_BACKEND: 'brave', TAVILY_API_KEY: 'k' }).kind, 'tavily');
});

test('selectSearchBackend default priority is tavily → brave → searxng → none', () => {
  assert.equal(selectSearchBackend({}).kind, 'none');
  assert.equal(selectSearchBackend({ SEARXNG_URL: 'http://localhost:8888' }).kind, 'searxng');
  assert.equal(selectSearchBackend({ BRAVE_API_KEY: 'b', SEARXNG_URL: 'http://x' }).kind, 'brave');
  assert.equal(selectSearchBackend({ TAVILY_API_KEY: 't', BRAVE_API_KEY: 'b' }).kind, 'tavily');
});

test('selectSearchBackend uses agent fallback opt-in when no key is present', () => {
  assert.equal(selectSearchBackend({ SEARCH_BACKEND_AGENT_FALLBACK: '1' }).kind, 'agent');
});

test('runResearchTurn with SEARXNG_URL builds JSON request and synthesises bullets', async () => {
  const env = { SEARXNG_URL: 'http://searx.local' };
  const captured = [];
  const fetchImpl = async (url) => {
    captured.push(url);
    return {
      ok: true,
      json: async () => ({
        results: [
          { title: 'LightRAG', url: 'https://arxiv.org/abs/2410.05779', content: 'LightRAG dual-level retrieval.' },
          { title: 'HippoRAG', url: 'https://arxiv.org/abs/2405.14831', content: 'PPR-based memory.' },
        ],
      }),
    };
  };
  const synthesize = async () => '- LightRAG is dual-level retrieval.\n- HippoRAG uses PPR.\n- GraphRAG uses Leiden clusters.\n\nSOURCES:\n[1] LightRAG\n[2] HippoRAG';
  const result = await runResearchTurn({ query: 'GraphRAG family', env, fetchImpl, synthesize, language: 'en' });
  assert.equal(result.status, 'ok');
  assert.equal(result.sources.length, 2);
  assert.equal(result.bullets.length, 3);
  assert.match(captured[0], /searx\.local\/search\?.*q=GraphRAG/);
  assert.match(captured[0], /format=json/);
});

test('runResearchTurn agent-delegated path skips performSearch and parses agent output', async () => {
  const env = { SEARCH_BACKEND: 'agent' };
  let fetchCalled = false;
  const fetchImpl = async () => { fetchCalled = true; return { ok: false, json: async () => ({}) }; };
  const synthCalls = [];
  const synthesize = async (prompt, opts) => {
    synthCalls.push({ prompt, opts });
    return [
      '- ACE evolves a per-project playbook that beats fine-tuning.',
      '- It compounds across sessions without changing model weights.',
      '- Open implementation available from the paper authors.',
      '',
      'SOURCES:',
      '[1] ACE paper | https://arxiv.org/abs/2510.04618',
      '[2] Project README | https://github.com/example/ace-repo',
    ].join('\n');
  };
  const result = await runResearchTurn({ query: 'Agentic Context Engineering ACE', env, fetchImpl, synthesize, language: 'en' });
  assert.equal(fetchCalled, false);
  assert.equal(result.status, 'ok');
  assert.equal(result.backend, 'agent');
  assert.equal(result.bullets.length, 3);
  assert.equal(result.sources.length, 2);
  assert.equal(result.sources[0].url, 'https://arxiv.org/abs/2510.04618');
  assert.equal(synthCalls[0].opts.task, true, 'agent-delegated synthesise call sets task=true for longer timeout');
});

test('parseAgentDelegatedOutput tolerates dash separators and missing brackets', () => {
  const text = [
    '- A.',
    '- B.',
    '- C.',
    '',
    'SOURCES:',
    '[1] Foo paper — https://example.com/foo',
    'Bar - https://example.com/bar',
  ].join('\n');
  const { bullets, sources } = parseAgentDelegatedOutput(text);
  assert.equal(bullets.length, 3);
  assert.equal(sources.length, 2);
  assert.equal(sources[0].url, 'https://example.com/foo');
  assert.equal(sources[1].url, 'https://example.com/bar');
});

test('buildAgentDelegatedResearchPrompt names the query and the strict format', () => {
  const p = buildAgentDelegatedResearchPrompt({ query: 'STORM autoresearch', language: 'en' });
  assert.match(p, /You have web access/);
  assert.match(p, /STORM autoresearch/);
  assert.match(p, /SOURCES:/);
});

test('runResearchTurn handles empty search gracefully', async () => {
  const env = { TAVILY_API_KEY: 'fake' };
  const fetchImpl = async () => ({ ok: true, json: async () => ({ results: [] }) });
  const result = await runResearchTurn({ query: 'X', env, fetchImpl, synthesize: async () => '', language: 'en' });
  assert.equal(result.status, 'empty');
  assert.match(result.speech, /could not find/);
});
