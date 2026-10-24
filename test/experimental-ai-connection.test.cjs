const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const SETTINGS_KEY = 'nsai-test-settings-v1';
const initialSettings = {
  enabled: false,
  endpoint: 'https://saved.example.com/v1',
  apiKey: 'saved-key-never-use-for-unsaved-test',
  model: 'saved-model',
};
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

function setup(t) {
  const dom = new JSDOM(`<html><head></head><body>
    <aside id="nsk-right-panel-container"><div class="user-stat"><div class="stat-block"><div><a href="/account">统计</a></div></div><div class="stat-block"><div data-nsit-automation-entry><a href="#">自动化</a></div><div data-nsit-background-entry><a href="#">外观</a></div></div></div></aside>
    <main id="nsk-body"><h1 class="post-title">PAGE_TITLE_MUST_NOT_LEAVE_718</h1>
      <ol class="comments"><li class="content-item" id="comment-0"><article class="post-content">PUBLIC_POST_MUST_NOT_LEAVE_719</article></li></ol>
      <textarea>DRAFT_MUST_NOT_LEAVE_720</textarea><aside class="profile">PROFILE_MUST_NOT_LEAVE_721</aside>
    </main></body></html>`, { url: 'https://www.nodeseek.com/post-101-1', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, d = w.document, requests = [], writes = [];
  const storage = new Map([[SETTINGS_KEY, structuredClone(initialSettings)]]);
  w.GM_getValue = (name, fallback) => storage.has(name) ? storage.get(name) : fallback;
  w.GM_setValue = (name, value) => { writes.push({ name, value }); storage.set(name, structuredClone(value)); };
  w.GM_xmlhttpRequest = options => {
    const request = { options, aborted: false };
    requests.push(request);
    return { abort() { request.aborted = true; options.onabort?.(); } };
  };
  assert.equal(w.ensureStatSettingsTrigger, undefined, 'the experimental script must not depend on main-script closures');
  const sources = ['ai-core.js', 'ai-assistant.js'].map(file => fs.readFileSync(path.join(__dirname, '../experiments/ai-assistant', file), 'utf8'));
  t.after(() => { w.aiController?.disconnect(); w.close(); });
  w.eval(`${sources.join('\n')}\nwindow.aiController = installAiAssistant();`);
  w.aiController.openSettings();
  const modal = d.querySelector('[data-nsit-ai-settings]');
  assert.ok(modal, 'settings dialog must be available from the standalone installer');
  const form = modal.querySelector('form');
  assert.ok(form);
  function field(name) {
    const element = form.elements.namedItem(name);
    assert.ok(element, `${name} field must exist`);
    return element;
  }
  function fill(values = {}) {
    for (const [name, value] of Object.entries({ enabled: false, endpoint: 'https://unsaved.example.com/v1/', apiKey: ' unsaved-secret-key-982 ', model: ' unsaved-model ', ...values })) {
      const element = field(name);
      if (element.type === 'checkbox') element.checked = value;
      else element.value = value;
    }
  }
  function start() {
    const button = modal.querySelector('[data-nsit-ai-test-connection]');
    assert.ok(button, 'settings must provide an explicit connection test button');
    button.click();
  }
  function status() {
    const element = modal.querySelector('[data-nsit-ai-settings-status]');
    assert.ok(element);
    return element.textContent;
  }
  fill();
  return { w, d, modal, form, requests, writes, storage, controller: w.aiController, field, fill, start, status };
}

function success(request, text = '连接测试完成') {
  request.options.onload({ status: 200, responseText: JSON.stringify({ choices: [{ message: { content: text } }] }) });
}

function lateCallbacks(request) {
  success(request, 'STALE_RESPONSE_MUST_NOT_REPLACE_STATUS_923');
  request.options.onerror?.({ error: 'STALE_NETWORK_ERROR_924' });
  request.options.ontimeout?.();
  request.options.onabort?.();
}

test('standalone AI connection test uses unsaved credentials while disabled without saving or enabling the assistant', async t => {
  const { requests, writes, storage, field, start } = setup(t);
  assert.equal(requests.length, 0, 'opening settings must not send a request');
  start(); await settle();
  assert.equal(requests.length, 1);
  const options = requests[0].options;
  assert.equal(options.url, 'https://unsaved.example.com/v1/chat/completions');
  assert.equal(options.method.toUpperCase(), 'POST');
  assert.equal(options.headers.Authorization, 'Bearer unsaved-secret-key-982');
  assert.equal(options.anonymous, true);
  assert.equal(options.timeout, 90000);
  const payload = JSON.parse(options.data);
  assert.equal(payload.model, 'unsaved-model');
  assert.equal(payload.stream, false);
  assert.equal(field('enabled').checked, false);
  assert.equal(writes.length, 0);
  assert.deepEqual(storage.get(SETTINGS_KEY), initialSettings);
});

test('connection messages are a fixed probe and exclude page content, drafts, profiles and API credentials', async t => {
  const { requests, start } = setup(t);
  start(); await settle();
  assert.equal(requests.length, 1);
  const messages = JSON.parse(requests[0].options.data).messages;
  assert.ok(Array.isArray(messages) && messages.length > 0);
  const text = JSON.stringify(messages);
  assert.match(text, /连接|test|OK/i);
  for (const forbidden of ['PAGE_TITLE_MUST_NOT_LEAVE_718', 'PUBLIC_POST_MUST_NOT_LEAVE_719', 'DRAFT_MUST_NOT_LEAVE_720', 'PROFILE_MUST_NOT_LEAVE_721', 'unsaved-secret-key-982', 'saved-key-never-use-for-unsaved-test', 'post-101-1']) {
    assert.equal(text.includes(forbidden), false, `${forbidden} must not enter a connection probe`);
  }
});

test('reasoning effort defaults to omission and offers the supported optional levels', async t => {
  const { field, start, requests } = setup(t);
  const select = field('reasoningEffort');
  assert.equal(select.tagName, 'SELECT');
  assert.deepEqual(Array.from(select.options, option => option.value), ['', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh']);
  assert.equal(select.value, '');
  start(); await settle();
  assert.equal(Object.hasOwn(JSON.parse(requests[0].options.data), 'reasoning_effort'), false);
});

test('an explicitly chosen reasoning effort reaches the connection request', async t => {
  const { field, start, requests } = setup(t);
  field('reasoningEffort').value = 'high';
  start(); await settle();
  assert.equal(JSON.parse(requests[0].options.data).reasoning_effort, 'high');
});

test('a successful Chat Completions response reports connection success and elapsed time', async t => {
  const { requests, start, status, writes } = setup(t);
  start(); await settle();
  success(requests[0]); await settle();
  assert.match(status(), /成功/);
  assert.match(status(), /耗时|毫秒|\bms\b|秒/i);
  assert.equal(writes.length, 0);
});

for (const code of [401, 429]) {
  test(`HTTP ${code} reports a safe connection failure without rendering response text or keys`, async t => {
    const { requests, start, status, modal } = setup(t);
    start(); await settle();
    requests[0].options.onload({ status: code, responseText: 'RAW_ERROR_MUST_STAY_HIDDEN_887 unsaved-secret-key-982 saved-key-never-use-for-unsaved-test <img src=x>' });
    await settle();
    assert.match(status(), new RegExp(`${code}|失败|认证|鉴权|频率|限流`));
    for (const forbidden of ['RAW_ERROR_MUST_STAY_HIDDEN_887', 'unsaved-secret-key-982', 'saved-key-never-use-for-unsaved-test']) {
      assert.equal(status().includes(forbidden), false);
    }
    assert.equal(modal.querySelector('[data-nsit-ai-settings-status] img'), null);
  });
}

test('cancel aborts a connection probe and ignores all late callbacks', async t => {
  const { modal, requests, start, status } = setup(t);
  start(); await settle();
  const cancel = modal.querySelector('[data-nsit-ai-test-cancel]');
  assert.ok(cancel, 'a pending connection test must be cancellable');
  cancel.click(); await settle();
  assert.equal(requests[0].aborted, true);
  assert.match(status(), /取消/);
  const cancelled = status();
  lateCallbacks(requests[0]); await settle();
  assert.equal(status(), cancelled);
  start(); await settle();
  success(requests[1]); await settle();
  const current = status();
  assert.match(current, /成功/);
  lateCallbacks(requests[0]); await settle();
  assert.equal(status(), current);
});

test('a timed out connection test can be retried and its late response cannot replace a newer result', async t => {
  const { requests, start, status } = setup(t);
  start(); await settle();
  requests[0].options.ontimeout(); await settle();
  assert.match(status(), /超时/);
  start(); await settle();
  assert.equal(requests.length, 2);
  success(requests[1]); await settle();
  const current = status();
  lateCallbacks(requests[0]); await settle();
  assert.match(current, /成功/);
  assert.equal(status(), current);
});

test('closing settings aborts its probe and late callbacks cannot affect a reopened dialog', async t => {
  const { modal, requests, start, status, controller, fill } = setup(t);
  start(); await settle();
  const close = modal.querySelector('[data-nsit-ai-close]');
  assert.ok(close);
  close.click(); await settle();
  assert.equal(modal.hidden, true);
  assert.equal(requests[0].aborted, true);
  controller.openSettings(); fill();
  start(); await settle();
  success(requests[1]); await settle();
  const current = status();
  lateCallbacks(requests[0]); await settle();
  assert.match(current, /成功/);
  assert.equal(status(), current);
});

test('editing API fields invalidates an in-flight probe before testing the new form values', async t => {
  const { w, field, requests, start, status } = setup(t);
  start(); await settle();
  field('model').value = 'new-model';
  field('model').dispatchEvent(new w.Event('input', { bubbles: true }));
  await settle();
  assert.equal(requests[0].aborted, true);
  start(); await settle();
  assert.equal(JSON.parse(requests[1].options.data).model, 'new-model');
  success(requests[1]); await settle();
  const current = status();
  lateCallbacks(requests[0]); await settle();
  assert.match(current, /成功/);
  assert.equal(status(), current);
});

test('selecting a different reasoning effort invalidates a pending connection probe', async t => {
  const { w, field, requests, start, status } = setup(t);
  start(); await settle();
  field('reasoningEffort').value = 'low';
  field('reasoningEffort').dispatchEvent(new w.Event('change', { bubbles: true }));
  await settle();
  assert.equal(requests[0].aborted, true);
  start(); await settle();
  assert.equal(JSON.parse(requests[1].options.data).reasoning_effort, 'low');
  success(requests[1]); await settle();
  const current = status();
  lateCallbacks(requests[0]); await settle();
  assert.match(current, /成功/);
  assert.equal(status(), current);
});

for (const [label, responseText] of [
  ['malformed JSON', '{"choices":'],
  ['nontext completion', JSON.stringify({ choices: [{ message: { content: { unexpected: 'RAW_NON_TEXT_625' } } }] })],
  ['an API error envelope', JSON.stringify({ error: { message: 'RAW_PROVIDER_ERROR_626 unsaved-secret-key-982' } })],
]) {
  test(`HTTP 200 with ${label} reports failure without exposing the provider response`, async t => {
    const { requests, start, status } = setup(t);
    start(); await settle();
    requests[0].options.onload({ status: 200, responseText }); await settle();
    assert.match(status(), /失败|无效|解析|响应/);
    assert.doesNotMatch(status(), /成功|RAW_NON_TEXT_625|RAW_PROVIDER_ERROR_626|unsaved-secret-key-982/);
  });
}

test('an oversized successful-looking completion is rejected rather than parsed or displayed', async t => {
  const { requests, start, status } = setup(t);
  start(); await settle();
  const responseText = JSON.stringify({ choices: [{ message: { content: `LARGE_RESPONSE_SECRET_627${'A'.repeat(500000)}` } }] });
  requests[0].options.onload({ status: 200, responseText }); await settle();
  assert.match(status(), /失败|过大|响应/);
  assert.doesNotMatch(status(), /成功|LARGE_RESPONSE_SECRET_627/);
  assert.ok(status().length < 1000, 'connection status must remain bounded');
});

test('a synchronous GM request failure is reported safely and leaves testing available', async t => {
  const { w, start, status, writes, requests } = setup(t);
  const original = w.GM_xmlhttpRequest;
  w.GM_xmlhttpRequest = () => { throw new Error('RAW_GM_THROW_628 unsaved-secret-key-982'); };
  start(); await settle();
  assert.match(status(), /失败|无法|权限/);
  assert.doesNotMatch(status(), /RAW_GM_THROW_628|unsaved-secret-key-982/);
  w.GM_xmlhttpRequest = original;
  start(); await settle();
  assert.equal(requests.length, 1);
  success(requests[0]); await settle();
  assert.match(status(), /成功/);
  assert.equal(writes.length, 0);
});

test('a GM network failure is reported safely and a retry can succeed', async t => {
  const { requests, start, status } = setup(t);
  start(); await settle();
  requests[0].options.onerror({ error: 'RAW_NETWORK_ERROR_629 unsaved-secret-key-982' }); await settle();
  assert.match(status(), /失败|网络|权限/);
  assert.doesNotMatch(status(), /RAW_NETWORK_ERROR_629|unsaved-secret-key-982/);
  start(); await settle();
  assert.equal(requests.length, 2);
  success(requests[1]); await settle();
  assert.match(status(), /成功/);
});

for (const [label, fields] of [
  ['invalid endpoint', { endpoint: 'javascript:alert(1)' }],
  ['remote HTTP endpoint', { endpoint: 'http://remote.example.com/v1' }],
  ['missing remote API key', { apiKey: '' }],
  ['missing model', { model: '' }],
]) {
  test(`connection testing rejects ${label} without requesting or saving`, async t => {
    const { fill, requests, writes, start, status } = setup(t);
    fill(fields); start(); await settle();
    assert.equal(requests.length, 0);
    assert.equal(writes.length, 0);
    assert.ok(status().trim().length > 0, 'invalid form values need a visible explanation');
    assert.doesNotMatch(status(), /成功/);
  });
}

test('a loopback HTTP service may be tested without a key or Authorization header', async t => {
  const { fill, requests, start, writes } = setup(t);
  fill({ endpoint: 'http://127.0.0.1:11434/v1', apiKey: '' });
  start(); await settle();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.url, 'http://127.0.0.1:11434/v1/chat/completions');
  assert.equal(requests[0].options.anonymous, true);
  assert.equal(Object.hasOwn(requests[0].options.headers, 'Authorization'), false);
  assert.equal(writes.length, 0);
});

test('disconnect aborts a settings probe and ignores callbacks after its dialog is removed', async t => {
  const { d, modal, requests, controller, start } = setup(t);
  start(); await settle();
  const status = modal.querySelector('[data-nsit-ai-settings-status]');
  controller.disconnect(); await settle();
  assert.equal(requests[0].aborted, true);
  assert.equal(d.querySelector('[data-nsit-ai-settings]'), null);
  const before = status.textContent;
  lateCallbacks(requests[0]); await settle();
  assert.equal(status.textContent, before);
  assert.equal(requests.length, 1);
});

for (const destination of ['/post-202-1', '/private', '/account']) {
  test(`navigating to ${destination} aborts a connection probe and invalidates its old callbacks`, async t => {
    const { w, requests, controller, start, status } = setup(t);
    start(); await settle();
    assert.equal(requests.length, 1);
    w.history.pushState({}, '', destination);
    controller.refresh(); await settle();
    assert.equal(requests[0].aborted, true, 'route changes must terminate the settings probe');
    const afterNavigation = status();
    assert.match(afterNavigation, /变化|取消|重新/);
    lateCallbacks(requests[0]); await settle();
    assert.equal(status(), afterNavigation);
    assert.doesNotMatch(status(), /成功/);
  });
}
