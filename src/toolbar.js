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
      toggle.toggleAttribute('data-busy', uploading);
      toggle.title = uploading ? '图片上传中，点击查看进度' : '出鸡模板、上传图片、计算器和收鸡模板';
      position();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
