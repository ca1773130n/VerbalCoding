# Устранение неполадок VerbalCoding

## `Cannot perform IP discovery - socket closed`

Эта ошибка означает, что бот вошёл в Discord и нашёл голосовой канал, но UDP-обнаружение Discord voice не сработало.

В Linux Docker Compose используйте:

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

Удалите `ports:` у этого же сервиса. В Docker Desktop для macOS/Windows host networking работает иначе; если ошибка остаётся, запускайте на хосте или в Linux VM.

## Token and channel setup

Если нет токена, выполните `vc setup token`; если имя канала не совпадает, выполните `vc setup channels "<реальный голосовой канал>"`.

```bash
vc setup token
vc setup channels "General,Team Voice"
vc doctor
```
