# Harnesses de agentes de codificación

<p align="center">
  <a href="../../README.es.md">README</a> ·
  <a href="README.es.md">Centro de documentación</a> ·
  <a href="USAGE.es.md">Uso</a> ·
  <a href="CONFIGURATION.es.md">Configuración</a> ·
  <a href="TROUBLESHOOTING.es.md">Resolución de problemas</a>
</p>

VerbalCoding es agnóstico al agente. Lanza el CLI de codificación que tengas instalado una vez por turno de voz, le pasa la transcripción como prompt y reproduce la respuesta. Elige **uno** como predeterminado; el enrutamiento por voz te permite alcanzar los demás dentro de la sesión.

| Harness | Comando por defecto | Reanudación de sesión | Documento específico |
|---|---|---|---|
| Hermes Agent | `hermes chat -Q -q` | ✅ (`--resume <id>`) | [HERMES_VOICE.es.md](./HERMES_VOICE.es.md) · [HARNESS_HERMES.es.md](./HARNESS_HERMES.es.md) |
| Claude Code | `claude -p` | ❌ | [HARNESS_CLAUDE.es.md](./HARNESS_CLAUDE.es.md) |
| Codex | `codex exec` | ❌ (captura del último mensaje) | [HARNESS_CODEX.es.md](./HARNESS_CODEX.es.md) |
| Gemini CLI | `gemini -p` | ❌ | [HARNESS_GEMINI.es.md](./HARNESS_GEMINI.es.md) |
| OpenCode | `opencode run` | ❌ | [HARNESS_OPENCODE.es.md](./HARNESS_OPENCODE.es.md) |
| OpenClaw | `openclaw run` | ❌ | [HARNESS_OPENCLAW.es.md](./HARNESS_OPENCLAW.es.md) |
| Aider | `aider --no-pretty --yes-always --message` | ❌ | [HARNESS_AIDER.es.md](./HARNESS_AIDER.es.md) |
| Cursor CLI | `cursor-agent --print --prompt` | ❌ | [HARNESS_CURSOR.es.md](./HARNESS_CURSOR.es.md) |

## Elige tu agente por defecto

`vc setup` autodetecta los binarios instalados y te deja elegir. Configuración no interactiva:

```bash
# .env o instance .env
AGENT_BACKEND=claude              # hermes | claude | codex | gemini | opencode | openclaw | aider | cursor | custom
```

Cada harness lee su comando de la env del mismo nombre (`HERMES_COMMAND`, `CLAUDE_COMMAND`, etc.). Las envs compartidas (`AGENT_LABEL`, `AGENT_COMMAND`, `AGENT_SESSION_FILE`, `AGENT_WORKDIR`, `AGENT_PROJECT_CONTEXT`, `AGENT_TASK_TIMEOUT_MS`, `AGENT_CHAT_TIMEOUT_MS`, `AGENT_VERBOSE_PROGRESS`) sobreescriben los valores por defecto de cada harness.

## Enrutamiento entre harnesses por voz

Una vez configurado, puedes alcanzar cualquier harness **instalado** sin reiniciar:

- `"ask Codex what it thinks"` — ruta de un solo turno; el siguiente turno vuelve al predeterminado.
- `"switch to Aider"` — ruta sticky hasta que digas `"back to default"`.
- Slot `which_agent` del modo plan — el propio agente propone qué backend ejecuta el siguiente plan.

La capa de enrutamiento verifica si el binario está en `PATH` (resolviendo rutas relativas contra el workdir de la sesión de proyecto activa). Si no está instalado, el puente pregunta `"¿Quieres que use el agente por defecto?"` — responde `"yes"` para hacer fallback o `"no"` para cancelar.

Alias reconocidos: `claude` / `claude code`, `codex`, `gemini` / `gemini cli`, `opencode`, `openclaw`, `aider`, `cursor` / `cursor cli`, `hermes`.

## Semánticas compartidas

Todo adaptador respeta:

- **Modo plan por voz** — `"plan it first"` narra un plan, edita por voz, `"approve"` ejecuta contra el harness elegido.
- **Barge-in** — el corte interrumpe el TTS actual y aborta la tarea del agente. El enrutamiento sticky sobrevive a interrupciones; solo las rutas de un turno se limpian.
- **Progreso detallado** — `AGENT_VERBOSE_PROGRESS=1` imprime eventos de progreso. Con `SMART_PROGRESS_API_KEY`, un LLM los resume en una frase por lote.
- **Notificación push** — `NOTIFY_PROVIDER=ntfy|pushover` + `NOTIFY_MIN_TASK_MS` envía push cuando una tarea larga termina y el canal de voz está vacío. Debounce por cuerpo + `NOTIFY_DEBOUNCE_MS`.
- **Estado por canal** — cada canal de voz mantiene su propio enrutamiento, estado de plan y buffer de elocuciones recientes.
- **Sesiones de proyecto** — `!session new <name> <workdir>` vincula un canal a un proyecto; los adaptadores (harness, sesión) se cachean y se invalidan al rebind.

Detalles de instalación, autenticación y pitfalls por harness en sus docs respectivos. Referencia completa de env: `docs/CONFIGURATION.es.md`.
