# vc Multi-Hermes-Profile Isolation — Design Spec

Date: 2026-05-03
Status: Approved by user, Codex-reviewed

## Goal

Each VerbalCoding instance (one Discord bot per project) should run against its own isolated Hermes home so that memory, MEMORY.md, SOUL.md, learned skills, and gateway config do not bleed across projects. Today every instance shares the user's default `~/.hermes`; only Discord tokens, sessions, channels, and `HERMES_SESSION_FILE` are isolated. This spec closes that gap with the smallest possible surface change.

## Non-goals

- A separate `vc hermes` command group. Profile lifecycle is auto on instance setup.
- Per-instance Hermes gateway processes. vc is the gateway; Hermes is invoked as a subprocess.
- Migrating sessions/memory between profiles.
- Cross-host profile sync.

## Locked decisions

1. **Auto-create on setup** — `vc instance setup <name>` materializes a Hermes profile if missing. No new top-level command group.
2. **Clone from default** — Profile is created via `hermes profile create <name> --clone` so API keys, model selection, and SOUL.md from the user's current `~/.hermes` carry over. Sessions, memory, and skills start fresh per project.
3. **1:1 name binding** — vc instance name == Hermes profile name. Reuse silently if the profile already exists, **except** when `terminal.cwd` conflicts (see §Conflict handling).
4. **Auto-set `terminal.cwd`** — Wizard runs `hermes config set terminal.cwd <AGENT_CWD>` against the new profile, so agent tool calls land in the right project.
5. **Seed SOUL.md from project context** — Wizard writes `<profile>/SOUL.md` from the wizard's `AGENT_PROJECT_CONTEXT` answer if the file does not exist.
6. **Migrate on re-setup** — Re-running `vc instance setup <existing>` against an instance that has no `HERMES_HOME` migrates it: creates the profile, re-renders the env file.
7. **Idempotent `ensureHermesProfile()` helper** called from BOTH `vc instance setup` AND `vc instance start` so manually-edited env files self-heal at start time.
8. **`HERMES_HOME` only** — One new env key in the instance env file. No `HERMES_PROFILE` alias (would create two sources of truth and require precedence rules).
9. **Strict name validation** — Profile names must match `^[a-z0-9][a-z0-9_-]{0,63}$`. vc's existing `slugifyInstanceName()` allows dots/Unicode and must be tightened for instance names that flow into Hermes.

## Architecture

### New module: `app-node/hermes_profiles.mjs`

Pure helpers, no CLI parsing, deps-injectable for testing. **Implementation MUST use `child_process.execFile` (or `execFileSync`), never `exec`/shell strings**, since the inputs include user-controlled names and paths.

Public API:

```js
hermesProfilesRoot({ homedir, env })  // -> "<home>/.hermes/profiles"
hermesProfileDir(name, deps)          // -> "<root>/<name>"
profileExists(name, deps)             // -> bool, keyed on <dir>/config.yaml
assertHermesAvailable(deps)           // throws friendly error if `hermes` not on PATH
ensureHermesProfile({
  name,
  workdir,
  projectContext,
  cloneFrom = 'default',
  deps = { execFile, fs, homedir, env, now },
}) // -> { created, dir, name, configPath, updatedConfig, warnings }
```

`ensureHermesProfile` semantics:

1. Validate `name` against `^[a-z0-9][a-z0-9_-]{0,63}$`. Throw `InvalidProfileName` if not.
2. Acquire exclusive lock at `<root>/.locks/<name>.lock` using `fs.openSync(..., 'wx')`. If locked, wait up to 10s for the lock holder, then retry `profileExists`. Release in `finally`.
3. If `profileExists(name)`:
   - Read existing `<dir>/config.yaml` → check `terminal.cwd`.
   - If matches `workdir`: return `{ created: false, dir, ... }`.
   - If conflicts: throw `ProfileBoundElsewhere` with message `"profile <name> already binds terminal.cwd to <other>; pass --rebind to overwrite or pick a different instance name"`.
4. Else create:
   - `assertHermesAvailable()`.
   - Spawn via `execFile`: `["hermes", ["profile", "create", name, "--clone-from", cloneFrom]]`. If `cloneFrom='default'` and that fails, retry with `["hermes", ["profile", "create", name]]` and append a warning to the result.
   - Spawn via `execFile`: `["hermes", ["config", "set", "terminal.cwd", workdir]]` with `env: { ...process.env, HERMES_HOME: dir }`.
   - If `<dir>/SOUL.md` missing and `projectContext` non-empty, `fs.writeFileSync(<dir>/SOUL.md, projectContext)`.
   - Return `{ created: true, dir, name, configPath: <dir>/config.yaml, updatedConfig: true, warnings }`.

### Env file change

`instances/<name>.env` gains exactly one new line, rendered by `app-node/install_config.mjs`:

```
HERMES_HOME="/Users/<user>/.hermes/profiles/<name>"
```

`HERMES_COMMAND` stays unchanged (`hermes chat -Q -q`). Profile selection is purely env-driven.

### Wizard flow change (`scripts/cli.mjs::handleInstanceSetup`)

1. Collect existing wizard answers (no new prompts).
2. Validate `instanceName` against the strict regex; if it fails, ask the user to enter a different name (do not silently slugify into something the user did not type).
3. Call `ensureHermesProfile({ name, workdir, projectContext })`.
4. On `ProfileBoundElsewhere`: print error, abort wizard with non-zero exit before touching the instance env.
5. Pass the resolved `HERMES_HOME` into `normalizeInstanceAnswers` so `buildInstanceEnvFile` renders it.
6. Print `Hermes profile: <name> at <dir> (created|reused)` in the setup summary.

### Start path self-heal (`scripts/cli.mjs::handleInstanceStart`)

Before the existing `assertInstanceStartIsSafe()` + `startInstance()` calls:

1. Read `instances/<name>.env`. If `HERMES_HOME` is set:
   - Resolve `<name>` from path basename.
   - Call `ensureHermesProfile({ name, workdir: env.AGENT_CWD || ROOT, projectContext: env.AGENT_PROJECT_CONTEXT })`.
   - On any thrown error, abort start with the error message; do not launch the bridge against a half-broken profile.

### Runtime injection

#### Node adapter (`app-node/agent_adapters.mjs`)

The Hermes adapter's child-process spawn currently inherits `process.env`. After this change:

- The adapter merges `HERMES_HOME` from the instance env into the spawn env map (it already does this implicitly via `process.env`, but the merge must be explicit so that `instances.mjs` can pass an instance-specific override even when the parent process's `HERMES_HOME` differs).
- `agent_adapters.mjs:201` `command: env.HERMES_COMMAND || 'hermes chat -Q -q'` is unchanged.

#### Python adapter (`app/hermes.py`)

`HermesClient.ask` already does `env = os.environ.copy()` before `asyncio.create_subprocess_exec`. Since `run.sh` exports `HERMES_HOME` from the instance env into the process environment, no Python code change is required.

### Launcher (`run.sh`)

`run.sh` sources the instance env file when `VERBALCODING_INSTANCE_ENV` is set. It must not let the shared `.env` clobber the instance's `HERMES_HOME`. The current launcher already prefers instance env over shared env (per the existing comment in `app-node/main.mjs::loadRuntimeEnv`); we extend the same precedence to the shell layer if not already present.

### Doctor (`app-node/instance_doctor.mjs`)

Add two checks to `checkInstanceConfigs`:

- **Warning** (not error): `HERMES_HOME` set in instance env, but profile dir absent. Message: `"<name>: HERMES_HOME points at <dir> which is missing; vc instance start will create it"`.
- **Error**: `HERMES_HOME` set, profile dir present, but `<dir>/config.yaml::terminal.cwd` differs from instance's `AGENT_CWD`. Message: `"<name>: profile terminal.cwd (<a>) does not match instance AGENT_CWD (<b>); re-run vc instance setup to reconcile"`.

Add a helper `effectiveHermesHome(root, instance)` that resolves `HERMES_HOME` with the same fallback shape as the existing `effectiveInstanceValue` function.

## Conflict handling

There are two kinds of conflict:

- **Profile/cwd conflict** — handled at setup time (abort with clear error) and reported by doctor for already-deployed instances.
- **Concurrent ensure** — handled by an exclusive lock file at `<profiles-root>/.locks/<name>.lock` taken via `fs.openSync(..., 'wx')`. Loser waits up to 10s polling for the lock to disappear, then re-runs `profileExists`. Treat "lock present after timeout" as an error rather than forcing.

## Failure modes

| Failure | Where | Behavior |
|---|---|---|
| `hermes` CLI missing | `assertHermesAvailable` | Throw `HermesCliMissing` with install hint, abort setup. |
| Profile already exists, cwd matches | `ensureHermesProfile` | Reuse silently, return `{ created: false }`. |
| Profile already exists, cwd differs | `ensureHermesProfile` | Throw `ProfileBoundElsewhere`, abort. |
| `--clone-from default` fails (no default profile) | `ensureHermesProfile` | Retry `hermes profile create <name>` (no clone), attach warning. |
| `hermes config set` fails | `ensureHermesProfile` | Throw `ProfileConfigFailed` with stderr; abort. Do not leave a half-written env file. |
| Concurrent setup of same name | Lock file | Loser waits, then no-ops on `profileExists`. |
| Invalid profile name | `ensureHermesProfile` | Throw `InvalidProfileName` with the exact regex. |

## Testing

### Unit (`app-node/hermes_profiles.test.mjs`, new)

- Profile name validation accepts `acme`, `llm-wiki`, `verbalcoding`; rejects `Acme`, `llm.wiki`, `한글`, empty string, `_leading`, names > 64 chars.
- `ensureHermesProfile` with mocked `execFile` and `fs`:
  - Creates when missing: spawns `hermes profile create <name> --clone-from default`, then `hermes config set terminal.cwd <workdir>`, writes SOUL.md.
  - Reuses when present and cwd matches.
  - Throws `ProfileBoundElsewhere` when cwd differs.
  - Falls back to plain `create` when `--clone-from` fails, returns warning.
  - Lock file present and stale → waits then retries.

### Integration (`app-node/install_config.test.mjs`, extended)

- `buildInstanceEnvFile` renders `HERMES_HOME` line.
- `normalizeInstanceAnswers` includes a derived `HERMES_HOME` in its output.

### Doctor (`app-node/instance_doctor.test.mjs`, extended)

- Warn when `HERMES_HOME` set but dir missing.
- Error when `HERMES_HOME` set, dir present, `terminal.cwd` mismatch.

### CLI smoke (`app-node/cli_install.test.mjs`, extended)

- `vc instance setup` calls `ensureHermesProfile` with the right args (mocked).
- `vc instance start` self-heals when env points at a missing profile dir.

## Files touched

**New:**
- `app-node/hermes_profiles.mjs`
- `app-node/hermes_profiles.test.mjs`

**Edit:**
- `app-node/install_config.mjs` — render `HERMES_HOME`, expose `normalizeInstanceAnswers` shape
- `app-node/install_config.test.mjs` — assert new env line
- `app-node/instances.mjs` — pass `HERMES_HOME` through to `startInstance` env if needed
- `app-node/instance_doctor.mjs` — two new checks
- `app-node/instance_doctor.test.mjs` — assertions for those checks
- `app-node/agent_adapters.mjs` — explicit `HERMES_HOME` in spawn env merge
- `app-node/cli_install.test.mjs` — wizard + start integration assertions
- `scripts/cli.mjs` — call `ensureHermesProfile` from `handleInstanceSetup` and `handleInstanceStart`; tighten name regex
- `scripts/doctor.mjs` — surface profile presence in doctor output
- `run.sh` — preserve launcher-provided `HERMES_HOME` over shared `.env`
- `docs/MULTI_INSTANCE.md` — document the new profile auto-creation
- `instances/README.md` — note `HERMES_HOME` in the isolated-values list
- `README.md` — add a sentence to the multi-instance section

**No change:**
- `app/hermes.py` — already propagates env via `os.environ.copy()`
- `app/agent.py` — Python adapter still wired but unaffected

## Open questions resolved

- `HERMES_HOME`-only env key. ✓ (Codex confirmed adding `HERMES_PROFILE` creates a second source of truth.)
- `--clone` semantics: confirmed via Codex review of Hermes source — copies `config.yaml`, `.env`, `SOUL.md`, `skills/`, `memories/MEMORY.md`, `memories/USER.md`. `--clone-all` copies full state minus runtime files. We use `--clone-from default` (not `--clone-all`) so sessions/memories start fresh per the user's choice.
