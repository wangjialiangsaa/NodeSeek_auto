  const AI_SETTINGS_KEY = 'nsai-test-settings-v1';
  const AI_RUNTIME_KEY = '__nsaiTestAssistant__';

  function installAiAssistant() {
    window[AI_RUNTIME_KEY]?.disconnect?.();
    let disposed = false, panel = null, modal = null, request = null, sequence = 0, busy = false;
    let testRequest = null, testSequence = 0, testBusy = false;
    let collapsedByUser = null, compact = true, resizeTimer = null, refreshTimer = null, pageURL = location.pathname + location.search, watchedEditor = null;
    const readSettings = () => {
      try { return normalizeAiSettings(typeof GM_getValue === 'function' ? GM_getValue(AI_SETTINGS_KEY, {}) : {}); }
      catch (_) { return normalizeAiSettings({}); }
    };
    let settings = readSettings();
    const localEndpoint = endpoint => { try { const host = new URL(endpoint).hostname; return host === 'localhost' || host === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(host); } catch (_) { return false; } };
    const ready = () => settings.enabled && settings.endpoint && settings.model && (settings.apiKey || localEndpoint(settings.endpoint));
    const publicPage = () => /^(?:\/|\/page-\d+\/?|\/post-\d+(?:-\d+)?\/?|\/categories(?:\/[^?#]*)?)$/.test(location.pathname);
    const text = (node, value) => { if (node && node.textContent !== value) node.textContent = value; };
    const collapsed = () => collapsedByUser == null ? compact : collapsedByUser;

    if (!document.getElementById('nsai-test-style')) {
      const style = document.createElement('style'); style.id = 'nsai-test-style';
      style.textContent = `
        .nsit-ai-panel,.nsit-ai-dialog{box-sizing:border-box;color:var(--nsbg-ink,var(--text-color,#27334a));background:var(--nsbg-solid,var(--bg-main-color,#fff));font:13px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;border:1px solid var(--nsbg-border,var(--nsit-line-strong,#bbb));border-radius:10px}
        .nsit-ai-panel{position:fixed;left:12px;bottom:16px;z-index:180;width:252px;max-height:420px;display:flex;flex-direction:column;box-shadow:0 4px 18px #0002}
        .nsit-ai-panel[hidden],.nsit-ai-settings[hidden],.nsit-ai-panel [hidden],.nsit-ai-settings [hidden]{display:none!important}
        .nsit-ai-panel header{display:flex;align-items:center;gap:6px;flex:none;padding:9px 11px;background:transparent;color:inherit}
        .nsit-ai-panel header strong{font-size:14px;flex:1}.nsit-ai-panel header small{font-size:10px;color:var(--nsbg-muted,var(--gray-color,#666))}
        .nsit-ai-panel button,.nsit-ai-dialog button{border:1px solid var(--nsbg-border,var(--nsit-line-strong,#bbb));border-radius:6px;padding:5px 8px;background:var(--nsbg-solid,var(--bg-main-color,#fff));color:inherit;font:inherit;cursor:pointer}
        .nsit-ai-panel button:disabled{opacity:.45;cursor:default}.nsit-ai-panel header button{padding:2px 6px;line-height:1.4}
        .nsit-ai-body{min-height:0;overflow:auto;padding:0 11px 11px}.nsit-ai-body p{margin:4px 0 8px;font-size:11px;color:var(--nsbg-muted,var(--gray-color,#666))}
        .nsit-ai-body textarea{box-sizing:border-box;width:100%;min-height:54px;max-height:110px;resize:vertical;padding:6px 8px;border:1px solid var(--nsbg-border,#bbb);border-radius:6px;color:inherit;background:var(--nsbg-solid,var(--bg-main-color,#fff));font:inherit}
        .nsit-ai-actions{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.nsit-ai-actions button{flex:1;white-space:nowrap}
        [data-nsit-ai-result]{margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;max-height:230px;overflow:auto;user-select:text}
        [data-nsit-ai-status]{display:block;margin:6px 0;font-size:11px;color:var(--nsbg-muted,var(--gray-color,#666))}
        [data-nsit-ai-sources]{padding:0;margin:6px 0;list-style:none;font-size:11px;overflow-wrap:anywhere}
        [data-nsit-ai-sources] a{color:var(--nsbg-link,var(--link-color,#145c9e))}
        .nsit-ai-panel[data-collapsed=true]{width:156px}.nsit-ai-panel[data-collapsed=true] header small{display:none}
        .nsit-ai-settings{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:16px;background:#0008}
        .nsit-ai-dialog{width:min(480px,100%);max-height:calc(100dvh - 32px);overflow:auto;padding:18px}
        .nsit-ai-dialog header{display:flex;align-items:center;justify-content:space-between;gap:12px;background:transparent;color:inherit}.nsit-ai-dialog h2{font-size:17px;margin:0}
        .nsit-ai-dialog label{display:block;margin:12px 0 5px}.nsit-ai-dialog input:not([type=checkbox]),.nsit-ai-dialog select{box-sizing:border-box;width:100%;padding:8px;border:1px solid var(--nsbg-border,#bbb);border-radius:6px;color:inherit;background:var(--nsbg-solid,var(--bg-main-color,#fff));font:inherit}
        .nsit-ai-dialog p{font-size:12px;color:var(--nsbg-muted,var(--gray-color,#666));margin:6px 0}.nsit-ai-dialog footer{display:flex;gap:8px;margin-top:16px;background:transparent}.nsit-ai-dialog [role=status]{display:block;min-height:20px;margin-top:10px}
        [data-nsai-test-entry]{display:block;box-sizing:border-box}[data-nsit-automation-entry]>[data-nsai-test-entry]{margin-top:6px}[data-nsai-test-entry] a{white-space:nowrap}[data-nsai-test-entry] svg{vertical-align:-.15em;width:1em;height:1em;margin-right:.25em}
      `;
      document.head.append(style);
    }

    function ensureSettingsEntry() {
      const block = document.querySelectorAll('#nsk-right-panel-container .user-stat > .stat-block,.nsk-right-panel-container .user-stat > .stat-block')[1];
      if (!block) return;
      const host = block.querySelector(':scope > [data-nsit-automation-entry]') || block;
      let entry = document.querySelector('[data-nsai-test-entry]');
      if (!entry) {
        const template = [...block.children].find(node => !node.matches('[data-nsit-automation-entry],[data-nsai-test-entry],[data-nsit-post-filter-entry],[data-nsit-background-entry]') && node.querySelector('a'));
        const nativeLink = template?.querySelector('a');
        if (!nativeLink) return;
        entry = template.cloneNode(false); entry.removeAttribute('id'); entry.dataset.nsaiTestEntry = '';
        const trigger = nativeLink.cloneNode(false); trigger.removeAttribute('id'); trigger.href = '#';
        trigger.dataset.nsaiTestTrigger = ''; trigger.title = 'AI 助手设置 · 独立测试版'; trigger.setAttribute('role', 'button'); trigger.setAttribute('aria-label', 'AI 助手设置');
        const svg = nativeLink.querySelector('svg')?.cloneNode(false) || document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 48 48'); svg.setAttribute('fill', 'none'); svg.setAttribute('aria-hidden', 'true');
        svg.innerHTML = '<rect x="8" y="12" width="32" height="28" rx="6" stroke="currentColor" stroke-width="4"/><path d="M24 5v7M16 24h1m14 0h1M17 32h14" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>';
        const label = nativeLink.querySelector('span')?.cloneNode(false) || document.createElement('span'); label.textContent = 'AI';
        trigger.append(svg, document.createTextNode(' '), label);
        trigger.addEventListener('click', event => { event.preventDefault(); openSettings(); });
        trigger.addEventListener('keydown', event => { if (event.key === ' ') { event.preventDefault(); trigger.click(); } });
        entry.append(trigger);
      }
      // The stable script keeps the automation row last. Nest this extra row so
      // both scripts reach a fixed DOM layout instead of moving each other's rows.
      if (entry.parentElement !== host) host.append(entry);
    }

    function status(value) { text(panel?.querySelector('[data-nsit-ai-status]'), value); }
    function updateActions() {
      if (!panel) return;
      for (const action of ['summary', 'duplicates']) panel.querySelector(`[data-nsit-ai-action="${action}"]`).disabled = busy || !ready();
      panel.querySelector('[data-nsit-ai-action="cancel"]').hidden = !busy;
      panel.querySelector('[data-nsit-ai-action="copy"]').disabled = !panel.querySelector('[data-nsit-ai-result]').textContent;
    }
    function updateCollapsed() {
      if (!panel) return;
      const value = collapsed();
      if (panel.dataset.collapsed !== String(value)) panel.dataset.collapsed = String(value);
      panel.querySelector('.nsit-ai-body').hidden = value;
      const button = panel.querySelector('[data-nsit-ai-action="collapse"]');
      text(button, value ? '+' : '−'); button.setAttribute('aria-expanded', String(!value));
      button.title = value ? '展开 AI 助手' : '收起 AI 助手';
    }
    function placePanel() {
      if (!panel?.isConnected) return;
      const main = document.querySelector('#nsk-body');
      const gap = main?.getBoundingClientRect().left || 0;
      compact = innerWidth <= 1360 || gap < 276;
      const nav = document.querySelector('#nsk-left-panel-container .category-list')?.getBoundingClientRect();
      if (!compact && nav && innerHeight - nav.bottom - 28 < 130) compact = true;
      let bottom = 16;
      if (compact) {
        const editor = document.querySelector('#editor.nst-fixed-editor');
        const rect = editor?.getBoundingClientRect();
        if (rect && rect.height > 0 && rect.top < innerHeight && rect.bottom > 0 && rect.left < 264 && rect.right > 12) bottom = Math.min(Math.max(16, innerHeight - rect.top + 12), Math.max(16, innerHeight - 140));
      }
      const space = !compact && nav ? innerHeight - nav.bottom - bottom - 12 : innerHeight - bottom - 90;
      panel.style.left = compact ? '12px' : `${Math.max(12, (gap - 252) / 2)}px`;
      panel.style.bottom = `${bottom}px`;
      panel.style.width = collapsed() ? '156px' : `${Math.min(252, innerWidth - 24)}px`;
      panel.style.maxHeight = `${Math.max(100, Math.min(440, compact ? innerHeight - bottom - 90 : space))}px`;
      updateCollapsed();
    }
    function cancel(message = '已取消本次分析') {
      sequence++; busy = false;
      const pending = request; request = null;
      pending?.abort?.(); updateActions(); status(message);
    }
    function showSources(sources) {
      const list = panel.querySelector('[data-nsit-ai-sources]');
      list.replaceChildren();
      for (const [index, source] of sources.slice(0, 60).entries()) {
        const li = document.createElement('li'), link = document.createElement('a');
        link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.textContent = `[${index + 1}] ${source.title}`; li.append(link); list.append(li);
      }
    }
    function analyze(mode) {
      if (disposed || busy || !publicPage() || !ready()) { if (!ready()) status('请先在 AI 设置中配置接口并启用'); return; }
      const query = panel.querySelector('[name="question"]').value.trim();
      const context = collectAiPageContext(document, mode, query, settings.maxChars);
      if (!context.text.trim()) { status('当前页面没有可分析的公开帖子内容'); return; }
      if (typeof GM_xmlhttpRequest !== 'function') { status('油猴请求接口不可用，请检查脚本权限'); return; }
      const id = ++sequence, targetPage = location.pathname + location.search;
      busy = true; text(panel.querySelector('[data-nsit-ai-result]'), ''); showSources(context.sources); updateActions(); status('正在分析当前页面已加载的内容…');
      const finish = (answer, error = false) => {
        if (disposed || id !== sequence || targetPage !== location.pathname + location.search) return;
        busy = false; request = null;
        if (!error) text(panel.querySelector('[data-nsit-ai-result]'), answer.slice(0, 24000));
        status(error ? answer : '分析完成 · 仅基于当前已加载内容'); updateActions(); placePanel();
      };
      const headers = { 'Content-Type': 'application/json' };
      if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;
      try {
        request = GM_xmlhttpRequest({
          method: 'POST', url: settings.endpoint, headers, anonymous: true, timeout: 120000,
          data: JSON.stringify({ model: settings.model, messages: buildAiMessages(context, mode, query), stream: false, ...(settings.reasoningEffort ? { reasoning_effort: settings.reasoningEffort } : {}) }),
          onload(response) {
            if (response.status < 200 || response.status >= 300) {
              const hint = response.status === 401 || response.status === 403 ? '请检查 API Key 与接口权限' : response.status === 429 ? '请求过于频繁或额度不足' : '请检查接口地址与模型名称';
              finish(`请求失败（${Number(response.status) || 0}）：${hint}`, true); return;
            }
            try {
              if (typeof response.responseText !== 'string' || response.responseText.length > 500000) throw new Error();
              finish(parseAiResponse(response.responseText));
            } catch (_) { finish('接口返回格式无法识别，请使用 Chat Completions 兼容接口', true); }
          },
          onerror: () => finish('请求失败，请检查 API 地址、网络及油猴联网权限', true),
          ontimeout: () => finish('请求超时，请稍后重试或更换模型', true),
          onabort: () => finish('请求已取消', true),
        });
      } catch (_) { finish('无法发起请求，请检查 API 配置与油猴权限', true); }
    }
    function createPanel() {
      panel = document.createElement('aside'); panel.className = 'nsit-ai-panel'; panel.dataset.nsitAiPanel = '';
      panel.setAttribute('aria-label', 'AI 小助手');
      panel.innerHTML = `<header><strong>AI 小助手</strong><small>测试版</small><button type="button" data-nsit-ai-action="settings" aria-label="AI 设置" title="AI 设置">⚙</button><button type="button" data-nsit-ai-action="collapse" aria-label="展开或收起 AI 助手">+</button></header>
        <div class="nsit-ai-body"><p>整理本页已加载的帖子与回复。可填写具体问题，不填写则直接总结。</p><textarea name="question" rows="2" maxlength="600" aria-label="想了解的问题" placeholder="例如：这些帖子反复在问什么？"></textarea>
        <div class="nsit-ai-actions"><button type="button" data-nsit-ai-action="summary">总结本页</button><button type="button" data-nsit-ai-action="duplicates">重复问题</button></div>
        <span role="status" aria-live="polite" data-nsit-ai-status></span><pre data-nsit-ai-result></pre><ul data-nsit-ai-sources aria-label="参考帖子"></ul>
        <div class="nsit-ai-actions"><button type="button" data-nsit-ai-action="copy">复制结果</button><button type="button" data-nsit-ai-action="cancel" hidden>取消分析</button></div></div>`;
      panel.addEventListener('click', async event => {
        const button = event.target.closest('[data-nsit-ai-action]'); if (!button) return;
        const action = button.dataset.nsitAiAction;
        if (action === 'settings') openSettings();
        else if (action === 'collapse') { collapsedByUser = !collapsed(); placePanel(); }
        else if (action === 'cancel') cancel();
        else if (action === 'summary' || action === 'duplicates') analyze(action);
        else if (action === 'copy') {
          const answer = panel.querySelector('[data-nsit-ai-result]').textContent;
          if (!answer) return;
          try { await navigator.clipboard.writeText(answer); status('已复制结果'); }
          catch (_) { status('浏览器未允许复制，请选中结果后按 Ctrl+C'); }
        }
      });
      document.body.append(panel); updateActions(); status(ready() ? '准备就绪 · 点击按钮开始分析' : '请先通过右上角齿轮或统计栏 AI 配置接口'); placePanel();
    }
    function formSettings() {
      const form = modal.querySelector('form');
      return {
        enabled: form.elements.namedItem('enabled').checked,
        endpoint: form.elements.namedItem('endpoint').value.trim(),
        apiKey: form.elements.namedItem('apiKey').value.trim(),
        model: form.elements.namedItem('model').value.trim(),
        reasoningEffort: form.elements.namedItem('reasoningEffort').value,
        maxChars: settings.maxChars
      };
    }
    function validRequestSettings(raw, next) {
      return next.endpoint && next.model && (next.apiKey || localEndpoint(next.endpoint)) && (!raw.endpoint || next.endpoint);
    }
    function updateTestActions() {
      if (!modal) return;
      modal.querySelector('[data-nsit-ai-test-connection]').disabled = testBusy;
      modal.querySelector('[data-nsit-ai-test-cancel]').hidden = !testBusy;
    }
    function cancelTest(message = '') {
      testSequence++; testBusy = false;
      const pending = testRequest; testRequest = null; pending?.abort?.();
      updateTestActions();
      if (message && modal) text(modal.querySelector('[data-nsit-ai-settings-status]'), message);
    }
    function testConnection() {
      if (disposed || testBusy || !modal || modal.hidden) return;
      const raw = formSettings(), selected = normalizeAiSettings(raw), message = modal.querySelector('[data-nsit-ai-settings-status]');
      if (!validRequestSettings(raw, selected)) { text(message, '请先填写有效的 API 地址、Key 和模型名称；本机服务可留空 Key'); return; }
      if (typeof GM_xmlhttpRequest !== 'function') { text(message, '油猴请求接口不可用，请检查脚本权限'); return; }
      const id = ++testSequence, started = Date.now();
      testBusy = true; updateTestActions(); text(message, '正在测试连接…（最多等待 90 秒）');
      const finish = (detail, statusCode = 0) => {
        if (disposed || id !== testSequence || !testBusy || modal.hidden) return;
        testBusy = false; testRequest = null; updateTestActions();
        const elapsed = Math.max(0, (Date.now() - started) / 1000).toFixed(1);
        text(message, `${detail}${statusCode ? ` · HTTP ${Number(statusCode) || 0}` : ''} · 耗时 ${elapsed} 秒`);
      };
      const headers = { 'Content-Type': 'application/json' };
      if (selected.apiKey) headers.Authorization = `Bearer ${selected.apiKey}`;
      try {
        const pending = GM_xmlhttpRequest({
          method: 'POST', url: selected.endpoint, headers, anonymous: true, timeout: 90000,
          data: JSON.stringify({
            model: selected.model,
            messages: [{ role: 'user', content: '这是一条 API 连接测试。请仅回复 OK。' }],
            stream: false,
            ...(selected.reasoningEffort ? { reasoning_effort: selected.reasoningEffort } : {})
          }),
          onload(response) {
            const code = Number(response.status) || 0;
            if (code < 200 || code >= 300) {
              const hint = code === 401 || code === 403 ? '请检查 Key 和权限' : code === 429 ? '请求过于频繁或额度不足' : '请检查接口地址、模型或思考等级是否受支持';
              finish(`连接失败：${hint}`, code); return;
            }
            try {
              if (typeof response.responseText !== 'string' || response.responseText.length > 500000) throw new Error();
              parseAiResponse(response.responseText); finish('连接成功，接口已正常返回文本', code);
            } catch (_) { finish('接口已响应，但未返回兼容的 Chat Completions 文本', code); }
          },
          onerror: () => finish('连接失败，请检查网络及油猴联网权限'),
          ontimeout: () => finish('连接超时，请稍后重试或降低思考等级'),
          onabort: () => finish('连接测试已取消')
        });
        if (id === testSequence && testBusy) testRequest = pending;
      } catch (_) { finish('无法发起连接测试，请检查配置与油猴权限'); }
    }
    function openSettings() {
      if (disposed) return;
      if (!modal) {
        modal = document.createElement('div'); modal.className = 'nsit-ai-settings'; modal.dataset.nsitAiSettings = ''; modal.hidden = true;
        modal.innerHTML = `<section class="nsit-ai-dialog" role="dialog" aria-modal="true" aria-labelledby="nsit-ai-title"><header><h2 id="nsit-ai-title">AI 助手设置 · 测试版</h2><button type="button" data-nsit-ai-close aria-label="关闭 AI 设置">×</button></header>
          <form><label><input type="checkbox" name="enabled"> 启用 AI 助手</label>
          <label for="nsit-ai-endpoint">API 地址</label><input id="nsit-ai-endpoint" name="endpoint" type="url" maxlength="4096" placeholder="https://你的接口/v1" autocomplete="off">
          <p>支持 Chat Completions 兼容接口，可填 API 基地址或完整的 /chat/completions 地址。</p>
          <label for="nsit-ai-key">API Key（本地服务可留空）</label><input id="nsit-ai-key" name="apiKey" type="password" maxlength="4096" autocomplete="off">
          <label for="nsit-ai-model">模型名称</label><input id="nsit-ai-model" name="model" maxlength="120" placeholder="填写接口提供的模型名称" autocomplete="off">
          <label for="nsit-ai-effort">思考等级（reasoning_effort）</label><select id="nsit-ai-effort" name="reasoningEffort"><option value="">默认（不发送此参数）</option><option value="none">none</option><option value="minimal">minimal</option><option value="low">low</option><option value="medium">medium</option><option value="high">high</option><option value="xhigh">xhigh</option></select>
          <p>可填写任意兼容模型名称。思考等级是否支持由接口和模型决定；不确定时使用默认。分析最多等待 120 秒。</p>
          <p>Key 保存在本机油猴存储。点击分析时，当前公开帖子的文字会发送至你填写的接口；私信、编辑草稿不参与分析。首版只使用本页已加载内容。</p>
          <p>测试连接使用当前未保存的配置，只发送一句固定测试语，不发送页面正文；最多等待 90 秒。</p>
          <footer><button type="button" data-nsit-ai-test-connection>测试连接</button><button type="button" data-nsit-ai-test-cancel hidden>取消测试</button><button type="submit">保存设置</button><button type="button" data-nsit-ai-close>关闭</button></footer><span role="status" aria-live="polite" data-nsit-ai-settings-status></span></form></section>`;
        document.body.append(modal);
        const form = modal.querySelector('form');
        const close = () => { cancelTest(); modal.hidden = true; modal.querySelector('[name="apiKey"]').value = ''; modal._nsitReturnFocus?.focus(); };
        modal.querySelectorAll('[data-nsit-ai-close]').forEach(button => button.addEventListener('click', close));
        modal.querySelector('[data-nsit-ai-test-connection]').addEventListener('click', testConnection);
        modal.querySelector('[data-nsit-ai-test-cancel]').addEventListener('click', () => cancelTest('连接测试已取消'));
        form.addEventListener('input', () => cancelTest('配置已修改，请重新测试连接'));
        form.addEventListener('change', () => cancelTest('配置已修改，请重新测试连接'));
        modal.addEventListener('click', event => { if (event.target === modal) close(); });
        modal.addEventListener('keydown', event => {
          if (event.key === 'Escape') { event.preventDefault(); close(); }
          if (event.key === 'Tab') {
            const items = [...modal.querySelectorAll('button,input,select')].filter(node => !node.disabled && !node.hidden);
            if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
            else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
          }
        });
        form.addEventListener('submit', event => {
          event.preventDefault();
          const raw = formSettings();
          const next = normalizeAiSettings(raw), message = modal.querySelector('[data-nsit-ai-settings-status]');
          if ((raw.endpoint && !next.endpoint) || (raw.enabled && (!next.endpoint || !next.model || (!next.apiKey && !localEndpoint(next.endpoint))))) { text(message, '请填写有效的 HTTPS API 地址、Key 和模型名称；本机服务可用 HTTP 并留空 Key'); return; }
          try {
            if (typeof GM_setValue !== 'function') throw new Error();
            GM_setValue(AI_SETTINGS_KEY, next); cancelTest(); cancel('配置已更新'); settings = next; updateActions();
            text(message, '已保存。点击助手中的总结按钮即可测试'); status(ready() ? '配置已保存 · 可开始分析' : 'AI 助手未启用');
          } catch (_) { text(message, '保存失败，请检查油猴存储权限'); }
        });
      }
      cancelTest(); settings = readSettings(); modal._nsitReturnFocus = document.activeElement;
      const form = modal.querySelector('form');
      for (const name of ['enabled', 'endpoint', 'apiKey', 'model', 'reasoningEffort']) {
        const input = form.elements.namedItem(name);
        if (input.type === 'checkbox') input.checked = settings.enabled; else input.value = settings[name];
      }
      text(modal.querySelector('[data-nsit-ai-settings-status]'), ''); modal.hidden = false; form.elements.namedItem('endpoint').focus();
    }
    function refresh() {
      if (disposed) return;
      ensureSettingsEntry();
      if (pageURL !== location.pathname + location.search) { pageURL = location.pathname + location.search; cancelTest('页面已变化，请重新测试连接'); cancel('页面已变化，请重新分析'); panel?.querySelector('[data-nsit-ai-result]')?.replaceChildren(); panel?.querySelector('[data-nsit-ai-sources]')?.replaceChildren(); }
      if (!publicPage()) { if (busy) cancel(); if (panel) panel.hidden = true; return; }
      if (!panel?.isConnected) createPanel();
      else if (panel.hidden) { panel.hidden = false; placePanel(); }
      const editor = document.querySelector('#editor.nst-fixed-editor');
      if (editor !== watchedEditor) { editorSize?.disconnect(); watchedEditor = editor; if (editor) editorSize?.observe(editor); resize(); }
    }
    const resize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(placePanel, 100); };
    const editorSize = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    const observer = new MutationObserver(records => {
      if (disposed || refreshTimer !== null || records.every(record => record.target.nodeType === 1 && record.target.closest('.nsit-ai-panel,.nsit-ai-settings,[data-nsai-test-entry]'))) return;
      refreshTimer = setTimeout(() => { refreshTimer = null; refresh(); }, 0);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('resize', resize); window.addEventListener('popstate', refresh);
    const runtime = { refresh, openSettings, disconnect() {
      disposed = true; cancelTest(); cancel(); clearTimeout(resizeTimer); clearTimeout(refreshTimer); observer.disconnect();
      editorSize?.disconnect();
      window.removeEventListener('resize', resize); window.removeEventListener('popstate', refresh);
      panel?.remove(); modal?.remove(); document.querySelector('[data-nsai-test-entry]')?.remove();
    } };
    window[AI_RUNTIME_KEY] = runtime; refresh(); return runtime;
  }
