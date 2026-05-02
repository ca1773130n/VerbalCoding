# 001: Hermes verbose output extraction

## Question

Given VerbalCoding runs `hermes chat` in verbose mode without `-Q`, when Hermes uses tools and prints rich CLI output, then `sanitizeAgentOutput()` should extract the final boxed answer instead of returning an empty string.

## Why this matters

A live Discord voice turn produced the spoken fallback `응답이 비어 있어.` even though the overall Hermes session later contained a real assistant answer. This spike checks whether the current stdout parser can reproduce extraction under fresh quiet and verbose CLI runs.

## How to run

```bash
node spikes/001-hermes-verbose-output-extraction/spike.mjs
```

## Results

Fresh CLI runs did not reproduce a parser failure:

- `hermes chat -Q -q`: stdout was short plain text, extracted answer was `현재 작업실은 /Users/neo 입니다.`
- `hermes chat -q`: stdout contained rich progress preview plus a final Hermes box, and `sanitizeAgentOutput()` extracted `현재 작업실은 /Users/neo 입니다.`

This means the box parser works for normal quiet and verbose Hermes output.

The live failure is therefore more likely specific to the voice bridge's long resumed-session turn: the child Hermes process reached `Agent CLI done`, but the captured stdout/stderr had no extractable final answer, so `createAgentAdapter()` returned its hardcoded fallback `응답이 비어 있어.`.

## Verdict: PARTIAL

### What worked
- Confirmed the current parser can extract final answers from fresh quiet and verbose Hermes CLI output.
- Confirmed verbose output with tool previews is not inherently enough to break `sanitizeAgentOutput()`.

### What didn't
- The spike did not reproduce the exact live empty-output condition.

### Surprises
- The live log showed the fallback was emitted only after about 41 seconds of agent runtime, so this was not an immediate STT or Discord playback failure.

### Recommendation for the real build
- Add instrumentation around `createAgentAdapter().ask()` to log sanitized stdout/stderr lengths and whether a Hermes final box was detected, without logging raw sensitive content.
- Replace the generic fallback `응답이 비어 있어.` with a clearer bridge-level message such as `응답 추출에 실패했어. 세션 로그를 확인할게.`
- Consider a fallback that reads the most recent assistant message from the Hermes session file when stdout extraction is empty.
