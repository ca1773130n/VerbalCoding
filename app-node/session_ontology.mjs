import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SCHEMA_VERSION = 1;
const NODE_TYPES = new Set(['D', 'F', 'T', 'C', 'A', 'R']);
const EDGE_PREDICATES = new Set(['d', 't', 'u', 'p', 'r', 's']);
const TYPE_LABELS = {
  D: { en: 'Decision', ko: '결정' },
  F: { en: 'File', ko: '파일' },
  T: { en: 'Tool', ko: '도구' },
  C: { en: 'Concept', ko: '개념' },
  A: { en: 'Agent', ko: '에이전트' },
  R: { en: 'Result', ko: '결과' },
};

const FILE_RE = /\b[a-zA-Z0-9_./-]+\.(?:mjs|js|ts|tsx|jsx|py|md|json|yaml|yml|toml|sh|sql|go|rs|java|kt|swift|c|cpp|h|hpp)\b/g;
const TOOL_RE = /\b(?:tool|command|cli|npm|yarn|pnpm|pip|cargo|docker|kubectl|gh|git|ffmpeg|whisper-cli|claude|codex|gemini|aider|cursor)\b/gi;
const DECISION_RE = /\b[a-z][a-z0-9_]{2,}=[\w./-]{1,40}\b/g;

function lc(value) { return String(value || '').trim().toLowerCase(); }
function nowSec() { return Math.floor(Date.now() / 1000); }
function safeChannelKey(value) { return String(value || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64); }
function defaultRootDir() { return path.join(os.homedir(), '.verbalcoding', 'memory'); }
function emptyState(channelKey) {
  return {
    v: SCHEMA_VERSION,
    channelKey,
    nodes: [],
    edges: [],
    meta: { updatedAt: nowSec(), nodeCount: 0, edgeCount: 0 },
  };
}

export function buildExtractionPrompt({ text, language = 'en', knownNames = [] } = {}) {
  const en = /^en/i.test(String(language || ''));
  const lines = [];
  lines.push(en
    ? 'Extract a tiny knowledge graph from the message below. Reply ONLY with JSON of shape {"nodes":[{"t":"D|F|T|C|A|R","n":"name"}],"edges":[{"s":"name","p":"d|t|u|p|r|s","o":"name"}]}.'
    : '아래 메시지에서 작은 지식 그래프를 추출해. JSON만 응답: {"nodes":[{"t":"D|F|T|C|A|R","n":"name"}],"edges":[{"s":"name","p":"d|t|u|p|r|s","o":"name"}]}.');
  lines.push(en
    ? 'Types: D=Decision (slot=value), F=File (path), T=Tool (command), C=Concept (noun), A=Agent (backend), R=Result (short summary).'
    : '타입: D=결정(slot=value), F=파일, T=도구, C=개념, A=에이전트, R=결과 요약.');
  lines.push(en
    ? 'Predicates: d=decided, t=touched, u=used, p=produced, r=referenced, s=superseded_by.'
    : '엣지: d=결정, t=수정, u=사용, p=생성, r=참조, s=덮어쓰기.');
  if (knownNames.length) {
    lines.push(en ? `Already known names (prefer these for dedup): ${knownNames.slice(0, 20).join(', ')}` : `이미 등록된 이름(중복 방지에 우선): ${knownNames.slice(0, 20).join(', ')}`);
  }
  lines.push(en ? `Message:\n${text}` : `메시지:\n${text}`);
  lines.push(en ? 'Return ONLY the JSON object, no markdown.' : 'JSON 객체만 반환, 마크다운 없이.');
  return lines.join('\n\n');
}

export function parseExtractionJson(raw) {
  const t = String(raw || '').trim();
  const fenceMatch = t.match(/```(?:json)?\s*([\s\S]+?)```/);
  const body = fenceMatch ? fenceMatch[1] : t;
  const firstBrace = body.indexOf('{');
  const lastBrace = body.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace <= firstBrace) return { nodes: [], edges: [] };
  try {
    const parsed = JSON.parse(body.slice(firstBrace, lastBrace + 1));
    const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
    const edges = Array.isArray(parsed?.edges) ? parsed.edges : [];
    const nameToId = new Map();
    const parsedNodes = [];
    for (const n of nodes) {
      if (!n || !n.t || !n.n) continue;
      const id = `e_${n.t}_${String(n.n).toLowerCase()}`;
      nameToId.set(String(n.n).toLowerCase(), id);
      parsedNodes.push({ id, t: n.t, n: n.n });
    }
    const parsedEdges = [];
    for (const e of edges) {
      if (!e || !e.p) continue;
      const s = nameToId.get(String(e.s || '').toLowerCase());
      const o = nameToId.get(String(e.o || '').toLowerCase());
      if (!s || !o) continue;
      parsedEdges.push({ s, p: e.p, o });
    }
    return { nodes: parsedNodes, edges: parsedEdges };
  } catch { return { nodes: [], edges: [] }; }
}

export function createSessionOntology({ rootDir, channelKey, maxNodes = 40, maxEdges = 80, fsApi = fs } = {}) {
  const root = rootDir || defaultRootDir();
  const channel = safeChannelKey(channelKey);
  const filePath = path.join(root, `${channel}.json`);
  let state = emptyState(channel);
  let nextId = 1;

  function nodeKey(node) { return `${node.t}::${lc(node.n)}`; }
  function findNodeId(t, name) {
    const key = `${t}::${lc(name)}`;
    for (const node of state.nodes) if (nodeKey(node) === key) return node.id;
    return null;
  }
  function evictIfNeeded() {
    while (state.nodes.length > maxNodes) {
      const idx = state.nodes.findIndex(n => n.t !== 'D');
      if (idx === -1) break;
      const evictedId = state.nodes[idx].id;
      state.nodes.splice(idx, 1);
      state.edges = state.edges.filter(e => e.s !== evictedId && e.o !== evictedId);
    }
    while (state.edges.length > maxEdges) state.edges.shift();
  }

  function add({ nodes = [], edges = [], supersedes = [] } = {}) {
    const idMap = new Map();
    const ts = nowSec();
    const addedNodes = [];
    for (const raw of nodes) {
      if (!raw || !NODE_TYPES.has(raw.t)) continue;
      const name = String(raw.n || '').trim();
      if (!name) continue;
      const existing = findNodeId(raw.t, name);
      if (existing) { idMap.set(raw.id || existing, existing); continue; }
      const node = { id: `n${nextId++}`, t: raw.t, n: name.slice(0, 80), ts: raw.ts || ts };
      if (raw.by) node.by = String(raw.by).slice(0, 24);
      state.nodes.push(node);
      idMap.set(raw.id || node.id, node.id);
      addedNodes.push(node.id);
    }
    for (const raw of edges) {
      if (!raw || !EDGE_PREDICATES.has(raw.p)) continue;
      const s = idMap.get(raw.s) || raw.s;
      const o = idMap.get(raw.o) || raw.o;
      if (!s || !o) continue;
      const exists = state.edges.some(e => e.s === s && e.p === raw.p && e.o === o);
      if (exists) continue;
      state.edges.push({ s, p: raw.p, o, ts: raw.ts || ts });
    }
    for (const sup of supersedes) {
      if (!sup) continue;
      const oldId = idMap.get(sup.old) || sup.old;
      const newId = idMap.get(sup.new) || sup.new;
      if (!oldId || !newId) continue;
      state.edges.push({ s: newId, p: 's', o: oldId, ts });
    }
    evictIfNeeded();
    state.meta = { updatedAt: ts, nodeCount: state.nodes.length, edgeCount: state.edges.length };
    return addedNodes;
  }

  function supersededIds() {
    const sup = new Set();
    for (const edge of state.edges) if (edge.p === 's') sup.add(edge.o);
    return sup;
  }
  function neighborsOf(nodeIds) {
    const out = new Set();
    const ids = nodeIds instanceof Set ? nodeIds : new Set(nodeIds);
    for (const edge of state.edges) {
      if (ids.has(edge.s)) out.add(edge.o);
      if (ids.has(edge.o)) out.add(edge.s);
    }
    return out;
  }

  function serializeForHandoff({ language = 'en', maxBytes = 1500 } = {}) {
    const en = /^en/i.test(String(language || ''));
    const labels = en
      ? { decisions: 'Active decisions', touched: 'Relevant files', tools: 'Tools in play', results: 'Recent results', empty: '(no prior session context)' }
      : { decisions: '활성 결정', touched: '관련 파일', tools: '사용 도구', results: '최근 결과', empty: '(이전 세션 컨텍스트 없음)' };
    const sup = supersededIds();
    const live = state.nodes.filter(n => !sup.has(n.id));
    if (!live.length) return labels.empty;
    const decisionNodes = live.filter(n => n.t === 'D');
    const decisionIds = new Set(decisionNodes.map(n => n.id));
    const nearby = neighborsOf(decisionIds);
    const fileNodes = live.filter(n => n.t === 'F' && nearby.has(n.id));
    const toolNodes = live.filter(n => n.t === 'T' && nearby.has(n.id));
    const resultNodes = live.filter(n => n.t === 'R').sort((a, b) => b.ts - a.ts).slice(0, 3);
    const lines = [];
    if (decisionNodes.length) {
      lines.push(`### ${labels.decisions}`);
      for (const n of decisionNodes.slice(-8)) lines.push(`- ${n.n}${n.by ? ` _(by ${n.by})_` : ''}`);
    }
    if (fileNodes.length) {
      lines.push(`### ${labels.touched}`);
      for (const n of fileNodes.slice(-6)) lines.push(`- ${n.n}`);
    }
    if (toolNodes.length) {
      lines.push(`### ${labels.tools}`);
      for (const n of toolNodes.slice(-6)) lines.push(`- ${n.n}`);
    }
    if (resultNodes.length) {
      lines.push(`### ${labels.results}`);
      for (const n of resultNodes) lines.push(`- ${n.n}${n.by ? ` _(${n.by})_` : ''}`);
    }
    let out = lines.join('\n');
    if (Buffer.byteLength(out, 'utf8') > maxBytes) out = out.slice(0, maxBytes - 4) + '\n...';
    return out;
  }

  function entitiesFromText(text, { by = '', kind = 'utterance' } = {}) {
    const t = String(text || '');
    if (!t.trim()) return { nodes: [], edges: [] };
    const nodes = [];
    const edges = [];
    const seenFile = new Set();
    const seenTool = new Set();
    const seenDecision = new Set();
    for (const match of t.matchAll(FILE_RE)) {
      const name = match[0];
      if (seenFile.has(name)) continue;
      seenFile.add(name);
      nodes.push({ id: `f_${name}`, t: 'F', n: name, by });
    }
    for (const match of t.matchAll(TOOL_RE)) {
      const tool = match[0].toLowerCase();
      if (seenTool.has(tool)) continue;
      seenTool.add(tool);
      nodes.push({ id: `t_${tool}`, t: 'T', n: tool, by });
    }
    for (const match of t.matchAll(DECISION_RE)) {
      const decision = match[0];
      if (seenDecision.has(decision)) continue;
      seenDecision.add(decision);
      const id = `d_${decision}`;
      nodes.push({ id, t: 'D', n: decision, by });
      for (const fn of seenFile) edges.push({ s: id, p: 't', o: `f_${fn}` });
      for (const tn of seenTool) edges.push({ s: id, p: 'u', o: `t_${tn}` });
    }
    if (kind === 'result' && t.trim()) {
      const summary = t.trim().replace(/\s+/g, ' ').slice(0, 80);
      nodes.push({ id: `r_${nowSec()}_${Math.random().toString(16).slice(2, 8)}`, t: 'R', n: summary, by });
    }
    return { nodes, edges };
  }

  function save() {
    try {
      fsApi.mkdirSync(root, { recursive: true });
      const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
      fsApi.writeFileSync(tmp, JSON.stringify(state), { mode: 0o600 });
      fsApi.renameSync(tmp, filePath);
      return true;
    } catch {
      return false;
    }
  }
  function load() {
    try {
      const raw = fsApi.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.v === SCHEMA_VERSION && parsed.channelKey === channel) {
        state = parsed;
        for (const node of state.nodes) {
          const m = String(node.id || '').match(/^n(\d+)$/);
          if (m) nextId = Math.max(nextId, Number(m[1]) + 1);
        }
        return true;
      }
    } catch {}
    state = emptyState(channel);
    return false;
  }
  function snapshot() { return JSON.parse(JSON.stringify(state)); }
  function reset() { state = emptyState(channel); nextId = 1; }

  return {
    add, entitiesFromText, serializeForHandoff, save, load, snapshot, reset,
    get nodeCount() { return state.nodes.length; },
    get edgeCount() { return state.edges.length; },
    get filePath() { return filePath; },
    get typeLabels() { return TYPE_LABELS; },
  };
}
