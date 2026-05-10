# VerbalCoding multiinstancia


## Flujo setup actualizado

```bash
npm install -g verbalcoding@latest
vc setup
vc doctor
vc start
```

No edites `.env` manualmente: usa `vc setup token` para guardar `DISCORD_BOT_TOKEN`/`DISCORD_CLIENT_ID` y `vc setup channels` para guardar `AUTO_JOIN_VOICE_CHANNELS`. Si Docker muestra `Cannot perform IP discovery - socket closed`, usa `network_mode: "host"` en Linux Compose y elimina `ports:`.

VerbalCoding puede ejecutar múltiples procesos independientes de puente de voz de Discord. Cada proceso sigue siendo el puente Node de instancia única existente, pero carga un archivo `instances/<name>.env` diferente y usa un token de bot de Discord diferente.

Usa esto cuando cada proyecto deba ocupar permanentemente su propio canal de voz de Discord y escribir en su propio canal/hilo de transcripción.

## Por qué se requieren varios tokens de bot

La residencia de voz de Discord es efectivamente una conexión de voz activa por cuenta de bot y por guild. Si un token de bot se une a otro canal de voz en la misma guild, no puede permanecer también conectado de forma permanente al canal anterior. Para salas de proyecto simultáneas, crea una aplicación/bot de Discord por proyecto.

## Diseño de archivos

```text
instances/
  README.md
  example.env
  llm-wiki.env        # local only, ignored by git
  verbalcoding.env    # local only, ignored by git
.run/instances/
  llm-wiki.pid        # runtime only, ignored by git
```

Los archivos reales `instances/*.env` se ignoran porque pueden contener tokens de Discord. `instances/example.env` es la plantilla versionada.

## Asistente de configuración de instancia

Los usuarios no deberían copiar y editar manualmente archivos env para el uso normal. Ejecuta el asistente en su lugar:

```bash
vc instance setup llm-wiki
# o mediante el script de configuración del proyecto:
./scripts/install.sh --instance llm-wiki
```

El asistente solicita el token del bot, ID de aplicación/cliente de Discord, canal de voz, destino de transcripción, workdir, contexto del proyecto y rutas de ejecución aisladas. Escribe `instances/<name>.env` con modo `0600`, hace una copia de seguridad del archivo existente antes de sobrescribirlo e imprime los siguientes comandos de inicio/estado.

Si introduces el ID de aplicación/cliente de Discord durante la configuración, el resumen también imprime la URL de invitación de ese bot. Puedes generar la misma URL en cualquier momento con:

```bash
vc bot invite <client-id>
vc bot invite <client-id> --guild <guild-id>
```

Discord sigue requiriendo una aplicación/bot del Developer Portal por sala de voz simultánea, pero esto evita construir manualmente URLs OAuth o enteros de permisos.

### Aislamiento de perfiles de Hermes

Cada instancia obtiene su propio home de Hermes en `~/.hermes/profiles/<name>` para que memoria, MEMORY.md, SOUL.md y skills aprendidas no se filtren entre proyectos.

`vc instance setup <name>` automáticamente:

- ejecuta `hermes profile create <name> --clone-from default` (traslada claves API
  y modelo desde tu `~/.hermes` actual; las sesiones y memoria empiezan limpias),
- define el `terminal.cwd` del nuevo perfil al workdir de la instancia,
- inicializa `<profile>/SOUL.md` desde la respuesta de contexto de proyecto del asistente,
- escribe `HERMES_HOME=...` en `instances/<name>.env`.

`vc instance start <name>` se autorepara: si el env apunta a un directorio de perfil de Hermes que ya no existe, el comando de inicio lo recrea antes de lanzar.

Los nombres de instancia deben coincidir con `^[a-z0-9][a-z0-9_-]{0,63}$` porque Hermes usa el nombre como directorio y clave de configuración.

## Env mínimo generado para una instancia

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

Da a cada instancia valores únicos para archivos de registro/depuración/sesión. `HERMES_HOME` y el directorio correspondiente `~/.hermes/profiles/<name>` se crean automáticamente con `vc instance setup`. `vc doctor` comprueba tokens duplicados, rutas de ejecución en conflicto, directorios de perfil faltantes y discrepancias de `terminal.cwd` entre perfil e instancia, todo sin imprimir secretos.

## Comandos

```bash
vc instance list
vc instance status
vc instance status my-project
vc instance start my-project
vc instance stop my-project
vc instance restart my-project
```

`start` ejecuta `./run.sh instances/<name>.env` desacoplado y escribe `.run/instances/<name>.pid`.

`stop` envía `SIGTERM`, espera hasta 10 segundos, luego recurre a `SIGKILL` y elimina el archivo pid.

## Ejemplo: dos salas de voz permanentes

1. Crea dos aplicaciones/bots de Discord:
   - Bot VerbalCoding
   - Bot LLM-Wiki

2. Invita ambos al servidor con permisos de texto y voz:
   - Ver canal
   - Enviar mensajes
   - Enviar mensajes en hilos
   - Leer historial de mensajes
   - Usar comandos de aplicación
   - Conectar
   - Hablar

   Usa `vc bot invite <client-id>` después de crear cada aplicación de Discord para imprimir la URL de invitación exacta con esos permisos.

3. Ejecuta el asistente de configuración para cada instancia local:

```bash
vc instance setup verbalcoding
vc instance setup llm-wiki
```

El asistente escribe los archivos ignorados `instances/verbalcoding.env` e `instances/llm-wiki.env` con modo `0600`; también hace copia de seguridad de un env de instancia existente antes de reemplazarlo. Cada ejecución también crea `~/.hermes/profiles/<name>` clonado desde tu home de Hermes predeterminado, de modo que las dos instancias empiezan con la misma autenticación/modelo, pero acumulan memoria y skills independientes a medida que aprenden cada proyecto.

4. Comprueba la configuración:

```bash
vc doctor
```

5. Inicia ambos:

```bash
vc instance start verbalcoding
vc instance start llm-wiki
vc instance status
```

6. Verifica los registros:

```bash
tail -n 50 /tmp/verbalcoding-verbalcoding.log
tail -n 50 /tmp/verbalcoding-llm-wiki.log
```

Líneas de registro esperadas:

```text
Listening in voice channel ... / VerbalCoding
Listening in voice channel ... / LLM-Wiki
```

7. Detén ambos:

```bash
vc instance stop verbalcoding
vc instance stop llm-wiki
```

## Vinculación de texto/voz de corto plazo con un solo bot

Si solo tienes un token de bot, usa vinculación de voz de sesión de proyecto en lugar de residencia multicanal simultánea.

Ejecuta esto en el canal/hilo de texto objetivo:

```text
!session attach-voice --voice "LLM-Wiki"
```

Comportamiento:

- Vincula el canal de voz seleccionado al canal/hilo de texto actual.
- Si el canal de texto actual no tiene sesión de proyecto, crea una sesión aislada ad hoc.
- El texto de STT/resultado/progreso/respuesta final de voz se enruta al destino de transcripción de ese proyecto activo.

Para adjuntar una sesión de proyecto nombrada existente:

```text
!session voice llm-wiki --voice "LLM-Wiki"
```

Esto es conveniente para el enrutamiento, pero no hace que un bot permanezca en dos canales de voz al mismo tiempo. Usa varios tokens/procesos de bot para residencia permanente simultánea.
