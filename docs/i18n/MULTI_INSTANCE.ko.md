# VerbalCoding 멀티 인스턴스

VerbalCoding은 여러 개의 독립적인 Discord 음성 브릿지 프로세스를 실행할 수 있습니다. 각 프로세스는 같은 단일 인스턴스 Node 브릿지를 사용하지만, 서로 다른 `instances/<name>.env` 파일과 서로 다른 Discord bot token을 로드합니다.

프로젝트마다 자기 Discord 음성 채널에 항상 붙어 있고, 자기 transcript 채널/스레드에 기록해야 할 때 사용하세요.

## 왜 여러 봇 토큰이 필요한가

Discord 음성 상주 방식은 사실상 길드마다 봇 계정 하나가 동시에 하나의 음성 연결만 유지하는 구조입니다. 같은 봇 토큰이 같은 길드의 다른 음성 채널에 들어가면 이전 채널에도 계속 남아 있을 수 없습니다. 동시에 여러 프로젝트 방을 유지하려면 프로젝트마다 Discord 애플리케이션/봇을 하나씩 만들어야 합니다.

## 파일 구조

```text
instances/
  README.md
  example.env
  llm-wiki.env        # 로컬 전용, git에서 무시
  verbalcoding.env    # 로컬 전용, git에서 무시
.run/instances/
  llm-wiki.pid        # 런타임 전용, git에서 무시
```

실제 `instances/*.env` 파일에는 Discord 토큰이 들어갈 수 있으므로 git에서 무시됩니다. `instances/example.env`만 템플릿으로 커밋됩니다.

## 인스턴스 설정 마법사

일반 사용자는 env 파일을 복사해서 직접 편집하지 않는 편이 좋습니다. 마법사를 실행하세요.

```bash
vc instance setup llm-wiki
# 또는 프로젝트 설정 스크립트에서:
./scripts/install.sh --instance llm-wiki
```

마법사는 봇 토큰, Discord Application/Client ID, 음성 채널, transcript 대상, 작업 디렉터리, 프로젝트 컨텍스트, 격리된 런타임 경로를 묻습니다. `instances/<name>.env`를 권한 `0600`으로 작성하고, 기존 파일이 있으면 덮어쓰기 전에 백업하며, 다음 start/status 명령을 출력합니다.

설정 중 Discord Application/Client ID를 입력하면 요약에 해당 봇 초대 URL도 출력됩니다. 같은 URL은 언제든지 다시 만들 수 있습니다.

```bash
vc bot invite <client-id>
vc bot invite <client-id> --guild <guild-id>
```

Discord는 동시에 여러 음성방에 상주하려면 여전히 방마다 Developer Portal 애플리케이션/봇 하나가 필요합니다. 대신 VerbalCoding이 OAuth URL이나 permission integer를 직접 조립할 필요를 없애 줍니다.

### Hermes 프로필 격리

각 인스턴스는 `~/.hermes/profiles/<name>` 아래에 자기 Hermes home을 갖습니다. 이렇게 하면 memory, MEMORY.md, SOUL.md, 학습된 skills가 프로젝트 사이에 섞이지 않습니다.

`vc instance setup <name>`은 자동으로 다음을 수행합니다.

- `hermes profile create <name> --clone-from default` 실행: 현재 `~/.hermes`의 API key와 모델 설정은 가져오지만, 세션과 메모리는 새로 시작합니다.
- 새 프로필의 `terminal.cwd`를 인스턴스 작업 디렉터리로 설정합니다.
- 마법사에서 입력한 project context로 `<profile>/SOUL.md`를 초기화합니다.
- `instances/<name>.env`에 `HERMES_HOME=...`을 씁니다.

`vc instance start <name>`은 self-heal을 수행합니다. env가 가리키는 Hermes profile directory가 사라졌다면 시작 전에 다시 만듭니다.

인스턴스 이름은 Hermes가 디렉터리와 config key로 쓰기 때문에 `^[a-z0-9][a-z0-9_-]{0,63}$` 형식이어야 합니다.

## 생성되는 최소 인스턴스 env 예시

```env
INSTANCE_NAME=my-project
DISCORD_TOKEN=replac...oken
DISCORD_CLIENT_ID=123456789012345678
AUTO_JOIN_VOICE_CHANNELS=Project Room
TRANSCRIPT_CHANNEL_ID=123456789012345678
PROJECT_SESSIONS_FILE=config/project-sessions.my-project.json
BRIDGE_LOG_PATH=/tmp/verbalcoding-my-project.log
NODE_AUDIO_DEBUG_DIR=/tmp/verbalcoding-my-project-debug
HERMES_SESSION_FILE=.agent-sessions/hermes/my-project.session
HERMES_HOME=/home/you/.hermes/profiles/my-project
AGENT_LABEL=VerbalCoding · My Project
AGENT_CWD=/path/to/my-project
AGENT_PROJECT_CONTEXT=Project session: My Project
```

모든 인스턴스는 log/debug/session 파일 경로가 고유해야 합니다. `HERMES_HOME`과 대응하는 `~/.hermes/profiles/<name>` 디렉터리는 `vc instance setup`이 자동 생성합니다. `vc doctor`는 비밀값을 출력하지 않고 중복 토큰, 충돌하는 런타임 경로, 누락된 profile directory, profile과 instance의 `terminal.cwd` 불일치를 검사합니다.

## 명령

```bash
vc instance list
vc instance status
vc instance status my-project
vc instance start my-project
vc instance stop my-project
vc instance restart my-project
```

`start`는 `./run.sh instances/<name>.env`를 detached로 실행하고 `.run/instances/<name>.pid`를 씁니다.

`stop`은 `SIGTERM`을 보내고 최대 10초 기다린 뒤, 필요하면 `SIGKILL`로 fallback하고 pid 파일을 제거합니다.

## 예시: 영구 음성방 두 개

1. Discord 애플리케이션/봇 두 개를 만듭니다.
   - VerbalCoding bot
   - LLM-Wiki bot

2. 둘 다 서버에 초대하고 텍스트/음성 권한을 줍니다.
   - View Channel
   - Send Messages
   - Send Messages in Threads
   - Read Message History
   - Use Application Commands
   - Connect
   - Speak

   각 Discord 애플리케이션을 만든 뒤 `vc bot invite <client-id>`를 실행하면 필요한 권한이 포함된 정확한 초대 URL을 출력합니다.

3. 각 로컬 인스턴스 설정 마법사를 실행합니다.

```bash
vc instance setup verbalcoding
vc instance setup llm-wiki
```

마법사는 git에서 무시되는 `instances/verbalcoding.env`, `instances/llm-wiki.env`를 권한 `0600`으로 작성하고, 기존 env가 있으면 백업합니다. 각 실행은 기본 Hermes home에서 clone한 `~/.hermes/profiles/<name>`도 생성하므로 두 인스턴스는 같은 인증/모델 설정으로 시작하지만, 프로젝트를 학습하면서 서로 독립적인 memory와 skills를 쌓습니다.

4. 설정을 확인합니다.

```bash
vc doctor
```

5. 둘 다 시작합니다.

```bash
vc instance start verbalcoding
vc instance start llm-wiki
vc instance status
```

6. 로그를 확인합니다.

```bash
tail -n 50 /tmp/verbalcoding-verbalcoding.log
tail -n 50 /tmp/verbalcoding-llm-wiki.log
```

예상 로그:

```text
Listening in voice channel ... / VerbalCoding
Listening in voice channel ... / LLM-Wiki
```

7. 둘 다 중지합니다.

```bash
vc instance stop verbalcoding
vc instance stop llm-wiki
```

## 단기: 단일 봇 텍스트/음성 바인딩

봇 토큰이 하나뿐이라면 동시 다중 채널 상주 대신 project-session voice binding을 쓰세요.

대상 텍스트 채널/스레드에서:

```text
!session attach-voice --voice "LLM-Wiki"
```

동작:

- 선택된 음성 채널을 현재 텍스트 채널/스레드에 연결합니다.
- 현재 텍스트 채널에 project session이 없으면 ad-hoc 격리 세션을 만듭니다.
- 음성 STT/result/progress/final-answer 텍스트가 해당 project transcript 대상으로 라우팅됩니다.

기존 named project session을 연결하려면:

```text
!session voice llm-wiki --voice "LLM-Wiki"
```

이 방식은 라우팅에는 편하지만, 봇 하나를 동시에 두 음성 채널에 머물게 하지는 않습니다. 동시에 여러 프로젝트 방에 영구 상주하려면 여러 봇 토큰/프로세스를 사용하세요.
