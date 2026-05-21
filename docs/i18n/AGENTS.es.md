# Guía del repositorio (español)

> Este fichero es un resumen en español de [`AGENTS.md`](../../AGENTS.md). Las reglas formales viven en el inglés original.

VerbalCoding es un puente de voz Discord para agentes de codificación. El runtime es la implementación Node en `app-node/`, lanzada vía `run.sh` o el CLI `vc`.

## Desarrollo

- En docs y ejemplos prefiere `vc ...` sobre `npm run vc -- ...`.
- Los secretos locales viven en `.env` o `instances/*.env`; nunca commits con tokens Discord, IDs de canal, ficheros de sesión, muestras de voz, pesos de modelo, virtualenvs, logs ni cachés.
- Edita ficheros fuente, no artefactos generados.
- Ejemplos públicos: usa placeholders para rutas locales, IDs de usuario, IDs Discord y tokens.

## Verificación

Antes de marcar un cambio como completo, ejecuta:

```bash
npm test
```

## Layout de módulos

Detalle en [`AGENTS.md`](../../AGENTS.md). Módulos clave:

- `main.mjs` — dispatcher Discord / voz / agente
- `agent_routing.mjs` — enrutamiento entre agentes por voz
- `plan_mode.mjs` — modo plan por voz (slot `which_agent`)
- `session_ontology.mjs` — grafo tipado por canal (handoff)
- `research_mode.mjs` — comando `"research X"`

## Bloque gestionado

HarnessSync sincroniza las reglas de `CLAUDE.md` dentro de `AGENTS.md`. No edites manualmente ese bloque.
