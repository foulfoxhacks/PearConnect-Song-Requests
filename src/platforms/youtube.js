// src/platforms/youtube.js
// YouTube Live chat is read-only via the unofficial `youtube-chat` package
// (it scrapes the live chat continuation token). It can't post replies back.
// We log replies to the console so you can see them; if you want chat replies
// on YouTube, configure a separate chatbot (Nightbot, etc.) to mirror them
// or use the official YouTube Data API with OAuth (out of scope here).
import { LiveChat } from 'youtube-chat';
import { dispatchChat } from '../commands.js';

export function startYouTube({ channelId, commands, queue, skipAllowlist, log }) {
  if (!channelId) {
    log.info('[youtube] disabled (YOUTUBE_CHANNEL_ID is empty)');
    return null;
  }

  const live = new LiveChat({ channelId });

  live.on('start', (liveId) => log.info(`[youtube] connected to live chat ${liveId}`));
  live.on('end', () => log.warn('[youtube] live chat ended'));
  live.on('error', () => log.error('[youtube] Connection error. Check channel and connectivity.'));

  live.on('chat', async (item) => {
    const text = (Array.isArray(item.message) ? item.message : []).map((m) => m.text || '').join('').trim();
    const user = item.author?.name;
    const userId = item.author?.channelId || '';

    const reply = (msg) => log.info(`[youtube reply -> ${user}] ${msg}`);

    if (!userId) return; // Never use a non-unique display name for YouTube accounting.
    try { await dispatchChat({ message: text, commands, queue, skipAllowlist, user, userId, platform: 'youtube', reply }); }
    catch { log.error('[youtube] Command processing failed.'); }
  });

  live.start().catch(() => log.error('[youtube] Could not start live chat.'));
  return live;
}
