const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const key = 'nsit-ai-settings-v1';
const configured = { enabled: true, endpoint: 'https://api.example.com/v1', apiKey: 'local-test-key', model: 'test-model', maxChars: 18000 };
const publicPage = `<header><h1 class="post-title">公开讨论标题</h1></header>
  <main id="nsk-body"><ul class="post-list">
    <li class="post-list-item"><div class="post-title"><a href="/post-101-1">公开主题一</a></div><span>公开摘要一</span></li>
    <li class="post-list-item"><div class="post-title"><a href="/post-102-1">公开主题二</a></div><span>公开摘要二</span></li>
  </ul><ol class="comments">
    <li class="content-item" id="comment-0"><div class="author-info">PROFILE_PRIVATE_573</div><article class="post-content">PUBLIC_BODY_101 原帖公开内容</article></li>
    <li class="content-item" id="comment-1"><article class="post-content">PUBLIC_REPLY_102 公开回复内容</article></li>
  </ol><div id="editor"><textarea>DRAFT_SECRET_472</textarea><div contenteditable="true">EDITABLE_SECRET_473</div></div>
  <aside class="profile">PROFILE_PRIVATE_574</aside></main>`;
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

function setup(t, { settings = configured, html = publicPage, url = 'https://www.nodeseek.com/post-101-1', beforeInstall = () => {} } = {}) {
  const dom = new JSDOM(`<html><head><title>公开讨论 - NodeSeek</title></head><body>${html}</body></html>`, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, d = w.document, requests = [], triggers = [], storage = new Map();
  t.after(() => { w.aiController?.disconnect(); w.close(); });
  if (settings !== undefined) storage.set(key, JSON.parse(JSON.stringify(settings)));
  w.GM_getValue = (name, fallback) => storage.has(name) ? storage.get(name) : fallback;
  w.GM_setValue = (name, value) => storage.set(name, JSON.parse(JSON.stringify(value)));
  w.GM_xmlhttpRequest = options => {
    const request = { options, aborted: false };
    requests.push(request);
    return { abort() { request.aborted = true; options.onabort?.(); } };
  };
  w.ensureStatSettingsTrigger = (...args) => triggers.push(args);
  beforeInstall(w, d);
  const names = ['ai-core.js', 'ai-assistant.js'];
  const sources = names.map(name => {
    const file = path.join(__dirname, '../src', name);
    assert.ok(fs.existsSync(file), `${name} must exist`);
    return fs.readFileSync(file, 'utf8');
  });
  w.eval(`${sources.join('\n')}\nwindow.aiController = installAiAssistant();`);
  return { w, d, requests, triggers, storage, controller: w.aiController };
}

function action(d, name) {
  const button = d.querySelector(`[data-nsit-ai-action="${name}"]`);
  assert.ok(button, `${name} action must be available`);
  button.click();
}
function result(d) {
  const element = d.querySelector('[data-nsit-ai-result]');
  assert.ok(element, 'AI result region must exist');
  return element;
}
function respond(request, text) {
  const response = { choices: [{ message: { role: 'assistant', content: text } }] };
  request.options.onload({ status: 200, responseText: JSON.stringify(response), response });
}

test('AI installation and repeated refresh stay idle, retain one panel and preserve the forum draft', t => {
  const { d, requests, triggers, controller } = setup(t);
  const panel = d.querySelector('[data-nsit-ai-panel]');
  assert.ok(panel);
  for (let i = 0; i < 12; i++) controller.refresh();
  assert.equal(requests.length, 0);
  assert.equal(d.querySelectorAll('[data-nsit-ai-panel]').length, 1);
  assert.equal(d.querySelector('[data-nsit-ai-panel]'), panel);
  assert.equal(d.querySelector('#editor textarea').value, 'DRAFT_SECRET_472');
  assert.ok(triggers.some(args => args[0] === 1 && args[1] === 'nsit-ai' && args[2] === 'AI'));
});

test('saving AI settings stores local credentials and does not request an answer', async t => {
  const { w, d, requests, storage, controller } = setup(t, { settings: null });
  controller.openSettings();
  const settings = d.querySelector('[data-nsit-ai-settings]');
  assert.ok(settings);
  const form = settings.matches('form') ? settings : settings.querySelector('form');
  assert.ok(form);
  form.querySelector('[name="enabled"]').checked = true;
  form.querySelector('[name="endpoint"]').value = ' https://api.example.com/v1/ ';
  form.querySelector('[name="apiKey"]').value = ' local-test-key ';
  form.querySelector('[name="model"]').value = ' test-model ';
  form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await settle();
  const saved = storage.get(key);
  assert.equal(saved.enabled, true);
  assert.equal(saved.endpoint, 'https://api.example.com/v1/chat/completions');
  assert.equal(saved.apiKey, 'local-test-key');
  assert.equal(saved.model, 'test-model');
  assert.equal(requests.length, 0);
});

test('summary sends only after an explicit click and excludes local drafts and profile content', async t => {
  const { d, requests } = setup(t);
  assert.equal(requests.length, 0);
  const question = d.querySelector('textarea[name="question"]');
  assert.ok(question);
  question.value = '请概括公开讨论';
  action(d, 'summary');
  await settle();
  assert.equal(requests.length, 1);
  const options = requests[0].options;
  assert.equal(options.url, 'https://api.example.com/v1/chat/completions');
  assert.equal(options.method.toUpperCase(), 'POST');
  assert.equal(options.headers.Authorization, 'Bearer local-test-key');
  assert.equal(options.anonymous, true);
  assert.equal(options.timeout, 45000);
  const payload = JSON.parse(options.data);
  assert.equal(payload.model, 'test-model');
  assert.equal(payload.stream, false);
  assert.ok(Array.isArray(payload.messages));
  const messages = JSON.stringify(payload.messages);
  assert.match(messages, /PUBLIC_BODY_101/);
  assert.match(messages, /PUBLIC_REPLY_102/);
  assert.match(messages, /请概括公开讨论/);
  for (const secret of ['DRAFT_SECRET_472', 'EDITABLE_SECRET_473', 'PROFILE_PRIVATE_573', 'PROFILE_PRIVATE_574', 'local-test-key']) assert.ok(!messages.includes(secret), `${secret} must stay local`);
});

test('duplicate checking uses the same explicit request boundary and loaded public post links', async t => {
  const { d, requests, controller } = setup(t, { url: 'https://www.nodeseek.com/' });
  controller.refresh();
  assert.equal(requests.length, 0);
  action(d, 'duplicates');
  await settle();
  assert.equal(requests.length, 1);
  const body = JSON.parse(requests[0].options.data);
  assert.equal(body.model, 'test-model');
  assert.equal(body.stream, false);
  assert.match(JSON.stringify(body.messages), /post-101-1/);
  assert.match(JSON.stringify(body.messages), /post-102-1/);
  assert.ok(!JSON.stringify(body.messages).includes('DRAFT_SECRET_472'));
});

test('AI answers display as text so model markup cannot create executable elements', async t => {
  const { w, d, requests } = setup(t);
  action(d, 'summary'); await settle();
  const answer = '<img src=x onerror="window.aiInjected=1"><script>window.aiInjected=2</script>\n**保留原文**';
  respond(requests[0], answer); await settle();
  assert.equal(result(d).textContent, answer);
  assert.equal(result(d).querySelector('img,script'), null);
  assert.equal(w.aiInjected, undefined);
});

test('cancel aborts the active request and late responses cannot replace a newer result', async t => {
  const { d, requests } = setup(t);
  action(d, 'summary'); await settle();
  const first = requests[0];
  action(d, 'cancel'); await settle();
  assert.equal(first.aborted, true);
  const cancelledText = result(d).textContent;
  respond(first, 'STALE_CANCELLED_ANSWER'); await settle();
  assert.equal(result(d).textContent, cancelledText);
  action(d, 'summary'); await settle();
  assert.equal(requests.length, 2);
  respond(requests[1], 'CURRENT_ANSWER'); await settle();
  respond(first, 'STALE_CANCELLED_ANSWER'); await settle();
  assert.equal(result(d).textContent, 'CURRENT_ANSWER');
});

test('disconnect aborts pending work and ignores callbacks after the assistant is disposed', async t => {
  const { d, requests, controller } = setup(t);
  action(d, 'summary'); await settle();
  const node = result(d);
  controller.disconnect();
  assert.equal(requests[0].aborted, true);
  const before = node.textContent;
  respond(requests[0], 'ANSWER_AFTER_DISCONNECT'); await settle();
  assert.equal(node.textContent, before);
  controller.refresh();
  assert.equal(d.querySelector('[data-nsit-ai-panel]'), null);
  assert.equal(requests.length, 1);
});

test('jumping to another floor hash in the same thread retains the pending AI answer', async t => {
  const { w, d, requests, controller } = setup(t);
  const panel = d.querySelector('[data-nsit-ai-panel]');
  action(d, 'summary'); await settle();
  w.history.replaceState(null, '', '#comment-17');
  w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  controller.refresh(); await settle();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].aborted, false);
  assert.equal(d.querySelector('[data-nsit-ai-panel]'), panel);
  respond(requests[0], 'SAME_THREAD_ANSWER'); await settle();
  assert.equal(result(d).textContent, 'SAME_THREAD_ANSWER');
});

test('fixed reply editor resizing moves the compact assistant above the editor', async t => {
  const observers = [];
  let geometry = { x: 0, y: 650, left: 0, right: 1200, top: 650, bottom: 900, width: 1200, height: 250 };
  const { w, d, requests } = setup(t, { beforeInstall(w, d) {
    Object.defineProperty(w, 'innerWidth', { value: 1200, configurable: true });
    Object.defineProperty(w, 'innerHeight', { value: 900, configurable: true });
    const editor = d.querySelector('#editor');
    editor.classList.add('nst-fixed-editor');
    editor.getBoundingClientRect = () => geometry;
    w.ResizeObserver = class {
      constructor(callback) { this.callback = callback; this.targets = new Set(); observers.push(this); }
      observe(target) { this.targets.add(target); }
      disconnect() { this.targets.clear(); }
      trigger(target) { this.callback([{ target, contentRect: target.getBoundingClientRect() }], this); }
    };
  } });
  const panel = d.querySelector('[data-nsit-ai-panel]'), editor = d.querySelector('#editor');
  const observer = observers.find(instance => instance.targets.has(editor));
  assert.ok(observer, 'fixed editor geometry must be observed');
  const initialBottom = parseFloat(panel.style.bottom);
  assert.equal(initialBottom, w.innerHeight - geometry.top + 12);
  geometry = { ...geometry, y: 450, top: 450, height: 450 };
  observer.trigger(editor);
  await new Promise(resolve => setTimeout(resolve, 130));
  assert.equal(parseFloat(panel.style.bottom), w.innerHeight - geometry.top + 12);
  assert.ok(parseFloat(panel.style.bottom) > initialBottom);
  assert.equal(requests.length, 0);
  assert.equal(d.querySelector('#editor textarea').value, 'DRAFT_SECRET_472');
});

test('disabled or incomplete AI settings never send requests when actions are invoked', async t => {
  for (const settings of [null, { ...configured, enabled: false }, { ...configured, endpoint: '' }, { ...configured, apiKey: '' }, { ...configured, model: '' }]) {
    const { d, requests } = setup(t, { settings });
    d.querySelector('[data-nsit-ai-action="summary"]')?.click();
    d.querySelector('[data-nsit-ai-action="duplicates"]')?.click();
    await settle();
    assert.equal(requests.length, 0, JSON.stringify(settings));
  }
});

test('local API services can explicitly run without a key while keeping anonymous transport', async t => {
  for (const endpoint of ['http://localhost:11434/v1', 'http://127.0.0.1:8080/v1', 'http://[::1]:8080/v1']) {
    const { d, requests } = setup(t, { settings: { ...configured, endpoint, apiKey: '' } });
    assert.equal(requests.length, 0);
    action(d, 'summary'); await settle();
    assert.equal(requests.length, 1, endpoint);
    assert.equal(requests[0].options.url, `${endpoint}/chat/completions`);
    assert.equal(requests[0].options.anonymous, true);
    assert.equal(requests[0].options.headers.Authorization, undefined);
  }
});

test('private message pages do not mount an AI panel or send private content', async t => {
  for (const url of ['https://www.nodeseek.com/message', 'https://www.nodeseek.com/message/123', 'https://www.nodeseek.com/notification']) {
    const { d, requests, controller } = setup(t, { url, html: '<article class="post-content">PRIVATE_MESSAGE_992</article><textarea>PRIVATE_DRAFT_993</textarea>' });
    controller.refresh();
    await settle();
    assert.equal(d.querySelector('[data-nsit-ai-panel]'), null, url);
    assert.equal(requests.length, 0, url);
  }
});
