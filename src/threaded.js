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
    ul.comments.nst-thread { --nst-step:36px; --nst-avatar:32px; --nst-gap:12px; --nst-surface:var(--bg-main-color,#fff); position:relative; display:flex !important; flex-direction:column; padding-inline:0; overflow-anchor:none; }
    body.dark-layout ul.comments.nst-thread { --nst-surface:var(--bg-main-color,#292929); }
    ul.comments.nst-thread > li.content-item { order:1000000; min-width:0; box-sizing:border-box; position:relative; margin:0 !important; padding:12px 0 !important; border:0 !important; border-radius:0; background:transparent !important; }
    ul.comments.nst-thread > li > .nsk-content-meta-info { display:flex; align-items:flex-start; gap:var(--nst-gap); margin:0 0 6px; }
    ul.comments.nst-thread > li > .nsk-content-meta-info > .avatar-wrapper { flex:0 0 var(--nst-avatar); width:var(--nst-avatar); margin:0; }
    ul.comments.nst-thread > li .avatar-normal { display:block; width:var(--nst-avatar) !important; height:var(--nst-avatar) !important; border-radius:50%; }
    ul.comments.nst-thread > li > .nsk-content-meta-info > div:has(.author-info) { display:flex; align-items:center; flex-wrap:wrap; gap:3px 6px; min-width:0; flex:1; margin:0; }
    ul.comments.nst-thread > li .author-info { line-height:1.5; }
    ul.comments.nst-thread > li .author-name { font-size:13px; font-weight:600; }
    ul.comments.nst-thread > li .content-info { margin:0; font-size:12px; }
    ul.comments.nst-thread > li .nsit-author-info { order:1; flex-basis:100%; margin:0; }
    ul.comments.nst-thread > li .floor-link-wrapper { margin-inline-start:auto; }
    ul.comments.nst-thread > li .floor-link { display:none !important; }
    ul.comments.nst-thread > li > .post-content,ul.comments.nst-thread > li > .comment-menu,
    ul.comments.nst-thread > li > .signature,ul.comments.nst-thread > li > .topic-warning,
    ul.comments.nst-thread > li > .nst-relation,ul.comments.nst-thread > li > .nst-auto-quote { margin-inline-start:calc(var(--nst-avatar) + var(--nst-gap)); }
    ul.comments.nst-thread > li[data-nst-depth]:not([data-nst-depth="0"]) { margin-inline-start:calc((1 + var(--nst-indent,0)) * var(--nst-step)) !important; }
    ul.comments.nst-thread > li > .post-content { margin-block:6px 10px; font-size:14px; line-height:1.7; overflow-wrap:anywhere; }
    ul.comments.nst-thread > li > .comment-menu { display:flex; align-items:center; justify-content:flex-start; flex-wrap:wrap; gap:14px; min-height:28px; margin-block:4px 0; }
    ul.comments.nst-thread > li > .comment-menu > .menu-item { margin:0; }
    ul.comments.nst-thread > li.nst-branch-hidden { display:none !important; }
    .nst-branch-toggle { position:absolute; left:var(--nst-toggle-x,2px); top:var(--nst-toggle-y,auto); bottom:12px; z-index:2; display:flex; align-items:center; gap:8px; min-width:28px; height:28px; padding:0 5px; margin:0; border:0; border-radius:14px; background:transparent; color:inherit; font:inherit; cursor:pointer; }
    .nst-branch-toggle svg { display:block; flex:none; width:18px; height:18px; overflow:visible; border-radius:50%; background:var(--nst-surface); }
    .nst-branch-toggle svg circle,.nst-branch-toggle svg path { fill:none; stroke:currentColor; stroke-width:1.6; stroke-linecap:round; }
    .nst-branch-toggle[aria-expanded="true"] .nst-branch-plus { display:none; }
    .nst-branch-toggle:hover { color:#3287be; background:color-mix(in srgb,currentColor 7%,transparent); }
    .nst-branch-toggle:focus-visible { outline:2px solid #3287be; outline-offset:2px; }
    .nst-branch-count { font-size:12px; line-height:1.5; }
    .nst-branch-count[hidden] { display:none; }
    .nst-branch-collapsed > .nst-branch-toggle { position:relative; left:auto; top:auto; bottom:auto; width:max-content; max-width:100%; margin:8px 0 0 var(--nst-toggle-x,2px); }
    .nst-has-children::before { content:""; position:absolute; pointer-events:none; left:var(--nst-rail-x,16px); top:var(--nst-rail-top,47px); height:var(--nst-rail-height,0px); width:0; border-left:1.4px solid color-mix(in srgb,currentColor 20%,transparent); }
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
      ul.comments.nst-thread { --nst-step:18px; --nst-avatar:28px; --nst-gap:8px; }
      ul.comments.nst-thread > li > .comment-menu { gap:10px; }
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
    card.classList.remove('nst-branch-hidden','nst-branch-collapsed','nst-has-children');
    card.querySelectorAll('.nst-relation,.nst-auto-quote,.nst-branch-toggle').forEach(n => n.remove());
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
    s.editorResize?.disconnect(); s.editorHeader?.remove(); s.editorSpacer?.remove();
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
    const valid = value => value?.postData && /^\d+$/.test(String(value.postData.postId)) && Array.isArray(value.postData.comments);
    const encoded=doc.getElementById('temp-script')?.textContent.trim();
    if(encoded) {
      try {
        const json=decodeURIComponent(Array.from(atob(encoded),c=>`%${c.charCodeAt(0).toString(16).padStart(2,'0')}`).join(''));
        const value=JSON.parse(json);
        if(valid(value)) return value;
      } catch { /* Invalid encoded data can still have a supported JSON alternative below. */ }
    }
    for (const script of doc.querySelectorAll('script')) {
      const text = script.textContent.trim();
      const assignment = text.match(/(?:window\.)?__config__\s*=\s*/);
      const tail = assignment ? text.slice(assignment.index + assignment[0].length).trim() : text;
      try {
        if (!assignment && script.type !== 'application/json') continue;
        if (tail.startsWith('JSON.parse(')) {
          const token = tail.slice(11).match(/^\s*("(?:\\.|[^"\\])*")\s*\)/);
          if (token) { const value=JSON.parse(JSON.parse(token[1])); if(valid(value)) return value; }
        }
        if (tail[0] !== '{') continue;
        let depth=0, quoted=false, escaped=false;
        for (let i=0;i<tail.length;i++) {
          const c=tail[i];
          if (quoted) { if(escaped) escaped=false; else if(c==='\\') escaped=true; else if(c==='"') quoted=false; }
          else if(c==='"') quoted=true;
          else if(c==='{') depth++;
          else if(c==='}' && --depth===0) { const value=JSON.parse(tail.slice(0,i+1)); if(valid(value)) return value; break; }
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
  function releaseLoadedMenu(s, card) {
    const binding=s.importedMenus?.get(card);
    if(!binding) return;
    s.importedMenus.delete(card);
    if(binding.menu) {
      s.nativeMenus=s.nativeMenus.filter(menu=>menu!==binding.menu);
      try { binding.menu.$destroy?.(); } catch { /* A discarded component must not block the retained conversation. */ }
    }
  }
  function refreshLoadedMenus(s) {
    const data=pageWindow().__config__?.postData;
    const comments=String(data?.postId)===s.topic && Array.isArray(data.comments)?data.comments:null;
    for(const card of s.imported.values()) {
      const binding=s.importedMenus?.get(card);
      if(binding && (binding.comments!==comments || (binding.index>=0 && comments?.[binding.index]!==binding.record))) mountLoadedMenu(s,card,binding.config);
    }
  }
  function mountLoadedMenu(s, card, config) {
    releaseLoadedMenu(s,card);
    s.importedMenus ||= new Map();
    const page=pageWindow(), data=page.__config__?.postData;
    const floor=Number(card.id), id=Number(card.dataset.commentId);
    const validId=Number.isSafeInteger(floor) && floor>0 && Number.isSafeInteger(id) && id>0;
    const actual = validId && String(config?.postData?.postId)===s.topic && Array.isArray(config.postData.comments) && config.postData.comments.find(p=>p && Number(p.floorIndex)===floor && Number(p.commentId)===id);
    const body=card.querySelector('article.post-content');
    const record=actual || { floorIndex:floor,commentId:id,poster:{name:card.querySelector('.author-name')?.textContent.trim() || `#${floor}`,isMe:false},markdown:excerpt(body,20000),time:{createdDate:card.querySelector('time')?.getAttribute('datetime') || '',editedDate:null} };
    let index=-1;
    const comments=String(data?.postId)===s.topic && Array.isArray(data.comments)?data.comments:null;
    if(validId && comments) {
      s.registered=s.registered.filter(registered=>comments.includes(registered));
      index=comments.findIndex(p=>p && Number(p.commentId)===id && Number(p.floorIndex)===floor);
      if(index<0) { index=comments.length; comments.push(record); s.registered.push(record); }
    }
    const binding={config,comments,record:index>=0?comments[index]:null,index,menu:null};
    s.importedMenus.set(card,binding);
    const old=card.querySelector('.comment-menu,.comment-menu-mount');
    const mount=el('div'); if(old) old.replaceWith(mount); else card.append(mount);
    if(actual && index>=0) {
      const candidates=[...page.document.querySelectorAll('.comment-menu')].filter(n=>!n.closest('[data-nst-loaded]'));
      for(const candidate of candidates) {
        let menu;
        try {
          const native=candidate.__vue__;
          if(typeof native?.constructor!=='function' || !native.$options) continue;
          menu=new native.constructor({...native.$options,el:undefined,parent:undefined});
          if(typeof menu.setIndex!=='function' || typeof menu.$mount!=='function') throw new Error('菜单接口不可用');
          menu.setIndex(index); menu.$mount(mount);
          if(!card.contains(menu.$el || mount)) throw new Error('菜单未挂载到评论');
          binding.menu=menu; s.nativeMenus.push(menu); return;
        } catch {
          // Vue may replace its mount node before failing; release it and restore the fallback slot.
          try { menu?.$destroy?.(); } catch { /* A broken component must not stop fallback actions. */ }
          if(menu?.$el!==mount && card.contains(menu?.$el || null)) menu.$el.replaceWith(mount);
          else if(!card.contains(mount)) card.append(mount);
          mount.replaceChildren();
        }
      }
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
    const restoring=s.restorePages.length>0;
    s.loader.textContent=s.loading?(restoring?'正在恢复前面的对话…':'正在加载下一页…'):s.loadError?(restoring?'对话恢复失败，稍后继续下滑自动重试':'加载失败，稍后继续下滑自动重试'):s.nextURL?'继续下滑，自动加载下一页':'已到末页，当前阅读范围已加载';
    s.loader.title=s.loadError || '';
  }
  function placeImportedCard(s,card) {
    const next=[...s.list.children].find(node=>node.matches('li.content-item') && /^\d+$/.test(node.id) && Number(node.id)>Number(card.id));
    if(next) next.before(card); else s.list.append(card);
  }
  async function loadNext(s) {
    if(state!==s || s.loading || (!s.restorePages.length && !s.nextURL) || Date.now() < s.retryAfter) return;
    s.loading=true; s.loadError=''; loadingStatus(s);
    const restoring=s.restorePages.length>0;
    const url=restoring?`/post-${s.topic}-${s.restorePages[0]}`:s.nextURL, page=Number(url.match(/post-\d+-(\d+)/)[1]);
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
        for(const card of cards) { placeImportedCard(s,card); s.imported.set(card.id,card); mountLoadedMenu(s,card,config); }
        s.loadedPages.add(page);
        if(page>=s.loadedThrough) { s.nextURL=nextPage(doc,s,page); s.loadedThrough=page; }
        if(restoring) s.restorePages.shift();
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
        if(!s.loadError) requestAnimationFrame(()=>{ if(state===s) { if(s.restorePages.length) loadNext(s); else maybeLoad(s); } });
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
    s.imported=new Map(); s.restorePages=[];
    const context=takeReplyContext(s);
    if(context) {
      s.restorePages=context.pages.filter(page=>page!==s.page);
      if(context.defaultCollapsed===s.defaultCollapsed) {
        const ids=value=>Array.isArray(value)?value.filter(n=>Number.isSafeInteger(n)&&n>0).slice(-2000):[];
        s.collapsed=new Set(ids(context.collapsed)); s.initializedBranches=new Set(ids(context.initializedBranches));
      }
    }
    s.nextURL=nextPage(document,s,s.page);
    s.loader=el('div','nst-auto-load'); s.loader.setAttribute('role','status'); s.list.after(s.loader);
    s.hiddenPagers=[...document.querySelectorAll('.post-bottom-pager')]; s.hiddenPagers.forEach(n=>n.classList.add('nst-pagination-hidden'));
    if(typeof IntersectionObserver==='function') {
      s.intersection=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)) loadNext(s);},{rootMargin:'0px 0px 350px 0px'});
      s.intersection.observe(s.loader);
    }
    loadingStatus(s);
    if(s.restorePages.length) queueMicrotask(()=>loadNext(s));
  }

  // A per-tab, one-use marker survives the native editor's reload or last-page redirect.
  // It contains page/fold metadata only, never draft text or comment HTML.
  function takeReplyContext(s) {
    try {
      const key=`nst:reply-context:${s.topic}`, raw=sessionStorage.getItem(key);
      if(!raw) return null;
      sessionStorage.removeItem(key);
      const value=JSON.parse(raw), age=Date.now()-value.at;
      if(!Number.isFinite(age) || age<0 || age>10*60*1000 || !Number.isSafeInteger(value.firstPage) || !Number.isSafeInteger(value.lastPage) || value.firstPage<1 || value.lastPage<value.firstPage || s.page<value.firstPage) return null;
      if(Array.isArray(value.pages)) {
        if(!value.pages.length || value.pages.length>200 || value.pages.some(page=>!Number.isSafeInteger(page)||page<value.firstPage||page>value.lastPage)) return null;
        value.pages=[...new Set(value.pages)].sort((a,b)=>a-b);
      } else {
        if(value.lastPage-value.firstPage>=200) return null;
        value.pages=Array.from({length:value.lastPage-value.firstPage+1},(_,index)=>value.firstPage+index);
      }
      return value;
    } catch { return null; }
  }
  function rememberReplyContext(event) {
    const s=state, target=event.target;
    if(!s || !target?.closest?.('#editor .md-editor') || target.closest('#nsit-app,[data-nsit-auto-dialog]')) return;
    const control=event.type==='click'?target.closest('button.submit,button[type="submit"],input[type="submit"]'):null;
    if(event.type==='click' && (!control || control.disabled || control.getAttribute('aria-disabled')==='true' || /保存|修改|更新/.test(control.textContent || control.value || ''))) return;
    const input=[...s.editor?.querySelectorAll('textarea') || []].find(node=>!node.closest('#nsit-app'));
    const draft=codeMirror()?.getValue?.() ?? input?.value ?? '';
    if(!draft.trim()) return;
    const pages=[...new Set([...s.loadedPages,...s.restorePages])].sort((a,b)=>a-b);
    const marker={at:Date.now(),firstPage:pages[0],lastPage:pages.at(-1),pages,defaultCollapsed:s.defaultCollapsed,collapsed:[...s.collapsed].slice(-2000),initializedBranches:[...s.initializedBranches].slice(-2000)};
    s.replySnapshot={at:marker.at,floors:[...s.posts.values()].filter(post=>!post.card.dataset.nstLoaded).map(post=>post.floor)};
    try { sessionStorage.setItem(`nst:reply-context:${s.topic}`,JSON.stringify(marker)); } catch { /* Same-document restoration still works without storage. */ }
  }
  function retainLoadedConversation(s,list) {
    if(s.list!==list) {
      s.list.classList.remove('nst-thread'); s.list.querySelector(':scope > .nst-connectors')?.remove();
      resize?.unobserve(s.list); s.list=list; resize?.observe(list);
    }
    if(s.bar.nextElementSibling!==list) list.before(s.bar);
    if(list.nextElementSibling!==s.loader) list.after(s.loader);
    for(const pager of document.querySelectorAll('.post-bottom-pager')) {
      if(!s.hiddenPagers.includes(pager)) s.hiddenPagers.push(pager);
      pager.classList.add('nst-pagination-hidden');
    }
    const current=new Map([...list.querySelectorAll(':scope > li.content-item')].map(card=>[card.id,card]));
    for(const [id,card] of s.imported) {
      if(!current.has(id)) placeImportedCard(s,card);
      else if(current.get(id)!==card) {
        // Prefer the site's fresh native copy; discard only our detached duplicate.
        s.imported.delete(id);
        releaseLoadedMenu(s,card);
        card.remove();
      }
    }
    refreshLoadedMenus(s);
    const snapshot=s.replySnapshot;
    if(snapshot && Date.now()-snapshot.at<60000 && snapshot.floors.some(floor=>!current.has(String(floor)))) {
      s.replySnapshot=null;
      if(!s.restorePages.includes(s.page)) s.restorePages.push(s.page);
      queueMicrotask(()=>loadNext(s));
    }
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
  function applyBranchState(s) {
    for (const post of s.sorted) {
      const parent = post.ref && s.posts.get(post.ref.parent);
      post.folded = mode === 'thread' && s.collapsed.has(post.floor);
      post.hidden = mode === 'thread' && !!parent && (parent.hidden || parent.folded);
      post.card.classList.toggle('nst-branch-hidden', post.hidden);
      post.card.classList.toggle('nst-branch-collapsed', post.folded && post.descendants > 0);
      if (!post.toggle) continue;
      post.toggle.setAttribute('aria-expanded', String(!post.folded));
      const label = `${post.folded ? '展开' : '收起'} ${post.author || '这条评论'} 下的 ${post.descendants} 条回复`;
      post.toggle.setAttribute('aria-label', label); post.toggle.title = label;
      post.count.hidden = !post.folded;
    }
  }
  function addBranchToggle(s, post) {
    if (!post.descendants) return;
    const button = el('button','nst-branch-toggle'); button.type = 'button';
    // This constant icon contains no page content or remote markup.
    button.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="8"/><path d="M6.5 10h7"/><path class="nst-branch-plus" d="M10 6.5v7"/></svg>';
    const count = el('span','nst-branch-count',`另外 ${post.descendants} 条回复`);
    button.append(count); post.toggle = button; post.count = count;
    post.card.classList.add('nst-has-children'); post.card.append(button);
    button.addEventListener('click', () => {
      if (state !== s || mode !== 'thread') return;
      if (s.collapsed.has(post.floor)) s.collapsed.delete(post.floor);
      else s.collapsed.add(post.floor);
      applyBranchState(s);
      updateFrame(false);
    });
  }
  function revealFloor(floor) {
    const s = state;
    const post = s?.posts.get(Number(floor));
    if (!post || mode !== 'thread') return false;
    let parent = post.ref && s.posts.get(post.ref.parent), changed = false;
    while (parent) {
      if (s.collapsed.delete(parent.floor)) changed = true;
      parent = parent.ref && s.posts.get(parent.ref.parent);
    }
    if (changed) { applyBranchState(s); updateFrame(false); }
    return changed;
  }
  function revealHash() {
    const s = state;
    if (!s) return;
    s.pendingHash = /^#\d+$/.test(location.hash) ? location.hash : '';
    if (!s.pendingHash || mode !== 'thread' || s.restorePages.length) return;
    const post = s.posts.get(Number(s.pendingHash.slice(1)));
    if (!post) return;
    s.pendingHash = '';
    revealFloor(post.floor);
    post.card.scrollIntoView({ block:'center', behavior:'auto' });
  }
  function anchor(s) {
    return [...s.list.children].filter(n => n.matches('li.content-item:not(.nst-branch-hidden)')).sort((a,b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      .find(n => n.getBoundingClientRect().bottom > 100);
  }
  function jump(card) {
    if (state) state.pendingHash = '';
    revealFloor(card.id);
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
    const link = el('a', '', `回复 ${name || '此前评论'}${parent ? '' : '（跨页或未加载）'}`);
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
    const paths = [], geometry = new Map();
    for (const post of s.sorted) {
      if (post.hidden || !post.card.getClientRects().length) continue;
      const a = post.card.querySelector('.avatar-wrapper img')?.getBoundingClientRect();
      if (!a?.width) continue;
      let startY = a.bottom - box.top + 3;
      if (post.toggle) {
        const cardBox = post.card.getBoundingClientRect();
        const menuBox = post.card.querySelector('.comment-menu')?.getBoundingClientRect();
        const x = a.left - cardBox.left + a.width / 2;
        const y = menuBox?.height ? menuBox.top - cardBox.top + menuBox.height / 2 - 14 : cardBox.height - 40;
        const values = { '--nst-toggle-x':x - 14, '--nst-toggle-y':Math.max(a.bottom - cardBox.top + 3,y), '--nst-rail-x':x, '--nst-rail-top':a.bottom - cardBox.top + 3 };
        for (const [key,value] of Object.entries(values)) post.card.style.setProperty(key,`${value}px`);
        const toggleBox = post.toggle.getBoundingClientRect();
        startY = toggleBox.top - box.top + toggleBox.height / 2;
        post.card.style.setProperty('--nst-rail-height',`${Math.max(0,startY - (a.bottom - box.top + 3))}px`);
      }
      geometry.set(post.floor,{avatar:a,startY});
    }
    for (const parent of s.sorted) {
      const own = geometry.get(parent.floor);
      if (!own || parent.folded) continue;
      const children = (s.children.get(parent.floor) || []).map(post => geometry.get(post.floor)?.avatar).filter(a => a && a.top > own.avatar.top);
      if (!children.length) continue;
      const startX = own.avatar.left - box.left + own.avatar.width / 2;
      const lane = Math.min(startX,...children.map(a => a.left - box.left - 14));
      const ends = children.map(a => ({x:a.left - box.left - 4,y:a.top - box.top + a.height / 2}));
      const lastY = Math.max(...ends.map(end => end.y));
      // One spine per parent avoids darkening shared segments for every sibling.
      paths.push(`M ${startX} ${own.startY} H ${lane} V ${lastY - 10} ` + ends.map(end => `M ${lane} ${end.y - 10} Q ${lane} ${end.y} ${lane + 10} ${end.y} H ${end.x}`).join(' '));
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
    const pages=[...s.loadedPages].sort((a,b)=>a-b), ranges=[];
    for(const page of pages) { const last=ranges.at(-1); if(last && page===last[1]+1) last[1]=page; else ranges.push([page,page]); }
    const pageLabel=ranges.map(([first,last])=>first===last?first:`${first}–${last}`).join('、');
    s.status.textContent = `已加载 ${percent}% · ${s.posts.size} 条评论 · 第 ${pageLabel} 页`;
    if (markRead && !document.hidden) {
      let changed = false;
      for (const post of s.posts.values()) {
        if (!s.pending.has(post.floor) || post.hidden) continue;
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
      if (!featureEnabled('threadedReading') || !current) { cleanup(); return; }
      if (state && (state.topic !== current.topic || state.page !== current.page)) cleanup();
      // Native rendering can briefly remove the list before inserting its replacement.
      if (!list) return;
      if (!state) {
        const stored = read(`page:${current.topic}:${current.page}`, null);
        state = { ...current, list, posts:new Map(), collapsed:new Set(), initializedBranches:new Set(), defaultCollapsed:automaticTaskSettings().threadDefaultCollapsed, pendingHash:location.hash, known:new Set(Array.isArray(stored?.known) ? stored.known.filter(Number.isSafeInteger) : []), pending:new Set(Array.isArray(stored?.pending) ? stored.pending.filter(Number.isSafeInteger) : []), visited:Array.isArray(stored?.known), maxPage:current.page };
        makeBar(state); setupLoading(state); resize?.observe(list);
      }
      const s = state;
      retainLoadedConversation(s,list);
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
        const post = { floor, card, body, author:card.querySelector('.author-name')?.textContent.trim() || '', ref:null, depth:0, root:floor, descendants:0 };
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
      s.sorted = sorted; s.children = children;
      for (let i = sorted.length - 1; i >= 0; i--) {
        const post = sorted[i], parent = post.ref && s.posts.get(post.ref.parent);
        if (parent) parent.descendants += 1 + post.descendants;
      }
      for (const post of sorted) {
        if (!post.descendants || s.initializedBranches.has(post.floor)) continue;
        s.initializedBranches.add(post.floor);
        if (s.defaultCollapsed) s.collapsed.add(post.floor);
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
            addBranchToggle(s,post);
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
      applyBranchState(s);
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
      // Resolve a direct comment link once, including a target arriving on a later page.
      // Refreshing author info or loading replies must not undo a later manual fold.
      if (mode === 'thread' && !s.restorePages.length && /^#\d+$/.test(s.pendingHash) && s.posts.has(Number(s.pendingHash.slice(1)))) revealHash();
    } finally { observe(); }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(refresh,80); }
  const observer = new MutationObserver(records => {
    if (records.some(record => {
      const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      const owned = '.nst-modebar,.nst-relation,.nst-auto-quote,.nst-branch-toggle,.nst-connectors,.nst-auto-load,.nst-fixed-editor,.nst-editor-spacer,.nst-editor-head';
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
  document.addEventListener('click',rememberReplyContext,true);
  document.addEventListener('submit',rememberReplyContext,true);
  document.addEventListener('nsit:reveal-floor', event => revealFloor(event.detail?.floor));
  document.addEventListener('nsit:thread-default-changed', () => {
    const s = state;
    if (!s) return;
    const next = automaticTaskSettings().threadDefaultCollapsed;
    if (next === s.defaultCollapsed) return;
    s.defaultCollapsed = next;
    s.collapsed.clear();
    if (next) for (const post of s.posts.values()) if (post.descendants) s.collapsed.add(post.floor);
    applyBranchState(s);
    updateFrame(false);
  });
  document.addEventListener('click', event => {
    const action=event.target.closest?.('.comment-menu .menu-item,.comment-menu button');
    if(action && /^(回复|引用|编辑)$/.test(action.textContent.trim())) openEditor(state,true);
    if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href]');
    if (link && state && (!link.target || link.target.toLowerCase() === '_self') && !link.hasAttribute('download')) {
      try {
        const url = new URL(link.href,location.href);
        const target = url.pathname.match(/^\/post-(\d+)-(\d+)\/?$/);
        const floor = /^#\d+$/.test(url.hash) ? Number(url.hash.slice(1)) : 0;
        if (url.origin === location.origin && target?.[1] === state.topic && state.posts.has(floor)) {
          event.preventDefault(); jump(state.posts.get(floor).card);
        }
      } catch { /* Non-URL links retain their native behavior. */ }
    }
  },true);
  document.addEventListener('load',event => { if (event.target.tagName === 'IMG') scheduleFrame(); },true);
  window.addEventListener('popstate',schedule);
  window.addEventListener('hashchange',revealHash);
  window.addEventListener('pageshow',schedule);
  window.addEventListener('pagehide',() => { if (state) persist(state); });
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('切换楼中楼 / 引用 / 原始', () => { mode = validModes[(validModes.indexOf(mode) + 1) % validModes.length]; write('mode',mode); refresh(); });
  }
  refresh();
  return { refresh };
}
