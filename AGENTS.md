# Repository Guidelines

VerbalCoding is a Discord voice bridge for coding agents. The active runtime is the Node implementation under `app-node/`, launched through `run.sh` or the `vc` CLI.

## Development

- Prefer user-facing `vc ...` commands over `npm run vc -- ...` in docs and examples.
- Keep local secrets in `.env` or `instances/*.env`; do not commit real Discord tokens, channel IDs, session files, voice samples, model weights, virtualenvs, logs, or cache output.
- Update source files rather than generated/runtime artifacts.
- Keep examples public-safe: use placeholders for local paths, user IDs, Discord IDs, and tokens.

## Verification

Run the Node test suite before reporting code changes as complete:

```bash
npm test
```
