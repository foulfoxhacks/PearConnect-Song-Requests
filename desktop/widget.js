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
    content.append(label, title, artist, progress, clocks, motion); root.append(art, content); container.replaceChildren(root);
    let state;
    const tick = () => {
      const t = timing(state?.track);
      elapsed.textContent = `${format(t.elapsed)} / ${format(t.duration)}`;
      left.textContent = t.remaining === null ? 'Timing unavailable' : `${format(Math.ceil(t.remaining))} left`;
      progress.value = t.duration && t.elapsed !== null ? t.elapsed / t.duration : 0;
      root.dataset.playing = String(state?.track?.paused === false && !t.stale);
      label.textContent = !state?.track ? 'WAITING FOR MUSIC' : t.stale ? 'PLAYER UPDATE DELAYED' : state.track.paused === true ? 'PAUSED' : state.appearance?.WIDGET_LABEL || 'NOW PLAYING';
    };
    return { tick, update(value) {
      state = value; const a = value.appearance || {}, track = value.track;
      root.dataset.layout = a.WIDGET_LAYOUT || 'cover'; root.dataset.surface = a.WIDGET_SURFACE || 'dark'; root.dataset.motion = a.WIDGET_MOTION || 'off'; root.dataset.font = a.WIDGET_FONT || 'system';
      if (/^#[a-f\d]{6}$/i.test(a.WIDGET_ACCENT)) root.style.setProperty('--widget-accent', a.WIDGET_ACCENT);
      art.hidden = a.WIDGET_ART === 'false' || a.WIDGET_LAYOUT === 'minimal'; progress.hidden = clocks.hidden = a.WIDGET_TIMING === 'false';
      title.textContent = track?.title || 'Your next favorite.'; artist.textContent = track?.artist || 'A little space for a great song.';
      if (value.art && img.getAttribute('src') !== value.art) { img.src = value.art; img.hidden = false; placeholder.hidden = true; }
      if (!value.art) { img.removeAttribute('src'); img.hidden = true; placeholder.hidden = false; }
      tick();
    } };
  }
  window.PearWidget = Object.freeze({ create, timing, format });
})();
