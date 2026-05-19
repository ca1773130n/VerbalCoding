# Aider — 하니스 노트

<p align="center">
  <a href="../../README.ko.md">README</a> ·
  <a href="HARNESSES.ko.md">하니스</a> ·
  <a href="USAGE.ko.md">사용법</a> ·
  <a href="CONFIGURATION.ko.md">설정</a>
</p>

Aider는 직접 파일 수정에 집중한 페어 프로그래밍 AI CLI야. VerbalCoding은 `aider --no-pretty --yes-always --message`로 호출해 — prompt는 `--message` 값으로 들어가고, voice turn 하나가 `AGENT_WORKDIR`의 파일을 직접 수정할 수 있는 non-interactive Aider 실행 하나가 돼.

## 설치

```bash
pip install aider-chat
aider --version
# 단일 메시지 실행 확인:
aider --no-pretty --yes-always --message "list the top-level files"
```

Aider는 사용하는 모델용 API 키가 필요해 (OpenAI / Anthropic / 로컬 서버). <https://aider.chat> 참고.

## VerbalCoding 설정

```bash
# .env
AGENT_BACKEND=aider
# 선택
AIDER_COMMAND="aider --no-pretty --yes-always --message"   # 기본값
AGENT_WORKDIR=/Users/you/code/your-project                 # Aider가 편집할 디렉터리
AGENT_PROJECT_CONTEXT="..."
AGENT_CHAT_TIMEOUT_MS=120000                               # Aider는 더 오래 걸릴 수 있음
AGENT_TASK_TIMEOUT_MS=0
```

`--no-pretty`는 Rich 박스 문자를 제거해서 스트림 sentencer가 안 막혀. `--yes-always`는 실행을 non-interactive로 유지 (Aider가 "이 diff 적용할까요?" 같은 대화 없이 진행).

## Aider로 전환하는 음성 표현

- en: `"switch to Aider"`, `"ask Aider to ..."`
- ko: `"aider로 전환해줘"`, `"에이더로 전환"`

매처가 받는 별칭: `aider`, `에이더`.

## 함정

- **Aider는 파일을 수정해.** `-p` 모드의 Claude / Codex / Gemini와 달리 Aider는 답변하면서 작업 트리를 직접 바꿔. `AGENT_WORKDIR` 설정을 신중히 — 보통 프로젝트 세션의 `workdir`이 적당.
- **출력에 diff.** Aider는 diff 모양 텍스트를 자주 emit해. 턴이 interrupt되면 bridge는 "중단됨" 안내만 하고 diff는 음성으로 안 읽어 — 텍스트 채널과 `git status`로 확인해.
- **인증.** `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`가 Aider 환경에 있어야 해. 인스턴스 격리 설치는 보통 `instances/<project>.env` 사용.
- **채널별 상태.** 크로스 에이전트 라우팅은 디스코드 채널 기준이라, 한 프로젝트 룸에서 Aider로 전환해도 다른 룸엔 영향 없어.
