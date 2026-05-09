# VerbalCoding 릴리스 노트

## 현재 릴리스 후보

VerbalCoding은 음성으로 CLI 기반 코딩 에이전트를 제어하기 위한 Discord 음성 브릿지입니다. 공개 릴리스를 지향하며, macOS / Apple Silicon 경로가 가장 많이 테스트되어 있고, 일반적인 Linux 패키지 매니저에 대해서는 best-effort 부트스트랩을 제공합니다.

### 포함된 기능

- Node `@discordjs/voice` 기반 Discord 음성 수신.
- `whisper.cpp` + Metal 기반 로컬 한국어 STT.
- 한국어 기본 음성을 사용하는 Edge TTS 재생.
- 범용 CLI 하네스 어댑터 레이어:
  - Hermes Agent
  - Claude Code
  - Codex CLI
  - Gemini CLI
  - OpenCode
  - OpenClaw
  - custom command
- Hermes 백엔드의 음성/텍스트 공유 세션 지원.
- 긴 답변 TTS chunking과 반응형 barge-in.
- 큰 diff/code/log 출력이 음성으로 읽히지 않도록 하는 guardrail.
- 실내와 noisy/outdoor 환경을 위한 normal/conservative 감도 모드.
- 설정 마법사, `.env.example`, `vc doctor` prerequisite checker, OS 패키지/npm 의존성/Edge TTS helper/기본 whisper.cpp 모델을 준비하는 `./scripts/install.sh --yes` 부트스트랩.
- 긴 에이전트 작업 중 텍스트 전용 중간 단계 업데이트를 위한 선택적 verbose progress mode.
- 파이프라인 최적화를 위한 JSONL latency metrics와 `!latency` / `!metrics` 요약.
- 낮아진 기본 utterance idle wait (`UTTERANCE_IDLE_MS=2000`)로 사용자가 말한 뒤 STT가 약 0.6초 더 빨리 시작.
- 멀티 인스턴스 Hermes 프로필 격리: `vc instance setup <name>`이 자동으로 Hermes 프로필을 `~/.hermes/profiles/<name>`에 clone하고, instance workdir을 설정하고, SOUL.md를 초기화하고, instance env에 `HERMES_HOME`을 기록합니다. `vc instance start`는 누락된 profile을 self-heal하고, `vc doctor`는 profile-dir 존재와 `terminal.cwd` 일관성을 검사합니다.
- npm 공개 패키지: `npm install -g verbalcoding`, `vc setup --yes`, `vc start` 경로 지원.

### 릴리스 전 체크리스트

저장소 루트에서 실행:

```bash
./scripts/install.sh --yes --no-wizard
./scripts/docker_ubuntu_smoke.sh   # Docker 필요; ubuntu:24.04 clean install 검증
node --check app-node/main.mjs app-node/agent_adapters.mjs app-node/install_config.mjs scripts/install.mjs
npm test
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest tests/ -q || [ $? -eq 5 ]  # Python 테스트가 없으면 exit 5 허용
bash -n run.sh scripts/install.sh scripts/bootstrap_prereqs.sh scripts/docker_ubuntu_smoke.sh
npm pack --dry-run
vc doctor
git diff --check
```

수동 스모크 테스트:

1. `vc start` 또는 `./run.sh`로 브릿지를 시작합니다.
2. 로그에 `Logged in as <bot-name>`이 있는지 확인합니다.
3. 로그에 `Listening in voice channel ... / 일반` 또는 설정된 기본 채널이 있는지 확인합니다.
4. Discord에서 `!ping`을 실행합니다.
5. Discord 음성에서 짧은 한국어 요청을 말합니다.
6. STT transcript, agent response, TTS playback, barge-in 동작을 확인합니다.

### 알려진 요구 사항

- macOS + Homebrew 또는 Linux + `apt`, `dnf`, `pacman` best-effort bootstrap.
- `ffmpeg`; 설치기가 설치를 시도합니다.
- `whisper-cli`; macOS에서는 Homebrew를 사용하고, Linux에서는 로컬 `vendor/whisper.cpp` 빌드 fallback을 사용합니다.
- 기본 모델 `models/ggml-small-q5_1.bin`; `--skip-model`을 쓰지 않으면 설치기가 다운로드합니다.
- PATH의 Edge TTS CLI 또는 로컬 `.venv-tts/bin/edge-tts`; 필요하면 설치기가 로컬 helper를 만듭니다.
- `.env`, `instances/<name>.env`, `~/.zshrc`, runtime env 중 하나에 Discord bot token.
- 선택한 CLI 하네스가 설치되고 인증되어 있어야 합니다.

### 아직 public release 전에 보강하면 좋은 것

- GitHub Actions CI.
- Demo video / GIF.
- Discord bot setup screenshots.
- 스크립트 수준 검증을 넘어 실제 여러 Linux 배포판에서 더 넓은 검증.
- 모든 logging path 보안 리뷰.
