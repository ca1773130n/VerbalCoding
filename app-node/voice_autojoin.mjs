export function isHumanAllowed(member, allowedUsers = new Set()) {
  const userId = String(member?.user?.id || member?.id || '');
  if (!userId || member?.user?.bot) return false;
  return allowedUsers.size === 0 || allowedUsers.has(userId);
}

export function pickOccupiedUserVoiceChannel(guilds = [], allowedUsers = new Set(), { activeVoiceChannelId = '', activeGuildId = '' } = {}) {
  const candidates = [];
  const guildList = [...(guilds || [])];
  for (const guild of guildList) {
    const channels = [...(guild?.channels?.cache?.values?.() || [])];
    for (const channel of channels) {
      if (!channel?.isVoiceBased?.()) continue;
      const members = [...(channel.members?.values?.() || [])];
      if (members.some(member => isHumanAllowed(member, allowedUsers))) {
        candidates.push({ channel, guildId: String(guild?.id || '') });
      }
    }
  }
  if (!candidates.length) return null;
  if (activeVoiceChannelId) {
    const stay = candidates.find(c => String(c.channel?.id || '') === String(activeVoiceChannelId));
    if (stay) return stay.channel;
  }
  if (activeGuildId) {
    const sameGuild = candidates.find(c => c.guildId === String(activeGuildId));
    if (sameGuild) return sameGuild.channel;
  }
  return candidates[0].channel;
}

export function shouldFollowUserVoiceChannel({ singleInstance = true, userId = '', allowedUsers = new Set(), userChannelId = '', activeVoiceChannelId = '' } = {}) {
  if (!singleInstance || !userChannelId) return false;
  const id = String(userId || '');
  if (!id || (allowedUsers.size > 0 && !allowedUsers.has(id))) return false;
  return String(userChannelId) !== String(activeVoiceChannelId || '');
}
