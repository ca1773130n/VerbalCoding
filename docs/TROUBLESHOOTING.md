# VerbalCoding Troubleshooting

## `Cannot perform IP discovery - socket closed`

This usually means the bot logged into Discord and found a voice channel, but Discord voice UDP discovery failed.

Typical log sequence:

```text
Logged in as <bot-name>
auto-join failed; trying next configured voice channel <server> <channel> AbortError: The operation was aborted
voice connection error Error: Cannot perform IP discovery - socket closed
No auto-join channel found or reachable ... attempted <server>/<channel>
```

Interpretation:

| Log signal | Meaning |
|---|---|
| `Logged in as ...` | Token and Discord gateway login worked. |
| `attempted <server>/<channel>` | Channel lookup worked; names are probably correct. |
| `AbortError` after ~30s | Voice connection did not become ready in time. |
| `Cannot perform IP discovery - socket closed` | UDP voice discovery failed, often because Docker/firewall/NAT blocked UDP. |

Fixes:

1. Try outside Docker first to isolate container networking.
2. On Linux Docker Compose, use host networking:

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

3. Remove `ports:` from the same service. Host networking and port publishing should not be combined.
4. Check host firewall, cloud security group, VPN, proxy, or corporate network policies for outbound UDP blocking.
5. On Docker Desktop for macOS/Windows, host networking behaves differently. If voice UDP still fails, run VerbalCoding directly on macOS/Linux host or in a Linux VM.

## `No auto-join channel found or reachable`

First confirm the configured names:

```bash
vc setup channels "VerbalCoding,LLM-Wiki,General"
vc doctor
vc start
```

If the log includes `attempted Server/Channel`, the channel was found and the remaining issue is reachability, permissions, or UDP voice transport. If the log has no attempted channel, update the channel names exactly as they appear in Discord.

## Missing Discord token

Run:

```bash
vc setup token
# or:
vc setup token <bot-token> --client-id <discord-client-id>
vc doctor
```

Do not paste real tokens into issues, logs, screenshots, or docs. `vc doctor` redacts configured token values.

## Bot invited but cannot speak or send text

Verify Discord permissions on the exact channel/thread/voice room:

- View Channel
- Send Messages
- Send Messages in Threads
- Read Message History
- Use Application Commands
- Connect
- Speak

Channel-level overwrites can deny access even when the bot has server-level permissions.

## Text delivery warning

```text
sendText missing transcript channel id; text not delivered
```

Voice can still work. This means `TRANSCRIPT_CHANNEL_ID` is unset, so restart/final/progress text cannot be mirrored to Discord text. Rerun setup or set a transcript text channel/thread ID.

## Docker Compose host networking

Equivalent of `docker run --network=host`:

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

Notes:

- Linux Docker: this is the most useful fix for Discord voice UDP issues.
- Docker Desktop macOS/Windows: host networking is limited/different; test on the host or a Linux VM if voice still fails.
- Do not include `ports:` for that service when using `network_mode: "host"`.

## Doctor auto-fix behavior

`vc doctor` may install or repair local prerequisites on supported macOS/Linux installs. It does not create Discord secrets or authenticate external agent CLIs for you.

```bash
vc doctor
VERBALCODING_DOCTOR_INSTALL_HERMES=0 vc doctor  # skip Hermes CLI auto-install
```
