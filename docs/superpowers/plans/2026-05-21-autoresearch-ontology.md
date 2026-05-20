# Voice Autoresearch + Session Ontology — Implementation Plan

**Status: in flight, 2026-05-21.** This is a 1-hour innovation push driven by 6 parallel research agents that surveyed 2026 autoresearch frameworks, LLM-driven ontology construction, agent memory systems, voice-first UX, agent design patterns, and the VerbalCoding code surface.

## Why now

VerbalCoding's cross-agent voice routing landed but the handoff still passes a flat string ("last 4 utterances + last plan decisions") to the routed backend. That string drops surrounding context — *which file was touched 6 turns ago that still matters*, *which tool was used*, *which decisions are now superseded*. Every 2026 production agent-memory system (Graphiti/Zep, Mem0g, Anthropic Memory tool, Letta MemFS, ACE) converged on **typed graph or filesystem persistence with append-only semantics + idempotent dedup**. We can carry the smallest viable shape of that across CLI invocations.

Simultaneously, the autoresearch wave (STORM, OpenScholar, GPT-Researcher, Anthropic multi-agent research) shows a stable architecture: **plan → parallel fan-out → outline-as-compression → cited synthesis**. VerbalCoding has every piece needed (plan-mode, streaming TTS, sentencer, per-channel state) — we just don't have the voice command or the orchestrator.

Both extensions share infrastructure: the session ontology is where autoresearch results land and where handoff context comes from.

## Module 1 — `app-node/session_ontology.mjs`

A per-channel typed graph. Fixed schema (no induction tax). Append-only with `superseded_by`. Serializable to <2KB JSON. Persists to `~/.verbalcoding/memory/<channelId>.json`.

**Node types (single char `t`):** `D` Decision, `F` File, `T` Tool, `C` Concept, `A` Agent, `R` Result.

**Edge predicates (single char `p`):** `d` decided, `t` touched, `u` used, `p` produced, `r` referenced, `s` superseded_by.

**Shape:**
```js
{
  v: 1,                                    // schema version
  channelKey: 'voice/123',
  nodes: [{ id: 'n1', t: 'D', n: 'oauth_provider=github', ts: 1716100000, by: 'claude' }],
  edges: [{ s: 'n1', p: 't', o: 'n2', ts: 1716100000 }],
  meta: { updatedAt: 1716100000, nodeCount: 1, edgeCount: 1 },
}
```

**Public API:**
- `createSessionOntology({ rootDir, channelKey, maxNodes = 40, maxEdges = 80 })` → store handle
- `store.add({ nodes, edges, supersedes })` — idempotent on `(t, lowercase(n))`
- `store.serializeForHandoff({ language = 'en', maxBytes = 1500 })` → compact markdown block ready for the cross-agent prompt
- `store.entitiesFromText(text, opts)` — convenience extractor (regex-only, no LLM, see below)
- `store.save() / store.load()`

**Why regex-only extraction (for v1):** the research summary said the EDC-style LLM extraction is the dominant 2025 pattern, but it costs an LLM call per turn on the voice critical path. v1 uses lightweight regex extraction so it never blocks a turn. The extraction is upgradeable later (slot in an LLM-backed extractor behind the same `entitiesFromText` signature).

**Eviction:** LRU on non-`Decision` nodes when over `maxNodes`. `Decision` nodes are sticky.

**Conflict resolution:** new fact does not delete old fact; it adds a `superseded_by` edge. `serializeForHandoff` skips superseded nodes by default. Graphiti-pattern, simplified.

## Module 2 — `app-node/research_mode.mjs`

Voice command parser + pipeline. Maps STORM's outline-as-compression and GPT-Researcher's plan→executors pattern, but compressed to fit a voice turn.

**Public API:**
- `parseResearchCommand(text, language)` — returns `{type:'research', query, depth, sticky?} | {type:'none'}`. English `"research X"`, `"look up X"`, `"deep research X"`; Korean `"X 리서치", "X 조사해"`.
- `runResearchTurn({ query, depth, fetchImpl, llmAdapter, signal, language })` — async generator yielding `{phase, payload}` events: `'plan'`, `'fetch'`, `'summarize'`, `'narration'`, `'done'`. The main dispatcher routes `narration` chunks to the existing sentencer / streaming TTS queue.

**Backends:** primary search via Tavily (`TAVILY_API_KEY`), fallback Brave (`BRAVE_SEARCH_API_KEY`), then a "search backend not configured" voice notice. Synthesis via the active agent adapter (whichever CLI is current) so we don't add a separate API key requirement.

**Output shape:** spoken = 3-bullet outline narrated as one sentence each; text-channel = full markdown with sources and a one-line summary at the top (Perplexity-Voice-style citation-defer).

**Ontology integration:** after `done`, write `Concept` nodes for the query and main topics, `Result` nodes for each summary bullet, with `referenced` edges to URLs (stored as `File` nodes with a `t:'F'` and `n` set to the URL hash).

## Module 3 — wire into `main.mjs`

1. Import both new modules near the existing `agent_routing` import block.
2. In the per-turn dispatcher (~`main.mjs:1844`, before `parseAgentRoutingCommand`), insert `parseResearchCommand`. If it returns `{type:'research', …}`, run the research turn and short-circuit the rest.
3. Add `ontologyStateFor(channelKey)` next to `routingStateFor`. Lazy-create, persist on every mutation.
4. Replace the cross-agent prompt's `priorUtterances` + `resolvedDecisions` inputs with `ontology.serializeForHandoff()` when the ontology is non-empty. Fall back to the existing flat string otherwise.
5. After every successful agent turn, call `ontology.entitiesFromText(prompt + answer, { by: backend })` non-blocking.

## Tests

- `app-node/session_ontology.test.mjs` — add, supersede, dedup, eviction, serializeForHandoff shape, save/load round-trip.
- `app-node/research_mode.test.mjs` — parser EN/KO, runResearchTurn pipeline with mocked fetch + llm.
- Extend `cross_agent_routing.test.mjs` — ontology projection replaces flat string when present.

## Out of scope (this push)

- LLM-driven entity extraction (regex v1; upgradeable later).
- Streaming TTS prefix for "Research finding: " (TODO `bet-2.1` — wire via the existing prefix mechanism).
- Citation-defer Discord embed formatting (TODO `bet-2.2`).
- Per-agent voice ID + pre-warm (separate workstream).
- The voice-coding benchmark suggestion from the agent-pattern survey (this is a positioning play, separate from code).

## Commit boundary

One commit per module + one for the wiring + one for the docs. Land green or revert.
