const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.join(__dirname, '..');
const stableFile = path.join(root, 'NodeSeek Issue Templates.user.js');
const experimentalFile = path.join(root, 'experiments', 'NodeSeek-auto-AI-test.user.js');
const pause = (milliseconds = 180) => new Promise(resolve => setTimeout(resolve, milliseconds));
const apiEndpoint = 'https://api.review-test.invalid/v1/chat/completions';
const page = `<html><head><title>NodeSeek</title></head><body>
  <header id="nsk-head"></header><div id="nsk-body">
    <aside id="nsk-right-panel-container"><div class="user-stat">
      <div class="stat-block"><div data-v-native><a data-v-native href="/progress"><svg data-v-native class="iconpark-icon"></svg><span data-v-native>等级 Lv 5</span></a></div></div>
      <div class="stat-block"><div data-v-native><a data-v-native href="/my-post"><svg data-v-native class="iconpark-icon"></svg><span data-v-native>主题帖 153</span></a></div></div>
    </div></aside>
    <main id="nsk-body-left"><ul class="post-list">
      <li class="post-list-item"><div class="post-title"><a href="/post-100-1">公开问题</a></div></li>
    </ul></main>
  </div>
</body></html>`;

async function setup(t, order) {
  assert.ok(fs.existsSync(experimentalFile), 'build the complete standalone AI userscript before testing coexistence');
  const errors = [], requests = [], menus = new Map(), observers = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(page, { url: 'https://www.nodeseek.com/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const w = dom.window, d = w.document, NativeObserver = w.MutationObserver;
  let deliveries = 0, overflow = false;
  w.MutationObserver = class extends NativeObserver {
    constructor(callback) {
      super((records, observer) => {
        deliveries++;
        if (deliveries > 120) { overflow = true; observers.forEach(item => item.disconnect()); return; }
        callback(records, observer);
      });
      observers.push(this);
    }
  };
  t.after(() => {
    w.__nsaiTestAssistant__?.disconnect?.();
    w.__nsitCustomBackground__?.disconnect?.();
    w.__nodeSeekAuthorInfo__?.disconnect?.();
    observers.forEach(observer => observer.disconnect());
    w.close();
  });
  const storage = new Map([
    ['nsit-auto-settings-v1', { dailyCheckin: false, autoReply: false }],
    ['nsai-test-settings-v1', { enabled: true, endpoint: apiEndpoint, apiKey: 'COEXISTENCE_LOCAL_KEY', model: 'test-model', reasoningEffort: 'high' }],
  ]);
  w.localStorage.setItem('nsit-feature-flags-v1', JSON.stringify({ threadedReading: false, homeAutoLoad: false, authorInfo: false }));
  w.GM_getValue = (key, fallback) => storage.has(key) ? storage.get(key) : fallback;
  w.GM_setValue = (key, value) => storage.set(key, value);
  w.GM_registerMenuCommand = (name, callback) => menus.set(name, callback);
  w.GM_addStyle = css => { const style = d.createElement('style'); style.textContent = css; d.head.append(style); return style; };
  w.GM_xmlhttpRequest = options => {
    requests.push(options);
    queueMicrotask(() => options.onerror?.({ status: 503 }));
    return { abort() { options.onabort?.(); } };
  };
  w.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  w.__config__ = { user: { member_id: 42 } };
  w.HTMLElement.prototype.getBoundingClientRect = () => ({ x: 0, y: 10000, top: 10000, bottom: 10040, left: 0, right: 800, width: 800, height: 40 });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  for (const name of order) {
    w.eval(fs.readFileSync(name === 'stable' ? stableFile : experimentalFile, 'utf8'));
    await pause();
  }
  await pause();
  return { w, d, menus, errors, requests, observers, get deliveries() { return deliveries; }, get overflow() { return overflow; } };
}

for (const order of [['stable', 'experimental'], ['experimental', 'stable']]) {
  test(`the complete stable and experimental scripts converge when loaded ${order.join(' then ')}`, { timeout: 10000 }, async t => {
    const state = await setup(t, order);
    const { w, d, menus, requests, errors } = state;
    const automation = d.querySelector('[data-nsit-automation-entry]');
    assert.ok(automation, 'the original stable automation entry remains available');
    const aiEntry = automation.querySelector('[data-nsai-test-entry]');
    assert.ok(aiEntry, 'AI nests inside the stable automation row instead of competing for the final column position');
    assert.equal(automation.parentElement.lastElementChild, automation);
    assert.equal(d.querySelectorAll('[data-nsai-test-entry]').length, 1);
    assert.equal(d.querySelectorAll('[data-nsit-ai-panel]').length, 1);
    assert.equal(typeof w.__nsaiTestAssistant__?.refresh, 'function');
    assert.equal(state.overflow, false, 'the two document observers must not enter an insertion loop');
    assert.ok(state.deliveries < 80, `initialization should converge promptly, saw ${state.deliveries} observer deliveries`);

    const before = state.deliveries;
    await pause(220);
    assert.equal(state.deliveries, before, 'the combined installation becomes idle without repeated child-list mutations');
    for (let index = 0; index < 8; index++) w.__nsaiTestAssistant__.refresh();
    await pause();
    assert.equal(state.deliveries, before, 'repeated AI refresh must preserve stable DOM order');

    const testMenu = [...menus.entries()].find(([name]) => /AI/.test(name));
    assert.ok(testMenu, 'the full standalone script registers its settings menu');
    testMenu[1]();
    assert.equal(d.querySelectorAll('[data-nsit-ai-settings]').length, 1);
    assert.equal(d.querySelector('[data-nsit-ai-settings]').hidden, false);
    d.querySelector('[data-nsit-ai-close]').click();
    await pause();
    assert.equal(d.querySelector('[name="apiKey"]').value, '', 'closing settings removes the entered API key from the page DOM');
    assert.equal(d.querySelectorAll('[data-nsit-ai-panel]').length, 1);
    assert.equal(requests.filter(request => request.url === apiEndpoint).length, 0, 'configured AI stays idle until an explicit analysis or connection-test click');
    assert.deepEqual(errors, []);
  });
}
