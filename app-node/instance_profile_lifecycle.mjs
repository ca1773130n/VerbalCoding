import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ensureHermesProfile as defaultEnsure } from './hermes_profiles.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function healInstanceProfileFromEnv(name, instanceEnv, deps = {}) {
  if (!instanceEnv || !instanceEnv.HERMES_HOME) return null;
  const ensure = deps.ensureHermesProfile || defaultEnsure;
  return ensure({
    name,
    workdir: instanceEnv.AGENT_CWD || ROOT,
    projectContext: instanceEnv.AGENT_PROJECT_CONTEXT || '',
  });
}
