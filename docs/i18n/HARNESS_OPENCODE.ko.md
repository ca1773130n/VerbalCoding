# OpenCode — 하니스 노트

<p align="center">
  <a href="../../README.ko.md">README</a> ·
  <a href="HARNESSES.ko.md">하니스</a> ·
  <a href="USAGE.ko.md">사용법</a> ·
  <a href="CONFIGURATION.ko.md">설정</a>
</p>

OpenCode는 오픈소스 터미널 코딩 에이전트. VerbalCoding은 `opencode run`으로 호출해.

## 설치

상위 OpenCode 설치 가이드를 따르고 확인:

```bash
opencode run "hello"
```

## VerbalCoding 설정

```bash
# .env
AGENT_BACKEND=opencode
# 선택
OPENCODE_COMMAND="opencode run"             # 기본값
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## OpenCode로 전환하는 음성 표현

- en: `"switch to OpenCode"`, `"ask OpenCode ..."`, `"switch to open code"`
- ko: `"opencode로 전환"`, `"오픈코드로 전환"`

매처가 받는 별칭: `opencode`, `open code`.

## 함정

- **기본 명령에는 세션 재개 없음.** 사용 중인 OpenCode 빌드가 resume 플래그를 지원하면 `OPENCODE_COMMAND="opencode run --resume"`처럼 붙여줘 (어댑터는 prompt를 마지막 positional 인자로 넘김).
- **모델 선택.** OpenCode 빌드가 `--model` 플래그를 요구하면 `OPENCODE_COMMAND`에 그대로 추가.
- **상세 진행.** stdout/stderr에 나오는 이벤트가 키워드 매칭으로 잡혀 (파일 읽기, 웹 검색, 터미널). `SMART_PROGRESS_API_KEY`가 없으면 bridge가 raw 라벨로 fallback.
