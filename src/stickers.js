  const STICKER_STORAGE_KEY = 'nsit-stickers-v1';
  let stickerSequence = 0;

  // 表情包存在油猴存储里：{ groups: [{ id, name, items: [{ id, name, url }] }], active }
  function readStickers() {
    const saved = autoTaskRead(STICKER_STORAGE_KEY, null);
    const groups = Array.isArray(saved?.groups) ? saved.groups.filter(group => group && typeof group.id === 'string').map(group => ({
      id: group.id, name: String(group.name || '未命名').slice(0, 20),
      items: (Array.isArray(group.items) ? group.items : []).filter(item => item && typeof item.id === 'string' && /^https:\/\//.test(String(item.url || ''))).map(item => ({ id: item.id, name: String(item.name || '表情').slice(0, 30), url: String(item.url) })),
    })) : [];
    if (!groups.length) groups.push({ id: 'default', name: '默认', items: [] });
    const active = groups.some(group => group.id === saved?.active) ? saved.active : groups[0].id;
    return { groups, active };
  }

  function stickerId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${(++stickerSequence).toString(36)}`;
  }

  function stickerMarkdown(item) {
    return `![${item.name.replace(/[[\]]/g, '')}](${item.url})`;
  }

  // 插入到原生回复框光标处（CodeMirror 或普通 textarea）。
  function insertStickerText(app, text) {
    const scope = app._nsitEditor;
    if (!scope?.isConnected) return false;
    const wrapper = scope.matches('.CodeMirror') ? scope : scope.querySelector('.CodeMirror');
    const cm = wrapper?.CodeMirror;
    if (cm && typeof cm.replaceSelection === 'function') { cm.replaceSelection(text, 'end'); cm.focus?.(); return true; }
    const textarea = scope.matches('textarea') ? scope : Array.from(scope.querySelectorAll('textarea')).find(element => !app.contains(element));
    if (!textarea || textarea.disabled || textarea.readOnly) return false;
    textarea.setRangeText(text, textarea.selectionStart, textarea.selectionEnd, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
    return true;
  }

  function installStickers(app) {
    const toolbox = app.querySelector('.nsit-toolbox');
    if (!toolbox || app.querySelector('.nsit-sticker') || app.dataset.nsitFlagHost !== undefined) return;
    const root = document.createElement('span');
    root.className = 'nsit-sticker';
    root.innerHTML = '<button type="button" class="nsit-sticker-toggle" data-nsit-sticker-toggle aria-expanded="false" aria-haspopup="true" title="我的表情包">😀 表情</button><div class="nsit-sticker-panel" data-nsit-sticker-panel role="dialog" aria-label="表情包" hidden><div class="nsit-sticker-tabs" data-nsit-sticker-tabs></div><div class="nsit-sticker-grid" data-nsit-sticker-grid></div><div class="nsit-sticker-foot"><small data-nsit-sticker-status role="status"></small><span class="nsit-sticker-manage-actions" data-nsit-sticker-group-actions hidden><button type="button" data-nsit-sticker-rename-group>重命名分组</button><button type="button" data-nsit-sticker-delete-group>删除分组</button></span><button type="button" data-nsit-sticker-upload>上传</button><button type="button" data-nsit-sticker-manage aria-pressed="false">管理</button></div><input type="file" accept="image/*" multiple hidden data-nsit-sticker-files></div>';
    root.style.display = featureEnabled('stickers') ? '' : 'none';
    toolbox.before(root);
    injectStyles(`#${APP_ID} .nsit-sticker{position:relative;display:inline-flex;flex:none;vertical-align:middle;margin:0 7px 0 0}#${APP_ID} .nsit-sticker-toggle{box-sizing:border-box;height:26px;margin:0;padding:3px 8px;border:1px solid var(--nsit-accent);border-radius:5px;background:var(--nsit-accent-soft);color:var(--nsit-accent-ink);font:600 13px/1.25 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;white-space:nowrap;cursor:pointer}#${APP_ID} .nsit-sticker-toggle:hover,#${APP_ID} .nsit-sticker-toggle[aria-expanded=true]{background:var(--nsit-accent);color:#fff}#${APP_ID} .nsit-sticker-panel{position:absolute;z-index:1000;top:calc(100% + 6px);left:0;display:flex;flex-direction:column;gap:8px;box-sizing:border-box;width:min(360px,calc(100vw - 16px));max-height:min(380px,70vh);padding:8px;border:1px solid var(--nsit-line-strong);border-radius:8px;background:var(--nsit-surface);box-shadow:0 8px 18px var(--nsit-shadow-soft);color:var(--nsit-ink);font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}#${APP_ID} .nsit-sticker-panel[hidden]{display:none}#${APP_ID} .nsit-sticker-panel.is-dragover{outline:2px dashed var(--nsit-accent)}#${APP_ID} .nsit-sticker-tabs{display:flex;gap:4px;overflow-x:auto;flex:none;padding-bottom:2px}#${APP_ID} .nsit-sticker-tabs button{flex:none;padding:2px 9px;border:1px solid var(--nsit-line-strong);border-radius:12px;background:var(--nsit-sunken);color:var(--nsit-ink);font:inherit;white-space:nowrap;cursor:pointer}#${APP_ID} .nsit-sticker-tabs button[aria-selected=true]{border-color:var(--nsit-accent);background:var(--nsit-accent-soft);color:var(--nsit-accent-ink);font-weight:600}#${APP_ID} .nsit-sticker-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px;min-height:72px;overflow-y:auto}#${APP_ID} .nsit-sticker-empty{grid-column:1/-1;align-self:center;margin:0;padding:14px 4px;color:var(--nsit-muted);font-size:12px;text-align:center}#${APP_ID} .nsit-sticker-item{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;margin:0;padding:4px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--nsit-ink);font:inherit;cursor:pointer}#${APP_ID} .nsit-sticker-item:hover{border-color:var(--nsit-accent-line,var(--nsit-line-strong));background:var(--nsit-sunken)}#${APP_ID} .nsit-sticker-item img{width:56px;height:56px;object-fit:contain}#${APP_ID} .nsit-sticker-item span{max-width:100%;overflow:hidden;font-size:11px;color:var(--nsit-muted);text-overflow:ellipsis;white-space:nowrap}#${APP_ID} .nsit-sticker-item[data-pending]{opacity:.55;cursor:default}#${APP_ID} .nsit-sticker-tools{position:absolute;top:0;right:0;display:none;gap:2px}#${APP_ID} .nsit-sticker-panel.is-managing .nsit-sticker-tools{display:flex}#${APP_ID} .nsit-sticker-tools button{width:20px;height:20px;margin:0;padding:0;border:1px solid var(--nsit-line-strong);border-radius:4px;background:var(--nsit-surface);color:var(--nsit-ink);font:12px/1 inherit;cursor:pointer}#${APP_ID} .nsit-sticker-foot{display:flex;flex-wrap:wrap;align-items:center;gap:6px;flex:none}#${APP_ID} .nsit-sticker-foot small{flex:1 1 140px;min-width:0;color:var(--nsit-muted);font-size:12px}#${APP_ID} .nsit-sticker-foot button{padding:2px 10px;border:1px solid var(--nsit-line-strong);border-radius:5px;background:var(--nsit-sunken);color:var(--nsit-ink);font:12px/1.5 inherit;cursor:pointer}#${APP_ID} .nsit-sticker-foot [data-nsit-sticker-upload],#${APP_ID} .nsit-sticker-foot [aria-pressed=true]{border-color:var(--nsit-accent);background:var(--nsit-accent-soft);color:var(--nsit-accent-ink)}#${APP_ID} .nsit-sticker-manage-actions{display:inline-flex;gap:6px}#${APP_ID} .nsit-sticker-manage-actions[hidden]{display:none}@media(pointer:coarse){#${APP_ID} .nsit-sticker-panel.is-managing .nsit-sticker-tools button{width:26px;height:26px}}`);
    const toggle = root.querySelector('[data-nsit-sticker-toggle]'), panel = root.querySelector('[data-nsit-sticker-panel]');
    const tabs = panel.querySelector('[data-nsit-sticker-tabs]'), grid = panel.querySelector('[data-nsit-sticker-grid]');
    const status = panel.querySelector('[data-nsit-sticker-status]'), picker = panel.querySelector('[data-nsit-sticker-files]');
    const manageButton = panel.querySelector('[data-nsit-sticker-manage]'), groupActions = panel.querySelector('[data-nsit-sticker-group-actions]');
    const pending = [];
    let managing = false, message = '';

    function save(data) { autoTaskWrite(STICKER_STORAGE_KEY, data); }
    function activeGroup(data) { return data.groups.find(group => group.id === data.active) || data.groups[0]; }
    function say(text) { message = text; render(); }

    function render() {
      const data = readStickers(), group = activeGroup(data);
      tabs.replaceChildren(...data.groups.map(item => {
        const tab = document.createElement('button');
        tab.type = 'button'; tab.dataset.nsitStickerGroup = item.id; tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', String(item.id === group.id));
        tab.textContent = `${item.name}${item.items.length ? ` ${item.items.length}` : ''}`;
        return tab;
      }));
      const add = document.createElement('button');
      add.type = 'button'; add.dataset.nsitStickerAddGroup = ''; add.textContent = '＋ 分组'; add.title = '新建分组';
      tabs.append(add);
      const cells = group.items.map(item => {
        const cell = document.createElement('button');
        cell.type = 'button'; cell.className = 'nsit-sticker-item'; cell.dataset.nsitStickerItem = item.id; cell.title = `插入「${item.name}」`;
        const image = document.createElement('img');
        image.loading = 'lazy'; image.alt = item.name; image.src = item.url; image.referrerPolicy = 'no-referrer';
        const label = document.createElement('span'); label.textContent = item.name;
        const tools = document.createElement('span'); tools.className = 'nsit-sticker-tools';
        for (const [action, text, title] of [['rename', '✎', '重命名'], ['move', '⇄', '移到其他分组'], ['delete', '×', '删除']]) {
          const button = document.createElement('button');
          button.type = 'button'; button.dataset.nsitStickerAction = action; button.textContent = text; button.title = title; button.setAttribute('aria-label', `${title}「${item.name}」`);
          tools.append(button);
        }
        cell.append(image, label, tools);
        return cell;
      });
      for (const job of pending.filter(job => job.group === group.id)) {
        const cell = document.createElement('span');
        cell.className = 'nsit-sticker-item'; cell.dataset.pending = '';
        const label = document.createElement('span'); label.textContent = '上传中…';
        cell.append(label); cells.push(cell);
      }
      if (!cells.length) {
        const empty = document.createElement('p');
        empty.className = 'nsit-sticker-empty'; empty.textContent = '这个分组还没有表情。打开面板时直接粘贴图片，或点「上传」添加。';
        cells.push(empty);
      }
      grid.replaceChildren(...cells);
      panel.classList.toggle('is-managing', managing);
      manageButton.setAttribute('aria-pressed', String(managing)); manageButton.textContent = managing ? '完成' : '管理';
      groupActions.hidden = !managing;
      status.textContent = message || (pending.length ? `正在上传 ${pending.length} 张…` : `粘贴图片即加入「${group.name}」`);
    }

    function position() {
      panel.style.left = panel.style.top = panel.style.bottom = '';
      const anchor = root.getBoundingClientRect(), box = panel.getBoundingClientRect();
      const width = document.documentElement.clientWidth || innerWidth, height = window.visualViewport?.height || innerHeight;
      if (anchor.left + box.width > width - 8) panel.style.left = `${Math.min(0, width - 8 - box.width - anchor.left)}px`;
      if (anchor.left + (parseFloat(panel.style.left) || 0) < 8) panel.style.left = `${8 - anchor.left}px`;
      // 底部固定回复栏贴着屏幕底边：放不下时向上展开。
      if (box.bottom > height - 8 && anchor.top - box.height - 6 >= 8) { panel.style.top = 'auto'; panel.style.bottom = 'calc(100% + 6px)'; }
    }
    function open() { message = ''; panel.hidden = false; toggle.setAttribute('aria-expanded', 'true'); render(); position(); }
    function close() { panel.hidden = true; managing = false; toggle.setAttribute('aria-expanded', 'false'); }

    // 上传到 NodeImage 图库，拿到永久链接后存进当前分组。
    function upload(files) {
      files = Array.from(files || []).filter(file => file?.type?.startsWith('image/'));
      if (!files.length) return;
      const target = readStickers().active;
      message = '';
      for (const file of files) {
        const job = { group: target };
        pending.push(job);
        uploadNodeImage(file).then(markdown => {
          const url = String(markdown).match(/\((https:\/\/[^\s)]+)\)/)?.[1];
          if (!url) throw new Error('图库未返回图片链接');
          const data = readStickers();
          const group = data.groups.find(item => item.id === job.group) || activeGroup(data);
          const base = String(file.name || '').replace(/\.[a-z0-9]+$/i, '').trim();
          const name = base && !/^(image|blob|pasted-\d+.*|clipboard.*)$/i.test(base) ? base.slice(0, 30) : `表情${group.items.length + 1}`;
          group.items.push({ id: stickerId('s'), name, url });
          save(data);
        }).catch(error => { message = `上传失败：${error.message || '网络错误'}`; })
          .finally(() => { pending.splice(pending.indexOf(job), 1); if (root.isConnected) render(); });
      }
      render();
    }

    function renameGroup(data, group) {
      const name = prompt('分组名称', group.name);
      if (name == null || !name.trim()) return;
      group.name = name.trim().slice(0, 20); save(data); render();
    }

    toggle.addEventListener('click', event => { event.stopPropagation(); if (panel.hidden) open(); else close(); });
    panel.addEventListener('click', event => {
      event.stopPropagation();
      const data = readStickers(), group = activeGroup(data);
      const tab = event.target.closest('[data-nsit-sticker-group]');
      if (tab) { data.active = tab.dataset.nsitStickerGroup; save(data); message = ''; render(); return; }
      if (event.target.closest('[data-nsit-sticker-add-group]')) {
        const name = prompt('新分组名称', '');
        if (name == null || !name.trim()) return;
        const created = { id: stickerId('g'), name: name.trim().slice(0, 20), items: [] };
        data.groups.push(created); data.active = created.id; save(data); render(); return;
      }
      if (event.target.closest('[data-nsit-sticker-upload]')) { picker.value = ''; picker.click(); return; }
      if (event.target.closest('[data-nsit-sticker-manage]')) { managing = !managing; message = ''; render(); return; }
      if (event.target.closest('[data-nsit-sticker-rename-group]')) { renameGroup(data, group); return; }
      if (event.target.closest('[data-nsit-sticker-delete-group]')) {
        if (data.groups.length < 2) { say('至少保留一个分组'); return; }
        if (!confirm(`删除分组「${group.name}」${group.items.length ? `和其中 ${group.items.length} 个表情` : ''}？`)) return;
        data.groups = data.groups.filter(item => item.id !== group.id); data.active = data.groups[0].id; save(data); render(); return;
      }
      const cell = event.target.closest('[data-nsit-sticker-item]');
      const item = cell && group.items.find(entry => entry.id === cell.dataset.nsitStickerItem);
      if (!item) return;
      const action = event.target.closest('[data-nsit-sticker-action]')?.dataset.nsitStickerAction || (managing ? 'rename' : 'insert');
      if (action === 'insert') {
        if (insertStickerText(app, stickerMarkdown(item))) close(); else say('回复框暂不可用');
      } else if (action === 'rename') {
        const name = prompt('表情名称', item.name);
        if (name == null || !name.trim()) return;
        item.name = name.trim().slice(0, 30); save(data); render();
      } else if (action === 'delete') {
        if (!confirm(`删除表情「${item.name}」？图库里的图片不受影响。`)) return;
        group.items = group.items.filter(entry => entry !== item); save(data); render();
      } else if (action === 'move') {
        const others = data.groups.filter(entry => entry !== group);
        if (!others.length) { say('先用「＋ 分组」新建一个分组'); return; }
        const answer = prompt(`移到哪个分组？输入序号：\n${others.map((entry, index) => `${index + 1}. ${entry.name}`).join('\n')}`, '1');
        const destination = others[Number(answer) - 1];
        if (!destination) return;
        group.items = group.items.filter(entry => entry !== item); destination.items.push(item); save(data); render();
      }
    });
    picker.addEventListener('change', () => { upload(picker.files); picker.value = ''; });
    panel.addEventListener('dragover', event => {
      if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
      event.preventDefault(); panel.classList.add('is-dragover');
    });
    panel.addEventListener('dragleave', () => panel.classList.remove('is-dragover'));
    panel.addEventListener('drop', event => {
      panel.classList.remove('is-dragover');
      if (!event.dataTransfer?.files?.length) return;
      event.preventDefault(); event.stopPropagation(); upload(event.dataTransfer.files);
    });

    // 面板打开时粘贴的图片都进表情包，不再插入回复框。
    const listeners = new AbortController();
    const options = { capture: true, signal: listeners.signal };
    document.addEventListener('paste', event => {
      if (!root.isConnected) { listeners.abort(); return; }
      if (panel.hidden) return;
      const files = Array.from(event.clipboardData?.items || []).filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(file => file?.type?.startsWith('image/'));
      const all = files.length ? files : Array.from(event.clipboardData?.files || []).filter(file => file.type.startsWith('image/'));
      if (!all.length) return;
      event.preventDefault(); event.stopImmediatePropagation(); upload(all);
    }, options);
    document.addEventListener('click', event => {
      if (!root.isConnected) { listeners.abort(); return; }
      if (!panel.hidden && !root.contains(event.target)) close();
    }, { signal: listeners.signal });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !panel.hidden) { close(); toggle.focus(); }
    }, { signal: listeners.signal });
  }
