# OpenClaw — 하니스 노트

<p align="center">
  <a href="../../README.ko.md">README</a> ·
  <a href="HARNESSES.ko.md">하니스</a> ·
  <a href="USAGE.ko.md">사용법</a> ·
  <a href="CONFIGURATION.ko.md">설정</a>
</p>

OpenClaw는 오픈소스 터미널 코딩 에이전트. VerbalCoding은 `openclaw run`으로 호출해.

## 설치

상위 OpenClaw 설치 가이드를 따르고 확인:

```bash
openclaw run "hello"
```

## VerbalCoding 설정

```bash
# .env
AGENT_BACKEND=openclaw
# 선택
OPENCLAW_COMMAND="openclaw run"             # 기본값
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## OpenClaw로 전환하는 음성 표현

- en: `"switch to OpenClaw"`, `"ask OpenClaw ..."`, `"switch to open claw"`
- ko: `"openclaw로 전환"`

매처가 받는 별칭: `openclaw`, `open claw`.

## 함정

- **기본 명령에는 세션 재개 없음.** 빌드가 resume 플래그를 지원하면 `OPENCLAW_COMMAND`에 추가.
- **상세 진행.** OpenCode와 동일 — `SMART_PROGRESS_API_KEY`가 없으면 키워드 기반 라벨로 fallback.
- **이름 혼동.** 파서 별칭 `openclaw`와 사용자용 라벨 `OpenClaw`는 `claude` / `claude code`와 명확히 구분돼. strict 모드 라우터가 둘을 혼동하지 않아.
