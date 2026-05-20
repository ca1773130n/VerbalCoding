import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseResearchCommand,
  buildSynthesisPrompt,
  parseSynthesisOutput,
  renderResearchSpeech,
  renderResearchMarkdown,
  runResearchTurn,
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

test('renderResearchSpeech joins intro plus bullets', () => {
  const speech = renderResearchSpeech(['A.', 'B.', 'C.'], 'en');
  assert.match(speech, /Here is what I found/);
  assert.match(speech, /A\./);
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

test('runResearchTurn handles empty search gracefully', async () => {
  const env = { TAVILY_API_KEY: 'fake' };
  const fetchImpl = async () => ({ ok: true, json: async () => ({ results: [] }) });
  const result = await runResearchTurn({ query: 'X', env, fetchImpl, synthesize: async () => '', language: 'en' });
  assert.equal(result.status, 'empty');
  assert.match(result.speech, /could not find/);
});
