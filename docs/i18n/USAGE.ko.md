# VerbalCoding 사용 가이드

이 문서는 README에 다 넣기에는 긴 실제 운영 방법을 모아 둔 사용 설명서입니다.

## CLI 명령

```bash
vc setup --yes                # npm 설치 후 의존성 부트스트랩과 설정 마법사 실행
vc start                      # 기본 Discord 음성 브릿지 시작
vc status                     # STT 언어, 진행 언어, TTS 음성 상태 보기
vc language en                # 영어 STT + 영어 진행/TTS 음성
vc language ko                # 한국어 STT + 한국어 진행/TTS 음성
vc language auto              # Whisper 자동 언어 감지 + 진행/TTS 음성 프리셋
vc restart auto status        # 커밋 시 음성 봇 자동 재시작 설정 보기
vc restart auto on            # 커밋 시 음성 봇 자동 재시작 켜기
vc restart auto off           # 자동 재시작 끄기; 기본값
vc bot invite CLIENT_ID       # 필요한 권한이 포함된 Discord 초대 URL 출력
vc instance status            # 인스턴스별 설정과 프로세스 상태 목록 보기
vc instance setup NAME        # instances/NAME.env 작성 및 Hermes 프로필 생성
vc instance start NAME        # ./run.sh instances/NAME.env를 백그라운드로 시작
vc instance stop NAME         # 백그라운드 인스턴스 중지 및 pid 파일 제거
vc doctor                     # 비밀값을 숨긴 상태 점검 실행
npm run mcp                   # stdio MCP 서버 실행
```

언어 변경은 `.env`를 수정합니다. 적용하려면 `vc start`, `./run.sh`, 또는 사용 중인 프로세스 매니저로 브릿지를 재시작하세요.

## 실행 모드

npm으로 설치한 기본 브릿지:

```bash
vc start
```

GitHub 클론에서 직접 실행:

```bash
./run.sh
```

프로젝트별 인스턴스 env로 실행:

```bash
./run.sh instances/my-project.env
# 또는
VERBALCODING_INSTANCE_ENV=instances/my-project.env ./run.sh
```

봇은 설정된 음성 채널 이름 중 첫 번째로 자동 입장합니다. 기본값은 `일반,General,general`입니다.

## Discord 명령

| 명령 | 용도 |
|---|---|
| `!ping` | 봇 연결 기본 확인 |
| `!join` / `!leave` | 음성 채널 입장/퇴장 |
| `!say <text>` | 텍스트를 바로 TTS로 읽기 |
| `!voice-test <text>` | 현재 TTS 백엔드 테스트 |
| `!voice-clone capture` | 다음 유효 발화를 OpenVoice 기준 샘플로 저장 |
| `!voice-clone status` / `!voice-clone cancel` | 샘플 캡처 상태 확인/취소 |
| `!ask <prompt>` | 음성과 같은 선택된 CLI 어댑터로 텍스트 요청 보내기 |
| `!session status` | 현재 프로젝트/default 에이전트 세션 보기 |
| `!session new <name> <workdir> [context] --voice <voice-channel>` | 프로젝트 단위 Hermes 세션 생성 |
| `!session attach-voice [sessionName] --voice <voice-channel>` | 현재 텍스트 채널/스레드를 음성 채널에 연결 |
| `!session list` | 설정된 프로젝트 세션 목록 보기 |
| `!session reset` / `!reset-session` | 현재 프로젝트/default 세션 파일 초기화 |
| `!verbose on/off` | 자세한 진행 업데이트 켜기/끄기 |
| `!latency` / `!metrics` | 최근 지연 시간 요약 보기 |
| `!sensitivity normal/conservative` | 끼어들기 감도 전환 |

음성으로도 “외부 모드”, “보수 모드”, “실내”, “기본 감도” 같은 감도 전환과 “잠깐”, “멈춰”, “그만” 같은 명확한 중단 표현을 처리합니다. “상세 진행 켜” / “상세 진행 꺼”처럼 말해서 verbose progress도 바꿀 수 있습니다.

## 자세한 진행 모드

자세한 진행은 기본적으로 꺼져 있습니다. `.env`에 `AGENT_VERBOSE_PROGRESS=1`을 설정하거나 Discord에서 `!verbose on`, 또는 음성으로 “상세 진행 켜”라고 말해 켤 수 있습니다.

켜져 있으면 긴 작업 중 이런 짧은 진행 줄을 텍스트로 보냅니다.

```text
🤖 에이전트 호출 시작
📖 파일 읽기 app-node/main.mjs
🔎 웹 검색 실행
⌨️ 터미널 명령 실행
🤖 에이전트 응답 수신
```

이 모드는 선택된 CLI 하네스에 `VERBALCODING_PROGRESS: ...` 줄을 내보내도록 요청하고, 가능하면 stdout/stderr의 일반적인 도구 사용 흔적도 요약합니다. 비밀값처럼 보이는 필드는 숨기고, 진행 줄은 최종 음성 답변에서 제거합니다.

## 지연 시간 지표

VerbalCoding은 각 턴의 지연 시간 기록을 JSONL로 저장합니다. 기본 경로:

```text
./.logs/latency.jsonl
```

각 기록에는 상태, 전체 시간, 음성 캡처 시간, 발화 idle 대기, STT 시간, 에이전트 시간, TTS 합성/재생 시간, 청크 수, 발화 길이, 답변 길이, 가능한 경우 오디오 레벨이 포함됩니다.

Discord에서:

```text
!latency
!metrics
```

요약은 최근 200개 기록 기준으로 count, average, p95, max, non-OK 상태를 보여줍니다.

## 테스트

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh
npm pack --dry-run
vc doctor
```

`vc doctor`는 비밀값을 출력하지 않고 필수 값이 설정됐는지만 확인합니다. 또한 `instances/*.env`에서 중복 토큰 지문과 충돌하는 런타임 경로를 검사합니다.
