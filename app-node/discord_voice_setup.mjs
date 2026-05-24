// Discord voice channel join / attach / shutdown machinery.
//
// Phase 5d extraction from main.mjs. createDiscordVoiceSetup(deps) closes
// over the bridge state (connection, player, activeVoiceChannelId,
// currentAbortController, ttsBackend, agentAdaptersBySession) plus the
// Discord client and a handful of helpers, and returns the seven functions
// main.mjs used to own: connectTo, autoJoin, findVoiceChannelBySelector,
// voiceChannelLabel, resolveVoiceChannelForAttach,
// attachVoiceChannelToTextSession, gracefulShutdown.
//
// The shutdown guard (`shutdownStarted`) lives as a closure variable
// inside the factory so SIGTERM/SIGINT handlers in main.mjs see exactly
// one shared flag.

import path from 'node:path';
import fs from 'node:fs';
import {
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  joinVoiceChannel,
} from '@discordjs/voice';
import { pickOccupiedUserVoiceChannel } from './voice_autojoin.mjs';
import { formatRestartShutdownNotice } from './restart_notice.mjs';

export function createDiscordVoiceSetup(deps) {
  const {
    bridge,
    client,
    settings,
    ROOT,
    log,
    warn,
    speakText,
    waitEvent,
    subscribeUser,
    pendingFallbackNoticePromises,
    bindProjectSessionToChannel,
    createProjectSession,
    resolveProjectSessionForChannel,
    saveProjectSessionsState,
    projectSessionsState,
    invalidateBackendAdaptersForSession,
    VOICE_CONNECT_TIMEOUT_MS,
  } = deps;

  async function connectTo(channel) {
    if (bridge.connection) {
      try { bridge.connection.destroy(); } catch {}
    }
    bridge.activeVoiceChannelId = channel.id;
    bridge.connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });
    const voiceConnection = bridge.connection;
    voiceConnection.subscribe(bridge.player);
    voiceConnection.on('error', e => warn('voice connection error', e?.stack || e));
    voiceConnection.on('stateChange', async (oldState, newState) => {
      log('voice connection state', oldState.status, '->', newState.status);
      if (bridge.connection !== voiceConnection) {
        log('ignore stale voice connection state', oldState.status, '->', newState.status);
        return;
      }
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        try {
          await Promise.race([
            entersState(voiceConnection, VoiceConnectionStatus.Signalling, 5000),
            entersState(voiceConnection, VoiceConnectionStatus.Connecting, 5000),
          ]);
        } catch (e) {
          if (bridge.connection !== voiceConnection) return;
          warn('voice connection disconnected; reconnecting to channel', channel.guild.name, channel.name, e?.message || e);
          try { voiceConnection.destroy(); } catch {}
          bridge.connection = null;
          setTimeout(() => connectTo(channel).catch(err => warn('voice reconnect failed', err?.stack || err)), 1500);
        }
      }
    });
    await entersState(voiceConnection, VoiceConnectionStatus.Ready, VOICE_CONNECT_TIMEOUT_MS);
    voiceConnection.receiver.speaking.on('start', userId => subscribeUser(voiceConnection.receiver, userId));
    log(`Listening in voice channel ${channel.guild.name} / ${channel.name}`);
  }

  async function autoJoin() {
    const attempted = [];
    for (const guild of client.guilds.cache.values()) {
      await guild.channels.fetch().catch(e => warn('auto-join channel fetch failed', guild.name, e?.message || e));
    }
    const activeGuildId = bridge.activeVoiceChannelId ? client.channels.cache.get(bridge.activeVoiceChannelId)?.guild?.id || '' : '';
    const occupied = pickOccupiedUserVoiceChannel(client.guilds.cache.values(), settings.allowedUsers, {
      activeVoiceChannelId: bridge.activeVoiceChannelId,
      activeGuildId,
    });
    if (occupied) {
      attempted.push(`${occupied.guild.name}/${occupied.name}`);
      try {
        log('auto-join following occupied user voice channel', occupied.guild.name, occupied.name);
        await connectTo(occupied);
        return;
      } catch (e) {
        warn('auto-join occupied user voice channel failed; trying configured channels', occupied.guild.name, occupied.name, e?.stack || e);
        try { bridge.connection?.destroy(); } catch {}
        bridge.connection = null;
        bridge.activeVoiceChannelId = '';
      }
    }
    for (const preferredName of settings.autoJoinVoiceChannels) {
      for (const guild of client.guilds.cache.values()) {
        const channels = await guild.channels.fetch();
        for (const ch of channels.values()) {
          if (!ch?.isVoiceBased?.() || ch.name.toLowerCase() !== preferredName) continue;
          attempted.push(`${guild.name}/${ch.name}`);
          try {
            await connectTo(ch);
            return;
          } catch (e) {
            warn('auto-join failed; trying next configured voice channel', guild.name, ch.name, e?.stack || e);
            try { bridge.connection?.destroy(); } catch {}
            bridge.connection = null;
            bridge.activeVoiceChannelId = '';
          }
        }
      }
    }
    warn('No auto-join channel found or reachable', settings.autoJoinVoiceChannels, 'attempted', attempted);
  }

  async function findVoiceChannelBySelector(guild, selector) {
    const wanted = String(selector || '').trim();
    if (!wanted || !guild) return null;
    const id = wanted.replace(/^<#(\d+)>$/, '$1');
    const channels = await guild.channels.fetch();
    const voiceChannels = [...channels.values()].filter(ch => ch?.isVoiceBased?.());
    const byId = voiceChannels.find(ch => ch.id === id);
    if (byId) return byId;
    const matches = voiceChannels.filter(ch => String(ch.name || '').toLowerCase() === wanted.toLowerCase());
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) throw new Error(`같은 이름의 음성 채널이 여러 개야. 채널 ID나 멘션으로 지정해줘: ${wanted}`);
    throw new Error(`음성 채널을 찾지 못했어: ${wanted}`);
  }

  async function voiceChannelLabel(guild, channelId) {
    if (!channelId || !guild) return '없음';
    try {
      const ch = await guild.channels.fetch(channelId);
      return ch?.name || '지정됨';
    } catch {
      return '지정됨';
    }
  }

  async function resolveVoiceChannelForAttach(msg, selector = '') {
    if (selector) return findVoiceChannelBySelector(msg.guild, selector);
    if (msg.member?.voice?.channel) return msg.member.voice.channel;
    if (bridge.activeVoiceChannelId && msg.guild) {
      try {
        const ch = await msg.guild.channels.fetch(bridge.activeVoiceChannelId);
        if (ch?.isVoiceBased?.()) return ch;
      } catch {}
    }
    throw new Error('붙일 음성 채널을 못 찾았어. 음성채널에 들어가서 `!session attach-voice`를 치거나 `--voice "채널명"`을 붙여줘.');
  }

  async function attachVoiceChannelToTextSession(msg, command) {
    const voiceChannel = await resolveVoiceChannelForAttach(msg, command.voice);
    let session = null;
    if (command.name) {
      session = bindProjectSessionToChannel({ state: projectSessionsState, nameOrSlug: command.name, channelId: msg.channelId });
    } else {
      session = resolveProjectSessionForChannel(msg.channelId)
        || resolveProjectSessionForChannel(voiceChannel.id);
      if (!session) {
        const fallbackName = String(msg.channel?.name || `channel-${msg.channelId}`).trim() || `channel-${msg.channelId}`;
        session = createProjectSession({
          root: ROOT,
          state: projectSessionsState,
          name: fallbackName,
          workdir: settings.agent.cwd || ROOT,
          channelId: msg.channelId,
          voiceChannelId: voiceChannel.id,
          transcriptChannelId: msg.channelId,
          mcpContext: 'Ad-hoc Discord text channel session',
        });
      }
    }
    session.transcriptChannelId = msg.channelId;
    session.voiceChannelId = voiceChannel.id;
    projectSessionsState.channelSessions[msg.channelId] = session.slug;
    projectSessionsState.channelSessions[voiceChannel.id] = session.slug;
    saveProjectSessionsState();
    bridge.agentAdaptersBySession.delete(session.slug);
    invalidateBackendAdaptersForSession(session.slug);
    if (bridge.activeVoiceChannelId !== voiceChannel.id) await connectTo(voiceChannel);
    return msg.reply(`${session.name} 세션을 이 텍스트 채널과 음성 채널 ${voiceChannel.name}에 붙였어. 이제 그 음성채널 발화의 STT/답변 텍스트는 이 채널로 가.`);
  }

  let shutdownStarted = false;
  async function gracefulShutdown(signalName) {
    if (shutdownStarted) return;
    shutdownStarted = true;
    log('graceful shutdown requested', signalName, 'connection', Boolean(bridge.connection));
    try {
      if (bridge.currentAbortController && !bridge.currentAbortController.signal.aborted) bridge.currentAbortController.abort();
    } catch (e) {
      warn('abort before shutdown failed', e?.stack || e);
    }
    try {
      if (bridge.connection) {
        let detail = '';
        const noticePath = path.join(ROOT, '.cache', 'restart-notice.txt');
        try {
          if (fs.existsSync(noticePath)) {
            detail = fs.readFileSync(noticePath, 'utf8').replace(/\s+/g, ' ').trim().slice(0, 120);
          }
        } catch (e) {
          warn('read restart notice failed', e?.stack || e);
        }
        await speakText(formatRestartShutdownNotice(detail, settings.tts.edge.voice));
        await waitEvent(bridge.player, AudioPlayerStatus.Idle, 30000).catch(() => {});
      }
    } catch (e) {
      warn('shutdown voice notice failed', e?.stack || e);
    }
    if (pendingFallbackNoticePromises.size) {
      try {
        await Promise.race([
          Promise.allSettled(Array.from(pendingFallbackNoticePromises)),
          new Promise(resolve => setTimeout(resolve, 3000)),
        ]);
      } catch {}
    }
    try { bridge.ttsBackend?.close?.(); } catch (e) { warn('tts backend close failed', e?.message || e); }
    try { bridge.connection?.destroy(); } catch {}
    try { client.destroy(); } catch {}
    process.exit(0);
  }

  return {
    connectTo,
    autoJoin,
    findVoiceChannelBySelector,
    voiceChannelLabel,
    resolveVoiceChannelForAttach,
    attachVoiceChannelToTextSession,
    gracefulShutdown,
  };
}
