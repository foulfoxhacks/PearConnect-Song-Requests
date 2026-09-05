import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { loadConfig } from './config.js';
import { PearConnectEngine } from './engine.js';
import { createLogger } from './diagnostics.js';

function cliOptions(args) {
  const env = {}; let action = 'start', output, json = false, strictPlayer = true;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') env.DRY_RUN = 'true';
    else if (arg === '--mode') { const value = args[++i]; if (!['simple', 'advanced'].includes(value)) throw new Error('--mode requires simple or advanced.'); env.CONNECTION_MODE = value; }
    else if (arg === '--json') json = true;
    else if (arg === '--paused') env.REQUESTS_ENABLED = 'false';
    else if (arg === '--accept-requests') env.REQUESTS_ENABLED = 'true';
    else if (arg === '--allow-disconnected') strictPlayer = false;
    else if (['--validate-config', '--status', '--diagnostics', '--help'].includes(arg)) {
      if (action !== 'start') throw new Error('Choose one CLI action.');
      action = arg.slice(2);
      if (arg === '--diagnostics') { output = args[++i]; if (!output || output.startsWith('--')) throw new Error('--diagnostics requires a new output filename.'); }
    } else throw new Error('Unknown CLI option. Run with --help.');
  }
  return { env, action, output, json, strictPlayer };
}

let engine;
let log = createLogger();
async function main() {
  const options = cliOptions(process.argv.slice(2));
  if (options.action === 'help') {
    console.log('PearConnect CLI\n  --mode simple|advanced  Select TikTok input\n  --dry-run              No player calls or accounting\n  --accept-requests      Enable intake (Simple defaults paused)\n  --paused               Start with requests paused\n  --allow-disconnected   Stay running while player needs repair\n  --validate-config      Validate without connecting\n  --status               Read running engine status\n  --diagnostics FILE     Export sanitized report to a new file\n  --json                 Structured JSON logs/status');
    return;
  }
  const config = loadConfig({ ...process.env, ...options.env }, { allowUnconfigured: !options.strictPlayer || ['status', 'diagnostics'].includes(options.action) });
  log = createLogger({ json: options.json, secrets: () => [config.token, config.secret, config.twitch.oauth] });
  if (options.action === 'validate-config') { log.info('Configuration valid. No connections or mutations performed.'); return; }
  if (['status', 'diagnostics'].includes(options.action)) {
    if (!config.port) throw new Error('Status requires the local HTTP listener (TIKFINITY_PORT).');
    const res = await fetch(`http://127.0.0.1:${config.port}/${options.action}`, { headers: { 'X-Webhook-Secret': config.secret }, redirect: 'error', signal: AbortSignal.timeout(config.timeoutMs) });
    if (!res.ok) throw new Error(`Cannot read engine: HTTP ${res.status}. Check port and secret.`);
    const result = JSON.stringify(await res.json(), null, 2);
    if (options.action === 'diagnostics') { await writeFile(options.output, result + '\n', { flag: 'wx', mode: 0o600 }); log.info('Sanitized diagnostics exported. No credentials or chat content included.'); }
    else console.log(result);
    return;
  }
  if (config.dryRun) log.warn('DRY RUN: no player calls, accounting or Twitch/YouTube connections. Simple mode reads TikFinity events.');
  engine = new PearConnectEngine(config, { logger: log });
  await engine.start({ strictPlayer: options.strictPlayer });
  log.info(`PearConnect Song Requests is running. ${config.connectionMode} input; requests ${engine.requestsEnabled ? 'enabled' : 'paused'}. Press Ctrl+C to quit.`);
  let closing = false;
  const shutdown = async () => {
    if (closing) return; closing = true;
    log.info('Shutting down.');
    const forced = setTimeout(() => process.exit(1), config.timeoutMs * 2 + 5000); forced.unref();
    await engine.stop(); clearTimeout(forced); process.exitCode = 0;
  };
  process.once('SIGINT', () => shutdown().catch(() => { process.exitCode = 1; }));
  process.once('SIGTERM', () => shutdown().catch(() => { process.exitCode = 1; }));
}

main().catch(async error => {
  await engine?.stop();
  if (error.code === 'EADDRINUSE') log.error('TIKFINITY_PORT is already in use. Stop the other bridge or choose another port.');
  else log.error(error.code === 'ENGINE_RUNNING' ? error.message : error.name === 'InputError' || /^--|^Unknown CLI|^Choose one CLI|^Pear Desktop|^Status requires|^Cannot read engine/.test(error.message) ? error.message : 'Operation failed. Check configuration, connections and output permissions.');
  process.exitCode = 1;
});
