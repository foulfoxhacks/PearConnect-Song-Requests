(() => {
  const platforms = { tiktok: 'TikTok', twitch: 'Twitch', discord: 'Discord', youtube: 'YouTube', instagram: 'Instagram', kick: 'Kick', website: 'Website' };
  const entries = a => Object.keys(platforms).map(platform => ({ platform, handle: a[`SOCIAL_${platform.toUpperCase()}`]?.trim() })).filter(e => e.handle);
  function create(container, { assetRoot = 'assets/platforms/' } = {}) {
    const make = (tag, cls) => { const el = document.createElement(tag); el.className = cls; return el; };
    const root = make('article', 'social-ticker'), icon = make('img', 'social-icon'), copy = make('div', 'social-copy'), label = make('div', 'social-label'), handle = make('div', 'social-handle'), count = make('span', 'social-count');
    icon.alt = ''; copy.append(label, handle); root.append(icon, copy, count); container.replaceChildren(root);
    let list = [], a = {}, started = Date.now(), key = '', index = -1;
    const tick = () => {
      if (!list.length) { root.hidden = true; return; }
      root.hidden = false;
      const next = Math.floor(Math.max(0, Date.now() - started) / (Math.max(3, Math.min(30, Number(a.SOCIAL_SECONDS) || 6)) * 1000)) % list.length;
      if (next === index) return; index = next;
      const entry = list[index]; icon.src = `${assetRoot}${entry.platform}.svg`;
      label.textContent = `${a.SOCIAL_LABEL || 'FOLLOW / CONNECT'} · ${platforms[entry.platform]}`;
      handle.textContent = entry.handle; count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}`;
    };
    return { tick, update(value) {
      a = value.appearance || {};
      const nextList = a.SOCIAL_ENABLED === 'true' ? entries(a) : [], nextKey = JSON.stringify([nextList, a.SOCIAL_LABEL]);
      if (nextKey !== key) { key = nextKey; index = -1; started = Date.now(); }
      list = nextList; root.dataset.icons = a.SOCIAL_ICONS || 'brand'; root.dataset.surface = a.SOCIAL_SURFACE || 'transparent';
      tick();
    } };
  }
  window.PearSocial = Object.freeze({ create, entries });
})();
