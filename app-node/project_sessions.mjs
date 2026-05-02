import fs from 'node:fs';
import path from 'node:path';

export function slugifySessionName(name) {
  const slug = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_.-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || 'default';
}

export function loadProjectSessions(configPath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return {
      version: 1,
      sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {},
      channelSessions: parsed.channelSessions && typeof parsed.channelSessions === 'object' ? parsed.channelSessions : {},
    };
  } catch {
    return { version: 1, sessions: {}, channelSessions: {} };
  }
}

export function saveProjectSessions(configPath, state) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify({
    version: 1,
    sessions: state.sessions || {},
    channelSessions: state.channelSessions || {},
  }, null, 2)}\n`, { mode: 0o600 });
}

export function createProjectSession({ root, state, name, workdir, channelId, transcriptChannelId = '', mcpContext = '' }) {
  const sessionName = String(name || '').trim();
  if (!sessionName) throw new Error('session name is required');
  const slug = slugifySessionName(sessionName);
  const resolvedWorkdir = path.resolve(String(workdir || root));
  const session = {
    name: sessionName,
    slug,
    workdir: resolvedWorkdir,
    sessionFile: path.join(root, '.agent-sessions', 'hermes', `${slug}.session`),
    transcriptChannelId: String(transcriptChannelId || channelId || '').trim(),
    mcpContext: String(mcpContext || '').trim(),
    createdAt: new Date().toISOString(),
  };
  state.sessions[slug] = session;
  if (channelId) state.channelSessions[String(channelId)] = slug;
  return session;
}

export function bindProjectSessionToChannel({ state, nameOrSlug, channelId }) {
  const slug = findProjectSessionSlug(state, nameOrSlug);
  if (!slug) throw new Error(`unknown project session: ${nameOrSlug}`);
  state.channelSessions[String(channelId)] = slug;
  return state.sessions[slug];
}

export function findProjectSessionSlug(state, nameOrSlug) {
  const key = slugifySessionName(nameOrSlug);
  if (state.sessions[key]) return key;
  const wanted = String(nameOrSlug || '').trim().toLowerCase();
  return Object.entries(state.sessions || {}).find(([, session]) => String(session.name || '').toLowerCase() === wanted)?.[0] || null;
}

export function projectSessionForChannel(state, channelId) {
  const slug = state.channelSessions?.[String(channelId || '')];
  return slug ? state.sessions?.[slug] || null : null;
}

export function listProjectSessions(state) {
  return Object.values(state.sessions || {}).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export function projectSessionContextText(session) {
  if (!session) return '';
  const parts = [`Project session: ${session.name}`, `Working directory: ${session.workdir}`];
  if (session.mcpContext) parts.push(`MCP/project context: ${session.mcpContext}`);
  return parts.join('\n');
}

export function parseProjectSessionCommand(content) {
  const text = String(content || '').trim();
  const match = /^!(?:project-session|session)\s+(new|create|use|bind|status|list|reset)\b\s*(.*)$/i.exec(text);
  if (!match) return null;
  const action = match[1].toLowerCase();
  const rest = match[2].trim();
  if (action === 'status' || action === 'list' || action === 'reset') return { action, rest };
  if (action === 'use' || action === 'bind') return { action: 'use', name: rest };
  const parts = rest.match(/(?:"([^"]+)"|'([^']+)'|(\S+))/g)?.map(part => part.replace(/^['"]|['"]$/g, '')) || [];
  return {
    action: 'new',
    name: parts[0] || '',
    workdir: parts[1] || '',
    mcpContext: parts.slice(2).join(' '),
  };
}
