# VerbalCoding 새 설치 가이드

이 문서는 공개 npm 패키지 또는 깨끗한 GitHub 클론에서 처음 설치하는 흐름을 설명합니다. 로컬 전용 가정을 피하고, 설치 스크립트가 가능한 한 많은 준비 작업을 자동화하도록 구성돼 있습니다.

## 1. CLI 설치

권장 npm 설치:

```bash
npm install -g verbalcoding
```

전역 설치 없이 바로 실행하려면:

```bash
npx verbalcoding setup --yes
```

전역 설치를 했다면 이어서:

```bash
vc setup --yes
```

기여자용 GitHub 클론 경로:

```bash
git clone https://github.com/ca1773130n/VerbalCoding.git
cd VerbalCoding
./scripts/install.sh --yes
```

## 2. 의존성 부트스트랩과 설정 마법사

npm 명령은 클론 설치와 같은 부트스트래퍼를 실행합니다. 클론에서는 다음을 실행합니다.

```bash
./scripts/install.sh --yes
```

이 명령이 하는 일:

- `node_modules/`가 없으면 npm 의존성을 설치합니다.
- 클론 설치에서는 짧은 `vc` 셸 명령을 `npm link`로 연결합니다.
- OS 패키지 매니저가 지원되면 `ffmpeg`, Node/npm, `whisper-cli`를 설치합니다.
- 기본 모델 `models/ggml-small-q5_1.bin`을 다운로드합니다.
- `edge-tts`가 PATH에 없으면 `.venv-tts`를 만들고 Edge TTS helper를 설치합니다.
- 대화형 `.env` 설정 마법사를 실행합니다.

지원되는 시스템 부트스트랩 경로:

| OS | 시스템 의존성 경로 |
|---|---|
| macOS | Homebrew: 필요 시 `brew install node ffmpeg whisper-cpp` |
| Debian/Ubuntu | `apt-get`으로 Node/npm, ffmpeg, Python, build tools 설치; 필요 시 로컬 whisper.cpp 빌드 |
| Fedora/RHEL | `dnf`로 Node/npm, ffmpeg, Python, build tools 설치; 필요 시 로컬 whisper.cpp 빌드 |
| Arch | `pacman`으로 Node/npm, ffmpeg, Python, build tools 설치; 필요 시 로컬 whisper.cpp 빌드 |

유용한 설치 변형:

```bash
vc setup --yes --no-wizard                   # npm 설치에서 의존성만 준비
./scripts/install.sh --yes --no-wizard       # 클론에서 의존성만 준비
./scripts/install.sh --skip-system           # OS 패키지는 직접 설치
./scripts/install.sh --skip-model            # 기본 STT 모델 다운로드 생략
./scripts/install.sh --skip-edge-tts         # .venv-tts 생성 생략
VERBALCODING_SKIP_CLI_LINK=1 ./scripts/install.sh --yes
```

OS가 지원되지 않으면 아래를 직접 설치한 뒤 다시 실행하세요.

- Node.js 20+ 및 npm
- ffmpeg
- venv/pip가 포함된 Python 3
- whisper.cpp `whisper-cli`
- 인증된 CLI 에이전트 백엔드 하나 이상; 기본은 Hermes Agent

## 3. Discord 애플리케이션 설정

Discord 봇을 처음 만든다면 먼저 공식/상위 문서를 확인하세요.

- Hermes Agent Discord 메시징 가이드: <https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord>
- Discord 공식 봇 개요: <https://docs.discord.com/developers/bots/overview>
- Discord 공식 시작 가이드: <https://docs.discord.com/developers/quick-start/getting-started>

위 문서에는 Discord 애플리케이션 생성, bot user 추가, privileged intent 활성화, 서버 초대 방법이 설명되어 있습니다. VerbalCoding도 같은 Discord bot 설정을 사용하고, 그 위에 음성 수신, STT, CLI 에이전트 실행, TTS 재생을 얹습니다.

1. Discord Developer Portal에서 애플리케이션과 봇을 만듭니다.
2. Message Content privileged intent를 켭니다.
3. 봇 토큰을 설치 프롬프트 또는 `.env`의 `DISCORD_BOT_TOKEN`에 넣습니다.
4. 초대 URL을 생성합니다.

```bash
vc bot invite <discord-client-id>
# 특정 서버로 고정하려면:
vc bot invite <discord-client-id> --guild <guild-id>
```

초대 URL에는 VerbalCoding이 쓰는 bot/application command scope와 텍스트/음성 권한이 포함됩니다.

## 4. 검증

```bash
vc doctor
```

`vc doctor`는 토큰을 숨깁니다. 필요한 토큰, 명령, 모델이 있는지만 보여주고 비밀값은 출력하지 않습니다. 모든 `✗` 항목을 고친 뒤 다시 실행하세요.

성공 예시는 다음과 같습니다.

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

설치기가 로컬 Edge TTS helper를 만들었다면 `.env`에는 `.venv-tts/bin/edge-tts`를 가리키는 `EDGE_TTS_COMMAND` 경로가 들어갑니다.

## 5. 기본 단일 봇 실행

```bash
vc start
# 또는 GitHub 클론에서:
./run.sh
```

성공한 시작 로그에는 다음 줄이 보입니다.

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

그 다음 설정된 음성 채널에서 말해 보세요. STT 텍스트, verbose 모드의 진행 텍스트, 최종 텍스트 답변, TTS 재생을 확인할 수 있어야 합니다.

## 6. 프로젝트별 음성방 설정

프로젝트 음성방마다 영구 봇 하나를 두려면 프로젝트마다 Discord 애플리케이션을 만든 뒤:

```bash
vc instance setup my-project
vc bot invite <that-project-client-id>
vc instance start my-project
vc instance status my-project
```

각 인스턴스는 무시되는 `instances/<name>.env`를 작성합니다. 이 파일에는 해당 봇의 토큰, 음성 채널, transcript 대상, 로그 경로, Hermes 세션 파일, 선택적 Hermes 프로필 정보가 들어갑니다.

## 7. 선택: OpenVoice 설정

OpenVoice 음성 복제는 선택 기능입니다. 공개 설치 직후에는 `TTS_BACKEND=edge`를 유지하세요. 나중에 OpenVoice를 켜려면:

```bash
./scripts/setup_openvoice.sh
# OpenVoice V2 체크포인트를 vendor/OpenVoice/checkpoints_v2/ 아래에 넣습니다.
# 허가된 로컬 샘플을 voice-samples/user-reference.wav에 두거나,
# 봇 실행 후 “목소리 샘플 녹음 시작해”라고 말하고 10~30초 발화합니다.
python3 scripts/openvoice_smoke.py
```

그 뒤 `TTS_BACKEND=openvoice`로 설정하고 `vc doctor`, Discord의 `!voice-test <text>`로 테스트합니다.

## 8. 유지보수자용 클린 설치 스모크 테스트

빠른 호스트 스모크 테스트:

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

이 시점에서 예상되는 실패는 로컬 비밀값 누락 또는 인증되지 않은 에이전트 CLI입니다. 토큰 노출이나 설치 스크립트 누락이 나오면 안 됩니다.

Docker 기반 Ubuntu 클린 설치 스모크 테스트:

```bash
./scripts/docker_ubuntu_smoke.sh
```

이 스크립트는 `ubuntu:24.04`에서 추적된 저장소 트리를 깨끗한 컨테이너로 복사하고, `./scripts/install.sh --yes --no-wizard`를 실행하고, 비밀값 없는 smoke `.env`를 만든 뒤 `vc`, Node 테스트, `vc doctor`를 확인합니다. Discord 음성 연결까지는 하지 않습니다. 실제 end-to-end 음성 테스트는 Ubuntu VM 또는 WSL2에서 별도로 진행하세요.
