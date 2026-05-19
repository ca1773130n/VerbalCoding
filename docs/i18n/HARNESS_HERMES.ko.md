# Hermes Agent — 하니스 노트

<p align="center">
  <a href="../../README.ko.md">README</a> ·
  <a href="HARNESSES.ko.md">하니스</a> ·
  <a href="USAGE.ko.md">사용법</a> ·
  <a href="CONFIGURATION.ko.md">설정</a>
</p>

Hermes Agent는 VerbalCoding의 기본 백엔드이고, 진짜 세션 재개 계약이 있는 유일한 하니스야. 턴 사이 컨텍스트가 깔끔하게 유지돼. Hermes 내장 `/voice` 슬래시 명령과의 포지셔닝 비교는 [HERMES_VOICE.ko.md](./HERMES_VOICE.ko.md).

## 설치

상위 Hermes Agent 설치 가이드: <https://hermes-agent.nousresearch.com>.

CLI 단독 동작부터 확인해줘:

```bash
hermes chat -Q -q "hello"
```

## VerbalCoding 설정

```bash
# .env
AGENT_BACKEND=hermes
# 선택
HERMES_COMMAND="hermes chat -Q -q"           # 기본값
HERMES_HOME=/Users/you/.hermes               # 인스턴스별 Hermes 홈
HERMES_PROJECT_CONTEXT="Project session: ..."
HERMES_TASK_TIMEOUT_MS=0                     # 0 = 무제한
HERMES_CHAT_TIMEOUT_MS=45000
HERMES_WORKDIR=/Users/you/code/your-project
```

세션 파일 기본 위치는 `<repo>/.verbalcoding-session` (덮어쓰려면 `HERMES_SESSION_FILE`).

## 세션 재개

Hermes는 내장 어댑터 중 유일하게 세션 재개를 지원해. 턴이 성공할 때마다 새 `session_id`를 디스크에 쓰고 다음 호출에 `--resume <id>`를 앞에 붙여. `!session reset`(또는 `!reset-session`)으로 그 파일을 지울 수 있어.

Hermes가 stderr에 `session_id:`를 emit하기 전에 턴이 abort되면, 어댑터가 `~/.hermes/sessions/session_<id>.json`을 직접 읽어서 마지막 어시스턴트 메시지를 복구해.

## 상세 진행

상세 모드에서는 어댑터가 Hermes의 `-Q` quiet 플래그를 떼서 stdout으로 `┊ <emoji> <tool>` 미리보기가 흘러나와. 이걸 한 줄짜리 진행 이벤트(파일 읽기, 웹 검색, 터미널 실행 등)로 요약해. 상세 모드가 꺼져 있으면 박스 안의 최종 답변만 음성으로 나가.

## Hermes로 전환하는 음성 표현

- en: `"switch to Hermes"`, `"ask Hermes ..."`
- ko: `"헤르메스로 전환"`, `"헤르메스한테 물어봐"`

## 함정

- 크로스 에이전트 핸드오프 시 TTS 접두사는 로케일에 맞춰서 `"Hermes says: "` / `"헤르메스: "`로 붙어.
- `HERMES_HOME`은 프로젝트별 격리에 가장 많이 쓰이는 노브야. 인스턴스 `.env`는 보통 `HERMES_HOME=/Users/you/.hermes/profiles/<project>` 식으로 설정.
- 상세 모드 켜고도 Hermes가 빈 박스로 끝나는 경우(타임아웃 등), 어댑터가 포기하기 전에 세션 JSON을 긁어서 최종 답변을 찾아내.
