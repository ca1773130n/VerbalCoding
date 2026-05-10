# Voz integrada de Hermes vs VerbalCoding

<!-- readme-glow-up:intro -->
<p align="center">
  <a href="../../README.es.md">README</a> ·
  <a href="README.es.md">Centro de docs</a> ·
  <a href="USAGE.es.md">Uso</a> ·
  <a href="CONFIGURATION.es.md">Configuración</a> ·
  <a href="TROUBLESHOOTING.es.md">Solución de problemas</a>
</p>

> Hermes ya soporta canales de voz de Discord. VerbalCoding no reemplaza ese bucle básico: añade una capa de flujo de trabajo para usar agentes de programación como si fueran una llamada.
<!-- /readme-glow-up:intro -->

## Lo que Hermes ya hace

El gateway de Discord de Hermes Agent incluye soporte para canales de voz. Cuando el bot está en tu servidor, `/voice join` o `/voice channel` lo une al VC donde estás. Después puede transcribir con Whisper/STT y responder con TTS mediante Edge TTS, ElevenLabs, OpenAI u otros proveedores configurados.

Para una conversación de voz básica, esto ya basta:

```text
Discord VC → Hermes STT → Hermes agent → TTS → Discord VC playback
```

## Lo que añade VerbalCoding

| Área | Voz integrada de Hermes | VerbalCoding |
|---|---|---|
| Objetivo | Conversación general con Hermes en un VC | Flujo de trabajo tipo llamada para agentes CLI de programación |
| Comandos | `/voice join`, `/voice channel`, `/voice leave`, `/voice tts` | `vc setup`, `vc start`, `!join`, `!ask`, `!session`, `!verbose`, `!latency`, comandos multiinstancia |
| Backend | Hermes Agent | Hermes Agent, Claude Code, Codex, Gemini CLI, OpenCode, OpenClaw o comando personalizado |
| Sesiones | Sesión normal del gateway Hermes | Ruteo por proyecto/sesión, vínculos de canal de voz y contexto compartido voz + `!ask` cuando el backend lo soporta |
| UX de voz | STT + TTS básico | Ventanas de habla ajustadas, presets de idioma, limpieza de transcripción, espejo de texto y pruebas de voz |
| Interrupción | Comportamiento básico de reproducción | Reglas de barge-in que paran la reproducción sin matar por accidente una tarea activa del agente |
| Tareas largas | Respuesta genérica del agente | Avisos de progreso/estado, resúmenes verbose de herramientas y supresión de diffs/logs en TTS |
| Operación | Configuración del gateway Hermes | `vc doctor`, diagnósticos redactados, métricas de latencia, guía Docker UDP y salas/procesos por proyecto |

## Cuándo elegir cada uno

Usa **Hermes integrado** si solo necesitas hablar, transcribir, responder y escuchar en un canal de voz.

Usa **VerbalCoding** si necesitas contexto de proyecto compartido entre voz y texto, varios backends CLI, presets coreano/inglés, interrupciones seguras durante tareas largas, progreso hablado, métricas de latencia y herramientas operativas.

## Posicionamiento honesto

VerbalCoding no debería describirse como “añadir voz de Discord a Hermes desde cero”. Hermes ya tiene esa base. Mejor: VerbalCoding es una capa de workflow de voz en Discord para agentes CLI de programación; puede usar Hermes como backend por defecto y añade ruteo de proyecto, semántica de interrupción, UX de progreso, diagnósticos y cambio de backend.
