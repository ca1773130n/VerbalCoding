# Solución de problemas de VerbalCoding

## `Cannot perform IP discovery - socket closed`

Este error significa que el bot inició sesión y encontró el canal de voz, pero falló el descubrimiento UDP de voz de Discord.

En Docker Compose sobre Linux usa:

```yaml
services:
  verbalcoding:
    network_mode: "host"
```

Elimina `ports:` del mismo servicio. En Docker Desktop para macOS/Windows el modo host se comporta de otra forma; si sigue fallando, ejecútalo en el host o en una VM Linux.

## Token and channel setup

Si falta el token, ejecuta `vc setup token`; si el nombre del canal no coincide, ejecuta `vc setup channels "<canal de voz real>"`.

```bash
vc setup token
vc setup channels "General,Team Voice"
vc doctor
```
