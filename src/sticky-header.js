  function installStickyHeader() {
    const key = '__nsitStickyHeader__', root = document.documentElement;
    window[key]?.disconnect?.();
    let header = null, disposed = false;
    if (!document.getElementById('nsit-pinned-header-style')) {
      const style = document.createElement('style'); style.id = 'nsit-pinned-header-style';
      style.textContent = `
        /* Pin the outer header: #nsk-head is a short inner navigation row. */
        html body>header.nsit-pinned-header{position:sticky!important;top:0;z-index:1000}
        html.nsit-header-pinned{scroll-padding-top:calc(var(--nsit-header-height,0px) + 12px)}
      `;
      document.head.append(style);
    }
    function measure() {
      if (disposed || !header?.isConnected) return;
      const value = `${Math.max(0, Math.ceil(header.getBoundingClientRect().height))}px`;
      if (root.style.getPropertyValue('--nsit-header-height') !== value) root.style.setProperty('--nsit-header-height', value);
    }
    const size = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    function release() {
      size?.disconnect();
      if (header?.classList.contains('nsit-pinned-header')) header.classList.remove('nsit-pinned-header');
      header = null;
      if (root.classList.contains('nsit-header-pinned')) root.classList.remove('nsit-header-pinned');
      if (root.style.getPropertyValue('--nsit-header-height')) root.style.removeProperty('--nsit-header-height');
    }
    function refresh() {
      if (disposed) return;
      const outer = document.getElementById('nsk-head')?.closest('header');
      const next = outer?.parentElement === document.body ? outer : null;
      let changed = next !== header;
      if (changed) { release(); header = next; if (header) size?.observe(header); }
      if (!header) return;
      if (!header.classList.contains('nsit-pinned-header')) { header.classList.add('nsit-pinned-header'); changed = true; }
      if (!root.classList.contains('nsit-header-pinned')) { root.classList.add('nsit-header-pinned'); changed = true; }
      if (changed || !root.style.getPropertyValue('--nsit-header-height')) measure();
    }
    window.addEventListener('resize', measure);
    const runtime = { refresh, disconnect() {
      if (disposed) return;
      disposed = true; window.removeEventListener('resize', measure); release();
    } };
    window[key] = runtime; refresh(); return runtime;
  }
