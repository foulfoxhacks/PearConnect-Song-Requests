// Every chat adapter uses this parser; preserve quoted text and Unicode exactly.
export function parseCommand(message, commands) {
  if (typeof message !== 'string' || message.length > 1024) return null;
  const match = message.trim().match(/^!([a-z0-9_-]+)(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  const command = Object.keys(commands).find(key => commands[key] === match[1].toLowerCase());
  return command ? { command, query: (match[2] || '').trim() } : null;
}

export function isAllowed({ user, userId, platform }, allowlist) {
  // Anonymous website names cannot satisfy a trusted chat identity allowlist.
  if (platform === 'web') return false;
  return allowlist.some(entry => {
    if (platform === 'youtube') return !!userId && entry === `youtube:${userId}`;
    const value = entry.toLowerCase();
    return value === user.toLowerCase() || value === `${platform}:${user.toLowerCase()}`;
  });
}

export async function dispatchChat({ message, commands, queue, skipAllowlist = [], ...identity }) {
  const parsed = parseCommand(message, commands);
  if (!parsed) return null;
  const methods = { request: 'handleRequest', nowPlaying: 'handleNowPlaying', queue: 'handleQueuePeek', skip: 'handleSkip' };
  return queue[methods[parsed.command]]({ ...identity, query: parsed.query, allowlist: skipAllowlist });
}
