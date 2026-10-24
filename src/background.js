  const BACKGROUND_SETTINGS_KEY = 'nsit-background-settings-v1';
  const BACKGROUND_RUNTIME_KEY = '__nsitCustomBackground__';
  const BACKGROUND_DEFAULTS = { enabled: false, backgroundUrl: '', lowPower: true, blur: 16, opacity: 74, autoContrast: true, autoFocus: true, focusX: 50, focusY: 50 };

  function normalizeBackgroundSettings(value) {
    const saved = value && typeof value === 'object' ? value : {};
    const number = (key, min, max) => {
      const n = saved[key] === '' || saved[key] == null ? NaN : Number(saved[key]);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : BACKGROUND_DEFAULTS[key];
    };
    let backgroundUrl = '';
    try {
      const raw = typeof saved.backgroundUrl === 'string' ? saved.backgroundUrl.trim() : '';
      if (/^https?:\/\//i.test(raw) && raw.length <= 4096) {
        const url = new URL(raw);
        if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) {
          // Bing's UHD wallpaper links can still request a tiny thumbnail.
          // Only remove known resize parameters for these official originals;
          // other hosts may require their query parameters or signatures.
          if ((url.hostname === 'bing.com' || url.hostname.endsWith('.bing.com')) && url.pathname === '/th'
            && url.searchParams.getAll('id').length === 1 && /^OHR\.[^/]+_UHD\.jpg$/i.test(url.searchParams.get('id'))) {
            for (const key of ['w', 'h', 'rs', 'c']) url.searchParams.delete(key);
          }
          backgroundUrl = url.href;
        }
      }
    } catch (_) { /* Invalid stored URLs leave the original appearance intact. */ }
    return { enabled: saved.enabled === true && !!backgroundUrl, backgroundUrl, lowPower: saved.lowPower !== false, blur: number('blur', 0, 32), opacity: number('opacity', 35, 95), autoContrast: saved.autoContrast !== false, autoFocus: saved.autoFocus !== false, focusX: number('focusX', 0, 100), focusY: number('focusY', 0, 100) };
  }

  function backgroundSettings() {
    try {
      return normalizeBackgroundSettings(typeof GM_getValue === 'function' ? GM_getValue(BACKGROUND_SETTINGS_KEY, {}) : JSON.parse(localStorage.getItem(BACKGROUND_SETTINGS_KEY) || '{}'));
    } catch (_) { return normalizeBackgroundSettings({}); }
  }

  function writeBackgroundSettings(settings) {
    if (typeof GM_setValue === 'function') GM_setValue(BACKGROUND_SETTINGS_KEY, settings);
    else localStorage.setItem(BACKGROUND_SETTINGS_KEY, JSON.stringify(settings));
  }

  // Coordinates describe the source-image rectangle visible through CSS cover.
  function backgroundCrop(image, viewport, position = { x: 50, y: 50 }) {
    const scale = Math.max(viewport.width / image.width, viewport.height / image.height);
    const width = Math.min(1, viewport.width / scale / image.width);
    const height = Math.min(1, viewport.height / scale / image.height);
    return { left: (1 - width) * position.x / 100, top: (1 - height) * position.y / 100, width, height };
  }

  function backgroundAutoPosition(sample, image, viewport) {
    if (!sample) return { x: 50, y: 50 };
    const { width, height, data } = sample;
    const gray = i => .2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2];
    const energy = new Float64Array(width * height);
    let total = 0;
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      const edge = Math.abs(gray(i + 4) - gray(i - 4)) + Math.abs(gray(i + width * 4) - gray(i - width * 4));
      const saturation = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
      energy[y * width + x] = edge + saturation * .3;
      total += energy[y * width + x];
    }
    if (total < 1) return { x: 50, y: 50 };
    const center = backgroundCrop(image, viewport);
    const candidatesX = center.width < .999 ? [0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100] : [50];
    const candidatesY = center.height < .999 ? [0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100] : [50];
    let best = { x: 50, y: 50 }, bestScore = -Infinity;
    for (const x of candidatesX) for (const y of candidatesY) {
      const crop = backgroundCrop(image, viewport, { x, y });
      let score = 0;
      for (let sy = 1; sy < height - 1; sy++) for (let sx = 1; sx < width - 1; sx++) {
        const px = (sx + .5) / width, py = (sy + .5) / height;
        if (px < crop.left || px > crop.left + crop.width || py < crop.top || py > crop.top + crop.height) continue;
        // Favor detail near the visible center and retain center bias on ties.
        const dx = (px - crop.left) / crop.width - .5, dy = (py - crop.top) / crop.height - .5;
        score += energy[sy * width + sx] * (1 - .65 * (dx * dx + dy * dy));
      }
      score = score / total - .025 * ((x - 50) ** 2 + (y - 50) ** 2) / 2500;
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
    return best;
  }

  function backgroundLuminance(rgb) {
    const c = rgb.map(value => { const v = value / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
  }

  function backgroundPalette(sample, settings, crop = null, nativeDark = false) {
    let brightness = 0, count = 0;
    if (sample) {
      const { width, height, data } = sample;
      const area = crop || { left: 0, top: 0, width: 1, height: 1 };
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        if ((x + .5) / width < area.left || (x + .5) / width > area.left + area.width || (y + .5) / height < area.top || (y + .5) / height > area.top + area.height) continue;
        const i = (y * width + x) * 4, a = data[i + 3] / 255;
        brightness += (.2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2]) / 255 * a;
        count++;
      }
    }
    const mode = settings.autoContrast !== false ? count && brightness / count >= .55 ? 'light' : 'dark' : nativeDark ? 'dark' : 'light';
    const colors = mode === 'dark'
      ? { surface: [17, 24, 39], ink: '#f3f4f6', muted: '#d1d5db', link: '#93c5fd', border: '#ffffff30' }
      : { surface: [248, 250, 252], ink: '#18212f', muted: '#405069', link: '#145c9e', border: '#18212f30' };
    const foregrounds = [colors.ink, colors.muted, colors.link].map(hex => backgroundLuminance(hex.match(/[0-9a-f]{2}/gi).map(c => parseInt(c, 16))));
    let alpha = Math.min(.95, Math.max(.35, (Number(settings.opacity) || 74) / 100));
    // Test both black and white behind the panel: the average alone cannot
    // guarantee readable text over mixed images, GIF frames or different rows.
    const contrastAt = opacity => Math.min(...[0, 255].flatMap(bg => {
      const light = backgroundLuminance(colors.surface.map(c => c * opacity + bg * (1 - opacity)));
      return foregrounds.map(fg => (Math.max(fg, light) + .05) / (Math.min(fg, light) + .05));
    }));
    while (alpha < .95 && contrastAt(alpha) < 4.5) alpha = Math.min(.95, alpha + .01);
    alpha = Math.ceil(alpha * 1000) / 1000;
    return { ...colors, mode, alpha, contrast: contrastAt(alpha) };
  }

  function injectBackgroundStyles() {
    if (document.getElementById('nsit-background-style')) return;
    const style = document.createElement('style'); style.id = 'nsit-background-style';
    style.textContent = `
      html.nsit-background-on{background:#111827!important}
      html.nsit-background-on body{background:transparent!important;isolation:isolate;color:var(--nsbg-ink)!important;
        --bg-main-color:var(--nsbg-solid);--bg-sub-color:var(--nsbg-solid);
        --text-color:var(--nsbg-ink);--body-text:var(--nsbg-ink);--gray-color:var(--nsbg-muted);
        --link-color:var(--nsbg-link);--link-hover-color:var(--nsbg-ink);--tab-text:var(--nsbg-muted);--tab-text-hover:var(--nsbg-ink);--tab-active-text:var(--nsbg-ink)}
      [data-nsit-background-layer]{position:fixed;inset:0;z-index:-2;pointer-events:none;background-color:#111827;background-size:cover;background-repeat:no-repeat;background-position:50% 50%}
      html.nsit-background-on #nsk-body{position:relative;background:transparent!important;color:var(--nsbg-ink)!important}
      html.nsit-background-on #nsk-body::before,html.nsit-background-on #nsk-left-panel-container .nsk-panel.category-list::before,html.nsit-background-on body>header::before,html.nsit-background-on body>footer::before,html.nsit-background-on #editor.nst-fixed-editor::before{
        content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;background:var(--nsbg-panel);
        -webkit-backdrop-filter:var(--nsbg-backdrop,none);backdrop-filter:var(--nsbg-backdrop,none)}
      html.nsit-background-on body>header,html.nsit-background-on body>footer{position:relative;background:transparent!important;color:var(--nsbg-ink)!important}
      html.nsit-background-on #nsk-body :is(.user-stat,.nsk-panel,.nsk-post,.comment-container,.post-list-controler,ul.post-list,li.content-item,li.post-list-item:not(.nsit-filter-highlighted)){background-color:transparent!important}
      html.nsit-background-on #nsk-body :is(.nsk-panel,.post-content,.post-title,.author-info){color:var(--nsbg-ink)}
      html.nsit-background-on #nsk-body :is(.content-info,.info-author,.info-last-comment,.signature,.nsit-author-info){color:var(--nsbg-muted)}
      html.nsit-background-on #nsk-body :is(.post-title>a,.author-name,.nsk-panel a,.user-stat a){color:var(--nsbg-link)}
      /* The fixed category navigation sits outside the main panel's bounds.
         Give its inner card the same glass surface, retaining the fixed parent. */
      html.nsit-background-on #nsk-left-panel-container .nsk-panel.category-list{position:relative;color:var(--nsbg-ink);font-family:inherit;font-size:inherit;line-height:inherit}
      /* Native inactive categories use opacity:.5, which dims the text and
         currentColor icons after the readable palette has been applied. */
      html.nsit-background-on #nsk-left-panel-container .nsk-panel.category-list li{opacity:1}
      html.nsit-background-on #nsk-left-panel-container .nsk-panel.category-list a{color:var(--nsbg-link)}
      html.nsit-background-on #nsk-body ul.comments.nst-thread{--nst-surface:var(--nsbg-solid)}
      html.nsit-background-on #editor.nst-fixed-editor{background:transparent!important;color:var(--nsbg-ink)}
      html.nsit-background-on #editor .nst-editor-head{background:transparent!important;color:var(--nsbg-ink)}
      html.nsit-background-on #nsk-body .post-content a{color:var(--nsbg-link)}
      /* Keep syntax highlighting, badges, action colors and editor contents in
         their native theme. Never apply a universal foreground override. */
      html.nsit-background-on body :is(pre,code,kbd,samp,#editor .md-editor,.CodeMirror){
        --bg-main-color:var(--nsbg-native-bg-main-color);--bg-sub-color:var(--nsbg-native-bg-sub-color);
        --text-color:var(--nsbg-native-text-color);--body-text:var(--nsbg-native-body-text);--gray-color:var(--nsbg-native-gray-color);
        --link-color:var(--nsbg-native-link-color);--link-hover-color:var(--nsbg-native-link-hover-color)}
      :where(html.nsit-background-on body :is(pre,#editor .md-editor,.CodeMirror)){color:var(--nsbg-native-text-color)}
      :where(html.nsit-background-on body code:not(pre code)){color:var(--nsbg-native-text-color)}
      @supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
        html.nsit-background-on #nsk-body::before,html.nsit-background-on #nsk-left-panel-container .nsk-panel.category-list::before,html.nsit-background-on body>header::before,html.nsit-background-on body>footer::before,html.nsit-background-on #editor.nst-fixed-editor::before{background:var(--nsbg-solid)!important}}
      .nsit-background-modal{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:16px;background:var(--nsit-scrim,rgba(0,0,0,.5));color:var(--nsit-ink,#27334a);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .nsit-background-modal[hidden]{display:none}
      .nsit-background-dialog{box-sizing:border-box;width:min(500px,100%);max-height:calc(100dvh - 32px);overflow:auto;padding:20px;border:1px solid var(--nsit-line-strong,#bbb);border-radius:12px;background:var(--nsit-surface,#fff);box-shadow:0 12px 40px #0004}
      .nsit-background-dialog header{display:flex;align-items:center;justify-content:space-between;gap:12px;background:transparent}
      .nsit-background-dialog h2{margin:0;font-size:17px}.nsit-background-dialog label{display:block;margin:14px 0 6px}
      .nsit-background-dialog p{margin:6px 0;color:var(--nsit-muted,#64748b);font-size:12px}
      .nsit-background-dialog input[type=url]{box-sizing:border-box;width:100%;padding:9px;border:1px solid var(--nsit-line-strong,#bbb);border-radius:6px;background:var(--nsit-sunken,#f5f5f5);color:var(--nsit-ink,#27334a);font:inherit}
      .nsit-background-dialog input[type=range]{width:100%;margin:4px 0;accent-color:var(--nsit-info,#3287be)}
      .nsit-background-dialog output{float:right;font-variant-numeric:tabular-nums;color:var(--nsit-muted,#64748b)}
      .nsit-background-dialog button{padding:6px 12px;border:1px solid var(--nsit-line-strong,#bbb);border-radius:6px;background:var(--nsit-sunken,#f5f5f5);color:var(--nsit-ink,#27334a);font:inherit;cursor:pointer}
      .nsit-background-dialog footer{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px;background:transparent}
      .nsit-background-dialog button[type=submit]{border-color:var(--nsit-accent,#d9961c);background:var(--nsit-accent-soft,#fff8ea);color:var(--nsit-accent-ink,#875800)}
      .nsit-background-dialog [role=status]{display:block;min-height:21px;margin:12px 0 0;overflow-wrap:anywhere}
      .nsit-background-dialog [data-nsit-background-focus]{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .nsit-background-dialog [data-nsit-background-focus][hidden]{display:none}
      @media(max-width:520px){.nsit-background-dialog{padding:16px}.nsit-background-dialog footer button{flex:1}}
    `;
    document.head.append(style);
  }

  function ensureBackgroundSettingsTrigger() {
    const path = '<rect x="5" y="7" width="38" height="34" rx="5" stroke="currentColor" stroke-width="4"/><circle cx="16" cy="18" r="4" stroke="currentColor" stroke-width="3"/><path d="m7 35 11-11 8 8 7-8 9 11" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';
    ensureStatSettingsTrigger(0, 'nsit-background', '外观', path, openBackgroundSettings);
  }

  function installCustomBackground() {
    window[BACKGROUND_RUNTIME_KEY]?.disconnect?.();
    injectBackgroundStyles();
    let disposed = false, revision = 0, frame = null, current = null, resource = null, lastRender = null;
    const cache = new Map(), cancelLoads = new Set();
    const root = document.documentElement;
    const nativeNames = ['bg-main-color', 'bg-sub-color', 'text-color', 'body-text', 'gray-color', 'link-color', 'link-hover-color'];
    let nativeColors = {}, nativeDark = document.body.classList.contains('dark-layout');
    function readNativeColors() {
      const active = root.classList.contains('nsit-background-on');
      // Resolve the site's theme without our overrides, then restore in the
      // same task before the browser paints. Native code/editor surfaces keep
      // their original foreground AND background when our panel tone changes.
      root.classList.remove('nsit-background-on');
      const css = getComputedStyle(document.body), dark = document.body.classList.contains('dark-layout');
      nativeDark = dark;
      nativeColors = Object.fromEntries(nativeNames.map(name => [name, css.getPropertyValue(`--${name}`).trim() || (name.startsWith('bg-') ? dark ? '#272727' : '#fff' : dark ? '#ddd' : '#222')]));
      if (active) root.classList.add('nsit-background-on');
    }
    readNativeColors();
    const viewport = () => ({ width: Math.max(1, innerWidth || root.clientWidth), height: Math.max(1, innerHeight || root.clientHeight) });
    let layer = null;

    function loadImage(url, cors = false) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        if (cors) image.crossOrigin = 'anonymous';
        let finished = false;
        const end = (error) => {
          if (finished) return;
          finished = true; clearTimeout(timer); cancelLoads.delete(cancel);
          image.onload = image.onerror = null;
          if (error) { image.removeAttribute?.('src'); reject(error); }
          else resolve(image);
        };
        const cancel = () => end(new Error('图片加载已取消'));
        const timer = setTimeout(() => end(new Error('图片加载超时，请检查图床直链')), cors ? 5000 : 15000);
        cancelLoads.add(cancel);
        image.onload = () => end(image.naturalWidth > 0 && image.naturalHeight > 0 ? null : new Error('该地址未返回可显示的图片'));
        image.onerror = () => end(new Error('图片加载失败，请检查图片直链或图床防盗链设置'));
        image.src = url;
      });
    }

    async function sampleImage(url) {
      try {
        const image = await loadImage(url, true);
        if (disposed) return null;
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return null;
        context.fillStyle = '#111827'; context.fillRect(0, 0, 64, 64);
        context.drawImage(image, 0, 0, 64, 64);
        const pixels = context.getImageData(0, 0, 64, 64);
        return { width: 64, height: 64, data: pixels.data };
      } catch (_) { return null; }
    }

    function removeAppearance() {
      lastRender = null;
      root.classList.remove('nsit-background-on');
      delete root.dataset.nsitBackgroundTone;
      layer?.remove(); layer = null;
      for (const key of [...root.style]) if (key.startsWith('--nsbg-')) root.style.removeProperty(key);
    }

    function render() {
      if (disposed || !current?.enabled || !resource) return;
      const size = viewport();
      const key = JSON.stringify([current, size, nativeColors, nativeDark]);
      if (layer?.isConnected && lastRender?.key === key && lastRender.resource === resource && lastRender.sample === resource.sample) return;
      let position = { x: current.focusX, y: current.focusY };
      if (current.autoFocus) {
        const cached = resource.framing;
        if (!cached || cached.sample !== resource.sample || cached.width !== size.width || cached.height !== size.height) {
          resource.framing = { sample: resource.sample, width: size.width, height: size.height, position: backgroundAutoPosition(resource.sample, resource, size) };
        }
        position = resource.framing.position;
      }
      const crop = backgroundCrop(resource, size, position);
      const palette = backgroundPalette(resource.sample, current, crop, nativeDark);
      if (!layer?.isConnected) {
        layer = document.createElement('div'); layer.dataset.nsitBackgroundLayer = ''; layer.setAttribute('aria-hidden', 'true');
        document.body.prepend(layer);
      }
      // Assign the URL as one quoted CSS value; never concatenate user content
      // into a style element or HTML template.
      layer.style.backgroundImage = `url(${JSON.stringify(current.backgroundUrl)})`;
      layer.style.backgroundPosition = `${position.x}% ${position.y}%`;
      const values = { panel: `rgba(${palette.surface.join(',')},${palette.alpha})`, solid: `rgb(${palette.surface.join(',')})`, ink: palette.ink, muted: palette.muted, link: palette.link, border: palette.border, blur: `${current.blur}px`, backdrop: current.lowPower || current.blur === 0 ? 'none' : `blur(${current.blur}px)` };
      for (const [key, value] of Object.entries(values)) root.style.setProperty(`--nsbg-${key}`, value);
      for (const [key, value] of Object.entries(nativeColors)) root.style.setProperty(`--nsbg-native-${key}`, value);
      root.dataset.nsitBackgroundTone = palette.mode;
      root.classList.add('nsit-background-on');
      const resolution = `图片 ${resource.width} × ${resource.height} · `;
      runtime.status = resolution + (resource.sample ? `已适配${palette.mode === 'light' ? '亮色' : '暗色'}背景 · 主体不透明度 ${Math.round(palette.alpha * 100)}%` : `背景已显示 · 使用高对比${palette.mode === 'light' ? '浅色' : '深色'}保护${current.autoFocus ? '与居中取景' : ''}`) + (current.lowPower ? ' · 省电显示' : '');
      lastRender = { key, resource, sample: resource.sample };
    }

    async function apply(value, { persist = false } = {}) {
      const settings = normalizeBackgroundSettings(value), id = ++revision;
      if (disposed) return { ok: false, error: '外观已关闭' };
      if ((value?.backgroundUrl && !settings.backgroundUrl) || (value?.enabled === true && !settings.backgroundUrl)) return { ok: false, error: '请填写有效的 HTTP / HTTPS 图片直链' };
      if (!settings.enabled) {
        try { if (persist) writeBackgroundSettings(settings); } catch (_) { return { ok: false, error: '设置保存失败，请检查浏览器存储' }; }
        current = settings; resource = null; removeAppearance(); runtime.status = '已恢复论坛原有外观';
        return { ok: true };
      }
      let nextResource = cache.get(settings.backgroundUrl);
      if (!nextResource) {
        try {
          const image = await loadImage(settings.backgroundUrl);
          nextResource = { width: image.naturalWidth, height: image.naturalHeight, image, sample: null };
        } catch (error) { return { ok: false, error: error.message }; }
      }
      if (disposed || id !== revision) return { ok: false, cancelled: true };
      try { if (persist) writeBackgroundSettings(settings); } catch (_) { return { ok: false, error: '设置保存失败，请检查浏览器存储' }; }
      current = settings; resource = nextResource;
      cache.set(settings.backgroundUrl, nextResource);
      if (cache.size > 3) {
        // Keep the saved image during previews: closing must restore it even
        // if its host has gone offline after it was originally displayed.
        const savedURL = backgroundSettings().backgroundUrl;
        const oldest = [...cache.keys()].find(url => url !== savedURL && url !== settings.backgroundUrl);
        if (oldest) cache.delete(oldest);
      }
      render();
      // Render immediately even on hosts that reject CORS; sampling is only an
      // enhancement, never a requirement for displaying a user-selected image.
      if (!nextResource.probed) {
        nextResource.probed = true;
        void sampleImage(settings.backgroundUrl).then(sample => {
          nextResource.sample = sample;
          if (!disposed && resource === nextResource && current?.enabled) render();
        });
      }
      return { ok: true };
    }

    function refresh() {
      if (disposed) return;
      ensureBackgroundSettingsTrigger();
      if (current?.enabled && !layer?.isConnected) render();
    }
    const resize = () => { clearTimeout(frame); frame = setTimeout(render, 100); };
    window.addEventListener('resize', resize);
    const theme = new MutationObserver(() => {
      if (document.body.classList.contains('dark-layout') === nativeDark) return;
      readNativeColors(); render();
    });
    theme.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const runtime = { apply, refresh, status: '', disconnect() {
      disposed = true; revision++; clearTimeout(frame); window.removeEventListener('resize', resize); theme.disconnect();
      for (const cancel of [...cancelLoads]) cancel();
      removeAppearance();
    } };
    window[BACKGROUND_RUNTIME_KEY] = runtime;
    refresh(); void apply(backgroundSettings());
    return runtime;
  }

  function openBackgroundSettings() {
    let modal = document.querySelector('[data-nsit-background-dialog]');
    if (!modal) {
      injectBackgroundStyles();
      modal = document.createElement('div'); modal.className = 'nsit-background-modal'; modal.dataset.nsitBackgroundDialog = ''; modal.hidden = true;
      modal.innerHTML = `<section class="nsit-background-dialog" role="dialog" aria-modal="true" aria-labelledby="nsit-background-title">
        <header><h2 id="nsit-background-title">背景与外观</h2><button type="button" data-nsit-background-close aria-label="关闭外观设置">×</button></header>
        <form novalidate>
          <label><input type="checkbox" name="enabled"> 启用自定义背景</label>
          <label for="nsit-background-url">图片直链</label><input id="nsit-background-url" type="url" name="backgroundUrl" maxlength="4096" placeholder="https://你的图床/背景.jpg" autocomplete="off">
          <p>将图片上传到自己选择的图床，再粘贴原图直链，避免缩略图放大。支持 JPG、PNG、WebP 等图片；必应 UHD 壁纸链接自动使用原图。</p>
          <label><input type="checkbox" name="lowPower"> 省电显示（推荐）</label><p>保留高清壁纸与半透明面板，关闭实时毛玻璃以减少渲染开销。取消勾选可恢复毛玻璃效果。</p>
          <label for="nsit-background-blur">毛玻璃模糊 <output data-nsit-background-output="blur"></output></label><input id="nsit-background-blur" type="range" name="blur" min="0" max="32" step="1">
          <label for="nsit-background-opacity">主体不透明度 <output data-nsit-background-output="opacity"></output></label><input id="nsit-background-opacity" type="range" name="opacity" min="35" max="95" step="1">
          <label><input type="checkbox" name="autoContrast"> 自动适配文字对比色</label><p>按图片明暗切换正文、次要文字和链接颜色；为保证可读性，必要时自动提高主体不透明度。代码、徽章与功能按钮保留原有配色。</p>
          <label><input type="checkbox" name="autoFocus"> 自动取景，适应页面尺寸</label><p>图片等比铺满，按画面细节选择裁切位置；窗口变化时重新适配。图床不支持亮度读取时，使用居中取景与高对比底色。</p>
          <div data-nsit-background-focus><div><label for="nsit-background-x">横向焦点 <output data-nsit-background-output="focusX"></output></label><input id="nsit-background-x" type="range" name="focusX" min="0" max="100"></div><div><label for="nsit-background-y">纵向焦点 <output data-nsit-background-output="focusY"></output></label><input id="nsit-background-y" type="range" name="focusY" min="0" max="100"></div></div>
          <footer><button type="button" data-nsit-background-preview>预览</button><button type="submit">保存设置</button><button type="button" data-nsit-background-reset>恢复默认</button></footer><span role="status" aria-live="polite" data-nsit-background-message></span>
        </form></section>`;
      document.body.append(modal);
      modal._nsitAction = 0;
      const form = modal.querySelector('form'), message = modal.querySelector('[data-nsit-background-message]');
      const values = () => Object.fromEntries([...form.elements].filter(node => node.name).map(node => [node.name, node.type === 'checkbox' ? node.checked : node.value]));
      const update = () => {
        for (const key of ['blur', 'opacity', 'focusX', 'focusY']) modal.querySelector(`[data-nsit-background-output="${key}"]`).textContent = `${form.elements.namedItem(key).value}${key === 'blur' ? 'px' : '%'}`;
        form.elements.namedItem('blur').disabled = form.elements.namedItem('lowPower').checked;
        modal.querySelector('[data-nsit-background-focus]').hidden = form.elements.namedItem('autoFocus').checked;
      };
      modal._nsitFill = () => {
        const settings = backgroundSettings();
        for (const [key, value] of Object.entries(settings)) {
          const input = form.elements.namedItem(key);
          if (input.type === 'checkbox') input.checked = value; else input.value = value;
        }
        update();
      };
      const close = () => {
        modal._nsitAction++; modal.hidden = true;
        void window[BACKGROUND_RUNTIME_KEY]?.apply(backgroundSettings());
        modal._nsitReturnFocus?.focus();
      };
      const run = async (settings, persist, reset = false) => {
        const id = ++modal._nsitAction;
        message.textContent = settings.enabled ? '正在加载背景…' : '正在恢复外观…';
        const runtime = window[BACKGROUND_RUNTIME_KEY] || installCustomBackground();
        const result = await runtime.apply(settings, { persist });
        if (id !== modal._nsitAction || modal.hidden) return;
        if (reset && result.ok) modal._nsitFill();
        message.textContent = result.ok ? `${persist ? '已保存。' : '预览中，保存后生效；关闭将还原。'}${runtime.status}` : result.error || '操作已取消';
      };
      form.addEventListener('input', update); form.addEventListener('change', update);
      form.addEventListener('submit', event => { event.preventDefault(); void run(values(), true); });
      modal.querySelector('[data-nsit-background-preview]').addEventListener('click', () => { void run(values(), false); });
      modal.querySelector('[data-nsit-background-reset]').addEventListener('click', () => { void run({ ...BACKGROUND_DEFAULTS }, true, true); });
      modal.querySelector('[data-nsit-background-close]').addEventListener('click', close);
      modal.addEventListener('click', event => { if (event.target === modal) close(); });
      modal.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); close(); }
        if (event.key === 'Tab') {
          const focusable = [...modal.querySelectorAll('button,input')].filter(node => !node.disabled && !node.closest('[hidden]'));
          if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
          else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0]?.focus(); }
        }
      });
    }
    modal._nsitAction++; modal._nsitReturnFocus = document.activeElement; modal._nsitFill();
    modal.querySelector('[data-nsit-background-message]').textContent = '';
    modal.hidden = false; modal.querySelector('[data-nsit-background-close]').focus();
  }
