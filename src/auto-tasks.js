  const AUTO_TASK_SETTINGS_KEY = 'nsit-auto-settings-v1';
  const AUTO_TASK_RUNTIME_KEY = '__nsitAutomaticTasks__';

  function autoTaskRead(key, fallback = null) {
    try {
      return typeof GM_getValue === 'function' ? GM_getValue(key, fallback) : JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
    } catch (_) { return fallback; }
  }

  function autoTaskWrite(key, value) {
    if (typeof GM_setValue === 'function') GM_setValue(key, value);
    else localStorage.setItem(key, JSON.stringify(value));
  }

  function automaticTaskSettings() {
    const saved = autoTaskRead(AUTO_TASK_SETTINGS_KEY, {}) || {};
    return { dailyCheckin: saved.dailyCheckin !== false, autoReply: saved.autoReply === true, replyText: typeof saved.replyText === 'string' ? saved.replyText.trim().slice(0, 500) : '' };
  }

  function automaticTaskPageWindow() {
    return typeof unsafeWindow === 'undefined' ? window : unsafeWindow;
  }

  function updateAutomaticTaskStatus() {
    const runtime = automaticTaskPageWindow()[AUTO_TASK_RUNTIME_KEY];
    for (const name of ['checkin', 'reply']) {
      const node = document.querySelector(`[data-nsit-auto-status="${name}"]`);
      const text = runtime?.status?.[name] || (name === 'checkin' ? '等待检查' : '未开启');
      if (node && node.textContent !== text) node.textContent = text;
    }
  }

  function openAutomaticTaskSettings() {
    let dialog = document.querySelector('[data-nsit-auto-dialog]');
    if (!dialog) {
      injectStyles(`.nsit-auto-modal{position:fixed;z-index:2147483647;inset:0;display:grid;place-items:center;padding:16px;background:var(--nsit-scrim);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--nsit-ink)}.nsit-auto-modal[hidden]{display:none}.nsit-auto-dialog{width:min(460px,100%);max-height:calc(100dvh - 32px);overflow:auto;padding:20px;border:1px solid var(--nsit-line-strong);border-radius:12px;background:var(--nsit-surface);box-shadow:0 12px 40px var(--nsit-shadow-soft)}.nsit-auto-dialog header{display:flex;align-items:center;justify-content:space-between;gap:12px}.nsit-auto-dialog h2{margin:0;font-size:17px}.nsit-auto-dialog label{display:block;margin:16px 0 6px}.nsit-auto-dialog p{margin:6px 0;color:var(--nsit-muted);font-size:12px}.nsit-auto-dialog textarea{box-sizing:border-box;width:100%;min-height:90px;padding:9px;border:1px solid var(--nsit-line-strong);border-radius:6px;background:var(--nsit-sunken);color:var(--nsit-ink);font:inherit;resize:vertical}.nsit-auto-dialog button{padding:5px 12px;border:1px solid var(--nsit-line-strong);border-radius:6px;background:var(--nsit-sunken);color:var(--nsit-ink);font:inherit;cursor:pointer}.nsit-auto-dialog footer{display:flex;align-items:center;gap:10px;margin-top:18px}.nsit-auto-dialog button[type=submit]{border-color:var(--nsit-accent);background:var(--nsit-accent-soft);color:var(--nsit-accent-ink)}.nsit-auto-dialog [role=status]{color:var(--nsit-accent-ink);font-size:12px}`);
      dialog = document.createElement('div'); dialog.className = 'nsit-auto-modal'; dialog.dataset.nsitAutoDialog = ''; dialog.hidden = true;
      dialog.innerHTML = '<section class="nsit-auto-dialog" role="dialog" aria-modal="true" aria-labelledby="nsit-auto-title"><header><h2 id="nsit-auto-title">自动任务</h2><button type="button" data-nsit-auto-close aria-label="关闭自动任务">×</button></header><form><label><input type="checkbox" name="dailyCheckin"> 每日自动签到</label><p>打开 NodeSeek 时自动签到；跨天后继续检查，默认领取固定奖励。</p><p data-nsit-auto-status="checkin"></p><label><input type="checkbox" name="autoReply"> 抽奖帖自动回复</label><label for="nsit-auto-reply-text">自定义回复语句</label><textarea id="nsit-auto-reply-text" name="replyText" maxlength="500" placeholder="填写后开启自动回复"></textarea><p>只在当前抽奖帖尝试一次。已回复、已开奖、自己发起的帖子会跳过；有草稿时保留草稿。</p><p>发送前最多核实 10 页历史回复；接口失败或历史未查完时跳过，避免重复回复。</p><p data-nsit-auto-status="reply"></p><footer><button type="submit">保存设置</button><span role="status" data-nsit-auto-message></span></footer></form></section>';
      document.body.append(dialog);
      const close = () => { dialog.hidden = true; };
      dialog.querySelector('[data-nsit-auto-close]').addEventListener('click', close);
      dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
      dialog.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
      dialog.querySelector('form').addEventListener('submit', event => {
        event.preventDefault();
        const next = { dailyCheckin: dialog.querySelector('[name="dailyCheckin"]').checked, autoReply: dialog.querySelector('[name="autoReply"]').checked, replyText: dialog.querySelector('[name="replyText"]').value.trim() };
        const message = dialog.querySelector('[data-nsit-auto-message]');
        if (next.autoReply && !next.replyText) { message.textContent = '请填写自定义回复语句'; return; }
        try {
          autoTaskWrite(AUTO_TASK_SETTINGS_KEY, next); message.textContent = '已保存';
          automaticTaskPageWindow()[AUTO_TASK_RUNTIME_KEY]?.schedule();
        } catch (_) { message.textContent = '设置保存失败，请检查浏览器存储'; }
      });
    }
    const settings = automaticTaskSettings();
    dialog.querySelector('[name="dailyCheckin"]').checked = settings.dailyCheckin;
    dialog.querySelector('[name="autoReply"]').checked = settings.autoReply;
    dialog.querySelector('[name="replyText"]').value = settings.replyText;
    dialog.querySelector('[data-nsit-auto-message]').textContent = '';
    dialog.hidden = false; updateAutomaticTaskStatus();
    dialog.querySelector('[data-nsit-auto-close]').focus();
  }

  function automaticTaskEditor() {
    const scope = document.querySelector('#editor-body') || document.querySelector('#editor .CodeMirror');
    if (!scope) return null;
    const cmElement = scope.matches('.CodeMirror') ? scope : scope.querySelector('.CodeMirror');
    const cm = cmElement?.CodeMirror;
    const input = scope.matches('textarea') ? scope : Array.from(scope.querySelectorAll('textarea')).find(node => !node.closest(`#${APP_ID}`));
    const area = scope.closest('.md-editor, form') || scope.parentElement;
    const submit = Array.from(area?.querySelectorAll('button.submit, button[type="submit"], input[type="submit"]') || []).find(node => !node.closest(`#${APP_ID}, [data-nsit-auto-dialog]`));
    if (!submit || submit.disabled || (!cm && (!input || input.disabled || input.readOnly))) return null;
    return { scope, submit, get: () => cm ? cm.getValue() : input.value, set: value => {
      if (cm) cm.setValue(value);
      else {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        if (setter) setter.call(input, value); else input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } };
  }

  function automaticTaskHasReply(uid, postId) {
    if (repliedFloors(postId).length) return true;
    const data = automaticTaskPageWindow().__config__?.postData;
    if (String(data?.postId) === postId && data.comments?.some(item => Number(item.floorIndex) > 0 && (item.poster?.isMe === true || String(item.poster?.uid || item.poster?.id || item.poster?.member_id || '') === uid))) return true;
    return Array.from(document.querySelectorAll('.content-item')).some(item => item.id !== '0' && Array.from(item.querySelectorAll('a.author-name')).some(author => {
      try { return new URL(author.href, location.href).pathname === `/space/${uid}`; } catch (_) { return false; }
    }));
  }

  function automaticTaskDraw(postId) {
    const first = luckyFirstFloor();
    const links = Array.from(first?.querySelectorAll('.post-content a[href]') || []);
    for (const link of links) {
      let url;
      try { url = new URL(link.getAttribute('href'), location.href); } catch (_) { continue; }
      if (url.protocol !== 'https:' || !['nodeseek.com', 'www.nodeseek.com'].includes(url.hostname) || url.pathname !== '/lucky' || url.searchParams.get('post') !== postId) continue;
      const draw = luckyParseLinkFromText(url.href);
      if (draw && draw.time > Date.now()) return draw;
    }
    return null;
  }

  function installAutomaticTasks({ autoStart = true } = {}) {
    const pageWindow = automaticTaskPageWindow();
    pageWindow[AUTO_TASK_RUNTIME_KEY]?.disconnect?.();
    let disposed = false, running = null, scheduled = null;
    const historyRetryAt = new Map();
    const controller = new AbortController();
    const runtime = { status: { checkin: '等待检查', reply: '未开启' }, run, schedule, disconnect() {
      disposed = true; controller.abort(); clearInterval(interval); clearTimeout(scheduled);
    } };
    pageWindow[AUTO_TASK_RUNTIME_KEY] = runtime;
    function status(name, value) { runtime.status[name] = value; updateAutomaticTaskStatus(); }
    async function locked(uid, task, callback) {
      if (!navigator.locks?.request) { status(task === 'checkin' ? 'checkin' : 'reply', '当前浏览器不支持任务锁，请手动操作'); return; }
      await navigator.locks.request(`nsit-auto-${uid}-${task}`, { ifAvailable: true }, async lock => { if (lock && !disposed) await callback(); });
    }
    async function requestJson(url, options = {}) {
      if (disposed) throw new Error('任务已取消');
      const requestController = new AbortController();
      const abortRequest = () => requestController.abort();
      controller.signal.addEventListener('abort', abortRequest, { once: true });
      const timeout = setTimeout(abortRequest, 20000);
      try {
        const response = await fetch(url, { ...options, credentials: 'same-origin', signal: requestController.signal });
        return { response, payload: await response.json() };
      } finally {
        clearTimeout(timeout); controller.signal.removeEventListener('abort', abortRequest);
      }
    }
    async function verifyReplyHistory(uid, postId) {
      const key = `${uid}-${postId}`;
      if (historyRetryAt.get(key) > Date.now()) { status('reply', '历史回复暂无法核实，稍后重试；不会自动发送'); return false; }
      status('reply', '正在核实历史回复…');
      try {
        for (let page = 1; page <= 10; page += 1) {
          const { response, payload } = await requestJson(`/api/content/list-comments?uid=${encodeURIComponent(uid)}&page=${page}`);
          if (disposed || currentNodeSeekUserId() !== uid || currentPostId() !== postId) return false;
          if (!response.ok || payload?.success !== true || !Array.isArray(payload.comments)) throw new Error('历史回复接口不可用');
          mergeRepliedComments(payload);
          if (automaticTaskHasReply(uid, postId)) { status('reply', '本帖已有历史回复，已跳过'); return false; }
          if (!payload.comments.length) return true;
        }
        throw new Error('已检查 10 页，历史回复尚未查完');
      } catch (error) {
        if (disposed) return false;
        historyRetryAt.set(key, Date.now() + 5 * 60 * 1000);
        status('reply', `${error.message || '历史回复无法核实'}，本次跳过`); return false;
      }
    }
    async function checkin(uid) {
      if (!automaticTaskSettings().dailyCheckin) { status('checkin', '未开启'); return; }
      await locked(uid, 'checkin', async () => {
        if (!automaticTaskSettings().dailyCheckin || currentNodeSeekUserId() !== uid) return;
        const now = Date.now(), day = new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const key = `nsit-auto-checkin-v1-${uid}`, record = autoTaskRead(key, {});
        if (record.day === day && record.done) { status('checkin', record.message || '今日已签到'); return; }
        if (record.day === day && record.nextAt > now) { status('checkin', record.message || '稍后重试'); return; }
        autoTaskWrite(key, { day, nextAt: now + 5 * 60 * 1000, done: false });
        status('checkin', '签到中…');
        try {
          const { response, payload } = await requestJson('/api/attendance?random=false', { method: 'POST' });
          const message = String(payload?.message || payload?.error || '');
          if (!response.ok || !(payload?.success === true || /已(?:经)?签(?:到|过)|already\s+(?:signed|checked)/i.test(message))) throw new Error(message || `签到失败（HTTP ${response.status}）`);
          const text = message || '今日签到成功';
          autoTaskWrite(key, { day, done: true, message: text }); status('checkin', text);
        } catch (error) {
          if (disposed) return;
          const text = `签到未完成：${error.message || '网络错误'}，稍后重试`;
          autoTaskWrite(key, { day, nextAt: now + 5 * 60 * 1000, done: false, message: text }); status('checkin', text);
        }
      });
    }
    async function reply(uid) {
      const settings = automaticTaskSettings();
      if (!settings.autoReply || !settings.replyText) { status('reply', '填写回复语句并开启后生效'); return; }
      const postId = currentPostId();
      if (!postId) { status('reply', '等待打开抽奖帖'); return; }
      await locked(uid, `reply-${postId}`, async () => {
        const key = `nsit-auto-reply-v1-${uid}-${postId}`, record = autoTaskRead(key);
        if (automaticTaskHasReply(uid, postId)) {
          if (record && record.state !== 'done') autoTaskWrite(key, { ...record, state: 'done' });
          status('reply', '本帖已回复，已跳过'); return;
        }
        if (record) { status('reply', record.state === 'done' ? '本帖已自动回复' : '本帖已尝试提交，请检查网页确认结果；不会重复发送'); return; }
        const draw = automaticTaskDraw(postId);
        if (!draw) { status('reply', '本页未检测到当前帖的有效抽奖链接'); return; }
        if (luckyIsOwnDraw()) { status('reply', '自己发起的抽奖，已跳过'); return; }
        const editor = automaticTaskEditor();
        if (!editor) { status('reply', '原生回复框暂不可用'); return; }
        if (editor.get()) { status('reply', '检测到草稿，保留草稿并跳过自动回复'); return; }
        if (!await verifyReplyHistory(uid, postId)) return;
        const ready = automaticTaskSettings();
        if (disposed || currentNodeSeekUserId() !== uid || currentPostId() !== postId || !editor.scope.isConnected || !editor.submit.isConnected || editor.get() || !ready.autoReply || ready.replyText !== settings.replyText || !automaticTaskDraw(postId) || editor.submit.disabled || automaticTaskHasReply(uid, postId)) {
          status('reply', '页面、设置或草稿已变化，本次跳过'); return;
        }
        const phrase = settings.replyText;
        autoTaskWrite(key, { state: 'prepared', at: Date.now() });
        editor.set(phrase);
        await new Promise(resolve => setTimeout(resolve, 0));
        const latestSettings = automaticTaskSettings();
        if (disposed || currentNodeSeekUserId() !== uid || currentPostId() !== postId || !editor.scope.isConnected || !editor.submit.isConnected || editor.get() !== phrase || !latestSettings.autoReply || latestSettings.replyText !== phrase || !automaticTaskDraw(postId) || editor.submit.disabled) {
          if (editor.scope.isConnected && editor.get() === phrase) editor.set('');
          autoTaskWrite(key, null); status('reply', '自动回复已取消，草稿已保留'); return;
        }
        autoTaskWrite(key, { state: 'submitted', at: Date.now() });
        editor.submit.click();
        if (automaticTaskHasReply(uid, postId)) { autoTaskWrite(key, { state: 'done', at: Date.now() }); status('reply', '本帖自动回复成功'); }
        else status('reply', '已通过原生按钮提交，请检查网页确认结果；不会重复发送');
      });
    }
    function run() {
      if (disposed) return Promise.resolve();
      if (running) return running;
      running = (async () => {
        const uid = currentNodeSeekUserId();
        if (!uid) { status('checkin', '登录后自动签到'); status('reply', '登录后可自动回复'); return; }
        await checkin(uid);
        if (!disposed && uid === currentNodeSeekUserId()) await reply(uid);
      })().catch(error => { status('reply', `自动任务未执行：${error.message || '存储不可用'}`); }).finally(() => { running = null; });
      return running;
    }
    function schedule() {
      if (disposed || scheduled) return;
      scheduled = setTimeout(() => { scheduled = null; void run(); }, 250);
    }
    const interval = setInterval(schedule, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); }, { signal: controller.signal });
    if (autoStart) schedule();
    return runtime;
  }
