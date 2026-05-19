# Gemini CLI — 하니스 노트

<p align="center">
  <a href="../../README.ko.md">README</a> ·
  <a href="HARNESSES.ko.md">하니스</a> ·
  <a href="USAGE.ko.md">사용법</a> ·
  <a href="CONFIGURATION.ko.md">설정</a>
</p>

Gemini CLI는 구글의 터미널 코딩 에이전트. VerbalCoding은 `gemini -p`로 호출해. voice turn 하나가 invocation 한 번이고, 호출 간 세션 재개는 없어.

## 설치

상위 Gemini CLI 설치 가이드를 따라줘. 확인:

```bash
gemini -p "hello"
```

## VerbalCoding 설정

```bash
# .env
AGENT_BACKEND=gemini
# 선택
GEMINI_COMMAND="gemini -p"                  # 기본값. 필요하면 --model, --debug 추가
AGENT_PROJECT_CONTEXT="..."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
```

## Gemini로 전환하는 음성 표현

- en: `"switch to Gemini"`, `"ask Gemini ..."`, `"switch to Gemini CLI"`
- ko: `"제미나이로 전환"`, `"gemini한테 물어봐"`

매처가 받는 별칭: `gemini`, `gemini cli`, `gemini-cli`, `제미나이`.

## 함정

- **세션 재개 없음.** Claude / Codex와 같은 연속성 전략: `AGENT_PROJECT_CONTEXT` + 크로스 에이전트 핸드오프 블록 의존.
- **긴 응답.** Gemini는 가끔 큰 구조화 응답을 반환하는데, 스트림 sentencer가 TTS 가능한 문장으로 잘라줘. 코드 펜스는 음성에서 제외 (텍스트 채널에는 코드 포함 전체 답변).
- **API 키.** Gemini가 인증 오류로 non-zero exit하면 bridge가 메시지를 보고. 기본 에이전트가 아닐 때 크로스 에이전트 fallback 프롬프트가 기본 에이전트로 재시도 제안.
- **상세 진행.** Gemini stdout은 Hermes의 `┊` 스타일 미리보기 포맷이 아니라서 상세 진행은 주로 smart-progress LLM 요약기에 의존해.
