  const AUTO_TASK_SETTINGS_KEY = 'nsit-auto-settings-v1';
  const AUTO_TASK_RUNTIME_KEY = '__nsitAutomaticTasks__';
  const AUTO_TASK_PAGE_CONCURRENCY = 3;
  const AUTO_TASK_PAGE_STAGGER_MS = 120;

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
    return { dailyCheckin: saved.dailyCheckin !== false, checkinRandom: saved.checkinRandom === true, autoReply: saved.autoReply === true, replyText: typeof saved.replyText === 'string' ? saved.replyText.trim().slice(0, 500) : '', threadDefaultCollapsed: saved.threadDefaultCollapsed !== false };
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

  function ensureAutomaticTaskTrigger() {
    const iconPath = '<path d="m28 3 1.5 5.5 5 3 5.5-1.5 4 7-4 4v6l4 4-4 7-5.5-1.5-5 3L28 45h-8l-1.5-5.5-5-3L8 38l-4-7 4-4v-6l-4-4 4-7 5.5 1.5 5-3L20 3Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="24" cy="24" r="7" stroke="currentColor" stroke-width="4"/>';
    ensureStatSettingsTrigger(1, 'nsit-automation', '自动化', iconPath, openAutomaticTaskSettings);
  }

  function openAutomaticTaskSettings() {
    let dialog = document.querySelector('[data-nsit-auto-dialog]');
    if (!dialog) {
      injectStyles(`.nsit-auto-modal{position:fixed;z-index:2147483647;inset:0;display:grid;place-items:center;padding:16px;background:var(--nsit-scrim);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--nsit-ink)}.nsit-auto-modal[hidden]{display:none}.nsit-auto-dialog{box-sizing:border-box;width:min(460px,100%);max-height:calc(100dvh - 32px);overflow:auto;padding:20px;border:1px solid var(--nsit-line-strong);border-radius:12px;background:var(--nsit-surface);box-shadow:0 12px 40px var(--nsit-shadow-soft)}.nsit-auto-dialog header{display:flex;align-items:center;justify-content:space-between;gap:12px}.nsit-auto-dialog h2{margin:0;font-size:17px}.nsit-auto-dialog label{display:block;margin:16px 0 6px}.nsit-auto-choice{display:flex;flex-wrap:wrap;gap:4px 18px;margin:4px 0 0 22px}.nsit-auto-dialog .nsit-auto-choice label{display:inline-flex;align-items:center;gap:4px;margin:0;font-size:13px}.nsit-auto-dialog p{margin:6px 0;color:var(--nsit-muted);font-size:12px}.nsit-auto-dialog textarea{box-sizing:border-box;width:100%;min-height:90px;padding:9px;border:1px solid var(--nsit-line-strong);border-radius:6px;background:var(--nsit-sunken);color:var(--nsit-ink);font:inherit;resize:vertical}.nsit-auto-dialog button{padding:5px 12px;border:1px solid var(--nsit-line-strong);border-radius:6px;background:var(--nsit-sunken);color:var(--nsit-ink);font:inherit;cursor:pointer}.nsit-auto-dialog footer{display:flex;align-items:center;gap:10px;margin-top:18px}.nsit-auto-dialog button[type=submit]{border-color:var(--nsit-accent);background:var(--nsit-accent-soft);color:var(--nsit-accent-ink)}.nsit-auto-dialog [role=status]{color:var(--nsit-accent-ink);font-size:12px}`);
      dialog = document.createElement('div'); dialog.className = 'nsit-auto-modal'; dialog.dataset.nsitAutoDialog = ''; dialog.hidden = true;
      dialog.innerHTML = '<section class="nsit-auto-dialog" role="dialog" aria-modal="true" aria-labelledby="nsit-auto-title"><header><h2 id="nsit-auto-title">自动任务</h2><button type="button" data-nsit-auto-close aria-label="关闭自动任务">×</button></header><form><label><input type="checkbox" name="threadDefaultCollapsed"> 楼中楼默认折叠</label><p>勾选后默认折叠对话，取消勾选则默认展开；更改并保存后立即应用当前页，也用于之后打开的帖子。</p><label><input type="checkbox" name="dailyCheckin"> 每日自动签到</label><p>打开 NodeSeek 任意页面（含主页）即自动签到，无需点击；成功后页面顶部提示获得的鸡腿数，5 秒后自动消失。跨天后继续检查。</p><div class="nsit-auto-choice" role="radiogroup" aria-label="签到奖励"><label><input type="radio" name="checkinMode" value="fixed"> 固定鸡腿</label><label><input type="radio" name="checkinMode" value="random"> 随机鸡腿（试试手气）</label></div><p data-nsit-auto-status="checkin"></p><label><input type="checkbox" name="autoReply"> 抽奖帖自动回复</label><label for="nsit-auto-reply-text">自定义回复语句</label><textarea id="nsit-auto-reply-text" name="replyText" maxlength="500" placeholder="填写后开启自动回复"></textarea><p>打开帖子后，检测楼主正文中的官方抽奖链接（/lucky?post=…&mode=view），自动发送已保存的语句。</p><p>只在当前抽奖帖尝试一次。已回复、已开奖、自己发起的帖子会跳过；直接通过接口发送，停留在当前页，不动回复框里的草稿。</p><p>发送前核实本帖各页回复，不受个人历史评论数量影响；分页核实失败时跳过，避免重复回复。</p><p data-nsit-auto-status="reply"></p><footer><button type="submit">保存设置</button><span role="status" data-nsit-auto-message></span></footer></form></section>';
      document.body.append(dialog);
      const close = () => { dialog.hidden = true; };
      dialog.querySelector('[data-nsit-auto-close]').addEventListener('click', close);
      dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
      dialog.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
      dialog.querySelector('form').addEventListener('submit', event => {
        event.preventDefault();
        const next = { dailyCheckin: dialog.querySelector('[name="dailyCheckin"]').checked, checkinRandom: dialog.querySelector('[name="checkinMode"]:checked')?.value === 'random', autoReply: dialog.querySelector('[name="autoReply"]').checked, replyText: dialog.querySelector('[name="replyText"]').value.trim(), threadDefaultCollapsed: dialog.querySelector('[name="threadDefaultCollapsed"]').checked };
        const message = dialog.querySelector('[data-nsit-auto-message]');
        if (next.autoReply && !next.replyText) { message.textContent = '请填写自定义回复语句'; return; }
        try {
          const previousDefault = automaticTaskSettings().threadDefaultCollapsed;
          autoTaskWrite(AUTO_TASK_SETTINGS_KEY, next); message.textContent = '已保存';
          if (previousDefault !== next.threadDefaultCollapsed) document.dispatchEvent(new CustomEvent('nsit:thread-default-changed', { detail: { collapsed: next.threadDefaultCollapsed } }));
          automaticTaskPageWindow()[AUTO_TASK_RUNTIME_KEY]?.schedule();
        } catch (_) { message.textContent = '设置保存失败，请检查浏览器存储'; }
      });
    }
    const settings = automaticTaskSettings();
    dialog.querySelector('[name="dailyCheckin"]').checked = settings.dailyCheckin;
    dialog.querySelector(`[name="checkinMode"][value="${settings.checkinRandom ? 'random' : 'fixed'}"]`).checked = true;
    dialog.querySelector('[name="autoReply"]').checked = settings.autoReply;
    dialog.querySelector('[name="replyText"]').value = settings.replyText;
    dialog.querySelector('[name="threadDefaultCollapsed"]').checked = settings.threadDefaultCollapsed;
    dialog.querySelector('[data-nsit-auto-message]').textContent = '';
    dialog.hidden = false; updateAutomaticTaskStatus();
    dialog.querySelector('[data-nsit-auto-close]').focus();
  }

  // 直接调评论接口回帖：原生发送按钮发完会跳到最后一页，大帖重新加载楼中楼时容易卡死。
  function nodeSeekCommentRequest(postId, content) {
    return {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'csrf-token': luckyRandomToken(16) },
      body: JSON.stringify({ content, mode: 'new-comment', postId: Number(postId) }),
    };
  }

  function nodeSeekCommentError(response, payload) {
    return response.ok && payload?.success === true ? '' : String(payload?.message || payload?.error || `HTTP ${response.status}`);
  }

  function automaticTaskHasReply(uid, postId) {
    if (repliedFloors(postId).length) return true;
    const data = automaticTaskPageWindow().__config__?.postData;
    if (String(data?.postId) === postId && data.comments?.some(item => Number(item.floorIndex) > 0 && (item.poster?.isMe === true || String(item.poster?.uid || item.poster?.id || item.poster?.member_id || '') === uid))) return true;
    return Array.from(document.querySelectorAll('.content-item')).some(item => item.id !== '0' && Array.from(item.querySelectorAll('a.author-name')).some(author => {
      try { return new URL(author.href, location.href).pathname === `/space/${uid}`; } catch (_) { return false; }
    }));
  }

  // 开奖链接只认本站 /lucky 且 post 指向当前帖、开奖时间未到。作者常写成 http、
  // 不带 www、/lucky/、被转义成 &amp; 的地址，或只贴纯文本 / 代码块而没有生成链接。
  function automaticTaskParseDraw(raw, postId) {
    let url;
    try { url = new URL(String(raw || '').trim().replace(/&amp;/gi, '&'), location.href); } catch (_) { return null; }
    if (!/^https?:$/.test(url.protocol) || !['nodeseek.com', 'www.nodeseek.com'].includes(url.hostname) || url.pathname.replace(/\/+$/, '') !== '/lucky' || url.searchParams.get('post') !== postId) return null;
    url.protocol = 'https:'; url.pathname = '/lucky';
    const draw = luckyParseLinkFromText(url.href);
    return draw && draw.time > Date.now() ? draw : null;
  }

  function automaticTaskDrawCandidates(postId) {
    const candidates = [];
    // Full URLs are validated by host below; a bare path must not be the tail of another site's URL.
    const linkPattern = /(?:https?:\/\/[^\s<>"'`)\]）】，。；]+|(?<![\w.:/-])\/lucky\/?\?[^\s<>"'`)\]）】，。；]+)/gi;
    const first = luckyFirstFloor();
    const content = first?.querySelector('.post-content') || first;
    if (content) {
      for (const link of content.querySelectorAll('a[href]')) candidates.push(link.getAttribute('href'));
      candidates.push(...(content.textContent.match(linkPattern) || []));
    }
    const data = automaticTaskPageWindow().__config__?.postData;
    if (String(data?.postId || '') === postId && Array.isArray(data.comments)) {
      const floor = data.comments.find(item => Number(item?.floorIndex) === 0);
      candidates.push(...(String(floor?.markdown || '').match(linkPattern) || []));
    }
    return candidates;
  }

  function automaticTaskDraw(postId) {
    for (const candidate of automaticTaskDrawCandidates(postId)) {
      const draw = automaticTaskParseDraw(candidate, postId);
      if (draw) return draw;
    }
    // 不在第一页时 0 楼不在页面上：用 resolveCurrentDraw 补拉第一页得到的开奖参数。
    const cached = luckyDrawCache.postId === postId ? luckyDrawCache.draw : null;
    return cached && cached.postId === postId && cached.time > Date.now() ? cached : null;
  }

  // 签到成功后在页面顶部居中提示收益，几秒后自动消失，不拦点击。
  function checkinToastText(payload) {
    const number = value => (value === null || value === undefined || value === '' ? NaN : Number(value));
    const message = String(payload?.message || '');
    let gain = number(payload?.gain);
    if (!Number.isFinite(gain)) gain = number(message.match(/(\d+)\s*个?\s*鸡腿/)?.[1]);
    const current = number(payload?.current);
    const head = Number.isFinite(gain) ? `🍗 签到成功，获得 ${gain} 个鸡腿` : `🍗 ${message || '签到成功'}`;
    return Number.isFinite(current) ? `${head}（现有 ${current} 个）` : head;
  }

  function showCheckinToast(payload) {
    if (!document.body) return;
    document.querySelector('.nsit-checkin-toast')?.remove();
    if (!document.querySelector('style[data-nsit-checkin-toast]')) {
      const style = document.createElement('style');
      style.dataset.nsitCheckinToast = '';
      style.textContent = '.nsit-checkin-toast{position:fixed;z-index:2147483000;top:14px;left:50%;max-width:calc(100vw - 32px);box-sizing:border-box;padding:9px 18px;border:1px solid rgba(214,139,22,.45);border-radius:999px;background:rgba(255,248,232,.97);color:#7a4a00;box-shadow:0 6px 20px rgba(0,0,0,.14);font:600 14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:center;pointer-events:none;transform:translate(-50%,-8px);opacity:0;transition:opacity .25s,transform .25s}.nsit-checkin-toast.is-shown{opacity:1;transform:translate(-50%,0)}@media(prefers-color-scheme:dark){.nsit-checkin-toast{border-color:rgba(255,190,90,.4);background:rgba(48,36,16,.96);color:#ffd48a}}@media(prefers-reduced-motion:reduce){.nsit-checkin-toast{transition:none}}';
      document.head.append(style);
    }
    const toast = document.createElement('div');
    toast.className = 'nsit-checkin-toast';
    toast.setAttribute('role', 'status');
    toast.textContent = checkinToastText(payload);
    document.body.append(toast);
    setTimeout(() => toast.classList.add('is-shown'), 30);
    setTimeout(() => { toast.classList.remove('is-shown'); setTimeout(() => toast.remove(), 300); }, 5000);
  }

  function installAutomaticTasks({ autoStart = true } = {}) {
    const pageWindow = automaticTaskPageWindow();
    pageWindow[AUTO_TASK_RUNTIME_KEY]?.disconnect?.();
    let disposed = false, running = null, scheduled = null;
    const replyRetryAt = new Map();
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
    async function request(url, options = {}, format = 'json') {
      if (disposed) throw new Error('任务已取消');
      const requestController = new AbortController();
      const abortRequest = () => requestController.abort();
      controller.signal.addEventListener('abort', abortRequest, { once: true });
      const timeout = setTimeout(abortRequest, 20000);
      try {
        const response = await fetch(url, { ...options, credentials: 'same-origin', signal: requestController.signal });
        return { response, payload: format === 'text' ? await response.text() : await response.json() };
      } finally {
        clearTimeout(timeout); controller.signal.removeEventListener('abort', abortRequest);
      }
    }
    async function verifyThreadReplies(uid, postId) {
      const key = `${uid}-${postId}`;
      if (replyRetryAt.get(key) > Date.now()) { status('reply', '本帖回复暂无法核实，稍后重试；不会自动发送'); return false; }
      let stop = false;
      try {
        let lastPage = 1, next = 1, checked = 0, found = false;
        function includePages(doc) {
          for (const link of doc.querySelectorAll('[aria-label="pagination"] [href]')) {
            if (link.closest('.post-content')) continue;
            const url = new URL(link.getAttribute('href'), location.href);
            const match = url.pathname.match(new RegExp(`^/post-${postId}-(\\d+)/?$`));
            if (url.origin === location.origin && match) lastPage = Math.max(lastPage, Number(match[1]));
          }
        }
        includePages(document);
        // 当前页已在页面上，由 automaticTaskHasReply 检查，不再重复抓取。
        const here = currentPostPage();
        // 查当前帖的完整评论，而不是要求读完账号的全部历史评论。
        async function check(page) {
          const path = `/post-${postId}-${page}`;
          const { response, payload } = await request(path, { cache: 'no-store' }, 'text');
          if (stop || disposed || currentNodeSeekUserId() !== uid || currentPostId() !== postId) { stop = true; return; }
          if ([403, 429, 503].includes(response.status) || /<title>\s*(?:Just a moment|请稍候)/i.test(payload)) throw new Error('站点人机验证或限流拦截了核实请求');
          const finalURL = new URL(response.url || path, location.href);
          if (!response.ok || finalURL.origin !== location.origin || finalURL.pathname.replace(/\/$/, '') !== path) throw new Error('本帖回复页面加载失败');
          const doc = new DOMParser().parseFromString(payload, 'text/html');
          const list = doc.querySelector('ul.comments');
          const titleURL = new URL(doc.querySelector('.post-title a[href]')?.getAttribute('href') || '/', location.href);
          if (!list || titleURL.origin !== location.origin || !new RegExp(`^/post-${postId}-\\d+/?$`).test(titleURL.pathname)) throw new Error('未取得本帖回复，请检查站点登录或验证');
          const pager = Array.from(doc.querySelectorAll('[aria-label="pagination"]')).find(node => !node.closest('.post-content'));
          const current = pager?.querySelector('.pager-cur[href]')?.getAttribute('href');
          // 只有一页的帖子不显示分页条；有分页条时当前页必须对得上。
          if (pager ? !current || new URL(current, location.href).pathname.replace(/\/$/, '') !== path : page !== 1) throw new Error('本帖回复分页不完整');
          includePages(doc);
          const ownReplies = [];
          for (const item of list.querySelectorAll(':scope > .content-item')) {
            const author = item.querySelector('a.author-name[href]');
            const authorURL = new URL(author?.getAttribute('href') || '/', location.href);
            if (!/^\d+$/.test(item.id) || Number(item.id) < 1 || !author || authorURL.origin !== location.origin || !/^\/space\/\d+\/?$/.test(authorURL.pathname)) throw new Error('本帖回复信息不完整');
            if (authorURL.pathname.replace(/\/$/, '') === `/space/${uid}`) ownReplies.push({ post_id: Number(postId), floor_id: Number(item.id) });
          }
          if (ownReplies.length) { mergeRepliedComments({ success: true, comments: ownReplies }); found = true; }
          checked += 1;
          if (!found) status('reply', `正在核实本帖回复（${checked}/${Math.max(lastPage - (here <= lastPage ? 1 : 0), checked)} 页）…`);
        }
        // 少量并发抓取其余页；错开起步，避免瞬间请求过多触发人机验证。
        async function worker(index) {
          if (index) await new Promise(resolve => setTimeout(resolve, index * AUTO_TASK_PAGE_STAGGER_MS));
          while (!stop && !found && !disposed) {
            while (next === here) next += 1;
            if (next > lastPage) return;
            const page = next++;
            try { await check(page); } catch (error) { stop = true; throw error; }
          }
        }
        status('reply', '正在核实本帖回复…');
        await Promise.all(Array.from({ length: AUTO_TASK_PAGE_CONCURRENCY }, (_, index) => worker(index)));
        if (stop || disposed) return false;
        if (found || automaticTaskHasReply(uid, postId)) { status('reply', '本帖已有回复，已跳过'); return false; }
        return true;
      } catch (error) {
        stop = true;
        if (disposed) return false;
        replyRetryAt.set(key, Date.now() + 5 * 60 * 1000);
        status('reply', `${error.message || '本帖回复无法核实'}，本次跳过`); return false;
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
          const { response, payload } = await request(`/api/attendance?random=${automaticTaskSettings().checkinRandom}`, { method: 'POST' });
          const message = String(payload?.message || payload?.error || '');
          if (!response.ok || !(payload?.success === true || /已(?:经)?签(?:到|过)|already\s+(?:signed|checked)/i.test(message))) throw new Error(message || `签到失败（HTTP ${response.status}）`);
          const text = message || '今日签到成功';
          autoTaskWrite(key, { day, done: true, message: text }); status('checkin', text);
          if (payload?.success === true) showCheckinToast(payload);
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
        if (record) {
          status('reply', record.state === 'done' ? '本帖已自动回复' : record.state === 'failed' ? `自动回复未成功：${record.message || '接口拒绝'}；不会重复发送` : '本帖已尝试提交，请刷新确认结果；不会重复发送');
          return;
        }
        // 不在第一页时先补拉第一页的开奖参数
        if (!luckyFirstFloor()) await resolveCurrentDraw();
        const draw = automaticTaskDraw(postId);
        if (!draw) { status('reply', '本页未检测到当前帖的有效抽奖链接'); return; }
        if (luckyIsOwnDraw()) { status('reply', '自己发起的抽奖，已跳过'); return; }
        if (!await verifyThreadReplies(uid, postId)) return;
        const ready = automaticTaskSettings();
        if (disposed || currentNodeSeekUserId() !== uid || currentPostId() !== postId || !ready.autoReply || ready.replyText !== settings.replyText || !automaticTaskDraw(postId) || automaticTaskHasReply(uid, postId)) {
          status('reply', '页面或设置已变化，本次跳过'); return;
        }
        // 不点原生发送按钮，回复框里的草稿也不受影响。
        autoTaskWrite(key, { state: 'submitted', at: Date.now() });
        status('reply', '正在发送自动回复…');
        let response, payload;
        try {
          ({ response, payload } = await request('/api/content/new-comment', nodeSeekCommentRequest(postId, settings.replyText)));
        } catch (error) {
          if (!disposed) status('reply', '发送结果未知，请刷新确认；不会重复发送');
          return;
        }
        const message = nodeSeekCommentError(response, payload);
        if (message) {
          autoTaskWrite(key, { state: 'failed', message, at: Date.now() });
          status('reply', `自动回复未成功：${message}；不会重复发送`); return;
        }
        autoTaskWrite(key, { state: 'done', at: Date.now() });
        recordParticipation(draw);
        status('reply', '本帖自动回复成功');
        // 补上「我的回复」楼层标记；失败不影响结果。
        void syncRepliedComments().catch(() => {});
      });
    }
    function run() {
      if (disposed) return Promise.resolve();
      if (running) return running;
      running = (async () => {
        const uid = currentNodeSeekUserId();
        if (!uid) { status('checkin', '登录后自动签到'); status('reply', '登录后可自动回复'); return; }
        // 签到与回复互不依赖，同时进行，回复不再等签到请求。
        await Promise.all([checkin(uid), reply(uid)]);
      })().catch(error => { status('reply', `自动任务未执行：${error.message || '存储不可用'}`); }).finally(() => { running = null; });
      return running;
    }
    function schedule() {
      if (disposed || scheduled) return;
      scheduled = setTimeout(() => { scheduled = null; void run(); }, 50);
    }
    const interval = setInterval(schedule, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); }, { signal: controller.signal });
    if (autoStart) schedule();
    return runtime;
  }
