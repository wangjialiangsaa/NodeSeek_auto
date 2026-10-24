function installHomeFeedLoading() {
  'use strict';
  if (document.getElementById('nsit-home-feed-style')) return { refresh() {} };
  const style = document.createElement('style');
  style.id = 'nsit-home-feed-style';
  style.textContent = '.nsit-home-loader{box-sizing:border-box;padding:22px 12px;min-height:60px;text-align:center;color:inherit;opacity:.7;font-size:13px}.nsit-home-pager-hidden{display:none!important}';
  document.head.append(style);
  let state = null, timer = 0;

  function pageNumber(url) {
    if (url.origin !== location.origin) return null;
    const match = url.pathname.match(/^\/(?:page-([1-9]\d*)\/?)?$/);
    if (!match) return null;
    const page = Number(match[1] || 1);
    return Number.isSafeInteger(page) ? page : null;
  }
  function sortOrder(doc) { return doc.querySelector('.sorter [data-sort].selected')?.getAttribute('data-sort') || ''; }
  function currentContext() {
    const url = new URL(location.href), page = pageNumber(url);
    return page ? { page, search:url.search, sort:sortOrder(document), key:`${url.pathname}${url.search}|${sortOrder(document)}` } : null;
  }
  function mainList(doc) {
    return [...doc.querySelectorAll('ul.post-list:not(.topic-carousel-panel)')].find(list => !list.closest('.topic-carousel-wrapper')) || null;
  }
  function rows(list) { return [...list.children].filter(row => row.matches('li.post-list-item')); }
  function postId(row) {
    const href = row.querySelector('.post-title > a[href]')?.getAttribute('href');
    if (!href) return null;
    try {
      const url = new URL(href,location.href);
      return url.origin === location.origin ? url.pathname.match(/^\/post-([1-9]\d*)-\d+\/?$/)?.[1] || null : null;
    } catch { return null; }
  }
  function nextPage(doc, s, after) {
    for (const link of doc.querySelectorAll('[aria-label="pagination"] a[rel="next"][href]')) {
      try {
        const url = new URL(link.getAttribute('href'),location.href);
        if (pageNumber(url) !== after + 1 || s.loadedPages.has(after + 1)) continue;
        if (!url.search) url.search = s.search;
        if (url.search !== s.search) continue;
        return url.pathname + url.search;
      } catch { /* Keep malformed links out of the loading queue. */ }
    }
    return null;
  }
  function active(s) {
    return state === s && featureEnabled('homeAutoLoad') && currentContext()?.key === s.key && mainList(document) === s.list && s.list.isConnected;
  }
  function status(s) {
    const text = s.loading ? '正在加载下一页…' : s.error ? '加载失败，稍后继续下滑自动重试' : s.nextURL ? `已加载到第 ${s.loadedThrough} 页，继续下滑自动加载` : '已到末页，当前阅读范围已加载';
    if (s.loader.textContent !== text) s.loader.textContent = text;
    if (s.loader.title !== s.error) s.loader.title = s.error;
  }
  function hideBottomPagers(s) {
    for (const pager of document.querySelectorAll('.nsk-pager.pager-bottom')) {
      if (!pager.classList.contains('nsit-home-pager-hidden')) {
        pager.classList.add('nsit-home-pager-hidden'); s.hiddenPagers.add(pager);
      }
    }
  }
  function sanitize(row, page) {
    row.querySelectorAll('script,style,link,meta,base,iframe,object,embed,form,template,[data-nsit-replied-post-label]').forEach(node => node.remove());
    row.classList.remove('nsit-filter-hidden','nsit-filter-highlighted');
    row.style.removeProperty('--nsit-filter-highlight');
    const ids = new Map();
    for (const node of [row,...row.querySelectorAll('[id]')]) if (node.id) {
      const previous = node.id; node.id = `nsit-home-${page}-${previous}`; ids.set(previous,node.id);
    }
    for (const node of [row,...row.querySelectorAll('*')]) for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase(), value = attribute.value.trim();
      if (/^on/.test(name) || name.startsWith('data-nsit-') || ['srcdoc','srcset'].includes(name)) node.removeAttribute(attribute.name);
      else if (['href','src','xlink:href','action','formaction'].includes(name)) {
        if (value.startsWith('#')) {
          // SVG icons reference the symbol sprite already present on the current page.
          if (node.localName !== 'use' && ids.has(value.slice(1))) node.setAttribute(attribute.name,`#${ids.get(value.slice(1))}`);
          continue;
        }
        try { if (!['http:','https:','mailto:'].includes(new URL(value,location.href).protocol)) node.removeAttribute(attribute.name); }
        catch { node.removeAttribute(attribute.name); }
      }
    }
    row.dataset.nsitHomeLoaded = String(page);
  }
  async function loadNext(s) {
    if (!active(s) || s.loading || !s.nextURL || Date.now() < s.retryAfter) return;
    const url = s.nextURL, expected = new URL(url,location.href), page = pageNumber(expected);
    const controller = new AbortController(); s.controller = controller;
    const timeout = setTimeout(() => controller.abort(),15000);
    s.loading = true; s.error = ''; status(s);
    try {
      const response = await fetch(url,{credentials:'same-origin',signal:controller.signal});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const final = new URL(response.url || url,location.href);
      if (pageNumber(final) !== page || final.search !== expected.search) throw new Error('分页跳转异常');
      const doc = new DOMParser().parseFromString(await response.text(),'text/html'), list = mainList(doc);
      if (!list) throw new Error('未取得帖子列表，请先完成站点登录或验证');
      if (sortOrder(doc) !== s.sort) throw new Error('帖子排序已改变，请刷新主页后继续');
      if (!active(s) || controller.signal.aborted) return;
      const known = new Set(rows(s.list).map(postId).filter(Boolean)), fragment = document.createDocumentFragment();
      for (const remote of rows(list)) {
        const id = postId(remote);
        if (!id || known.has(id)) continue;
        const row = document.importNode(remote,true); sanitize(row,page);
        known.add(id); s.imported.add(row); fragment.append(row);
      }
      s.list.append(fragment);
      s.loadedPages.add(page); s.loadedThrough = page; s.nextURL = nextPage(doc,s,page);
    } catch (error) {
      if (active(s)) { s.error = controller.signal.aborted ? '请求超时' : error.message; s.retryAfter = Date.now() + 5000; }
    } finally {
      clearTimeout(timeout); s.loading = false;
      if (state === s) {
        status(s);
        // Filtering or a short page can leave the sentinel visible without a new IO event.
        if (!s.error) requestAnimationFrame(() => maybeLoad(s));
      }
    }
  }
  function maybeLoad(s) {
    if (!s || !active(s) || document.hidden || !s.loader.isConnected) return;
    const box = s.loader.getBoundingClientRect();
    if (box.top <= window.innerHeight + 350 && box.bottom >= 0) void loadNext(s);
  }
  function cleanup() {
    if (!state) return;
    const previous = state; state = null;
    previous.controller?.abort(); previous.intersection?.disconnect();
    previous.imported.forEach(row => row.remove());
    previous.hiddenPagers.forEach(pager => pager.classList.remove('nsit-home-pager-hidden'));
    previous.loader.remove();
  }
  function refresh() {
    const current = currentContext(), list = mainList(document);
    if (!featureEnabled('homeAutoLoad') || !current || !list) { cleanup(); return; }
    if (state && (state.key !== current.key || state.list !== list)) cleanup();
    if (!state) {
      const loader = document.createElement('div'); loader.className = 'nsit-home-loader';
      loader.setAttribute('role','status');
      const s = { ...current,list,loader,imported:new Set(),hiddenPagers:new Set(),loadedPages:new Set([current.page]),loadedThrough:current.page,retryAfter:0,error:'',loading:false };
      state = s; s.nextURL = nextPage(document,s,s.page); list.after(loader);
      if (typeof IntersectionObserver === 'function') {
        s.intersection = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) void loadNext(s); },{rootMargin:'0px 0px 350px 0px'});
        s.intersection.observe(loader);
      } else requestAnimationFrame(() => maybeLoad(s));
    }
    const s = state;
    if (s.list.nextElementSibling !== s.loader) s.list.after(s.loader);
    hideBottomPagers(s); status(s);
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(refresh,80); }
  const observer = new MutationObserver(records => {
    if (records.some(record => !record.target.closest?.('.nsit-home-loader,.topic-carousel-panel,.topic-carousel-wrapper'))) schedule();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  // Scroll and resize fire many times per frame; measure the loader at most once per frame.
  let loadFrame = 0;
  const scheduleLoadCheck = () => { if (!loadFrame) loadFrame = requestAnimationFrame(() => { loadFrame = 0; maybeLoad(state); }); };
  window.addEventListener('scroll',scheduleLoadCheck,{passive:true});
  window.addEventListener('resize',scheduleLoadCheck,{passive:true});
  window.addEventListener('popstate',schedule);
  window.addEventListener('pageshow',schedule);
  refresh();
  return { refresh };
}
