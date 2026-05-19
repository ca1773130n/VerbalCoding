# Codex — 하니스 노트

<p align="center">
  <a href="../../README.ko.md">README</a> ·
  <a href="HARNESSES.ko.md">하니스</a> ·
  <a href="USAGE.ko.md">사용법</a> ·
  <a href="CONFIGURATION.ko.md">설정</a>
</p>

Codex CLI는 OpenAI의 터미널 코딩 에이전트. VerbalCoding은 `codex exec`로 호출해. `codex exec`는 `--output-last-message <path>`를 주면 최종 어시스턴트 텍스트를 임시 파일에 써주는데, 어댑터가 이 플래그를 자동으로 끼워 넣고 stdout이 시끄러워도 파일에서 답변을 읽어와.

## 설치

```bash
npm install -g @openai/codex
codex login              # 또는 헤드리스용으로 OPENAI_API_KEY 설정
codex exec "hello"
```

## VerbalCoding 설정

```bash
# .env
AGENT_BACKEND=codex
# 선택
CODEX_COMMAND="codex exec"                      # 기본값
AGENT_PROJECT_CONTEXT="작업 중인 내용과 이미 결정된 사항."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

`AGENT_SESSION_FILE`은 미사용 (Codex `exec`는 호출 간 stateless).

## 출력 캡처

Codex 어댑터는:

1. `os.tmpdir()` 아래 `verbalcoding-codex-last-<pid>-<ts>.txt` 같은 임시 경로를 만들고
2. 최종 prompt 인자 바로 앞에 `--output-last-message <path>`를 끼우고
3. 실행 후 그 파일을 정답 답변으로 읽고 (stdout보다 우선)
4. 임시 파일을 지워.

Codex가 stdout에 tool-use chatter를 뿌려도 음성으로 나가는 답변은 항상 캡처된 파일 기준.

## Codex로 전환하는 음성 표현

- en: `"switch to Codex"`, `"ask Codex what it thinks"`
- ko: `"코덱스로 전환"`, `"코덱스한테 물어봐"`

## 함정

- **긴 작업.** 분 단위 코드 생성을 위해 `AGENT_TASK_TIMEOUT_MS=0` 설정 권장. 어댑터가 `signal.aborted`를 존중하므로 barge-in은 깨끗하게 끊겨.
- **세션 재개 없음.** `AGENT_PROJECT_CONTEXT`로 컨텍스트를 전달하고, 라우트 변경 후 연속성은 크로스 에이전트 핸드오프 블록에 맡겨.
- **Patch 형식 출력 안전장치.** 턴이 interrupt됐고 Codex가 diff 중이었으면 bridge는 diff를 음성으로 읽지 **않고** "중단됨" 안내만 한 다음 텍스트 채널 확인을 권유해.
- **인증.** OpenAI 백엔드의 401은 non-zero exit로 표면화. 기본 에이전트가 아니면 크로스 에이전트 fallback 프롬프트가 기본 에이전트로 재시도 제안.
