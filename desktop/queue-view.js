import { playerQueue } from '../src/player-queue.js';

// Use player order, never titles or an ambiguous duplicate to infer position.
export function upcomingQueue(raw, current, now = Date.now()) {
  const rows = playerQueue(raw);
  const empty = { tracks: [], total: 0, updatedAt: now };
  if (!rows.length) return { ...empty, state: 'empty' };
  const selected = rows.filter(row => row.selected);
  let index = -1;
  if (selected.length === 1 && (!current?.videoId || selected[0].videoId === current.videoId)) index = selected[0].position - 1;
  else if (!selected.length && current?.videoId) {
    const matches = rows.filter(row => row.videoId === current.videoId);
    if (matches.length === 1) index = matches[0].position - 1;
  }
  if (index < 0) return { ...empty, state: 'position_unknown' };
  const remaining = rows.slice(index + 1);
  return { state: remaining.length ? 'ready' : 'empty', updatedAt: now, total: remaining.length,
    tracks: remaining.slice(0, 5).map(({ title, artist, duration, videoId }, i) => ({ title, artist, duration, videoId, next: i + 1 })) };
}
