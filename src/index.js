import 'dotenv/config';
import { loadConfig } from './config.js';
import { YTMDClient } from './ytmd.js';
import { QueueManager } from './queue-manager.js';
import { startTikfinity } from './platforms/tikfinity.js';

const log = Object.fromEntries(['info', 'warn', 'error'].map((level) =>
  [level, (...args) => console[level](new Date().toISOString(), ...args)]));

async function main() {
  const config = loadConfig({ ...process.env, ...(process.argv.includes('--dry-run') ? { DRY_RUN: 'true' } : {}) });
  const ytmd = new YTMDClient(config);
  if (config.dryRun) log.warn('[pearconnect] DRY RUN: no player calls and no Twitch/YouTube connections.');
  else {
    await ytmd.getCurrentSong();
    log.info('[ytmd] connected.');
  }
  if (config.port && !config.secret) log.warn('[security] No webhook secret: any local process can call this bridge. Set TIKFINITY_SECRET for normal use.');
  const queue = new QueueManager({ ...config, ytmd, logger: log, requestCommand: config.commands.request });
  // Bind first; an occupied port must fail startup, not print a false success.
  const server = await startTikfinity({ ...config, queue, log });
  let twitch;
  let youtube;
  if (!config.dryRun) {
    const [{ startTwitch }, { startYouTube }] = await Promise.all([import('./platforms/twitch.js'), import('./platforms/youtube.js')]);
    const shared = { commands: config.commands, queue, skipAllowlist: config.skipAllowlist, log };
    twitch = startTwitch({ ...shared, ...config.twitch });
    youtube = startYouTube({ ...shared, channelId: config.channelId });
  }
  log.info('PearConnect Song Requests is running. Press Ctrl+C to quit.');
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    log.info('[pearconnect] Shutting down.');
    const forced = setTimeout(() => process.exit(1), 5000);
    forced.unref();
    try { youtube?.stop(); } catch { /* Already stopped. */ }
    const tasks = [];
    if (twitch) tasks.push(Promise.resolve().then(() => twitch.disconnect()).catch(() => {}));
    if (server) tasks.push(new Promise((resolve) => server.close(resolve)));
    await Promise.all(tasks);
    clearTimeout(forced);
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((error) => {
  if (error.code === 'EADDRINUSE') log.error('TIKFINITY_PORT is already in use. Stop the other bridge or choose another port.');
  else log.error('[startup]', error.message);
  process.exit(1);
});
