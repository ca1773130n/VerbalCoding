// Discord text-channel command dispatcher. Replaces the big inline
// `client.on('messageCreate', ...)` body that used to live in main.mjs.
//
// Phase 6b extraction. The dispatcher is a single async function that
// recognises the `!`-prefixed control commands (ping, verbose, notify,
// smart-progress, sensitivity, session, latency, join/leave, say,
// voice-test, voice-clone, ask) and falls through to either the
// project-session router or the agent-text path.
//
// Commands are expressed as a small ordered table; adding a new command
// is a table edit, not a new `if` branch in main.mjs.

import { appendRecentDiscordText, shouldRouteDiscordTextToAgent } from './text_routing.mjs';
import { parseProjectSessionCommand } from './project_sessions.mjs';

export function createDiscordCommandRouter(deps) {
  const {
    bridge,
    settings,
    warn,
    path,
    ROOT,
    isAllowed,
    handleProjectSessionCommand,
    handleTextAgentMessage,
    resolveProjectSessionForChannel,
    // Status & toggles
    verboseStatusText,
    setVerboseProgress,
    notifyStatusText,
    smartProgressStatusText,
    sensitivityStatusText,
    setSensitivityMode,
    // Latency metrics
    summarizeLatencyRecords,
    readJsonlRecords,
    formatLatencySummary,
    // Voice channel control
    connectTo,
    // TTS / audio helpers
    synthTTS,
    playAudio,
    speakText,
    // Voice clone capture state
    voiceCloneCapture,
  } = deps;

  // Build the command table once. Entries are matched in order; the first
  // matching entry consumes the message. Each `match` is either a string,
  // an array of strings (case-insensitive), or a function (content => bool).
  // Each handler is `async (msg, content) => void`.
  const commands = [
    { match: '!ping', handler: async msg => { await msg.reply('pong'); } },

    { match: '!verbose', handler: async msg => { await msg.reply(verboseStatusText()); } },
    { match: ['!verbose on', '!verbose true', '!verbose 1', '!verbose 켜', '!verbose 켜줘'],
      handler: async msg => { setVerboseProgress(true, 'discord-command'); await msg.reply(verboseStatusText()); } },
    { match: ['!verbose off', '!verbose false', '!verbose 0', '!verbose 꺼', '!verbose 꺼줘'],
      handler: async msg => { setVerboseProgress(false, 'discord-command'); await msg.reply(verboseStatusText()); } },

    { match: '!notify', handler: async msg => { await msg.reply(notifyStatusText()); } },
    { match: ['!notify on', '!notify always', '!notify 1'],
      handler: async msg => { bridge.notifyUserOptIn = true; await msg.reply(notifyStatusText()); } },
    { match: ['!notify off', '!notify auto', '!notify 0'],
      handler: async msg => { bridge.notifyUserOptIn = false; await msg.reply(notifyStatusText()); } },

    { match: c => c === '!smart-progress' || c === '!smart_progress',
      handler: async msg => { await msg.reply(smartProgressStatusText()); } },
    { match: ['!smart-progress on', '!smart-progress true', '!smart-progress 1', '!smart_progress on'],
      handler: async msg => { bridge.smartProgressEnabled = true; await msg.reply(smartProgressStatusText()); } },
    { match: ['!smart-progress off', '!smart-progress false', '!smart-progress 0', '!smart_progress off'],
      handler: async msg => { bridge.smartProgressEnabled = false; await msg.reply(smartProgressStatusText()); } },

    { match: '!sensitivity', handler: async msg => { await msg.reply(sensitivityStatusText()); } },
    { match: '!sensitivity conservative',
      handler: async msg => { setSensitivityMode('conservative', 'discord-command'); await msg.reply(sensitivityStatusText()); } },
    { match: '!sensitivity normal',
      handler: async msg => { setSensitivityMode('normal', 'discord-command'); await msg.reply(sensitivityStatusText()); } },

    { match: c => c === '!latency' || c === '!metrics',
      handler: async msg => {
        const summary = summarizeLatencyRecords(readJsonlRecords(settings.latencyLogPath, { limit: 200 }));
        await msg.reply(`최근 latency 요약 (${settings.latencyLogPath}):\n${formatLatencySummary(summary)}`.slice(0, 1900));
      } },

    { match: '!session', handler: async msg => { await handleProjectSessionCommand(msg, { action: 'status' }); } },
    { match: '!reset-session', handler: async msg => { await handleProjectSessionCommand(msg, { action: 'reset' }); } },

    { match: '!join',
      handler: async msg => {
        const ch = msg.member?.voice?.channel;
        if (!ch) { await msg.reply('먼저 음성 채널에 들어가줘.'); return; }
        await connectTo(ch);
        await msg.reply('들어왔어. Node receiver로 듣는 중.');
      } },
    { match: '!leave',
      handler: async msg => {
        try { bridge.connection?.destroy(); } catch {}
        bridge.connection = null;
        bridge.activeVoiceChannelId = '';
        await msg.reply('나갈게.');
      } },

    { match: c => c.startsWith('!say '),
      handler: async (_msg, content) => {
        const text = content.slice(5).trim();
        const mp3 = await synthTTS(text);
        await playAudio(mp3);
      } },

    { match: c => c.startsWith('!voice-test '),
      handler: async (msg, content) => {
        const text = content.slice('!voice-test '.length).trim();
        if (!text) { await msg.reply('테스트할 문장을 붙여줘.'); return; }
        const started = Date.now();
        try {
          await msg.reply(`TTS 백엔드 ${bridge.ttsBackend.name}로 음성 테스트할게.`);
          await speakText(text);
          await msg.channel.send(`음성 테스트 완료: ${bridge.ttsBackend.name}, ${Date.now() - started}ms`);
        } catch (e) {
          warn('voice-test failed', e?.stack || e);
          await msg.channel.send(`음성 테스트 실패: ${String(e?.message || e).slice(0, 700)}`);
        }
      } },

    { match: c => c === '!voice-clone' || c === '!voice-clone status',
      handler: async msg => {
        const current = voiceCloneCapture.current();
        if (current?.userId === String(msg.author.id)) {
          await msg.reply(`다음 유효한 음성을 ${path.relative(ROOT, current.targetPath)}에 저장할게.`);
          return;
        }
        await msg.reply('대기 중인 보이스 클로닝 샘플 캡처가 없어. `!voice-clone capture`로 시작해.');
      } },
    { match: '!voice-clone cancel',
      handler: async msg => {
        const cancelled = voiceCloneCapture.cancel(msg.author.id);
        await msg.reply(cancelled ? '보이스 클로닝 샘플 캡처를 취소했어.' : '대기 중인 캡처가 없어.');
      } },
    { match: '!voice-clone capture',
      handler: async msg => {
        const armed = voiceCloneCapture.arm({ userId: msg.author.id, source: 'discord-command' });
        await msg.reply(`다음 유효한 음성을 ${path.relative(ROOT, armed.targetPath)}에 저장할게. 음성 채널에서 10~30초 정도 말해줘.`);
      } },

    { match: c => c.startsWith('!ask '),
      handler: async (msg, content) => {
        const text = content.slice(5).trim();
        if (!text) { await msg.reply('물어볼 내용을 붙여줘.'); return; }
        await handleTextAgentMessage(msg, text, { speakResponse: true });
      } },
  ];

  function matches(rule, lowered, raw) {
    if (typeof rule === 'string') return raw === rule;
    if (Array.isArray(rule)) return rule.includes(lowered);
    if (typeof rule === 'function') return rule(raw);
    return false;
  }

  async function handleDiscordMessage(msg) {
    const content = msg.content.trim();
    if (msg.author.bot && !content.startsWith('!say ')) return;
    if (!msg.author.bot && !isAllowed(msg.author.id)) return;
    appendRecentDiscordText(bridge.recentDiscordTextByChannel, {
      channelId: msg.channelId,
      authorLabel: msg.member?.displayName || msg.author?.username || 'user',
      content,
      messageId: msg.id,
    });

    // Project-session commands (e.g. !session attach-voice ...) take priority.
    const projectSessionCommand = parseProjectSessionCommand(content);
    if (projectSessionCommand) {
      try {
        await handleProjectSessionCommand(msg, projectSessionCommand);
      } catch (e) {
        warn('project session command failed', e?.stack || e);
        await msg.reply(String(e?.message || e).slice(0, 700));
      }
      return;
    }

    const lowered = content.toLowerCase();
    for (const cmd of commands) {
      if (matches(cmd.match, lowered, content)) {
        await cmd.handler(msg, content);
        return;
      }
    }

    // Fallback: route to the agent if the heuristic says so OR if the
    // channel is bound to a project session.
    if (shouldRouteDiscordTextToAgent({
      content,
      channelId: msg.channelId,
      transcriptChannelId: settings.transcriptChannelId,
    }) || resolveProjectSessionForChannel(msg.channelId)) {
      await handleTextAgentMessage(msg, content, { speakResponse: false });
    }
  }

  return { handleDiscordMessage };
}
