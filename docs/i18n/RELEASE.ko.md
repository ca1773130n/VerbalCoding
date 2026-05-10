# VerbalCoding 릴리스 노트


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

## 현재 릴리스 후보

VerbalCoding은 CLI 기반 코딩 에이전트를 음성으로 제어하기 위한 Discord 음성 브리지입니다. 공개 릴리스를 지향하며, macOS / Apple Silicon 경로가 가장 많이 테스트되었고 일반적인 패키지 관리자에 대한 Linux 부트스트랩은 최선 노력으로 지원됩니다.

### 포함됨

- Node `@discordjs/voice`를 통한 Discord 음성 수신.
- `whisper.cpp` + Metal을 통한 로컬 한국어 STT.
- 한국어 기본 음성을 사용하는 Edge TTS 재생.
- 범용 CLI 하네스 어댑터 계층:
  - Hermes Agent
  - Claude Code
  - Codex CLI
  - Gemini CLI
  - OpenCode
  - OpenClaw
  - 커스텀 명령
- Hermes 백엔드의 공유 음성/텍스트 세션 지원.
- 긴 답변 TTS 청킹 및 반응형 끼어들기.
- 큰 기술 출력이 소리 내어 읽히지 않도록 하는 diff/code/log 안전장치.
- 실내와 시끄러운/실외 사용을 위한 일반 및 보수적 감도 모드.
- OS 패키지, npm 의존성, Edge TTS 헬퍼, 기본 whisper.cpp 모델을 위한 설정 마법사, `.env.example`, `vc doctor` 필수 조건 점검기, `./scripts/install.sh --yes` 부트스트랩.
- npm 패키지 설치 경로: `npm install -g verbalcoding`, `vc setup --yes`, `vc start`.
- 긴 에이전트 작업 중 텍스트 전용 중간 단계 업데이트를 위한 선택적 자세한 진행 모드.
- 파이프라인 최적화를 위한 항상 켜진 JSONL 지연 시간 지표와 `!latency` / `!metrics` 요약.
- 더 여유 있는 발화 유휴 대기(`UTTERANCE_IDLE_MS=4500`)로, 자연스러운 멈춤이 있는 긴 음성 지시가 부분 프롬프트와 무시되는 처리 중 발화로 나뉘지 않도록 함.
- Multi-instance Hermes 프로필 격리: `vc instance setup <name>`은 인스턴스 workdir를 가진 Hermes 프로필을 `~/.hermes/profiles/<name>`에 자동 복제하고, SOUL.md를 초기화하며, 인스턴스 env에 `HERMES_HOME`을 작성하여 프로젝트별 메모리와 skill을 분리합니다. `vc instance start`는 누락된 프로필을 자가 복구하고, `vc doctor`는 프로필 디렉터리 존재와 `terminal.cwd` 일관성을 확인합니다.

### 사전 릴리스 체크리스트

저장소 루트에서 실행하세요:

```bash
./scripts/install.sh --yes --no-wizard
./scripts/docker_ubuntu_smoke.sh   # Docker 필요; ubuntu:24.04 깨끗한 설치 검증
node --check app-node/main.mjs app-node/agent_adapters.mjs app-node/install_config.mjs scripts/install.mjs
npm test
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest tests/ -q || [ $? -eq 5 ]  # Python 테스트가 없으면 OK
bash -n run.sh scripts/install.sh scripts/bootstrap_prereqs.sh scripts/docker_ubuntu_smoke.sh
npm pack --dry-run
vc doctor
git diff --check
```

수동 스모크 테스트:

1. `vc start` 또는 `./run.sh`로 브리지를 시작합니다.
2. 로그에 `Logged in as <bot-name>`가 포함되는지 확인합니다.
3. 로그에 `Listening in voice channel ... / 일반` 또는 설정된 기본 채널이 포함되는지 확인합니다.
4. Discord에서 `!ping`을 실행합니다.
5. Discord 음성에서 짧은 한국어 요청을 말합니다.
6. STT 전사, 에이전트 응답, TTS 재생, 끼어들기 동작을 확인합니다.

### 알려진 요구 사항

- 최선 노력 부트스트랩을 위해 Homebrew가 있는 macOS 또는 `apt`, `dnf`, `pacman`이 있는 Linux.
- `ffmpeg`; 설치 프로그램이 설치를 시도합니다.
- `whisper-cli`; 설치 프로그램은 macOS에서 Homebrew를 사용하거나 Linux에서 로컬 `vendor/whisper.cpp` 빌드 폴백을 사용합니다.
- `models/ggml-small-q5_1.bin`의 기본 모델; `--skip-model`을 사용하지 않으면 설치 프로그램이 다운로드합니다.
- `PATH`의 Edge TTS CLI 또는 로컬 `.venv-tts/bin/edge-tts`; 필요하면 설치 프로그램이 로컬 헬퍼를 만듭니다.
- `.env`, `instances/<name>.env`, `~/.zshrc` 또는 런타임 env의 Discord 봇 토큰.
- 선택한 CLI 하네스가 설치 및 인증되어 있어야 합니다.

### 아직 공개 릴리스용은 아님

공개 릴리스 전에 다음 추가를 고려하세요:

- GitHub Actions CI.
- 데모 비디오 / GIF.
- Discord 봇 설정 스크린샷.
- 스크립트 수준 점검을 넘어 실제 배포판에서 더 넓은 Linux 검증.
- 모든 로깅 경로의 보안 검토.
