# 코딩 에이전트 하니스

<p align="center">
  <a href="../../README.ko.md">README</a> ·
  <a href="README.ko.md">문서 허브</a> ·
  <a href="USAGE.ko.md">사용법</a> ·
  <a href="CONFIGURATION.ko.md">설정</a> ·
  <a href="TROUBLESHOOTING.ko.md">문제 해결</a>
</p>

VerbalCoding은 에이전트 종속이 아니야. 설치돼 있는 CLI 코딩 에이전트를 voice turn 하나당 한 번씩 실행하고, STT 결과를 prompt로 넘긴 다음 응답을 음성으로 돌려줘. **하나**를 기본 에이전트로 정하고, 음성 라우팅으로 다른 에이전트에 잠깐씩 전환할 수 있어.

| 하니스 | 기본 명령 | 세션 재개 | 하니스별 문서 |
|---|---|---|---|
| Hermes Agent | `hermes chat -Q -q` | ✅ (`--resume <id>`) | [HERMES_VOICE.ko.md](./HERMES_VOICE.ko.md) · [HARNESS_HERMES.ko.md](./HARNESS_HERMES.ko.md) |
| Claude Code | `claude -p` | ❌ | [HARNESS_CLAUDE.ko.md](./HARNESS_CLAUDE.ko.md) |
| Codex | `codex exec` | ❌ (마지막 메시지 파일 캡처) | [HARNESS_CODEX.ko.md](./HARNESS_CODEX.ko.md) |
| Gemini CLI | `gemini -p` | ❌ | [HARNESS_GEMINI.ko.md](./HARNESS_GEMINI.ko.md) |
| OpenCode | `opencode run` | ❌ | [HARNESS_OPENCODE.ko.md](./HARNESS_OPENCODE.ko.md) |
| OpenClaw | `openclaw run` | ❌ | [HARNESS_OPENCLAW.ko.md](./HARNESS_OPENCLAW.ko.md) |
| Aider | `aider --no-pretty --yes-always --message` | ❌ | [HARNESS_AIDER.ko.md](./HARNESS_AIDER.ko.md) |
| Cursor CLI | `cursor-agent --print --prompt` | ❌ | [HARNESS_CURSOR.ko.md](./HARNESS_CURSOR.ko.md) |

## 기본 에이전트 고르기

`vc setup`이 설치된 바이너리를 자동 감지해서 선택지를 보여줘. 비대화형 설정은:

```bash
# .env 또는 instance .env
AGENT_BACKEND=claude              # hermes | claude | codex | gemini | opencode | openclaw | aider | cursor | custom
```

각 하니스는 자기 명령을 같은 이름의 env 변수(`HERMES_COMMAND`, `CLAUDE_COMMAND` 등)에서 읽어. 공통 env (`AGENT_LABEL`, `AGENT_COMMAND`, `AGENT_SESSION_FILE`, `AGENT_WORKDIR`, `AGENT_PROJECT_CONTEXT`, `AGENT_TASK_TIMEOUT_MS`, `AGENT_CHAT_TIMEOUT_MS`, `AGENT_VERBOSE_PROGRESS`)는 해당 하니스의 기본값을 덮어써.

## 음성으로 하니스 사이 라우팅

설정이 끝나면 재시작 없이 **설치돼 있는** 어떤 하니스로든 옮길 수 있어:

- `"코덱스한테 물어봐"` — 이번 턴만 Codex, 다음 턴은 기본 에이전트로 복귀.
- `"aider로 전환"` — sticky 라우팅, `"기본으로 돌아가"`라고 할 때까지 유지.
- 플랜 모드의 `which_agent` 슬롯 — 에이전트가 다음 플랜을 어느 백엔드로 돌릴지 직접 제안.

라우팅 레이어는 바이너리가 `PATH`에 있는지 확인하고 (활성 프로젝트 세션의 workdir 기준 상대 경로도 처리), 없으면 `"기본 에이전트로 대신 진행할까?"`라고 물어봐. `"예"`로 답하면 기본 에이전트로 fallback, `"아니오"`로 취소.

파서가 인식하는 별칭: `claude` / `claude code`, `codex` / `코덱스`, `gemini` / `gemini cli` / `제미나이`, `opencode`, `openclaw`, `aider` / `에이더`, `cursor` / `cursor cli`, `hermes` / `헤르메스`.

## 공통 동작

모든 하니스 어댑터가 똑같이 처리하는 것들:

- **음성 플랜 모드** — `"먼저 계획 짜줘"`로 플랜을 만들고, 음성으로 편집한 다음 `"실행"`이라고 하면 선택된 하니스로 실행돼.
- **Barge-in** — 끼어들기는 현재 TTS를 끊고 에이전트 작업을 abort 시켜. Sticky 라우팅은 interrupt 후에도 유지, 단일 턴 라우팅만 초기화돼.
- **상세 진행** — `AGENT_VERBOSE_PROGRESS=1` (또는 `"상세 진행 켜"`)로 하니스가 emit하는 진행 이벤트를 출력해. `SMART_PROGRESS_API_KEY`가 있으면 LLM 요약기가 묶음당 한 문장으로 정리.
- **푸시 알림 핸드오프** — `NOTIFY_PROVIDER=ntfy|pushover` + `NOTIFY_MIN_TASK_MS` 조건 충족 시 긴 작업이 끝나고 음성채널이 비어 있으면 푸시. body + `NOTIFY_DEBOUNCE_MS`로 debounce.
- **채널별 상태** — 디스코드 음성 채널마다 별도의 라우팅·플랜 상태·발화 링 버퍼.
- **프로젝트 세션** — `!session new <name> <workdir>`로 채널과 프로젝트를 묶음. (하니스, 세션)별 어댑터는 캐시되고 rebind 시 무효화.

설치 경로, 인증, 함정은 하니스별 문서 참고. env 변수 전체 레퍼런스는 `docs/CONFIGURATION.ko.md`.
