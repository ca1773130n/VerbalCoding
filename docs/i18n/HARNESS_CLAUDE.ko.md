# Claude Code — 하니스 노트

<p align="center">
  <a href="../../README.ko.md">README</a> ·
  <a href="HARNESSES.ko.md">하니스</a> ·
  <a href="USAGE.ko.md">사용법</a> ·
  <a href="CONFIGURATION.ko.md">설정</a>
</p>

Claude Code는 Anthropic의 공식 터미널 코딩 에이전트야. VerbalCoding은 `claude -p`로 호출하고, voice turn 하나가 invocation 한 번. `-p`는 호출 간 세션 재개 계약이 없어서 매번 fresh context — 연속성을 유지하려면 `AGENT_PROJECT_CONTEXT`와 크로스 에이전트 핸드오프 블록을 활용해.

## 설치

```bash
npm install -g @anthropic-ai/claude-code
claude login
claude -p "hello"     # 응답 오는지 확인
```

## VerbalCoding 설정

```bash
# .env
AGENT_BACKEND=claude              # 'claude-code' 별칭도 허용
# 선택
CLAUDE_COMMAND="claude -p"        # 기본값. --model, --debug 같은 플래그 추가 가능
AGENT_PROJECT_CONTEXT="auth 모듈 작업 중; 이전 결정: oauth=github."
AGENT_WORKDIR=/Users/you/code/your-project
AGENT_CHAT_TIMEOUT_MS=45000
AGENT_TASK_TIMEOUT_MS=0
AGENT_VERBOSE_PROGRESS=0
```

`AGENT_SESSION_FILE`은 기본 `<repo>/.agent-sessions/claude`이지만 이 하니스에서는 **사용되지 않아** — Claude Code의 `-p`는 stateless. 그대로 둬도 no-op.

## 매 턴 Claude가 받는 것

매 턴 어댑터는 디스코드 음성 대응 preamble(`VOICE_LANGUAGE`에 따라 영어 또는 한국어), 프로젝트 컨텍스트, 최근 디스코드 텍스트 컨텍스트, 마지막으로 STT 결과를 순서대로 prepend해. 크로스 에이전트 핸드오프인 경우(예: 이전 턴에 `"코덱스한테 물어봐"`였고 이번 턴이 첫 복귀) "최근 사용자 음성" 라인(최대 4개)과 가장 최근 해결된 플랜 결정도 같이 붙어서 Claude가 cold start하지 않아.

## 상세 진행

Claude Code는 `-p`에서 표준 progress stream을 emit하지 않아. `AGENT_VERBOSE_PROGRESS=1`을 켜면 어댑터가 stdout/stderr에서 tool/file/web 멘션을 키워드로 파싱하긴 하지만, Hermes보다 거친 진행 정보만 잡혀.

## Claude Code로 전환하는 음성 표현

- en: `"switch to Claude Code"`, `"ask Claude ..."`, `"let Claude finish this"`
- ko: `"클로드로 전환"`, `"claude한테 물어봐"`

매처는 `claude`와 `claude code` 둘 다 별칭으로 받아. 라우팅-온리 발화에서 쓰는 strict 모드는 정확히 일치해야 매치돼.

## 함정

- **세션 재개 없음.** 긴 페어 프로그래밍 세션은 크로스 에이전트 핸드오프 컨텍스트 블록에 의존해서 결정사항을 이어가야 해. 백엔드 전환 시 자동으로 들어가고, 같은 백엔드 안에서는 `AGENT_PROJECT_CONTEXT`에 짧은 요약을 넣어둬.
- **인용된 명령 경로.** `CLAUDE_COMMAND`에 공백이 든 절대 경로가 있으면(예: `"/Applications/Claude Code/claude" -p`) VerbalCoding의 설치 검사가 `shellSplit`을 써서 따옴표를 올바르게 처리해.
- **인증 갱신.** `claude login` 토큰 만료는 non-zero exit로 surfacing돼. bridge가 실패를 보고하고, 기본 백엔드가 아니면 fallback 프롬프트가 기본 에이전트로 재시도를 제안.
- **Patch 형식 출력.** Claude가 diff를 반환 중에 턴이 interrupt되면 bridge는 diff를 음성으로 읽지 않고 `"에이전트 작업이 중단됐어. 파일 변경과 테스트 상태는 텍스트 채널을 확인해줘"`라고만 말해.
