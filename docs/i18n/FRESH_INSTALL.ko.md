# 새로 설치하기

이 가이드는 깨끗한 공개 설치를 위한 문서입니다. 로컬 환경에만 맞춘 가정을 피하고, 설치 프로그램으로 가능한 한 많은 부분을 부트스트랩합니다.

## 1. CLI 설치

권장 npm 경로:

```bash
npm install -g verbalcoding
```

또는 게시된 패키지를 바로 실행합니다:

```bash
npx verbalcoding setup --yes
```

`npm install -g`를 사용했다면 다음을 계속 실행하세요:

```bash
vc setup --yes
```

기여자를 위한 GitHub 클론 경로:

```bash
git clone https://github.com/ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh --yes
```

## 2. 의존성 부트스트랩 및 설정 마법사 실행

위 npm 명령은 클론 설치와 동일한 부트스트래퍼를 실행합니다. 클론에서는 다음을 실행하세요:

```bash
./scripts/install.sh --yes
```

수행되는 작업:

- `node_modules/`가 없으면 npm 의존성을 설치합니다.
- `npm link`로 짧은 `vc` 셸 명령을 설치합니다.
- OS 패키지 관리자가 지원하는 경우 `ffmpeg`, Node/npm, `whisper-cli`를 설치합니다.
- `models/ggml-small-q5_1.bin`을 다운로드합니다.
- `edge-tts`가 `PATH`에 없으면 `.venv-tts`를 만들고 `edge-tts`를 설치합니다.
- 대화형 `.env` 마법사를 실행합니다.

지원되는 시스템 부트스트랩 경로:

| OS | 시스템 의존성 경로 |
|---|---|
| macOS | 필요 시 Homebrew: `brew install node ffmpeg whisper-cpp` |
| Debian/Ubuntu | Node/npm, ffmpeg, Python, 빌드 도구는 `apt-get`; 로컬 whisper.cpp 빌드 폴백 |
| Fedora/RHEL | Node/npm, ffmpeg, Python, 빌드 도구는 `dnf`; 로컬 whisper.cpp 빌드 폴백 |
| Arch | Node/npm, ffmpeg, Python, 빌드 도구는 `pacman`; 로컬 whisper.cpp 빌드 폴백 |

유용한 설치 변형:

```bash
vc setup --yes --no-wizard                   # npm 설치에서 의존성/부트스트랩만 실행
./scripts/install.sh --yes --no-wizard       # 클론에서 의존성/부트스트랩만 실행
./scripts/install.sh --skip-system           # OS 패키지를 설치하지 않음
./scripts/install.sh --skip-model            # 기본 STT 모델을 다운로드하지 않음
./scripts/install.sh --skip-edge-tts         # .venv-tts를 만들지 않음
VERBALCODING_SKIP_CLI_LINK=1 ./scripts/install.sh --yes
```

OS가 지원되지 않으면 다시 실행하기 전에 다음을 수동으로 설치하세요:

- Node.js 20+ 및 npm
- ffmpeg
- venv/pip가 포함된 Python 3
- whisper.cpp `whisper-cli`
- 인증된 CLI 에이전트 백엔드 하나 이상, 기본값은 Hermes Agent

## 3. Discord 애플리케이션 설정

처음 봇을 만드는 경우 먼저 업스트림 Discord 봇 설정 가이드를 읽으세요:

- Hermes Agent Discord 메시징 가이드: <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Discord 공식 봇 개요: <https://docs.discord.com/developers/bots/overview>
- Discord 공식 시작 가이드: <https://docs.discord.com/developers/quick-start/getting-started>

이 페이지들은 Discord 애플리케이션 생성, 봇 사용자 추가, privileged intents 활성화, 서버 초대 방법을 보여줍니다. VerbalCoding은 동일한 Discord 봇 설정을 사용한 뒤 그 위에 음성 수신, STT, CLI 에이전트 실행, TTS 재생을 추가합니다.

1. Discord Developer Portal에서 Discord 애플리케이션과 봇을 만듭니다.
2. Message Content privileged intent를 활성화합니다.
3. 봇 토큰을 설치 프로그램 프롬프트 또는 `.env`의 `DISCORD_BOT_TOKEN`에 복사합니다.
4. 초대 URL을 생성합니다:

```bash
vc bot invite <discord-client-id>
# 또는 하나의 서버에 고정:
vc bot invite <discord-client-id> --guild <guild-id>
```

초대에는 VerbalCoding이 사용하는 텍스트/음성 권한과 bot 및 slash-command scope가 포함됩니다.

## 4. 확인

```bash
vc doctor
```

`vc doctor`는 민감 정보를 가립니다. 비밀 값을 출력하지 않고 누락된 토큰/명령/모델을 보고합니다. 모든 `✗` 항목을 고친 뒤 다시 실행하세요.

예상 성공 출력에는 다음이 포함됩니다:

```text
✓ Node.js
✓ npm
✓ ffmpeg
✓ whisper-cli
✓ whisper.cpp model
✓ Discord bot token configured — [REDACTED]
✓ edge-tts
✓ hermes CLI
Doctor passed. Run vc start to start VerbalCoding.
```

설치 프로그램이 로컬 Edge TTS 헬퍼를 만들었다면 `.env`에는 `.venv-tts/bin/edge-tts`를 가리키는 `EDGE_TTS_COMMAND` 경로가 있어야 합니다.

## 5. 단일 기본 봇 실행

```bash
vc start
# 또는 GitHub 클론에서:
./run.sh
```

성공적인 시작 로그에는 다음이 포함됩니다:

```text
Logged in as <bot-name>
Listening in voice channel <server> / <channel>
```

Discord에서:

```text
!ping
!join
!ask say hello briefly
!verbose on
```

그런 다음 설정된 음성 채널에서 말하세요. STT 텍스트, 자세한 모드가 켜졌을 때의 진행 텍스트, 최종 텍스트 답변을 볼 수 있고 TTS 재생도 들을 수 있어야 합니다.

## 6. 프로젝트별 방 설정

프로젝트 음성 방마다 하나의 영구 봇을 두려면 프로젝트마다 Discord 애플리케이션을 하나씩 만들고 다음을 실행하세요:

```bash
vc instance setup my-project
vc bot invite <that-project-client-id>
vc instance start my-project
vc instance status my-project
```

각 인스턴스는 자체 토큰, 음성 채널, 전사 대상, 로그 경로, Hermes 세션 파일, 선택적 Hermes 프로필을 가진 무시되는 `instances/<name>.env`를 작성합니다.

## 7. 선택 사항: OpenVoice 설정

OpenVoice 음성 복제는 선택 사항입니다. 깨끗한 공개 설치에서는 `TTS_BACKEND=edge`를 유지하세요. 나중에 OpenVoice를 활성화하려면:

```bash
./scripts/setup_openvoice.sh
# OpenVoice V2 checkpoints를 vendor/OpenVoice/checkpoints_v2/에 다운로드합니다.
# 허용된 로컬 샘플을 voice-samples/user-reference.wav에 추가하거나,
# 봇을 실행하고 "목소리 샘플 녹음 시작해"라고 말한 뒤 10-30초 동안 말합니다.
python3 integrations/openvoice/synth.py --openvoice-dir vendor/OpenVoice --ref-audio voice-samples/user-reference.wav --text '안녕하세요. 버벌코딩 목소리 복제 테스트입니다.' --output /tmp/verbalcoding-openvoice-smoke.wav
```

그런 다음 `TTS_BACKEND=openvoice`를 설정하고 `vc doctor`를 실행한 뒤 Discord에서 `!voice-test <text>`를 테스트하세요.

## 8. 유지관리자를 위한 깨끗한 클론 스모크 테스트

빠른 호스트 전용 스모크 테스트:

```bash
TMPDIR=$(mktemp -d)
git clone https://github.com/ca1773130n/VerbalCoding.git "$TMPDIR/VerbalCoding"
cd "$TMPDIR/VerbalCoding"
./scripts/install.sh --yes --no-wizard
npm pack --dry-run
cp .env.example .env
chmod 600 .env
vc doctor || true
```

이 시점의 예상 실패는 로컬 비밀 정보 누락 또는 인증되지 않은 에이전트 CLI이며, 토큰 유출이나 설치 스크립트 누락이 아니어야 합니다.

Docker 기반 Ubuntu 깨끗한 설치 스모크 테스트:

```bash
./scripts/docker_ubuntu_smoke.sh
```

이 스크립트는 `ubuntu:24.04`를 실행하고, 추적 중인 저장소 트리를 깨끗한 컨테이너로 복사하고, `./scripts/install.sh --yes --no-wizard`를 실행하고, 비밀이 아닌 스모크 `.env`를 작성하고, `vc`를 확인하고, Node 테스트를 실행하고, `vc doctor`를 검증합니다. Discord 음성에는 연결하지 않습니다. 이후 엔드투엔드 음성 채널 테스트가 필요하면 실제 Ubuntu VM 또는 WSL2를 사용하세요.
