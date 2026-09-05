export function redact(value, secrets = []) {
  let result = String(value).replace(/[\u0000-\u001f\u007f]/g, ' ');
  for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length)) result = result.split(secret).join('[redacted]');
  return result.replace(/\b(Bearer|oauth:)[\s]*[^\s,;]+/gi, '$1 [redacted]').slice(0, 1024);
}

export function createLogger({ json = false, sink = console, secrets = () => [], onLog = () => {} } = {}) {
  return Object.fromEntries(['info', 'warn', 'error'].map(level => [level, (...args) => {
    // Never serialize arbitrary objects from platform libraries.
    const message = redact(args.map(arg => typeof arg === 'string' ? arg : '[details omitted]').join(' '), secrets());
    const entry = { time: new Date().toISOString(), level, message };
    onLog(entry);
    sink[level](json ? JSON.stringify(entry) : `${entry.time} ${message}`);
  }]));
}

export function diagnosticReport(status) {
  // Deliberate allowlist: no credentials, paths, URLs, viewer identities, queries, song metadata or raw logs.
  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(),
    connectionMode: status.connectionMode, dryRun: status.dryRun,
    lifecycle: status.lifecycle, player: status.player, requestsEnabled: status.requestsEnabled,
    input: { state: status.input.state, lastEventAt: status.input.lastEventAt, lastChatAt: status.input.lastChatAt, lastCommandAt: status.input.lastCommandAt, invalidEvents: status.input.invalidEvents },
    history: status.activity.map(({ time, command, source, state, code }) => ({ time, command, source, state, code })),
  };
}
