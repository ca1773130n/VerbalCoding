# VerbalCoding 사용 가이드


## 최신 setup 흐름

```bash
npm install -g verbalcoding@latest
vc setup --yes
vc setup token
vc setup channels "General,Team Voice"
vc doctor
vc start
```

수동 `.env` 편집 대신 `vc setup token`으로 `DISCORD_BOT_TOKEN`/`DISCORD_CLIENT_ID`를 저장하고, `vc setup channels`로 `AUTO_JOIN_VOICE_CHANNELS`를 저장하세요. Docker에서 `Cannot perform IP discovery - socket closed`가 보이면 Linux Compose 서비스에 `network_mode: "host"`를 사용하고 `ports:`를 제거하세요.

이 페이지에는 README를 너무 길게 만들던 운영 세부 정보가 담겨 있습니다.

## CLI 명령

```bash
vc status                    # STT 언어, 진행 언어, TTS 음성 표시
vc language en               # 영어 STT + 영어 진행/TTS 음성
vc language ko               # 한국어 STT + 한국어 진행/TTS 음성
vc language auto             # Whisper 자동 감지 STT + 영어 진행/TTS 음성
vc restart auto status       # 커밋 시점 음성 봇 자동 재시작 설정 표시
vc restart auto on           # 커밋 시점 음성 봇 자동 재시작 활성화
vc restart auto off          # 비활성화; 기본값
vc bot invite CLIENT_ID      # 필요한 권한이 포함된 Discord 초대 URL 출력
vc instance status           # 인스턴스별 브리지 설정 및 프로세스 상태 나열
vc instance setup NAME       # instances/NAME.env 작성 및 ~/.hermes/profiles/NAME 생성
vc instance start NAME       # ./run.sh instances/NAME.env를 분리 실행으로 시작
vc instance stop NAME        # 분리 실행 중인 인스턴스를 중지하고 pid 파일 제거
vc doctor                    # 민감 정보가 제거된 doctor 점검 실행
npm run mcp                  # stdio MCP 서버 실행
```

언어 변경은 `.env`를 업데이트합니다. 적용하려면 `./run.sh` 또는 사용 중인 프로세스 관리자로 브리지를 다시 시작하세요.

## 실행 모드

단일 인스턴스 브리지:

```bash
./run.sh
```

로컬 override env를 사용하는 인스턴스별 브리지:

```bash
./run.sh instances/my-project.env
# 또는
VERBALCODING_INSTANCE_ENV=instances/my-project.env ./run.sh
```

봇은 설정된 첫 번째 채널 이름에 자동 참가하며 기본값은 `일반,General,general`입니다.

## Discord 명령

명령을 연결하기 전에 업스트림 가이드를 사용해 Discord 애플리케이션/봇을 설정하세요:

- Hermes Agent Discord 가이드: <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Discord 공식 봇 문서: <https://docs.discord.com/developers/bots/overview>

그런 다음 `vc bot invite CLIENT_ID`로 텍스트 및 음성 권한이 포함된 VerbalCoding 전용 초대 URL을 생성하세요.

| 명령 | 목적 |
|---|---|
| `!ping` | 기본 봇 점검 |
| `!join` / `!leave` | 음성 채널 참가 또는 나가기 |
| `!say <text>` | TTS로 텍스트를 직접 말하기 |
| `!voice-test <text>` | 활성 TTS 백엔드/음성 테스트 |
| `!voice-clone capture` | 다음 유효 발화를 OpenVoice 참조 샘플로 저장 |
| `!voice-clone status` / `!voice-clone cancel` | 캡처 상태 확인 또는 취소 |
| `!ask <prompt>` | 음성과 동일하게 선택된 하네스 어댑터로 텍스트 전송 |
| `!session status` | 현재 프로젝트/기본 어댑터 세션 표시 |
| `!session new <name> <workdir> [context] --voice <voice-channel>` | 프로젝트 범위 Hermes 세션 생성 |
| `!session attach-voice [sessionName] --voice <voice-channel>` | 텍스트 채널/스레드를 음성 채널에 연결 |
| `!session list` | 설정된 프로젝트 세션 나열 |
| `!session reset` / `!reset-session` | 현재 프로젝트/기본 어댑터 세션 파일 지우기 |
| `!verbose on/off` | 자세한 진행 업데이트 전환 |
| `!latency` / `!metrics` | 최근 지연 시간 요약 표시 |
| `!sensitivity normal/conservative` | 끼어들기 감도 전환 |

“외부 모드”, “보수 모드”, “실내”, “기본 감도” 같은 음성 표현과 “잠깐”, “멈춰”, “그만” 같은 명확한 중지 문구는 브리지가 처리합니다. “상세 진행 켜” / “상세 진행 꺼”라고 말해 음성으로 자세한 진행을 전환할 수도 있습니다.

## 음성 변경

`vc language ko|en|auto`는 STT 언어, 진행 언어, 해당 기본 TTS 음성을 함께 변경합니다. 브리지가 실행 중일 때 화자/음성만 바꾸고 싶다면 Discord 음성으로 말하세요:

```text
남자 한국어 목소리로 바꿔
여자 한국어 목소리로 바꿔
change voice to Korean female
switch speaker to English
```

실행 중인 브리지는 이를 음성 제어 명령으로 인식하고 `config/tts-voices.json`을 업데이트하며, 실행 중 프로세스의 유효 TTS env를 업데이트하고 “목소리를 Korean male로 바꿨어.” 같은 짧은 확인으로 응답합니다. 변경 직후 `!voice-test <text>`로 현재 백엔드와 음성을 들어보세요.

내장 Edge 음성 유형:

| 음성 유형 | Edge 음성 |
|---|---|
| `korean_male` | `ko-KR-InJoonNeural` |
| `korean_female` | `ko-KR-SunHiNeural` |
| `korean_multilingual_male` | `ko-KR-HyunsuMultilingualNeural` |
| `english_male` | `en-US-GuyNeural` |
| `english_female` | `en-US-AriaNeural` |

수동 영구 설정은 `.env`에서 `TTS_BACKEND=edge`, `TTS_VOICE_TYPE=<voice-type>`, 선택적으로 `TTS_VOICE=<edge-voice>`를 설정하거나, 커스텀 음성 카탈로그를 위해 `config/tts-voices.json`을 편집하세요.

백엔드별 음성 조정값:

| 백엔드 | 음성 설정 | 일반 선택지 |
|---|---|---|
| Edge | `TTS_VOICE_TYPE`, `TTS_VOICE` | `korean_male`, `korean_female`, `korean_multilingual_male`, `english_male`, `english_female`; `edge-tts --list-voices`의 모든 Edge 음성 |
| Supertonic | `SUPERTONIC_VOICE` | `M1`–`M5`, `F1`–`F5`; `SUPERTONIC_LANGUAGE=ko|en|es|pt|fr` 설정 |
| OpenVoice | `OPENVOICE_REF_AUDIO`, `OPENVOICE_STYLE` | 허용된 참조 WAV와 `default` 같은 스타일 |
| SpeechSwift / CosyVoice | `SPEECHSWIFT_REF_AUDIO`, `SPEECHSWIFT_ENGINE`, `SPEECHSWIFT_SPEAKER` | CosyVoice용 참조 WAV 또는 백엔드가 지원하는 화자/모델 값 |

Supertonic 및 로컬 복제 백엔드에서는 위 백엔드 env 변수와 `!voice-test <text>`를 사용해 변경 사항을 청음하세요. 음성 명령 전환은 현재 내장 Edge 스타일 음성 유형에 매핑됩니다. 더 풍부한 백엔드 카탈로그는 `config/tts-voices.json`에 추가할 수 있습니다.

## 긴 받아쓰기와 멈춤

VerbalCoding은 음성을 STT로 보내기 전에 유휴 구간을 기다립니다. 기본 `UTTERANCE_IDLE_MS=4500`은 일부러 약간 여유 있게 잡혀 있어, 긴 지시 중 자연스러운 멈춤 때문에 문장이 나뉘거나 에이전트 턴이 너무 일찍 시작되고 나머지가 처리 중 끼어들기로 취급되는 일을 방지합니다.

짧은 명령을 더 빠르게 처리하고 싶다면 `.env`에서 낮추세요. 긴 한국어 받아쓰기가 여전히 나뉜다면 높이세요:

```bash
UTTERANCE_IDLE_MS="6000"
```

## 자세한 진행 모드

`AGENT_VERBOSE_PROGRESS=1`이 설정되지 않은 한 자세한 진행은 기본적으로 꺼져 있습니다. `!verbose on` 또는 “상세 진행 켜” 같은 음성 명령으로 활성화하세요. 다음과 같은 짧은 진행 줄을 내보낼 수 있습니다:

```text
🤖 Hermes Agent 호출 시작
📖 파일 읽기 app-node/main.mjs
🔎 웹 검색 실행
⌨️ 터미널 명령 실행
🤖 Hermes Agent 응답 수신
```

이 모드는 선택된 CLI 하네스에 `VERBALCODING_PROGRESS: ...` 줄을 내보내도록 요청하고, 가능한 경우 스트리밍 stdout/stderr에서 일반적인 도구 표시자를 요약합니다. 비밀처럼 보이는 필드는 가려지고 진행 줄은 최종 음성 답변에서 제거됩니다.

## 지연 시간 지표

VerbalCoding은 턴별 지연 시간 기록을 JSONL로 작성합니다. 기본 경로:

```text
./.logs/latency.jsonl
```

각 기록에는 상태, 총 시간, 음성 캡처 시간, 발화 유휴 대기, STT 시간, 에이전트 시간, TTS 합성/재생 시간, 청크 수, 전사 길이, 답변 길이, 가능한 경우 오디오 레벨이 포함됩니다.

Discord에서:

```text
!latency
!metrics
```

요약은 최신 200개 기록을 사용합니다: 개수, 평균, p95, 최대값, OK가 아닌 상태.

## 테스트

```bash
node --check app-node/main.mjs
npm test
bash -n run.sh scripts/install.sh
vc doctor
```

`vc doctor`는 의도적으로 비밀 정보를 가리고 필수 값이 설정되었는지만 보고합니다. 또한 중복 토큰 지문과 충돌하는 런타임 경로가 있는지 `instances/*.env`를 확인합니다.
