# Multi-instance VerbalCoding

VerbalCoding은 여러 개의 독립적인 Discord 음성 브리지 프로세스를 실행할 수 있습니다. 각 프로세스는 여전히 기존 단일 인스턴스 Node 브리지이지만, 서로 다른 `instances/<name>.env` 파일을 로드하고 서로 다른 Discord 봇 토큰을 사용합니다.

각 프로젝트가 자체 Discord 음성 채널을 영구적으로 차지하고 자체 전사 채널/스레드에 기록해야 할 때 사용하세요.

## 여러 봇 토큰이 필요한 이유

Discord 음성 상주는 사실상 길드당 봇 계정 하나에 활성 음성 연결 하나입니다. 같은 길드에서 하나의 봇 토큰이 다른 음성 채널에 참가하면 이전 채널에 영구 연결된 상태를 동시에 유지할 수 없습니다. 동시에 여러 프로젝트 방을 쓰려면 프로젝트마다 Discord 애플리케이션/봇을 하나씩 만드세요.

## 파일 배치

```text
instances/
  README.md
  example.env
  llm-wiki.env        # 로컬 전용, git에서 무시됨
  verbalcoding.env    # 로컬 전용, git에서 무시됨
.run/instances/
  llm-wiki.pid        # 런타임 전용, git에서 무시됨
```

실제 `instances/*.env` 파일은 Discord 토큰을 포함할 수 있으므로 무시됩니다. `instances/example.env`가 커밋된 템플릿입니다.

## 인스턴스 설정 마법사

일반 사용자는 env 파일을 복사해 수동으로 편집하지 않아도 됩니다. 대신 마법사를 실행하세요:

```bash
vc instance setup llm-wiki
# 또는 프로젝트 설정 스크립트를 통해:
./scripts/install.sh --instance llm-wiki
```

마법사는 봇 토큰, Discord Application/Client ID, 음성 채널, 전사 대상, workdir, 프로젝트 컨텍스트, 격리된 런타임 경로를 묻습니다. mode `0600`으로 `instances/<name>.env`를 작성하고, 덮어쓰기 전에 기존 파일을 백업하며, 다음 start/status 명령을 출력합니다.

설정 중 Discord Application/Client ID를 입력하면 요약에 해당 봇의 초대 URL도 출력됩니다. 같은 URL은 언제든 다음으로 생성할 수 있습니다:

```bash
vc bot invite <client-id>
vc bot invite <client-id> --guild <guild-id>
```

동시 음성 방마다 Developer Portal 애플리케이션/봇이 하나씩 필요한 점은 변하지 않지만, OAuth URL이나 권한 정수를 수동으로 만들 필요가 없습니다.

### Hermes 프로필 격리

각 인스턴스는 `~/.hermes/profiles/<name>`에 자체 Hermes home을 갖습니다. 따라서 memory, MEMORY.md, SOUL.md, 학습된 skill이 프로젝트 간에 새지 않습니다.

`vc instance setup <name>`은 자동으로 다음을 수행합니다:

- `hermes profile create <name> --clone-from default` 실행(현재 `~/.hermes`의 API 키와 모델은 가져오며, 세션과 메모리는 새로 시작),
- 새 프로필의 `terminal.cwd`를 인스턴스 workdir로 설정,
- 마법사의 프로젝트 컨텍스트 답변으로 `<profile>/SOUL.md` 초기화,
- `instances/<name>.env`에 `HERMES_HOME=...` 작성.

`vc instance start <name>`은 자가 복구를 수행합니다. env가 더 이상 존재하지 않는 Hermes 프로필 디렉터리를 가리키면, 시작 명령은 실행 전에 해당 프로필을 다시 만듭니다.

Hermes가 이름을 디렉터리 및 설정 키로 사용하므로 인스턴스 이름은 `^[a-z0-9][a-z0-9_-]{0,63}$`와 일치해야 합니다.

## 최소 생성 인스턴스 env

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

모든 인스턴스에 로그/디버그/세션 파일의 고유 값을 부여하세요. `HERMES_HOME`과 일치하는 `~/.hermes/profiles/<name>` 디렉터리는 `vc instance setup`이 자동으로 만듭니다. `vc doctor`는 비밀 정보를 출력하지 않고 중복 토큰, 충돌하는 런타임 경로, 누락된 프로필 디렉터리, 프로필과 인스턴스 사이의 `terminal.cwd` 불일치를 확인합니다.

## 명령

```bash
vc instance list
vc instance status
vc instance status my-project
vc instance start my-project
vc instance stop my-project
vc instance restart my-project
```

`start`는 `./run.sh instances/<name>.env`를 분리 실행하고 `.run/instances/<name>.pid`를 작성합니다.

`stop`은 `SIGTERM`을 보내고 최대 10초간 기다린 뒤, 필요하면 `SIGKILL`로 폴백하고 pid 파일을 제거합니다.

## 예시: 두 개의 영구 음성 방

1. 두 개의 Discord 애플리케이션/봇을 만듭니다:
   - VerbalCoding bot
   - LLM-Wiki bot

2. 텍스트 및 음성 권한으로 둘 다 서버에 초대합니다:
   - View Channel
   - Send Messages
   - Send Messages in Threads
   - Read Message History
   - Use Application Commands
   - Connect
   - Speak

   각 Discord 애플리케이션을 만든 뒤 `vc bot invite <client-id>`를 사용하면 해당 권한이 포함된 정확한 초대 URL을 출력할 수 있습니다.

3. 각 로컬 인스턴스에 대해 설정 마법사를 실행합니다:

```bash
vc instance setup verbalcoding
vc instance setup llm-wiki
```

마법사는 mode `0600`으로 git에서 무시되는 `instances/verbalcoding.env` 및 `instances/llm-wiki.env` 파일을 작성합니다. 또한 기존 인스턴스 env를 교체하기 전에 백업합니다. 각 실행은 기본 Hermes home에서 복제한 `~/.hermes/profiles/<name>`도 생성하므로, 두 인스턴스는 같은 인증/모델로 시작하지만 각 프로젝트를 학습하면서 독립적인 메모리와 skill을 축적합니다.

4. 설정을 확인합니다:

```bash
vc doctor
```

5. 둘 다 시작합니다:

```bash
vc instance start verbalcoding
vc instance start llm-wiki
vc instance status
```

6. 로그를 확인합니다:

```bash
tail -n 50 /tmp/verbalcoding-verbalcoding.log
tail -n 50 /tmp/verbalcoding-llm-wiki.log
```

예상 로그 줄:

```text
Listening in voice channel ... / VerbalCoding
Listening in voice channel ... / LLM-Wiki
```

7. 둘 다 중지합니다:

```bash
vc instance stop verbalcoding
vc instance stop llm-wiki
```

## 단기 단일 봇 텍스트/음성 바인딩

봇 토큰이 하나뿐이라면 동시 다중 채널 상주 대신 프로젝트 세션 음성 바인딩을 사용하세요.

대상 텍스트 채널/스레드에서 다음을 실행합니다:

```text
!session attach-voice --voice "LLM-Wiki"
```

동작:

- 선택한 음성 채널을 현재 텍스트 채널/스레드에 바인딩합니다.
- 현재 텍스트 채널에 프로젝트 세션이 없으면 임시 격리 세션을 만듭니다.
- 음성 STT/결과/진행/최종 답변 텍스트가 해당 활성 프로젝트 전사 대상으로 라우팅됩니다.

기존 이름 있는 프로젝트 세션을 연결하려면:

```text
!session voice llm-wiki --voice "LLM-Wiki"
```

이는 라우팅에는 편리하지만, 하나의 봇을 두 음성 채널에 동시에 머물게 하지는 않습니다. 동시 영구 상주에는 여러 봇 토큰/프로세스를 사용하세요.
