  let imageUploadSequence = 0;

  function installImageUploads(app) {
    if (app._nsitImageUploads) return;
    const scope = app._nsitEditor;
    const button = app.querySelector('.nsit-image-trigger');
    const picker = app.querySelector('[data-nsit-image-files]');
    const status = app.querySelector('[data-nsit-image-status]');
    if (!scope || !button || !picker || !status) return;
    app._nsitImageUploads = true;
    const controller = new AbortController();
    const listenerOptions = { capture: true, signal: controller.signal };
    const failed = [];
    const originals = new Map();
    let pending = 0, completed = 0;

    function editor() {
      const wrapper = scope.matches('.CodeMirror') ? scope : scope.querySelector('.CodeMirror');
      const cm = wrapper?.CodeMirror;
      if (cm && typeof cm.replaceRange === 'function') return { cm, get: () => cm.getValue() };
      const textarea = scope.matches('textarea') ? scope : Array.from(scope.querySelectorAll('textarea')).find(element => !app.contains(element));
      return textarea ? { textarea, get: () => textarea.value } : null;
    }

    function replace(target, from, to, text, selectInserted = false) {
      if (target.cm) {
        const cm = target.cm;
        // replaceRange keeps CodeMirror's undo history and adjusts the current cursor.
        cm.replaceRange(text, cm.posFromIndex(from), cm.posFromIndex(to), 'nsit-image-upload');
        if (selectInserted) cm.setSelection(cm.posFromIndex(from + text.length));
      } else {
        const input = target.textarea;
        input.setRangeText(text, from, to, selectInserted ? 'end' : 'preserve');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    function renderStatus(message = '') {
      status.hidden = false;
      status.replaceChildren(document.createTextNode(pending ? `正在上传 ${pending} 张图片…` : message || (completed ? `已上传 ${completed} 张图片` : '')));
      if (!failed.length) return;
      status.append(document.createTextNode(` ${failed[0].error.message} `));
      if (/登录|授权/.test(failed[0].error.message)) {
        const login = document.createElement('a');
        login.href = 'https://www.nodeimage.com/'; login.target = '_blank'; login.rel = 'noopener noreferrer';
        login.textContent = '登录 NodeImage'; status.append(login, document.createTextNode(' '));
      }
      const retry = document.createElement('button');
      retry.type = 'button'; retry.textContent = `重试${failed.length > 1 ? `（${failed.length} 张）` : ''}`;
      retry.title = '在当前光标处重新插入图片，保留选中的文字';
      retry.addEventListener('click', () => {
        const files = failed.splice(0).map(job => job.file);
        start(files, true);
      });
      status.append(retry);
    }

    function settle(job, text) {
      if (!app.isConnected || !scope.isConnected) return;
      const content = job.target.get();
      const at = content.indexOf(job.token);
      // If the author deleted/replaced the pending image, never resurrect it.
      if (at >= 0) replace(job.target, at, at + job.token.length, text);
    }

    function start(files, keepSelection = false) {
      const target = editor();
      if (!target || !scope.isConnected) return;
      files = Array.from(files).filter(file => file?.type?.startsWith('image/'));
      if (!files.length) return;
      const content = target.get();
      const to = target.cm ? target.cm.indexFromPos(target.cm.getCursor('to')) : target.textarea.selectionEnd;
      const from = keepSelection ? to : target.cm ? target.cm.indexFromPos(target.cm.getCursor('from')) : target.textarea.selectionStart;
      const jobs = files.map((file, index) => ({
        file, target, original: index === 0 ? content.slice(from, to) : '', prefix: index ? '\n' : '',
        token: `![图片上传中…](nsit-upload://${Date.now()}-${++imageUploadSequence})`,
      }));
      jobs.forEach(job => originals.set(job.token, job.original));
      replace(target, from, to, jobs.map(job => job.token).join(''), true);
      pending += jobs.length;
      renderStatus();
      for (const job of jobs) {
        uploadNodeImage(job.file).then(markdown => {
          settle(job, job.prefix + markdown); completed++;
        }).catch(error => {
          settle(job, job.original); failed.push({ file: job.file, error });
        }).finally(() => { pending--; if (app.isConnected) renderStatus(); });
      }
    }

    button.addEventListener('click', () => { picker.value = ''; picker.click(); });
    picker.addEventListener('change', () => { start(picker.files); picker.value = ''; });
    scope.addEventListener('paste', event => {
      if (app.contains(event.target)) return;
      const target = editor();
      if (!target || !(target.cm ? event.target.closest?.('.CodeMirror') : event.target === target.textarea)) return;
      const data = event.clipboardData;
      let files = Array.from(data?.items || []).filter(item => item.kind === 'file' && item.type.startsWith('image/')).map(item => item.getAsFile()).filter(Boolean);
      if (!files.length) files = Array.from(data?.files || []).filter(file => file.type.startsWith('image/'));
      if (!files.length) return;
      event.preventDefault(); event.stopImmediatePropagation();
      start(files);
    }, listenerOptions);

    // Keep temporary upload markers out of published posts, including Ctrl+Enter.
    const postingArea = scope.closest('form, .md-editor, .message-input') || scope.parentElement;
    function blockPendingPost(event) {
      const isPost = event.type === 'submit' || (event.type === 'keydown' && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) ||
        (event.type === 'click' && event.target.closest?.('button[type="submit"], input[type="submit"], .submit, .submit-button, .send-button, [data-action="submit"]'));
      if (app.contains(event.target) || !isPost) return;
      if (pending) {
        event.preventDefault(); event.stopImmediatePropagation();
        renderStatus('请等待图片上传完成后再发布');
        return;
      }
      // Undo or a restored draft can bring an old marker back after its request ended.
      const target = editor();
      if (!target) return;
      const markers = Array.from(target.get().matchAll(/!\[图片上传中…\]\(nsit-upload:\/\/[\d-]+\)/g));
      for (const marker of markers.reverse()) replace(target, marker.index, marker.index + marker[0].length, originals.get(marker[0]) || '');
    }
    for (const type of ['submit', 'click', 'keydown']) postingArea?.addEventListener(type, blockPendingPost, listenerOptions);
    const observer = new MutationObserver(() => {
      if (app.isConnected && scope.isConnected) return;
      controller.abort(); observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
