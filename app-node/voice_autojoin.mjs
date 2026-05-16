export function isHumanAllowed(member, allowedUsers = new Set()) {
  const userId = String(member?.user?.id || member?.id || '');
  if (!userId || member?.user?.bot) return false;
  return allowedUsers.size === 0 || allowedUsers.has(userId);
}

export function pickOccupiedUserVoiceChannel(guilds = [], allowedUsers = new Set()) {
  for (const guild of guilds) {
    const channels = [...(guild?.channels?.cache?.values?.() || [])];
    for (const channel of channels) {
      if (!channel?.isVoiceBased?.()) continue;
      const members = [...(channel.members?.values?.() || [])];
      if (members.some(member => isHumanAllowed(member, allowedUsers))) return channel;
    }
  }
  return null;
}

export function shouldFollowUserVoiceChannel({ singleInstance = true, userId = '', allowedUsers = new Set(), userChannelId = '', activeVoiceChannelId = '' } = {}) {
  if (!singleInstance || !userChannelId) return false;
  const id = String(userId || '');
  if (!id || (allowedUsers.size > 0 && !allowedUsers.has(id))) return false;
  return String(userChannelId) !== String(activeVoiceChannelId || '');
}
