# 저장소 가이드라인 (한국어)

> 이 파일은 [`AGENTS.md`](../../AGENTS.md)의 한국어 요약입니다. 정식 규칙은 원본 영어 문서를 따라주세요.

VerbalCoding은 코딩 에이전트용 Discord 음성 브릿지입니다. 실제 런타임은 `app-node/` 하위 Node 구현체이고, `run.sh` 또는 `vc` CLI로 실행합니다.

## 개발

- 문서·예제에서는 `npm run vc -- ...` 보다 `vc ...` 형태를 우선 사용합니다.
- 로컬 비밀은 `.env` 또는 `instances/*.env`에만 두고 절대 커밋하지 마세요. 실제 Discord 토큰, 채널 ID, 세션 파일, 음성 샘플, 모델 가중치, 가상환경, 로그, 캐시 출력도 마찬가지입니다.
- 생성물/런타임 산출물 대신 소스 파일을 수정합니다.
- 예제는 공개 안전한 값으로 유지합니다. 로컬 경로, 사용자 ID, Discord ID, 토큰은 플레이스홀더로.

## 검증

코드 변경을 완료로 보고하기 전에 Node 테스트 스위트를 실행하세요:

```bash
npm test
```

## 모듈 맵

자세한 내용은 [`AGENTS.md`](../../AGENTS.md)를 참고하세요. 핵심 모듈:

- `main.mjs` — Discord/음성/에이전트 디스패처
- `agent_routing.mjs` — 음성 기반 크로스 에이전트 라우팅
- `plan_mode.mjs` — 음성 플랜 모드 (which_agent 슬롯)
- `session_ontology.mjs` — 채널별 타입드 그래프 (cross-agent 핸드오프 컨텍스트)
- `research_mode.mjs` — `"리서치 X"` 음성 명령 파이프라인

## 관리되는 영역

HarnessSync가 `AGENTS.md`에 `CLAUDE.md`의 규칙을 자동 동기화합니다. 그 블록은 손대지 마세요.
