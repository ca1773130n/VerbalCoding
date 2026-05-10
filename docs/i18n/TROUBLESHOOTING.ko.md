# VerbalCoding 문제 해결

## `Cannot perform IP discovery - socket closed`

이 오류는 봇이 Discord에 로그인하고 음성 채널을 찾았지만 Discord 음성 UDP 검색에 실패했다는 뜻입니다.

Linux Docker Compose에서는 다음을 사용하세요:

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

같은 서비스의 `ports:`는 제거하세요. Docker Desktop macOS/Windows에서는 host networking 동작이 다르므로 계속 실패하면 호스트나 Linux VM에서 실행하세요.

## Token and channel setup

토큰이 없으면 `vc setup token`을 실행하고, 채널 이름이 맞지 않으면 `vc setup channels "<실제 음성 채널>"`을 실행하세요.

```bash
vc setup token
vc setup channels "General,Team Voice"
vc doctor
```
