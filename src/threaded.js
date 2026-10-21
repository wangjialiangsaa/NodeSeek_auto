function installThreadedReading() {
  'use strict';
  if (document.getElementById('nst-style')) return { refresh() {} };

  const style = document.createElement('style');
  style.id = 'nst-style';
  style.textContent = `
    .nst-modebar { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin:14px 0; padding:10px 12px; border:1px solid #8883; border-radius:9px; font-size:13px; }
    .nst-modes { display:flex; gap:3px; flex-wrap:wrap; }
    .nst-modebar button,.nst-relation button { font:inherit; color:inherit; cursor:pointer; border:1px solid #8884; border-radius:6px; background:transparent; padding:5px 9px; }
    .nst-modebar button[aria-pressed="true"] { color:#3287be; background:#3287be15; border-color:#3287be65; }
    .nst-modebar button:disabled { opacity:.55; cursor:wait; }
    .nst-modebar button:focus-visible,.nst-relation a:focus-visible,.nst-relation button:focus-visible { outline:2px solid #3287be; outline-offset:2px; }
    .nst-status { margin-inline-start:auto; opacity:.72; font-size:12px; }
    .nst-progress { flex-basis:100%; height:3px; border-radius:3px; overflow:hidden; background:#8882; }
    .nst-progress > span { display:block; height:100%; width:0; background:#3287be; }
    ul.comments.nst-thread { position:relative; display:flex !important; flex-direction:column; overflow-anchor:none; }
    ul.comments.nst-thread > li.content-item { order:1000000; min-width:0; box-sizing:border-box; position:relative; }
    ul.comments.nst-thread > li > .post-content,ul.comments.nst-thread > li > .comment-menu,
    ul.comments.nst-thread > li > .nst-relation,ul.comments.nst-thread > li > .nst-auto-quote { margin-inline-start:50px; }
    ul.comments.nst-thread > li[data-nst-depth]:not([data-nst-depth="0"]) {
      margin-block:0 !important; margin-inline-start:30px !important; padding:12px 12px 10px calc(12px + var(--nst-indent,0) * 22px) !important;
      border-block:0 !important; background:color-mix(in srgb,currentColor 5%,transparent);
    }
    ul.comments.nst-thread > li[data-nst-first] { margin-top:7px !important; border-radius:9px 9px 0 0; }
    ul.comments.nst-thread > li[data-nst-last] { margin-bottom:18px !important; border-radius:0 0 9px 9px; }
    ul.comments.nst-thread > li[data-nst-first][data-nst-last] { border-radius:9px; }
    ul.comments.nst-thread > li[data-nst-depth]:not([data-nst-depth="0"]) .avatar-normal { width:28px !important; height:28px !important; }
    ul.comments.nst-thread > li[data-nst-depth]:not([data-nst-depth="0"]) .post-content { font-size:14px; line-height:1.7; overflow-wrap:anywhere; }
    ul.comments.nst-thread > li[data-nst-depth]:not([data-nst-depth="0"]) > .post-content,
    ul.comments.nst-thread > li[data-nst-depth]:not([data-nst-depth="0"]) > .comment-menu,
    ul.comments.nst-thread > li[data-nst-depth]:not([data-nst-depth="0"]) > .nst-relation,
    ul.comments.nst-thread > li[data-nst-depth]:not([data-nst-depth="0"]) > .nst-auto-quote { margin-inline-start:38px; }
    ul.comments.nst-thread > li[data-nst-depth]:not([data-nst-depth="0"]) .comment-menu { margin-top:7px; }
    .nst-relation { display:flex; align-items:center; gap:7px; flex-wrap:wrap; margin:4px 0 6px; font-size:12px; opacity:.8; }
    .nst-relation a { color:inherit; text-decoration:none; }
    .nst-relation a:hover { color:#3287be; text-decoration:underline; }
    .nst-relation button { padding:1px 6px; font-size:11px; }
    .nst-auto-quote { margin:8px 0; padding:8px 12px; border-inline-start:3px solid #8885; border-radius:4px; background:#8881; font-size:13px; white-space:pre-wrap; overflow-wrap:anywhere; }
    .nst-thread .nst-reply-prefix { display:none !important; }
    .nst-connectors { position:absolute; inset:0; width:100%; height:100%; overflow:visible; pointer-events:none; z-index:1; }
    .nst-connectors path { fill:none; stroke:color-mix(in srgb,currentColor 20%,transparent); stroke-width:1.4; stroke-linejoin:round; stroke-linecap:round; }
    .nst-auto-load { padding:20px 12px; text-align:center; font-size:13px; color:inherit; opacity:.7; min-height:56px; }
    .nst-pagination-hidden { display:none !important; }
    .nst-loaded-menu { display:flex; justify-content:flex-end; flex-wrap:wrap; gap:14px; font-size:12px; }
    .nst-loaded-menu button,.nst-loaded-menu a { color:inherit; background:none; border:0; padding:3px 0; font:inherit; cursor:pointer; text-decoration:none; }
    #editor.nst-fixed-editor { position:fixed !important; left:var(--nst-editor-left,12px) !important; bottom:0 !important; top:auto !important; width:var(--nst-editor-width,calc(100% - 24px)) !important; max-height:min(65vh,460px); z-index:900; background:var(--bg-main-color,#fff); border:1px solid #8884; border-radius:9px 9px 0 0; box-shadow:0 -4px 24px #0002; overflow:auto; margin:0 !important; box-sizing:border-box; }
    #editor.nst-fixed-editor > .md-editor { position:static !important; width:100% !important; top:auto !important; left:auto !important; margin:0 !important; transform:none !important; }
    .nst-editor-head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:8px 12px; min-height:42px; font-size:13px; background:var(--bg-main-color,#fff); }
    .nst-editor-head button { padding:4px 10px; border:1px solid #8885; border-radius:5px; background:transparent; font:inherit; color:inherit; cursor:pointer; }
    #editor.nst-editor-collapsed > .md-editor { display:none !important; }
    #editor.nst-fixed-editor:has(#nsit-app:is(.nsit-open,.nsit-buy-open,.nsit-calc-open,.nsit-catalog-open,.nsit-registered-machine-configs-open,.nsit-personalization-open,.nsit-buy-personalization-open,.nsit-flag-open)) { z-index:2147483647; overflow:visible; }
    #editor.nst-fixed-editor:not(:has(.fullscreen-editor)) #editor-body { height:auto !important; }
    #editor.nst-fixed-editor:not(:has(.fullscreen-editor)) #cm-editor-wrapper,
    #editor.nst-fixed-editor:not(:has(.fullscreen-editor)) #code-mirror-editor,
    #editor.nst-fixed-editor:not(:has(.fullscreen-editor)) .CodeMirror { height:clamp(100px,22vh,200px) !important; }
    #editor.nst-fixed-editor:has(.fullscreen-editor) { position:static !important; overflow:visible; max-height:none; }
    #editor.nst-fixed-editor:has(.fullscreen-editor) > .nst-editor-head { display:none; }
    body.dark-layout #editor.nst-fixed-editor,body.dark-layout .nst-editor-head { background:var(--bg-main-color,#292929); }
    .nst-editor-spacer { height:56px; }
    .nst-docking { scroll-padding-bottom:var(--nst-dock-height,56px); }
    li.content-item.nst-new { box-shadow:inset 3px 0 #3287be; }
    li.content-item.nst-focus { animation:nst-focus 1.6s ease-out; }
    @keyframes nst-focus { from { outline:2px solid #3287be; outline-offset:2px; } to { outline-color:transparent; outline-offset:5px; } }
    @media(max-width:600px) {
      .nst-modebar { gap:6px; padding:8px; }
      .nst-status { margin-inline-start:0; flex-basis:100%; }
      ul.comments.nst-thread > li[data-nst-depth]:not([data-nst-depth="0"]) { margin-inline-start:12px !important; padding-inline-start:calc(8px + var(--nst-indent,0) * 12px) !important; padding-inline-end:8px !important; }
    }
    @media(prefers-reduced-motion:reduce) { .nst-focus { animation:none !important; outline:2px solid #3287be; } }
  `;
  document.head.append(style);

  function read(key, fallback) {
    try {
      if (typeof GM_getValue === 'function') return GM_getValue(`nst:${key}`, fallback);
      const value = localStorage.getItem(`nst:${key}`);
      return value === null ? fallback : JSON.parse(value);
    } catch { return fallback; }
  }
  function write(key, value) {
    try {
      if (typeof GM_setValue === 'function') GM_setValue(`nst:${key}`, value);
      else localStorage.setItem(`nst:${key}`, JSON.stringify(value));
    } catch { /* Storage disabled: the current page remains usable. */ }
  }
  const validModes = ['thread', 'quote', 'raw'];
  let mode = read('mode', 'thread');
  if (!validModes.includes(mode)) mode = 'thread';
  let state = null, timer = 0, frame = 0;
  const savedStyles = new WeakMap();
  const connectorMarkup = new WeakMap();
  const previewCache = new Map();
  const previewRequests = new Map();
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleFrame) : null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function route() {
    const match = location.pathname.match(/^\/post-(\d+)-(\d+)\/?$/);
    return match ? { topic:match[1], page:Number(match[2]) } : null;
  }
  function restoreStyle(card) {
    if (!savedStyles.has(card)) return;
    const value = savedStyles.get(card);
    if (value === null) card.removeAttribute('style');
    else card.setAttribute('style', value);
  }
  function clearCard(card) {
    restoreStyle(card);
    ['nstDepth', 'nstFirst', 'nstLast'].forEach(key => delete card.dataset[key]);
    card.querySelectorAll('.nst-relation,.nst-auto-quote').forEach(n => n.remove());
    card.querySelectorAll('.nst-reply-prefix').forEach(n => n.classList.remove('nst-reply-prefix'));
  }
  function excerpt(body, limit = 600) {
    if (!body) return '';
    const copy = body.cloneNode(true);
    copy.querySelectorAll('script,style,iframe,object,embed,.nst-auto-quote,.nst-relation,.nst-reply-prefix').forEach(n => n.remove());
    copy.querySelectorAll('img').forEach(n => n.replaceWith(n.alt || '[图片]'));
    copy.querySelectorAll('br').forEach(n => n.replaceWith('\n'));
    copy.querySelectorAll('p,li,pre').forEach(n => n.append('\n'));
    return copy.textContent.trim().replace(/\n{3,}/g, '\n\n').slice(0,limit);
  }

  function pageWindow() { return typeof unsafeWindow !== 'undefined' ? unsafeWindow : window; }
  function codeMirror() { return pageWindow().document.querySelector('#editor .CodeMirror')?.CodeMirror; }
  function openEditor(s, focus = false) {
    if (!s?.editor) return;
    s.editor.classList.remove('nst-editor-collapsed');
    s.editorToggle.textContent = '收起'; s.editorToggle.setAttribute('aria-expanded','true');
    requestAnimationFrame(() => { codeMirror()?.refresh?.(); if (focus) codeMirror()?.focus?.(); layoutEditor(s); });
  }
  function layoutEditor(s) {
    if (!s.editor?.isConnected) return;
    const box = s.list.getBoundingClientRect();
    const width = Math.max(0,Math.min(box.width || window.innerWidth - 24,window.innerWidth - 16));
    const left = Math.max(8,Math.min(box.left,window.innerWidth - width - 8));
    s.editor.style.setProperty('--nst-editor-left',`${left}px`);
    s.editor.style.setProperty('--nst-editor-width',`${width}px`);
    const height = Math.ceil(s.editor.getBoundingClientRect().height || 48);
    if (s.editorSpacer.style.height !== `${height + 16}px`) s.editorSpacer.style.height = `${height + 16}px`;
    document.documentElement.style.setProperty('--nst-dock-height',`${height + 16}px`);
    s.editorHeight = height;
  }
  function dockEditor(s) {
    if (s.editor?.isConnected) return;
    const editor = document.getElementById('editor');
    if (!editor?.querySelector('.md-editor')) return;
    s.editor = editor; s.editorStyle = editor.getAttribute('style');
    const header = el('div','nst-editor-head');
    header.append(el('span','', '回复当前帖子'));
    const button = el('button','nst-editor-toggle','展开回复');
    button.type = 'button'; button.setAttribute('aria-expanded','false');
    button.addEventListener('click', () => {
      if (editor.classList.contains('nst-editor-collapsed')) openEditor(s,true);
      else { editor.classList.add('nst-editor-collapsed'); button.textContent='展开回复'; button.setAttribute('aria-expanded','false'); layoutEditor(s); }
    });
    header.append(button); editor.prepend(header);
    const spacer = el('div','nst-editor-spacer'); editor.before(spacer);
    s.editorHeader=header; s.editorToggle=button; s.editorSpacer=spacer;
    editor.classList.add('nst-fixed-editor','nst-editor-collapsed');
    document.documentElement.classList.add('nst-docking');
    s.editorResize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => layoutEditor(s)) : null;
    s.editorResize?.observe(editor); layoutEditor(s);
    // Keep a draft already being edited visible when the script is enabled.
    if (editor.contains(document.activeElement) || editor.querySelector('#nsit-app.nsit-flag-open')) openEditor(s);
  }

  function nextPage(doc, s, after) {
    const links = [...doc.querySelectorAll('.comment-container [aria-label="pagination"] a[rel="next"], [aria-label="pagination"] a[rel="next"]')];
    for (const link of links) {
      const url = new URL(link.getAttribute('href'),location.href);
      const match = url.pathname.match(/^\/post-(\d+)-(\d+)\/?$/);
      if (url.origin === location.origin && match && match[1] === s.topic && Number(match[2]) > after && !s.loadedPages.has(Number(match[2]))) return url.pathname + url.search;
    }
    return null;
  }
  // Read data only; never execute scripts contained in a fetched page.
  function pageConfig(doc) {
    for (const script of doc.querySelectorAll('script')) {
      const text = script.textContent.trim();
      const assignment = text.match(/(?:window\.)?__config__\s*=\s*/);
      const tail = assignment ? text.slice(assignment.index + assignment[0].length).trim() : text;
      try {
        if (!assignment && script.type !== 'application/json') continue;
        if (tail.startsWith('JSON.parse(')) {
          const token = tail.slice(11).match(/^\s*("(?:\\.|[^"\\])*")\s*\)/);
          if (token) { const value=JSON.parse(JSON.parse(token[1])); if(value?.postData) return value; }
        }
        if (tail[0] !== '{') continue;
        let depth=0, quoted=false, escaped=false;
        for (let i=0;i<tail.length;i++) {
          const c=tail[i];
          if (quoted) { if(escaped) escaped=false; else if(c==='\\') escaped=true; else if(c==='"') quoted=false; }
          else if(c==='"') quoted=true;
          else if(c==='{') depth++;
          else if(c==='}' && --depth===0) { const value=JSON.parse(tail.slice(0,i+1)); if(value?.postData) return value; break; }
        }
      } catch { /* A different encoding uses the safe DOM-derived reply fallback. */ }
    }
    return null;
  }
  function sanitizeCard(card, page, topic) {
    card.querySelectorAll('script,style,link,meta,base,iframe,object,embed,form,template').forEach(n=>n.remove());
    const ids=new Map();
    for(const n of card.querySelectorAll('[id]')) { const old=n.id; n.id=`nst-p${page}-${old}`; ids.set(old,n.id); }
    for(const n of [card,...card.querySelectorAll('*')]) {
      for(const a of [...n.attributes]) {
        if(/^on/i.test(a.name) || ['srcdoc','srcset'].includes(a.name)) n.removeAttribute(a.name);
        else if(['href','src','xlink:href','action','formaction'].includes(a.name)) {
          const value=a.value.trim();
          if(value[0]==='#') { const id=value.slice(1); n.setAttribute(a.name,ids.has(id)?`#${ids.get(id)}`:`/post-${topic}-${page}#${id}`); }
          else {
            try { const url=new URL(value,location.href); if(!['https:','http:','mailto:'].includes(url.protocol)) n.removeAttribute(a.name); }
            catch { n.removeAttribute(a.name); }
          }
        }
      }
    }
    card.dataset.nstLoaded='1'; card.dataset.nstPage=String(page);
    const floorLink=card.querySelector('.floor-link');
    if(floorLink) floorLink.setAttribute('href',`/post-${topic}-${page}#${card.id}`);
  }
  function mountLoadedMenu(s, card, config) {
    const page=pageWindow(), data=page.__config__?.postData;
    const floor=Number(card.id), id=Number(card.dataset.commentId);
    const actual = String(config?.postData?.postId)===s.topic && config.postData.comments?.find(p=>Number(p.floorIndex)===floor && Number(p.commentId)===id);
    const body=card.querySelector('article.post-content');
    const record=actual || { floorIndex:floor,commentId:id,poster:{name:card.querySelector('.author-name')?.textContent.trim() || `#${floor}`,isMe:false},markdown:excerpt(body,20000),time:{createdDate:card.querySelector('time')?.getAttribute('datetime') || '',editedDate:null} };
    let index=-1;
    if(data && String(data.postId)===s.topic && Array.isArray(data.comments)) {
      index=data.comments.findIndex(p=>Number(p.commentId)===id && Number(p.floorIndex)===floor);
      if(index<0) { index=data.comments.length; data.comments.push(record); s.registered.push(record); }
    }
    const old=card.querySelector('.comment-menu,.comment-menu-mount');
    const mount=el('div'); if(old) old.replaceWith(mount); else card.append(mount);
    if(actual && index>=0) {
      try {
        const native=[...page.document.querySelectorAll('.comment-menu')].find(n=>!n.closest('[data-nst-loaded]'))?.__vue__;
        if(native?.constructor && native.$options) {
          const menu=new native.constructor({...native.$options,el:undefined,parent:undefined});
          menu.setIndex(index); menu.$mount(mount); s.nativeMenus.push(menu); return;
        }
      } catch { /* Fall back to native editor entry points and an original-page link. */ }
    }
    mount.className='comment-menu nst-loaded-menu';
    for(const [action,label] of [['quote','引用'],['reply','回复']]) {
      const button=el('button','',label); button.type='button';
      button.addEventListener('click',()=>{
        openEditor(s,true);
        try {
          if(index>=0 && typeof page.editor?.[action]==='function') { page.editor[action](index); return; }
          const cm=codeMirror();
          if(!cm?.replaceRange) throw new Error('编辑器尚未就绪，请点击原页操作');
          const header=`@${record.poster.name} [#${floor}](${location.origin}/post-${s.topic}-${card.dataset.nstPage}#${floor}) `;
          const quote=action==='quote'?`\n> ${excerpt(body,20000).replace(/\n/g,'\n> ')}\n\n`:'';
          cm.replaceRange(`${cm.getValue()?'\n\n':''}${header}${quote}`,{line:cm.lastLine(),ch:cm.getLine(cm.lastLine()).length});
          cm.focus();
        } catch(error) { button.title=error.message; button.textContent='编辑器未就绪 · 重试'; }
      });
      mount.append(button);
    }
    const original=el('a','','原页操作'); original.href=`/post-${s.topic}-${card.dataset.nstPage}#${floor}`;
    original.target='_blank'; original.rel='noopener'; original.title='打开原页进行点赞、加鸡腿等操作'; mount.append(original);
  }
  function loadingStatus(s) {
    s.loader.textContent=s.loading?'正在加载下一页…':s.loadError?'加载失败，稍后继续下滑自动重试':s.nextURL?'继续下滑，自动加载下一页':'已到末尾，全部评论已加载';
    s.loader.title=s.loadError || '';
  }
  async function loadNext(s) {
    if(state!==s || s.loading || !s.nextURL || Date.now() < s.retryAfter) return;
    s.loading=true; s.loadError=''; loadingStatus(s);
    const url=s.nextURL, page=Number(url.match(/post-\d+-(\d+)/)[1]);
    const controller=new AbortController(); s.loadController=controller;
    const timeout=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetch(url,{credentials:'same-origin',signal:controller.signal});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const final=new URL(response.url || url,location.href);
      if(final.origin!==location.origin || final.pathname.replace(/\/$/,'')!==`/post-${s.topic}-${page}`) throw new Error('分页跳转异常');
      const doc=new DOMParser().parseFromString(await response.text(),'text/html');
      if(!doc.querySelector('ul.comments')) throw new Error('未取得评论，请先完成站点登录或验证');
      if(state!==s || controller.signal.aborted || route()?.topic!==s.topic || route()?.page!==s.page) return;
      const config=pageConfig(doc);
      const existing=new Set([...s.list.querySelectorAll(':scope > li.content-item')].map(n=>n.id));
      const cards=[];
      for(const remote of doc.querySelectorAll('ul.comments > li.content-item')) {
        if(!/^\d+$/.test(remote.id) || Number(remote.id)<=0 || existing.has(remote.id)) continue;
        if(!remote.querySelector('article.post-content')) continue;
        const card=document.importNode(remote,true); sanitizeCard(card,page,s.topic);
        existing.add(card.id); s.known.add(Number(card.id)); cards.push(card);
      }
      observer.disconnect();
      try {
        for(const card of cards) { s.list.append(card); mountLoadedMenu(s,card,config); }
        s.loadedPages.add(page); s.nextURL=nextPage(doc,s,page); s.loadedThrough=page;
      } finally { observe(); }
      refresh();
    } catch(error) {
      if(state===s && !controller.signal.aborted) { s.loadError=error.message; s.retryAfter=Date.now()+5000; }
      else if(state===s && route()?.topic===s.topic) { s.loadError='请求超时'; s.retryAfter=Date.now()+5000; }
    } finally {
      clearTimeout(timeout); s.loading=false;
      if(state===s) {
        loadingStatus(s); scheduleFrame();
        // A short page may leave the sentinel intersecting without another observer event.
        if(!s.loadError) requestAnimationFrame(()=>{ if(state===s) maybeLoad(s); });
      }
    }
  }
  function maybeLoad(s) {
    if(!s?.loader.isConnected || document.hidden) return;
    const r=s.loader.getBoundingClientRect();
    if(r.top <= window.innerHeight - (s.editorHeight || 0) + 350 && r.bottom>=0) loadNext(s);
  }
  function setupLoading(s) {
    s.loadedPages=new Set([s.page]); s.loadedThrough=s.page; s.retryAfter=0; s.nativeMenus=[]; s.registered=[];
    s.nextURL=nextPage(document,s,s.page);
    s.loader=el('div','nst-auto-load'); s.loader.setAttribute('role','status'); s.list.after(s.loader);
    s.hiddenPagers=[...document.querySelectorAll('.post-bottom-pager')]; s.hiddenPagers.forEach(n=>n.classList.add('nst-pagination-hidden'));
    if(typeof IntersectionObserver==='function') {
      s.intersection=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)) loadNext(s);},{rootMargin:'0px 0px 350px 0px'});
      s.intersection.observe(s.loader);
    }
    loadingStatus(s);
  }

  // A plain @mention or a link inside a quotation is not a parent relationship.
  function relation(body, floor, s) {
    if (!body) return null;
    const topic = s.topic;
    const first = [...body.childNodes].find(n => n.nodeType === 1 || n.textContent.trim());
    const links = [...body.querySelectorAll('a[href]')], candidates = [];
    const nonText = 'br,hr,img,picture,svg,video,audio,iframe,object,embed,input,button';
    for (const [index, link] of links.entries()) {
      if (link.closest('blockquote,pre,code')) continue;
      let url;
      try { url = new URL(link.getAttribute('href'), location.href); } catch { continue; }
      if (url.origin !== location.origin) continue;
      const target = url.pathname.match(/^\/post-(\d+)-(\d+)\/?$/);
      const hash = url.hash.match(/^#(\d+)$/);
      if (!target || target[1] !== topic || !hash || link.textContent.trim() !== `#${Number(hash[1])}`) continue;
      const parent = Number(hash[1]);
      if (!Number.isSafeInteger(parent) || parent < 0 || parent >= floor) continue;
      let block = link.closest('p,div');
      if (!block || !body.contains(block)) block = body;
      const previous = links[index - 1];
      let mention = null;
      const range = document.createRange();
      if (previous && block.contains(previous) && previous.textContent.trim().startsWith('@') && previous.textContent.trim().length > 1 && !previous.closest('blockquote,pre,code')) {
        try {
          const profile = new URL(previous.getAttribute('href'), location.href);
          const nativeProfile = /^\/space\/\d+\/?$/.test(profile.pathname) || (/^\/member\/?$/.test(profile.pathname) && profile.searchParams.get('t'));
          range.setStartAfter(previous); range.setEndBefore(link);
          if (profile.origin === location.origin && nativeProfile && !range.toString().trim() && !range.cloneContents().querySelector(nonText)) mention = previous;
        } catch { /* Invalid profile links cannot identify a reply recipient. */ }
      }
      range.setStart(block, 0);
      range.setEndBefore(link);
      const before = range.toString().trim();
      const leading = block === first && (!before || (mention && before === mention.textContent.trim())) && !range.cloneContents().querySelector(nonText);
      // NodeSeek can leave an appended @recipient as plain text. Only accept
      // that text when it is adjacent to the floor link and matches its author.
      const parentAuthor = (parent === 0 ? s.op : s.posts.get(parent))?.author;
      const previousNode = link.previousSibling;
      const plainMention = !mention && parentAuthor && previousNode?.nodeType === 3 && previousNode.textContent.trimEnd().endsWith(`@${parentAuthor}`);
      // Native replies can append the adjacent @recipient / #floor pair after prose.
      // A standalone floor link still qualifies only at the start of the body.
      if (!leading && !mention && !plainMention) continue;
      const prefix = leading ? [...(mention ? [mention] : []), link] : [];
      if (leading && link.nextSibling?.nodeName === 'BR') prefix.push(link.nextSibling);
      const ref = { parent, href:`/post-${topic}-${Number(target[2])}#${parent}`, author:mention?.textContent.trim().replace(/^@/, '') || (plainMention ? parentAuthor : ''), prefix };
      if (leading) return ref;
      candidates.push(ref);
    }
    return candidates.length && candidates.every(ref => ref.parent === candidates[0].parent) ? candidates[0] : null;
  }

  function persist(s) {
    write(`page:${s.topic}:${s.page}`, { known:[...s.known].slice(-2000), pending:[...s.pending].slice(-2000) });
  }
  function anchor(s) {
    return [...s.list.children].filter(n => n.matches('li.content-item')).sort((a,b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      .find(n => n.getBoundingClientRect().bottom > 100);
  }
  function jump(card) {
    card.scrollIntoView({ block:'center', behavior:'auto' });
    card.classList.remove('nst-focus');
    void card.offsetWidth;
    card.classList.add('nst-focus');
    setTimeout(() => card.classList.remove('nst-focus'), 1800);
  }

  async function getPreview(s, ref) {
    const key = `${s.topic}:${ref.parent}`;
    if (previewCache.has(key)) return previewCache.get(key);
    if (previewRequests.has(key)) return previewRequests.get(key);
    const request = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(ref.href.split('#')[0], { credentials:'same-origin', signal:controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const finalURL = new URL(response.url || ref.href, location.href);
        if (finalURL.origin !== location.origin || !finalURL.pathname.startsWith(`/post-${s.topic}-`)) throw new Error('页面发生跳转');
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        const card = [...doc.querySelectorAll('.content-item[id]')].find(n => n.id === String(ref.parent));
        if (!card?.querySelector('article.post-content')) throw new Error('未找到父评论，可能需要完成站点验证');
        const result = { author:card.querySelector('.author-name')?.textContent.trim() || ref.author, text:excerpt(card.querySelector('article.post-content')) };
        previewCache.set(key, result);
        if (previewCache.size > 60) previewCache.delete(previewCache.keys().next().value);
        return result;
      } finally { clearTimeout(timeout); }
    })();
    previewRequests.set(key, request);
    try { return await request; } finally { previewRequests.delete(key); }
  }

  function addRelation(s, post, parent) {
    const ref = post.ref;
    if (!ref) return;
    const row = el('div', 'nst-relation');
    const name = parent?.author || ref.author;
    const link = el('a', '', `回复 ${name ? `${name} · ` : ''}#${ref.parent}${parent ? '' : '（跨页或未加载）'}`);
    link.href = ref.href;
    if (parent) link.addEventListener('click', event => {
      if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); jump(parent.card);
    });
    row.append(link);
    post.body.before(row);
    if (!parent) {
      const button = el('button', '', '预览父评论');
      button.type = 'button';
      row.append(button);
      button.addEventListener('click', async () => {
        const old = post.card.querySelector('.nst-auto-quote');
        if (old) { old.remove(); button.textContent = '预览父评论'; return; }
        button.disabled = true;
        button.textContent = '加载中…';
        try {
          const result = await getPreview(s, ref);
          if (state !== s || !row.isConnected) return;
          const quote = el('aside', 'nst-auto-quote', `${result.author || `#${ref.parent}`}：\n${result.text || '（无文字内容）'}`);
          row.after(quote);
          button.textContent = '收起预览';
        } catch (error) {
          button.textContent = '重试预览';
          button.title = error.name === 'AbortError' ? '请求超时，请重试或点击楼层跳转' : error.message;
        } finally { button.disabled = false; }
      });
    } else if (mode === 'quote') {
      const quote = el('aside', 'nst-auto-quote', `${name || `#${ref.parent}`}：\n${excerpt(parent.body) || '（无文字内容）'}`);
      row.after(quote);
    }
    if (mode === 'thread') {
      ref.prefix.forEach(n => {
        if (n.nodeType === 1) n.classList.add('nst-reply-prefix');
      });
    }
  }

  function makeBar(s) {
    const bar = el('div', 'nst-modebar');
    const modes = el('div', 'nst-modes');
    modes.setAttribute('role', 'group');
    modes.setAttribute('aria-label', '评论阅读模式');
    for (const [value,label] of [['thread','楼中楼'],['quote','引用'],['raw','原始']]) {
      const button = el('button', '', label);
      button.type = 'button'; button.dataset.nstMode = value;
      button.addEventListener('click', () => {
        mode = value; write('mode', value); refresh();
      });
      modes.append(button);
    }
    bar.append(modes);
    const updates = el('button', 'nst-updates', '暂无新回复');
    updates.type = 'button';
    updates.addEventListener('click', () => {
      const target = [...s.posts.values()].filter(p => s.pending.has(p.floor)).sort((a,b) => Number(a.card.style.order) - Number(b.card.style.order))[0];
      if (target) { jump(target.card); s.pending.delete(target.floor); target.card.classList.remove('nst-new'); persist(s); scheduleFrame(); }
    });
    s.updates = updates; bar.append(updates);
    const check = el('button', '', '检查新回复');
    check.type = 'button';
    check.title = '检查当前已加载的最后一页是否出现新回复';
    check.addEventListener('click', async () => {
      if (check.dataset.reload) { location.reload(); return; }
      check.disabled = true; check.textContent = '检查中…';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(`/post-${s.topic}-${s.loadedThrough}`, { credentials:'same-origin', cache:'no-store', signal:controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        if (!doc.querySelector('.content-item[id="0"],ul.comments')) throw new Error('未取得帖子页面，请稍后重试');
        const fresh = [...doc.querySelectorAll('ul.comments > li.content-item')].filter(n => /^\d+$/.test(n.id) && !s.known.has(Number(n.id)));
        const next = [...doc.querySelectorAll('[aria-label="pagination"] a[href]')].some(a => {
          const m = a.getAttribute('href').match(new RegExp(`^/post-${s.topic}-(\\d+)`));
          return m && Number(m[1]) > s.maxPage;
        });
        if (state !== s) return;
        if (fresh.length || next) {
          check.textContent = fresh.length ? `发现 ${fresh.length} 条 · 刷新` : '有新增分页 · 刷新';
          check.dataset.reload = '1';
        } else check.textContent = '末页暂无新增';
      } catch (error) {
        check.textContent = '检查失败 · 重试'; check.title = error.name === 'AbortError' ? '请求超时' : error.message;
      } finally { clearTimeout(timeout); check.disabled = false; }
    });
    bar.append(check);
    s.status = el('span', 'nst-status'); bar.append(s.status);
    const progress = el('div', 'nst-progress');
    progress.setAttribute('role', 'progressbar'); progress.setAttribute('aria-label', '本页阅读进度');
    progress.setAttribute('aria-valuemin', '0'); progress.setAttribute('aria-valuemax', '100');
    s.fill = el('span'); progress.append(s.fill); bar.append(progress); s.progress = progress;
    s.list.before(bar); s.bar = bar;
  }

  function drawConnectors(s) {
    let svg = s.list.querySelector(':scope > .nst-connectors');
    if (mode !== 'thread') { svg?.remove(); return; }
    const box = s.list.getBoundingClientRect();
    const paths = [];
    for (const post of s.posts.values()) {
      const parent = post.ref && s.posts.get(post.ref.parent);
      if (!parent) continue;
      const a = parent.card.querySelector('.avatar-wrapper img')?.getBoundingClientRect();
      const b = post.card.querySelector('.avatar-wrapper img')?.getBoundingClientRect();
      if (!a?.width || !b?.width || b.top <= a.top || !parent.card.getClientRects().length || !post.card.getClientRects().length) continue;
      const startX = a.left - box.left + a.width / 2;
      const endX = b.left - box.left - 4;
      const startY = a.bottom - box.top + 3;
      const endY = b.top - box.top + b.height / 2;
      const lane = Math.min(startX, endX - 8);
      paths.push(`M ${startX} ${startY} H ${lane} V ${endY - 7} Q ${lane} ${endY} ${lane + 7} ${endY} H ${endX}`);
    }
    if (!paths.length) { svg?.remove(); return; }
    // Read-only previews never inject remote HTML. Only numeric SVG paths are generated here.
    const html = paths.map(d => `<path d="${d}"/>`).join('');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.classList.add('nst-connectors'); svg.setAttribute('aria-hidden','true'); s.list.append(svg);
    }
    if (connectorMarkup.get(svg) !== html) { svg.innerHTML = html; connectorMarkup.set(svg, html); }
  }

  function updateFrame(markRead = false) {
    frame = 0;
    const s = state;
    if (!s?.list.isConnected) return;
    layoutEditor(s);
    const box = s.list.getBoundingClientRect();
    const start = window.scrollY + box.top - 80;
    const range = Math.max(0, box.height - window.innerHeight + (s.editorHeight || 0) + 100);
    const ratio = range ? Math.max(0, Math.min(1,(window.scrollY - start) / range)) : (box.top < window.innerHeight ? 1 : 0);
    const percent = Math.round(ratio * 100);
    s.fill.style.width = `${percent}%`; s.progress.setAttribute('aria-valuenow', String(percent));
    s.status.textContent = `已加载 ${percent}% · ${s.posts.size} 条评论 · 第 ${s.page}${s.loadedThrough>s.page?`–${s.loadedThrough}`:''} 页`;
    if (markRead && !document.hidden) {
      let changed = false;
      for (const post of s.posts.values()) {
        if (!s.pending.has(post.floor)) continue;
        const rect = post.card.getBoundingClientRect();
        if (rect.height && rect.top >= 70 && rect.bottom <= window.innerHeight - (s.editorHeight || 0)) {
          s.pending.delete(post.floor); post.card.classList.remove('nst-new'); changed = true;
        }
      }
      if (changed) persist(s);
    }
    s.updates.textContent = s.pending.size ? `${s.pending.size} 条新回复 · 定位` : '暂无新回复';
    s.updates.disabled = !s.pending.size;
    drawConnectors(s);
  }
  function scheduleFrame() {
    if (!frame) frame = requestAnimationFrame(() => updateFrame(false));
  }
  function cleanup() {
    if (!state) return;
    persist(state);
    state.loadController?.abort(); state.intersection?.disconnect(); state.editorResize?.disconnect();
    state.nativeMenus?.forEach(menu=>menu.$destroy?.());
    const records=pageWindow().__config__?.postData?.comments;
    if(records && state.registered?.length && state.registered.every((record,i)=>records[records.length-state.registered.length+i]===record)) records.splice(records.length-state.registered.length);
    state.list.querySelectorAll(':scope > [data-nst-loaded]').forEach(n=>n.remove());
    state.hiddenPagers?.forEach(n=>n.classList.remove('nst-pagination-hidden')); state.loader?.remove();
    if(state.editor) {
      state.editor.classList.remove('nst-fixed-editor','nst-editor-collapsed');
      if(state.editorStyle===null) state.editor.removeAttribute('style'); else state.editor.setAttribute('style',state.editorStyle);
      state.editorHeader.remove(); state.editorSpacer.remove();
    }
    document.documentElement.classList.remove('nst-docking'); document.documentElement.style.removeProperty('--nst-dock-height');
    state.list.querySelectorAll(':scope > li.content-item').forEach(card => { clearCard(card); card.classList.remove('nst-new','nst-focus'); });
    state.list.classList.remove('nst-thread');
    state.list.querySelector(':scope > .nst-connectors')?.remove();
    state.bar.remove(); resize?.disconnect(); state = null;
  }
  function observe() { observer.observe(document.body, { childList:true, subtree:true, characterData:true }); }
  function refresh() {
    observer.disconnect();
    try {
      const current = route();
      const list = document.querySelector('ul.comments');
      if (!featureEnabled('threadedReading') || !current || !list) { cleanup(); return; }
      if (state && (state.topic !== current.topic || state.page !== current.page || state.list !== list)) cleanup();
      if (!state) {
        const stored = read(`page:${current.topic}:${current.page}`, null);
        state = { ...current, list, posts:new Map(), known:new Set(Array.isArray(stored?.known) ? stored.known.filter(Number.isSafeInteger) : []), pending:new Set(Array.isArray(stored?.pending) ? stored.pending.filter(Number.isSafeInteger) : []), visited:Array.isArray(stored?.known), maxPage:current.page };
        makeBar(state); setupLoading(state); resize?.observe(list);
      }
      const s = state;
      dockEditor(s);
      const op = document.querySelector('.content-item[id="0"]');
      s.op = op ? { card:op, body:op.querySelector('article.post-content'), author:op.querySelector('.author-name')?.textContent.trim() || '' } : null;
      const keep = anchor(s), top = keep?.getBoundingClientRect().top;
      const cards = [...list.children].filter(n => n.matches('li.content-item') && /^\d+$/.test(n.id) && Number(n.id) > 0);
      s.posts.clear();
      for (const card of cards) {
        if (!savedStyles.has(card)) savedStyles.set(card, card.getAttribute('style'));
        clearCard(card);
        const floor = Number(card.id);
        const body = card.querySelector('article.post-content');
        const post = { floor, card, body, author:card.querySelector('.author-name')?.textContent.trim() || '', ref:null, depth:0, root:floor };
        s.posts.set(floor, post);
        if (s.visited && !s.known.has(floor)) s.pending.add(floor);
        s.known.add(floor); card.classList.toggle('nst-new', s.pending.has(floor));
      }
      s.visited = true;
      const sorted = [...s.posts.values()].sort((a,b) => a.floor - b.floor);
      const children = new Map();
      for (const post of sorted) {
        post.ref = relation(post.body,post.floor,s);
        const parent = post.ref && s.posts.get(post.ref.parent);
        if (parent) { post.depth = parent.depth + 1; post.root = parent.root; }
        const key = parent ? parent.floor : 0;
        if (!children.has(key)) children.set(key, []);
        children.get(key).push(post);
      }
      list.classList.toggle('nst-thread', mode === 'thread');
      let rank = 1;
      const stack = [...(children.get(0) || [])].reverse();
      const groups = new Map();
      while (stack.length) {
        const post = stack.pop();
        if (mode !== 'raw') {
          post.card.dataset.nstDepth = String(post.depth);
          if (mode === 'thread') {
            post.card.style.order = String(rank++);
            post.card.style.setProperty('--nst-indent',String(Math.min(4,Math.max(0,post.depth - 1))));
          }
          addRelation(s,post,post.ref && (post.ref.parent === 0 ? s.op : s.posts.get(post.ref.parent)));
        }
        if (post.depth) {
          if (!groups.has(post.root)) groups.set(post.root, []);
          groups.get(post.root).push(post.card);
        }
        stack.push(...[...(children.get(post.floor) || [])].reverse());
      }
      if (mode === 'thread') for (const group of groups.values()) {
        group[0].dataset.nstFirst = ''; group[group.length - 1].dataset.nstLast = '';
      }
      s.bar.querySelectorAll('[data-nst-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.nstMode === mode)));
      document.querySelectorAll('[aria-label="pagination"] a[href]').forEach(a => {
        const m = a.getAttribute('href').match(new RegExp(`^/post-${s.topic}-(\\d+)`));
        if (m) s.maxPage = Math.max(s.maxPage,Number(m[1]));
      });
      // Pending IDs that moved to another page are not actionable on this page.
      for (const n of s.pending) if (!s.posts.has(n)) s.pending.delete(n);
      persist(s);
      if (keep?.isConnected && Number.isFinite(top)) {
        const delta = keep.getBoundingClientRect().top - top;
        if (Math.abs(delta) > 1) window.scrollTo({ top:window.scrollY + delta, behavior:'auto' });
      }
      updateFrame(false);
    } finally { observe(); }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(refresh,80); }
  const observer = new MutationObserver(records => {
    if (records.some(record => {
      const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      const owned = '.nst-modebar,.nst-relation,.nst-auto-quote,.nst-connectors,.nst-auto-load,.nst-fixed-editor,.nst-editor-spacer,.nst-editor-head';
      if (target?.closest(owned)) return false;
      const changed = [...record.addedNodes,...record.removedNodes];
      // Inserting a preview targets its native parent card, not the preview itself.
      if (record.type === 'childList' && changed.length && changed.every(n => n.nodeType === 1 && n.matches(owned))) return false;
      return true;
    })) schedule();
  });
  let readTimer = 0;
  window.addEventListener('scroll', () => {
    scheduleFrame();
    maybeLoad(state);
    clearTimeout(readTimer); readTimer = setTimeout(() => updateFrame(true),700);
  }, { passive:true });
  window.addEventListener('resize',scheduleFrame,{ passive:true });
  document.addEventListener('nsit:open-reply-editor', () => openEditor(state));
  document.addEventListener('click', event => {
    const action=event.target.closest?.('.comment-menu .menu-item,.comment-menu button');
    if(action && /^(回复|引用|编辑)$/.test(action.textContent.trim())) openEditor(state,true);
  },true);
  document.addEventListener('load',event => { if (event.target.tagName === 'IMG') scheduleFrame(); },true);
  window.addEventListener('popstate',schedule);
  window.addEventListener('pageshow',schedule);
  window.addEventListener('pagehide',() => { if (state) persist(state); });
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('切换楼中楼 / 引用 / 原始', () => { mode = validModes[(validModes.indexOf(mode) + 1) % validModes.length]; write('mode',mode); refresh(); });
  }
  refresh();
  return { refresh };
}
