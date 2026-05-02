export const AGENT_ADAPTER_CONTRACT_VERSION = 1;

export function agentAdapterCapabilities(settings = {}) {
  const backend = settings.backend || 'custom';
  return {
    contractVersion: AGENT_ADAPTER_CONTRACT_VERSION,
    backend,
    label: settings.label || backend,
    supportsSessionResume: Boolean(settings.supportsHermesSession),
    supportsStreamingProgress: true,
    supportsCancellation: true,
    returnsFinalText: true,
  };
}

export function createAgentRunResult({
  status = 'ok',
  answer = '',
  backend = 'custom',
  label = 'Agent',
  elapsedMs = 0,
  sessionId = null,
  recoveredFromSession = false,
  error = null,
} = {}) {
  return {
    contractVersion: AGENT_ADAPTER_CONTRACT_VERSION,
    status,
    answer: String(answer || ''),
    backend,
    label,
    elapsedMs,
    sessionId,
    recoveredFromSession,
    error,
  };
}

export function assertAgentAdapterContract(adapter) {
  const missing = ['backend', 'label', 'capabilities', 'run', 'ask', 'buildArgs'].filter(key => !(key in (adapter || {})));
  if (missing.length) throw new Error(`Agent adapter contract missing: ${missing.join(', ')}`);
  if (typeof adapter.run !== 'function') throw new Error('Agent adapter contract requires run(request, signal, plan)');
  if (typeof adapter.ask !== 'function') throw new Error('Agent adapter contract requires ask(text, signal, plan)');
  return true;
}
