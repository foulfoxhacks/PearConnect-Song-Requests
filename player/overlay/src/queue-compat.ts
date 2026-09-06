// PearConnect queue compatibility layer. MIT; see player/README.md.
// YouTube's internal renderer objects are untyped at this boundary.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
export type QueueResult = {
  ok: boolean;
  code: string;
  videoId: string;
  queueVerified?: boolean;
  queuePosition?: number;
  outcomeUncertain?: boolean;
};
const videoPattern = /^[A-Za-z0-9_-]{11}$/;
const renderer = (item: unknown): Row | undefined => {
  if (!item || typeof item !== 'object') return undefined;
  const row = item as Row;
  return row.playlistPanelVideoRenderer ?? row.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer;
};
const count = (items: unknown[], id: string) => items.filter(item => renderer(item)?.videoId === id).length;

export function createQueueCompatibility({
  getQueue, getApp, now = Date.now,
  sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
}: { getQueue: () => any; getApp: () => any; now?: () => number; sleep?: (ms: number) => Promise<void> }) {
  let tail: Promise<unknown> = Promise.resolve();
  let pending = 0;
  let lastResult: QueueResult | null = null;
  const refs = () => {
    const queue = getQueue();
    const store = queue?.queue?.store?.store;
    return { queue, store, state: store?.getState?.()?.queue, app: getApp() };
  };
  const finish = (result: QueueResult) => (lastResult = result);
  const fail = (code: string, videoId: string, uncertain = false): QueueResult =>
    ({ ok: false, code, videoId, ...(uncertain ? { outcomeUncertain: true } : {}) });

  async function run(videoId: string, position: string, deadline: number, preview: boolean): Promise<QueueResult> {
    if (now() >= deadline) return fail('queue_timeout', videoId);
    const { queue, store, state, app } = refs();
    if (!queue || !store || !Array.isArray(state?.items) || typeof queue.dispatch !== 'function' || !app?.networkManager?.fetch)
      return fail('queue_not_ready', videoId);
    let data: Row;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // This endpoint retrieves renderers; it does not change playback. Queue
      // context/insert position belong to insertion, not this metadata lookup.
      // In particular, do not forward stale radio/playlist queueContextParams.
      data = await Promise.race([
        app.networkManager.fetch('/music/get_queue', { videoIds: [videoId] }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), Math.max(1, deadline - now())); }),
      ]);
    } catch { return fail(now() >= deadline ? 'queue_timeout' : 'metadata_unavailable', videoId); }
    finally { clearTimeout(timer); }
    const items = Array.isArray(data?.queueDatas) ? data.queueDatas.map(entry => (entry as Row)?.content) : [];
    const item = items.find(entry => renderer(entry)?.videoId === videoId && renderer(entry)?.isPlayable !== false);
    if (!item) return fail('queue_item_unavailable', videoId);
    if (now() >= deadline) return fail('queue_timeout', videoId);
    if (preview) return { ok: true, code: 'queue_preview_ready', videoId };

    // Re-read immediately before the only mutation. A navigation/reload during
    // metadata retrieval must not write to an abandoned queue object.
    const current = refs();
    if (current.queue !== queue || current.store !== store || !Array.isArray(current.state?.items)) return fail('queue_changed', videoId);
    const before = count(current.state.items, videoId);
    const selected = current.state.items.findIndex((entry: Row) => renderer(entry)?.selected);
    const index = position === 'INSERT_AFTER_CURRENT_VIDEO' && selected >= 0 ? selected + 1 : current.state.items.length;
    try {
      queue.dispatch({ type: 'ADD_ITEMS', payload: {
        nextQueueItemId: current.state.nextQueueItemId, index, items: [item],
        shuffleEnabled: false, shouldAssignIds: true,
      } });
      for (let attempt = 0; attempt < 6; attempt++) {
        if (refs().queue !== queue || refs().store !== store) return fail('queue_unconfirmed', videoId, true);
        const after = queue.queue.getItems();
        if (Array.isArray(after) && count(after, videoId) > before) {
          const matches = after.map((entry, i) => renderer(entry)?.videoId === videoId ? i : -1).filter(i => i >= 0);
          const matched = matches.find((i: number) => i >= index) ?? matches[matches.length - 1];
          return { ok: true, code: 'added', videoId, queueVerified: true, queuePosition: matched + 1 };
        }
        if (now() >= deadline) break;
        await sleep(Math.min(100, Math.max(0, deadline - now())));
      }
    } catch { return fail('queue_unconfirmed', videoId, true); }
    return fail('queue_unconfirmed', videoId, true);
  }

  return {
    status() {
      try {
        const { queue, store, state, app } = refs();
        return { build: '3.11.0-pearconnect.1', queueReady: !!(queue && store && Array.isArray(state?.items) && app?.networkManager?.fetch), pending, lastResult };
      } catch { return { build: '3.11.0-pearconnect.1', queueReady: false, pending, lastResult }; }
    },
    enqueue(videoId: string, position = 'INSERT_AT_END', deadline = now() + 8000, preview = false): Promise<QueueResult> {
      if (typeof videoId !== 'string' || !videoPattern.test(videoId) || !['INSERT_AT_END', 'INSERT_AFTER_CURRENT_VIDEO'].includes(position) || !Number.isFinite(deadline))
        return Promise.resolve(fail('invalid_request', videoId));
      if (pending >= 16) return Promise.resolve(fail('queue_busy', videoId));
      pending++;
      const result = tail.then(() => run(videoId, position, Math.min(deadline, now() + 8000), preview))
        .catch(() => fail('queue_not_ready', videoId));
      tail = result.then(() => { pending--; });
      return result.then(finish);
    },
  };
}
