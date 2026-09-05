import { rendererText } from './ytmd.js';

// Read only the ordered queue, never nested menus, recommendations or alternate
// renderers that could count the same video twice. Position is a snapshot, not ownership.
export function playerQueue(data) {
  if (data === null) return [];
  const items = data?.items;
  if (!Array.isArray(items) || items.length > 10000) throw new Error('Pear Desktop returned an unsupported queue response.');
  return items.map((item, index) => {
    const row = item?.playlistPanelVideoRenderer || item?.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer;
    if (!row || typeof row.videoId !== 'string' || !row.videoId) throw new Error('Pear Desktop returned an unrecognized queue item.');
    return { videoId: row.videoId, position: index + 1, title: rendererText(row.title).slice(0, 512),
      artist: rendererText(row.shortBylineText).slice(0, 512), duration: rendererText(row.lengthText).slice(0, 32), selected: row.selected === true };
  });
}

export function findQueueAddition(before, after, videoId) {
  const previous = before.filter(row => row.videoId === videoId).length;
  const matches = after.filter(row => row.videoId === videoId);
  return matches.length > previous ? matches.at(-1) : null;
}
