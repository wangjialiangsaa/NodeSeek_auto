  function installReplyKeyboard(app) {
    const editor = app._nsitEditor;
    if (!editor || !/^\/post-\d+-\d+\/?$/.test(location.pathname)) return;
    editor._nsitReplyKeyboardController?.abort();
    const controller = new AbortController();
    editor._nsitReplyKeyboardController = controller;
    const options = { capture: true, signal: controller.signal };
    let composing = false;
    editor.addEventListener('compositionstart', () => { composing = true; }, options);
    editor.addEventListener('compositionend', () => { composing = false; }, options);
    editor.addEventListener('keydown', event => {
      if (!/^\/post-\d+-\d+\/?$/.test(location.pathname) || event.key !== 'Enter' || event.isComposing || composing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element) || target.closest(`#${APP_ID}, .CodeMirror-dialog`)) return;
      const cmElement = target.closest('.CodeMirror');
      const cm = cmElement?.CodeMirror;
      const input = cm?.getInputField?.() || (target.matches('textarea') ? target : null);
      if (!input || (input !== target && !input.contains(target)) || input.disabled || input.readOnly || cm?.getOption?.('readOnly')) return;
      const area = editor.closest('.md-editor, form, #editor') || editor.parentElement;
      const submit = Array.from(area?.querySelectorAll('button.submit, button[type="submit"], input[type="submit"]') || []).find(node => !node.closest(`#${APP_ID}`));
      if (!submit || /保存|修改|更新/.test(submit.textContent || submit.value || '')) return;
      // Handle before CodeMirror and native shortcuts so one key makes one action.
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.repeat) return;
      if (event.shiftKey) {
        if (cm?.replaceSelection) cm.replaceSelection('\n', 'end', '+input');
        else if (input.matches('textarea')) {
          input.setRangeText('\n', input.selectionStart, input.selectionEnd, 'end');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }
      const content = cm?.getValue ? cm.getValue() : input.value;
      if (!String(content || '').trim()) return;
      if (!submit.disabled && submit.getAttribute('aria-disabled') !== 'true') submit.click();
    }, options);
  }

  function installEditorToolbar(app) {
    if (app.querySelector('[data-nsit-tools-toggle]') || app.dataset.nsitFlagHost !== undefined) return;
    const toolbox = document.createElement('span');
    toolbox.className = 'nsit-toolbox';
    const toggle = document.createElement('button');
    toggle.type = 'button'; toggle.className = 'nsit-tools-toggle';
    toggle.dataset.nsitToolsToggle = ''; toggle.textContent = '🐔 工具';
    toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-haspopup', 'true');
    toggle.setAttribute('aria-controls', 'nsit-tools-panel');
    const panel = document.createElement('div');
    panel.id = 'nsit-tools-panel'; panel.className = 'nsit-tools-panel'; panel.dataset.nsitToolsPanel = '';
    panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', '编辑工具'); panel.hidden = true;
    const nativePopover = typeof panel.showPopover === 'function';
    if (nativePopover) panel.setAttribute('popover', 'auto');
    const controls = Array.from(app.children).filter(node => node.matches('.nsit-trigger, .nsit-image-trigger, [data-nsit-image-files], [data-nsit-image-status]'));
    for (const control of controls) panel.append(control);
    toolbox.append(toggle, panel); app.prepend(toolbox);
    injectStyles(`#${APP_ID} .nsit-toolbox{display:inline-flex;align-items:center;flex:none;vertical-align:middle;margin:0 7px 0 0}#${APP_ID} .nsit-tools-toggle{display:inline-flex;align-items:center;justify-content:center;gap:3px;box-sizing:border-box;min-width:76px;height:26px;margin:0;padding:3px 8px;border:1px solid var(--nsit-accent);border-radius:5px;background:var(--nsit-accent-soft);color:var(--nsit-accent-ink);font:600 13px/1.25 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;white-space:nowrap;cursor:pointer}#${APP_ID} .nsit-tools-toggle::after{content:'▾';font-size:10px}#${APP_ID} .nsit-tools-toggle[data-busy]::after{content:'◌';animation:nsit-generation-spin 1s linear infinite}#${APP_ID} .nsit-tools-panel{position:fixed;z-index:2147483646;inset:auto;margin:0;display:flex;flex-wrap:wrap;align-items:center;gap:8px;width:max-content;max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);overflow:auto;padding:12px;border:1px solid var(--nsit-line-strong);border-radius:9px;background:var(--nsit-surface);color:var(--nsit-ink);box-shadow:0 8px 28px var(--nsit-shadow-soft);font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}#${APP_ID} .nsit-tools-panel[hidden]{display:none!important}#${APP_ID} .nsit-tools-panel .nsit-trigger,#${APP_ID} .nsit-tools-panel .nsit-image-trigger{flex:none;display:inline-flex;align-items:center;justify-content:center;width:auto;min-width:70px;height:26px;margin:0;white-space:nowrap}#${APP_ID} .nsit-tools-panel>.nsit-trigger:first-child,#${APP_ID} .nsit-tools-panel>.nsit-image-trigger{width:70px}#${APP_ID} .nsit-tools-panel [data-nsit-image-status]{flex:1 0 100%;max-width:420px;overflow-wrap:anywhere}.message-input .mde-toolbar>#${APP_ID} .nsit-toolbox{align-self:center;margin-left:auto}`);
    const controller = new AbortController();
    const options = { signal: controller.signal };
    function position() {
      if (panel.hidden) return;
      const anchor = toggle.getBoundingClientRect();
      const width = document.documentElement.clientWidth || innerWidth;
      panel.style.maxWidth = `${Math.max(0, width - 16)}px`;
      const box = panel.getBoundingClientRect();
      const height = window.visualViewport?.height || innerHeight;
      panel.style.left = `${Math.max(8, Math.min(anchor.left, width - box.width - 8))}px`;
      const below = anchor.bottom + 6;
      panel.style.top = `${Math.max(8, below + box.height <= height - 8 ? below : anchor.top - box.height - 6)}px`;
    }
    function close() {
      if (nativePopover) { try { panel.hidePopover(); } catch (_) { /* already closed */ } }
      panel.hidden = true; toggle.setAttribute('aria-expanded', 'false');
    }
    toggle.addEventListener('click', event => {
      event.stopPropagation();
      if (!panel.hidden) { close(); return; }
      panel.hidden = false;
      if (nativePopover) { try { panel.showPopover(); } catch (_) { /* fixed panel fallback */ } }
      toggle.setAttribute('aria-expanded', 'true'); position();
    }, options);
    panel.addEventListener('toggle', event => { if (event.newState === 'closed') close(); }, options);
    app.addEventListener('click', event => {
      if (event.target.closest('.nsit-trigger, .nsit-image-trigger')) close();
    }, options);
    document.addEventListener('click', event => { if (!toolbox.contains(event.target)) close(); }, options);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !panel.hidden) { close(); toggle.focus(); }
    }, options);
    window.addEventListener('resize', position, options);
    window.addEventListener('scroll', position, { ...options, capture: true });
    const observer = new MutationObserver(() => {
      if (!app.isConnected) { controller.abort(); observer.disconnect(); return; }
      const uploading = /正在上传/.test(app.querySelector('[data-nsit-image-status]')?.textContent || '');
      const title = uploading ? '图片上传中，点击查看进度' : '出鸡模板、上传图片、计算器和收鸡模板';
      toggle.toggleAttribute('data-busy', uploading);
      if (toggle.title !== title) toggle.title = title;
      position();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  const QUICK_REPLY_KEY = 'nsit-quick-reply-v1';

  // 「快速回复」：一键把自定义语句填进原生回复框并用原生按钮发送；✎ 修改语句。
  function installQuickReply(app) {
    const toolbox = app.querySelector('.nsit-toolbox');
    if (!toolbox || app.querySelector('.nsit-quick-reply') || !/^\/post-\d+-\d+\/?$/.test(location.pathname)) return;
    const group = document.createElement('span');
    group.className = 'nsit-quick-reply';
    group.innerHTML = '<button type="button" class="nsit-quick-send" data-nsit-quick-send>⚡ 快速回复</button><button type="button" class="nsit-quick-edit" data-nsit-quick-edit aria-label="编辑快速回复内容" title="编辑快速回复内容" aria-expanded="false">✎</button><span class="nsit-quick-panel" data-nsit-quick-panel hidden><textarea maxlength="500" rows="3" placeholder="填写快速回复的内容"></textarea><span class="nsit-quick-actions"><small data-nsit-quick-message role="status"></small><button type="button" data-nsit-quick-cancel>取消</button><button type="button" data-nsit-quick-save>保存</button></span></span>';
    group.style.display = featureEnabled('quickReply') ? '' : 'none';
    toolbox.after(group);
    injectStyles(`#${APP_ID} .nsit-quick-reply{position:relative;display:inline-flex;align-items:stretch;flex:none;vertical-align:middle;height:26px;margin:0 7px 0 0}#${APP_ID} .nsit-quick-reply>button{box-sizing:border-box;margin:0;border:1px solid var(--nsit-accent);background:var(--nsit-accent-soft);color:var(--nsit-accent-ink);font:600 13px/1.25 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;white-space:nowrap;cursor:pointer}#${APP_ID} .nsit-quick-send{padding:3px 8px;border-radius:5px 0 0 5px}#${APP_ID} .nsit-quick-edit{padding:3px 7px;border-left:0!important;border-radius:0 5px 5px 0}#${APP_ID} .nsit-quick-reply>button:hover{background:var(--nsit-accent);color:#fff}#${APP_ID} .nsit-quick-reply>button:disabled{opacity:.6;cursor:default}#${APP_ID} .nsit-quick-panel{position:absolute;z-index:1000;top:calc(100% + 6px);left:0;display:grid;gap:6px;box-sizing:border-box;width:min(300px,calc(100vw - 16px));padding:8px;border:1px solid var(--nsit-line-strong);border-radius:7px;background:var(--nsit-surface);box-shadow:0 8px 18px var(--nsit-shadow-soft)}#${APP_ID} .nsit-quick-panel[hidden]{display:none}#${APP_ID} .nsit-quick-panel textarea{box-sizing:border-box;width:100%;min-height:64px;padding:6px;border:1px solid var(--nsit-line-strong);border-radius:5px;background:var(--nsit-sunken);color:var(--nsit-ink);font:13px/1.5 inherit;resize:vertical}#${APP_ID} .nsit-quick-actions{display:flex;align-items:center;gap:6px}#${APP_ID} .nsit-quick-actions small{flex:1;color:var(--nsit-muted);font-size:12px}#${APP_ID} .nsit-quick-actions button{padding:2px 10px;border:1px solid var(--nsit-line-strong);border-radius:5px;background:var(--nsit-sunken);color:var(--nsit-ink);font:12px/1.5 inherit;cursor:pointer}#${APP_ID} .nsit-quick-actions [data-nsit-quick-save]{border-color:var(--nsit-accent);background:var(--nsit-accent-soft);color:var(--nsit-accent-ink)}@media(pointer:coarse){#${APP_ID} .nsit-quick-edit{position:relative}#${APP_ID} .nsit-quick-edit::after{content:'';position:absolute;inset:-8px -8px -8px 0}}`);
    const send = group.querySelector('[data-nsit-quick-send]'), edit = group.querySelector('[data-nsit-quick-edit]');
    const panel = group.querySelector('[data-nsit-quick-panel]'), input = panel.querySelector('textarea'), message = panel.querySelector('[data-nsit-quick-message]');
    const saved = () => String(autoTaskRead(QUICK_REPLY_KEY, '') || '').trim();
    function flash(text) {
      send.title = text; send.textContent = text;
      setTimeout(() => { send.textContent = '⚡ 快速回复'; send.title = saved() ? `发送：${saved()}` : '先设置快速回复内容'; }, 1600);
    }
    function openPanel(hint = '') {
      input.value = saved(); message.textContent = hint; panel.hidden = false;
      edit.setAttribute('aria-expanded', 'true');
      // 底部固定回复栏贴着屏幕底边：放不下时向上展开，并保持在屏幕左右边界内。
      panel.style.left = panel.style.top = panel.style.bottom = '';
      const anchor = group.getBoundingClientRect(), box = panel.getBoundingClientRect();
      const width = document.documentElement.clientWidth || innerWidth, height = window.visualViewport?.height || innerHeight;
      if (anchor.left + box.width > width - 8) panel.style.left = `${Math.min(0, width - 8 - box.width - anchor.left)}px`;
      if (box.bottom > height - 8 && anchor.top - box.height - 6 >= 8) { panel.style.top = 'auto'; panel.style.bottom = 'calc(100% + 6px)'; }
      input.focus();
    }
    function closePanel() { panel.hidden = true; edit.setAttribute('aria-expanded', 'false'); }
    send.title = saved() ? `发送：${saved()}` : '先设置快速回复内容';
    edit.addEventListener('click', event => { event.stopPropagation(); if (panel.hidden) openPanel(); else closePanel(); });
    panel.addEventListener('click', event => event.stopPropagation());
    panel.querySelector('[data-nsit-quick-cancel]').addEventListener('click', closePanel);
    panel.querySelector('[data-nsit-quick-save]').addEventListener('click', () => {
      try {
        autoTaskWrite(QUICK_REPLY_KEY, input.value.trim());
        send.title = saved() ? `发送：${saved()}` : '先设置快速回复内容'; closePanel();
      } catch (_) { message.textContent = '保存失败，请检查浏览器存储'; }
    });
    input.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { closePanel(); edit.focus(); }
    });
    const outside = new AbortController();
    document.addEventListener('click', event => {
      if (!group.isConnected) { outside.abort(); return; }
      if (!group.contains(event.target)) closePanel();
    }, { signal: outside.signal });
    send.addEventListener('click', async event => {
      event.stopPropagation();
      const text = saved();
      if (!text) { openPanel('先填写快速回复的内容'); return; }
      const postId = currentPostId();
      if (!postId || send.disabled) return;
      // 走评论接口发送，停留在当前页；回复框里的草稿原样保留。
      send.disabled = true;
      const timeout = new AbortController(), timer = setTimeout(() => timeout.abort(), 20000);
      try {
        const response = await fetch('/api/content/new-comment', { ...nodeSeekCommentRequest(postId, text), credentials: 'same-origin', signal: timeout.signal });
        const error = nodeSeekCommentError(response, await response.json().catch(() => null));
        if (error) { flash(`未发送：${error}`); return; }
        flash('已发送');
        // 与原生「发布评论」一致：参与别人的抽奖时记一笔，并补上「我的回复」楼层标记。
        const draw = luckyDrawForReply();
        if (draw && !luckyIsOwnDraw()) recordParticipation(draw);
        void syncRepliedComments().catch(() => {});
      } catch (_) {
        flash('结果未知，请刷新确认');
      } finally {
        clearTimeout(timer);
        setTimeout(() => { send.disabled = false; }, 1600);
      }
    });
  }
