import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createSessionOntology } from './session_ontology.mjs';

function tmpDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `vc-onto-${label}-`));
}

test('add inserts nodes and dedupes by (type, lowercase name)', () => {
  const ontology = createSessionOntology({ rootDir: tmpDir('dedup'), channelKey: 'voice/1' });
  ontology.add({ nodes: [{ t: 'D', n: 'OAUTH_PROVIDER=github' }, { t: 'D', n: 'oauth_provider=github' }] });
  assert.equal(ontology.nodeCount, 1);
});

test('add applies supersede edges without deleting old node', () => {
  const ontology = createSessionOntology({ rootDir: tmpDir('supersede'), channelKey: 'voice/2' });
  ontology.add({
    nodes: [
      { id: 'a', t: 'D', n: 'session_store=memory' },
      { id: 'b', t: 'D', n: 'session_store=redis' },
    ],
    supersedes: [{ old: 'a', new: 'b' }],
  });
  assert.equal(ontology.nodeCount, 2);
  const md = ontology.serializeForHandoff({ language: 'en' });
  assert.match(md, /session_store=redis/);
  assert.doesNotMatch(md, /session_store=memory/);
});

test('LRU eviction keeps decisions sticky', () => {
  const ontology = createSessionOntology({ rootDir: tmpDir('lru'), channelKey: 'voice/3', maxNodes: 3 });
  ontology.add({ nodes: [{ t: 'D', n: 'a=1' }, { t: 'F', n: 'app.mjs' }, { t: 'F', n: 'lib.mjs' }] });
  assert.equal(ontology.nodeCount, 3);
  ontology.add({ nodes: [{ t: 'F', n: 'main.mjs' }] });
  assert.equal(ontology.nodeCount, 3);
  const snap = ontology.snapshot();
  assert.ok(snap.nodes.some(n => n.t === 'D'), 'decision survives eviction');
});

test('entitiesFromText extracts files, tools, decisions', () => {
  const ontology = createSessionOntology({ rootDir: tmpDir('extract'), channelKey: 'voice/4' });
  const out = ontology.entitiesFromText(
    'Updated app/main.mjs and ran npm test. We settled oauth_provider=github.',
    { by: 'claude' },
  );
  const types = out.nodes.map(n => n.t).sort();
  assert.ok(types.includes('F'), 'has file node');
  assert.ok(types.includes('T'), 'has tool node');
  assert.ok(types.includes('D'), 'has decision node');
  const decision = out.nodes.find(n => n.t === 'D');
  assert.match(decision.n, /oauth_provider=github/);
});

test('serializeForHandoff returns empty marker on empty ontology', () => {
  const ontology = createSessionOntology({ rootDir: tmpDir('empty'), channelKey: 'voice/5' });
  assert.match(ontology.serializeForHandoff({ language: 'en' }), /no prior session context/);
  assert.match(ontology.serializeForHandoff({ language: 'ko' }), /이전 세션 컨텍스트 없음/);
});

test('serializeForHandoff groups decisions, files, tools, results', () => {
  const ontology = createSessionOntology({ rootDir: tmpDir('serialize'), channelKey: 'voice/6' });
  const { nodes, edges } = ontology.entitiesFromText(
    'Touched app-node/main.mjs with git commit. oauth_provider=github decided.',
    { by: 'claude' },
  );
  ontology.add({ nodes, edges });
  ontology.add({ nodes: [{ t: 'R', n: 'OAuth wired up successfully', by: 'codex' }] });
  const md = ontology.serializeForHandoff({ language: 'en' });
  assert.match(md, /Active decisions/);
  assert.match(md, /oauth_provider=github/);
  assert.match(md, /Relevant files/);
  assert.match(md, /main\.mjs/);
  assert.match(md, /Recent results/);
});

test('save/load round-trips state to disk', () => {
  const root = tmpDir('persist');
  const ontology = createSessionOntology({ rootDir: root, channelKey: 'voice/7' });
  ontology.add({ nodes: [{ t: 'D', n: 'db=postgres', by: 'claude' }] });
  assert.ok(ontology.save());
  const restored = createSessionOntology({ rootDir: root, channelKey: 'voice/7' });
  assert.ok(restored.load());
  assert.equal(restored.nodeCount, 1);
  assert.match(restored.serializeForHandoff({ language: 'en' }), /db=postgres/);
});
