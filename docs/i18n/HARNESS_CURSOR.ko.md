# Cursor CLI — 하니스 노트

<p align="center">
  <a href="../../README.ko.md">README</a> ·
  <a href="HARNESSES.ko.md">하니스</a> ·
  <a href="USAGE.ko.md">사용법</a> ·
  <a href="CONFIGURATION.ko.md">설정</a>
</p>

Cursor CLI(`cursor-agent`)는 Cursor의 터미널 에이전트. VerbalCoding은 `cursor-agent --print --prompt`로 호출하면서 STT 결과를 prompt 값으로 넘겨. `--print`는 실행을 non-interactive로 유지.

## 설치

상위 Cursor CLI 설치 가이드를 따르고 확인:

```bash
cursor-agent --print --prompt "hello"
```

## VerbalCoding 설정

```bash
# .env
AGENT_BACKEND=cursor                                       # 'cursor-cli' 별칭도 허용
# 선택
CURSOR_COMMAND="cursor-agent --print --prompt"             # 기본값
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## Cursor로 전환하는 음성 표현

- en: `"switch to Cursor"`, `"ask Cursor ..."`, `"switch to cursor cli"`, `"switch to cursor agent"`
- ko: `"커서로 전환"`, `"cursor한테 물어봐"`

매처가 받는 별칭: `cursor`, `cursor cli`, `cursor-cli`, `cursor agent`, `cursor-agent`.

## 함정

- **Prompt 위치.** `--prompt`는 값을 뒤에 받는데, VerbalCoding의 shell-aware argv 빌더가 STT 결과를 마지막 positional 인자로 두니까 `CURSOR_COMMAND`는 `--prompt`로 끝나야 해.
- **에디터 부수 효과.** Cursor CLI는 working directory에 cursor 관련 상태 파일을 만질 수 있어. 음성 전용 흐름에선 놀랍게 느껴질 수 있으니 격리된 프로젝트 디렉터리로 `AGENT_WORKDIR`를 지정해.
- **세션 재개 없음.** 턴 사이 연속성은 `AGENT_PROJECT_CONTEXT` + 다른 하니스에서 돌아올 때의 크로스 에이전트 핸드오프 블록에 의존.
- **Patch 안전장치.** Cursor가 diff를 반환 중 interrupt되면 bridge는 diff를 음성으로 안 읽어.
