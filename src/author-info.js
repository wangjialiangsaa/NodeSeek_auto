  function authorInfoProfile(value, uid) {
    if (!value || String(value.member_id) !== uid) return null;
    const profile = { member_id: uid };
    for (const field of ['rank', 'coin', 'stardust', 'nPost', 'nComment']) {
      const raw = value[field];
      if ((typeof raw !== 'number' && typeof raw !== 'string') || String(raw).trim() === '') continue;
      const number = Number(raw);
      if (Number.isFinite(number) && (field === 'coin' || number >= 0)) profile[field] = number;
    }
    if (typeof value.created_at === 'string' && Number.isFinite(Date.parse(value.created_at))) profile.created_at = value.created_at;
    return Object.keys(profile).length > 1 ? profile : null;
  }

  function installAuthorInfo() {
    const runtimeKey = '__nodeSeekAuthorInfo__';
    window[runtimeKey]?.disconnect();
    const cacheKey = 'nsit-author-info-cache-v1';
    const ttl = 10 * 60 * 1000;
    const cache = new Map(), failures = new Map(), targets = new Map(), pending = new Map(), queued = new Set(), visible = new Set();
    const rendered = new WeakMap();
    const queue = [];
    let disposed = false, timer = null, wakeTimer = null, pausedUntil = 0;
    const enabled = () => !disposed && featureEnabled('authorInfo') && /^\/post-\d+-\d+\/?$/.test(location.pathname);
    const numericId = value => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? String(Number(value)) : '';
    try {
      const saved = JSON.parse(sessionStorage.getItem(cacheKey) || '[]');
      if (Array.isArray(saved)) for (const item of saved.slice(-200)) {
        const uid = numericId(item?.uid), profile = authorInfoProfile(item?.profile, uid);
        if (uid && profile && Number.isFinite(item.at) && item.at <= Date.now() && Date.now() - item.at < ttl) cache.set(uid, { at: item.at, profile });
      }
    } catch (_) { /* A corrupt or unavailable cache does not block public lookups. */ }

    if (!document.getElementById('nsit-author-info-style')) {
      const style = document.createElement('style'); style.id = 'nsit-author-info-style';
      style.textContent = '.nsit-author-info{display:flex;flex-wrap:wrap;align-items:center;gap:3px 10px;margin:3px 0;font-size:12px;line-height:1.5;font-weight:400;color:var(--nsit-muted,#888)}.nsit-author-info>span{white-space:nowrap}.nsit-author-info .nsit-author-level{padding:0 5px;border-radius:4px;background:var(--nsit-accent-soft,#fff2cc);color:var(--nsit-accent-ink,#8a6500);font-weight:600}';
      document.head.append(style);
    }
    function cached(uid) {
      const item = cache.get(uid);
      if (item && Date.now() - item.at < ttl) return item.profile;
      cache.delete(uid); return null;
    }
    function save(uid, profile) {
      cache.delete(uid); cache.set(uid, { at: Date.now(), profile });
      while (cache.size > 200) cache.delete(cache.keys().next().value);
      try { sessionStorage.setItem(cacheKey, JSON.stringify(Array.from(cache, ([uid, item]) => ({ uid, ...item })))); } catch (_) { /* Memory cache remains available. */ }
    }
    function identify(card) {
      const author = card.querySelector('.author-info .author-name[href]');
      if (!author) return null;
      try {
        const url = new URL(author.getAttribute('href'), location.href);
        const uid = url.origin === location.origin ? numericId(url.pathname.match(/^\/space\/(\d+)\/?$/)?.[1]) : '';
        return uid ? { uid, header: author.closest('.author-info') } : null;
      } catch (_) { return null; }
    }
    function show(card, info, profile) {
      rendered.set(card, { uid: info.uid, at: cache.get(info.uid).at });
      const parts = [];
      for (const [field, label] of [['rank', '等级 Lv'], ['coin', '鸡腿'], ['stardust', '星辰'], ['nPost', '主题'], ['nComment', '评论']]) {
        if (Object.hasOwn(profile, field)) parts.push([field, `${label} ${profile[field]}`]);
      }
      if (profile.created_at) parts.push(['joined', `加入 ${Math.max(0, Math.ceil((Date.now() - Date.parse(profile.created_at)) / 86400000))} 天`]);
      let row = card.querySelector('[data-nsit-author-info]');
      const signature = JSON.stringify([info.uid, parts]);
      if (row?.dataset.nsitAuthorSignature === signature) return;
      if (!row) { row = document.createElement('div'); row.className = 'nsit-author-info'; }
      row.dataset.nsitAuthorInfo = info.uid; row.dataset.nsitAuthorSignature = signature;
      row.replaceChildren(...parts.map(([field, text]) => {
        const span = document.createElement('span'); span.textContent = text;
        if (field === 'rank') span.className = 'nsit-author-level';
        return span;
      }));
      if (row.previousElementSibling !== info.header) info.header.after(row);
    }
    function schedule() {
      if (disposed || timer !== null) return;
      timer = setTimeout(() => { timer = null; scan(); }, 15);
    }
    function enqueue(uid) {
      if (!enabled() || cached(uid) || pending.has(uid) || queued.has(uid) || (failures.get(uid) || 0) > Date.now()) return;
      queue.push(uid); queued.add(uid); pump();
    }
    const intersection = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.target.isConnected) {
          visible.add(entry.target);
          const uid = targets.get(entry.target);
          if (uid) enqueue(uid);
        } else visible.delete(entry.target);
      }
    }, { rootMargin: '300px' }) : null;
    function pump() {
      if (!enabled() || pending.size >= 2 || !queue.length) return;
      if (pausedUntil > Date.now()) {
        if (wakeTimer === null) wakeTimer = setTimeout(() => { wakeTimer = null; pump(); }, pausedUntil - Date.now());
        return;
      }
      while (pending.size < 2 && queue.length) {
        const uid = queue.shift(); queued.delete(uid);
        if (cached(uid) || !Array.from(targets).some(([card, id]) => card.isConnected && id === uid)) continue;
        const controller = new AbortController(); pending.set(uid, controller);
        const timeout = setTimeout(() => controller.abort(), 10000);
        Promise.resolve().then(() => fetch(`/api/account/getInfo/${uid}?readme=1`, { credentials: 'same-origin', signal: controller.signal }))
          .then(async response => {
            if (response.status === 429) pausedUntil = Date.now() + 60000;
            if (!response.ok) throw new Error('Profile unavailable');
            const payload = await response.json();
            const profile = payload?.success === true ? authorInfoProfile(payload.detail, uid) : null;
            if (!profile) throw new Error('Invalid public profile');
            if (enabled() && !controller.signal.aborted) { save(uid, profile); schedule(); }
          }).catch(() => {
            if (!controller.signal.aborted) failures.set(uid, Date.now() + 3 * 60 * 1000);
          }).finally(() => { clearTimeout(timeout); pending.delete(uid); pump(); });
      }
    }
    function scan() {
      if (!enabled()) {
        document.querySelectorAll('[data-nsit-author-info]').forEach(row => row.remove());
        intersection?.disconnect(); targets.clear(); visible.clear(); queue.length = 0; queued.clear();
        for (const controller of pending.values()) controller.abort();
        clearTimeout(wakeTimer); wakeTimer = null;
        return;
      }
      for (const [card] of targets) if (!card.isConnected) { intersection?.unobserve(card); targets.delete(card); visible.delete(card); }
      for (const card of document.querySelectorAll('.content-item')) {
        const info = identify(card), row = card.querySelector('[data-nsit-author-info]');
        if (!info) { row?.remove(); continue; }
        if (row && row.dataset.nsitAuthorInfo !== info.uid) row.remove();
        const profile = cached(info.uid);
        if (profile) show(card, info, profile);
        if (targets.get(card) !== info.uid) {
          intersection?.unobserve(card); targets.set(card, info.uid);
          if (intersection) intersection.observe(card);
        }
        const displayed = rendered.get(card);
        if ((!intersection || visible.has(card)) && (!row || displayed?.uid !== info.uid || Date.now() - displayed.at >= ttl)) enqueue(info.uid);
      }
      pump();
    }
    function disconnect() {
      disposed = true; clearTimeout(timer); clearTimeout(wakeTimer); intersection?.disconnect();
      for (const controller of pending.values()) controller.abort();
      queue.length = 0; queued.clear(); targets.clear(); visible.clear();
      document.querySelectorAll('[data-nsit-author-info]').forEach(row => row.remove());
    }
    const runtime = { schedule, disconnect };
    window[runtimeKey] = runtime; schedule();
    return runtime;
  }
