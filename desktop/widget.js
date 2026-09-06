/* Shared by the isolated desktop preview and read-only OBS browser source. */
(() => {
  const make = (tag, cls, text) => { const el = document.createElement(tag); el.className = cls; if (text) el.textContent = text; return el; };
  const format = seconds => Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '—:—';
  function timing(track, now = Date.now()) {
    if (!track) return { elapsed: null, remaining: null, duration: null, stale: true };
    const age = Math.max(0, now - track.updatedAt), stale = age > 10000;
    const delta = track.paused === false && !stale ? Math.min(age / 1000, 4) : 0;
    const elapsed = track.elapsed === null ? null : Math.min(track.elapsed + delta, track.duration ?? Infinity);
    return { elapsed, remaining: track.duration !== null && elapsed !== null ? Math.max(0, track.duration - elapsed) : null, duration: track.duration, stale };
  }
  function create(container) {
    const root = make('article', 'music-widget'), art = make('div', 'widget-art'), img = make('img', 'widget-image'), placeholder = make('div', 'widget-placeholder', '♪');
    img.alt = ''; img.hidden = true; img.addEventListener('error', () => { img.hidden = true; placeholder.hidden = false; });
    art.append(placeholder, img);
    const content = make('div', 'widget-copy'), label = make('div', 'widget-label'), title = make('h3', 'widget-title'), artist = make('p', 'widget-artist');
    const progress = make('progress', 'widget-progress'); progress.max = 1; progress.value = 0; progress.setAttribute('aria-label', 'Song playback progress');
    const clocks = make('div', 'widget-clocks'), elapsed = make('span', 'widget-elapsed'), left = make('span', 'widget-remaining'); clocks.append(elapsed, left);
    const motion = make('div', 'widget-motion'); motion.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 22; i++) { const bar = make('i', ''); bar.style.setProperty('--i', i); motion.append(bar); }
    const nowPlaying = make('div', 'widget-now');
    const queueSection = make('section', 'widget-queue'), queueTitle = make('h4', 'widget-queue-heading', 'UP NEXT'), queueList = make('ol', 'widget-queue-list'), queueNote = make('p', 'widget-queue-note');
    queueSection.append(queueTitle, queueList, queueNote);
    content.append(label, title, artist, progress, clocks, motion); nowPlaying.append(art, content); root.append(nowPlaying, queueSection); container.replaceChildren(root);
    let state;
    const tick = () => {
      const t = timing(state?.track);
      elapsed.textContent = `${format(t.elapsed)} / ${format(t.duration)}`;
      left.textContent = t.remaining === null ? 'Timing unavailable' : `${format(Math.ceil(t.remaining))} left`;
      progress.value = t.duration && t.elapsed !== null ? t.elapsed / t.duration : 0;
      root.dataset.playing = String(state?.track?.paused === false && !t.stale);
      label.textContent = !state?.track ? 'WAITING FOR MUSIC' : t.stale ? 'PLAYER UPDATE DELAYED' : state.track.paused === true ? 'PAUSED' : state.appearance?.WIDGET_LABEL || 'NOW PLAYING';
      if (state?.queue?.updatedAt && Date.now() - state.queue.updatedAt > 10000) { queueList.replaceChildren(); queueNote.textContent = 'Waiting for a fresh queue update'; }
    };
    return { tick, update(value) {
      state = value; const a = value.appearance || {}, track = value.track;
      root.dataset.layout = a.WIDGET_LAYOUT || 'cover'; root.dataset.surface = a.WIDGET_SURFACE || 'dark'; root.dataset.motion = a.WIDGET_MOTION || 'off'; root.dataset.font = a.WIDGET_FONT || 'system';
      if (/^#[a-f\d]{6}$/i.test(a.WIDGET_ACCENT)) root.style.setProperty('--widget-accent', a.WIDGET_ACCENT);
      art.hidden = a.WIDGET_ART === 'false' || a.WIDGET_LAYOUT === 'minimal'; progress.hidden = clocks.hidden = a.WIDGET_TIMING === 'false';
      title.textContent = track?.title || 'Your next favorite.'; artist.textContent = track?.artist || 'A little space for a great song.';
      if (value.art && img.getAttribute('src') !== value.art) { img.src = value.art; img.hidden = false; placeholder.hidden = true; }
      if (!value.art) { img.removeAttribute('src'); img.hidden = true; placeholder.hidden = false; }
      queueSection.hidden = a.WIDGET_QUEUE === 'false';
      root.dataset.queue = String(!queueSection.hidden);
      queueList.replaceChildren();
      const q = value.queue || {}, count = Math.max(1, Math.min(5, Number(a.WIDGET_QUEUE_ROWS) || 3));
      const tracks = q.state === 'ready' ? (q.tracks || []).slice(0, count) : [];
      for (const [i, song] of tracks.entries()) {
        const row = make('li', 'widget-queue-row'), number = make('span', 'widget-queue-number', String(i + 1).padStart(2, '0'));
        const copy = make('div', 'widget-queue-copy'); copy.append(make('strong', 'widget-queue-title', song.title || 'Untitled'), make('span', 'widget-queue-artist', song.artist || 'Unknown artist'));
        row.append(number, copy, make('span', 'widget-queue-duration', song.duration || '—:—')); queueList.append(row);
      }
      queueTitle.textContent = 'UP NEXT';
      queueNote.textContent = q.state === 'empty' ? 'Room for the next great song.' : q.state === 'position_unknown' ? 'Waiting for the player’s queue position' : q.state !== 'ready' ? 'Waiting for a fresh queue update' : q.total > tracks.length ? `+ ${q.total - tracks.length} more in the player queue` : 'From the player queue';
      tick();
    } };
  }
  function dimensions(a = {}) {
    const rows = Math.max(1, Math.min(5, Number(a.WIDGET_QUEUE_ROWS) || 3));
    return { width: a.WIDGET_LAYOUT === 'vertical' ? 400 : 760,
      height: ({ cover: 320, compact: 240, minimal: 300, vertical: 240 }[a.WIDGET_LAYOUT] || 320) + (a.WIDGET_QUEUE === 'false' ? 0 : 90 + 56 * rows) };
  }
  window.PearWidget = Object.freeze({ create, timing, format, dimensions });
})();
