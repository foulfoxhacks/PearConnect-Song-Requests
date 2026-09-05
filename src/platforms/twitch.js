// src/platforms/twitch.js
import tmi from 'tmi.js';
import { dispatchChat } from '../commands.js';

export function startTwitch({ channel, username, oauth, commands, queue, skipAllowlist, log }) {
  if (!channel) {
    log.info('[twitch] disabled (TWITCH_CHANNEL is empty)');
    return null;
  }
  if (!username || !oauth) {
    log.warn('[twitch] TWITCH_USERNAME or TWITCH_OAUTH missing - skipping');
    return null;
  }

  const client = new tmi.Client({
    options: { debug: false },
    connection: { reconnect: true, secure: true },
    identity: { username, password: oauth },
    channels: [channel],
  });

  client.on('connected', () => log.info(`[twitch] connected as ${username} -> #${channel}`));
  client.on('disconnected', () => log.warn('[twitch] disconnected.'));

  client.on('message', async (chan, tags, message, self) => {
    if (self) return;
    const user = tags.username;
    const userId = tags['user-id'] || '';

    const reply = (msg) => client.say(chan, msg).catch(() => log.error('[twitch.say] Reply delivery failed.'));
    try { await dispatchChat({ message, commands, queue, skipAllowlist, user, userId, platform: 'twitch', reply }); }
    catch { log.error('[twitch] Command processing failed.'); }
  });

  client.connect().catch(() => log.error('[twitch] Connection failed. Check credentials and connectivity.'));
  return client;
}
