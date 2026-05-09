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

명령을 연결하기 전에 먼저 상위 문서대로 Discord 애플리케이션/봇을 설정하세요.

- Hermes Agent Discord 가이드: <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Discord 공식 봇 문서: <https://docs.discord.com/developers/bots/overview>

그 다음 `vc bot invite CLIENT_ID`를 사용하면 VerbalCoding에 필요한 텍스트/음성 권한이 포함된 초대 URL을 만들 수 있습니다.

| 명령 | 용도 |
|---|---|
| `!ping` | 봇 연결 기본 확인 |
| `!join` / `!leave` | 음성 채널 입장/퇴장 |
| `!say <text>` | 텍스트를 바로 TTS로 읽기 |
| `!voice-test <text>` | 현재 TTS 백엔드/목소리 테스트 |
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

## 목소리 변경

`vc language ko|en|auto`는 STT 언어, 진행 언어, 기본 TTS 목소리를 함께 바꿉니다. 언어 전체가 아니라 말하는 사람/목소리만 바꾸고 싶다면 Discord 음성에서 이렇게 말하면 됩니다.

```text
남자 한국어 목소리로 바꿔
여자 한국어 목소리로 바꿔
change voice to Korean female
switch speaker to English
```

실행 중인 브릿지는 이 발화를 제어 명령으로 인식해 `config/tts-voices.json`을 갱신하고, 현재 프로세스의 TTS 설정도 바로 바꾼 뒤 “목소리를 Korean male로 바꿨어.” 같은 짧은 확인을 말합니다. 바꾼 직후에는 `!voice-test <text>`로 현재 백엔드와 목소리를 바로 들어볼 수 있습니다.

기본 Edge 목소리 타입:

| 목소리 타입 | Edge voice |
|---|---|
| `korean_male` | `ko-KR-InJoonNeural` |
| `korean_female` | `ko-KR-SunHiNeural` |
| `korean_multilingual_male` | `ko-KR-HyunsuMultilingualNeural` |
| `english_male` | `en-US-GuyNeural` |
| `english_female` | `en-US-AriaNeural` |

영구 수동 설정이 필요하면 `.env`에 `TTS_BACKEND=edge`, `TTS_VOICE_TYPE=<voice-type>`, 필요 시 `TTS_VOICE=<edge-voice>`를 설정하세요. 더 많은 커스텀 목소리 카탈로그는 `config/tts-voices.json`에서 관리할 수 있습니다.

백엔드별 목소리 설정:

| 백엔드 | 목소리 설정 | 자주 쓰는 선택지 |
|---|---|---|
| Edge | `TTS_VOICE_TYPE`, `TTS_VOICE` | `korean_male`, `korean_female`, `korean_multilingual_male`, `english_male`, `english_female`; `edge-tts --list-voices`의 모든 Edge voice |
| Supertonic | `SUPERTONIC_VOICE` | `M1`–`M5`, `F1`–`F5`; `SUPERTONIC_LANGUAGE=ko|en|es|pt|fr` |
| OpenVoice | `OPENVOICE_REF_AUDIO`, `OPENVOICE_STYLE` | 사용 허가가 있는 reference WAV와 `default` 같은 style |
| SpeechSwift / CosyVoice | `SPEECHSWIFT_REF_AUDIO`, `SPEECHSWIFT_ENGINE`, `SPEECHSWIFT_SPEAKER` | CosyVoice reference WAV 또는 백엔드가 지원하는 speaker/model 값 |

Supertonic과 로컬 clone 백엔드는 위 env를 바꾼 뒤 `!voice-test <text>`로 바로 들어보세요. 현재 음성 명령 기반 전환은 기본 Edge-style voice type에 매핑되어 있고, 더 풍부한 백엔드 카탈로그는 `config/tts-voices.json`에 추가할 수 있습니다.

## 긴 발화와 중간 멈춤

VerbalCoding은 말을 STT로 보내기 전에 idle window를 기다립니다. 기본값 `UTTERANCE_IDLE_MS=4500`은 일부러 조금 여유 있게 잡혀 있습니다. 긴 지시 중 자연스러운 멈춤을 문장 끝으로 오해해 앞부분만 에이전트에 보내고, 뒷부분을 processing 중 끼어들기로 처리하는 문제를 줄이기 위해서입니다.

짧은 명령 반응을 더 빠르게 하고 싶다면 `.env`에서 낮추고, 긴 한국어 dictation이 여전히 잘리면 더 올리세요.

```bash
UTTERANCE_IDLE_MS="6000"
```

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
