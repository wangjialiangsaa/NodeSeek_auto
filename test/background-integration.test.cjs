const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const SETTINGS_KEY = 'nsit-background-settings-v1';
const IMAGE_URL = 'https://images.example.net/user-background.webp';
const pause = (ms = 180) => new Promise(resolve => setTimeout(resolve, ms));
const bundles = ['NodeSeek Issue Templates.user.js', 'NodeSeek Issue Templates.min.user.js'];

const page = `<html><head></head><body><header id="nsk-head"></header><div id="nsk-body">
<aside id="nsk-right-panel-container"><div class="user-stat">
  <div class="stat-block"><div data-v-native><a data-v-native href="/progress"><svg data-v-native class="iconpark-icon"></svg><span data-v-native>等级 Lv 5</span></a></div></div>
  <div class="stat-block"><div data-v-native><a data-v-native href="/my-post"><svg data-v-native class="iconpark-icon"></svg><span data-v-native>主题帖 153</span></a></div></div>
</div></aside><main id="nsk-body-left"><div class="content-item" id="0"><div class="author-info"><a class="author-name">OP</a></div><article class="post-content">Original topic</article></div>
<ul class="comments"><li class="content-item" id="1"><div class="nsk-content-meta-info"><div class="avatar-wrapper"><img class="avatar-normal"></div><a class="author-name">Native author</a><a class="floor-link" href="#1">#1</a></div><article class="post-content" id="native-comment-body"><p>Original native comment</p><pre><code><span style="color:rgb(200, 50, 50)">const nativeCode = true;</span></code></pre></article><div class="comment-menu"><button type="button" id="native-like">鸡腿</button></div></li></ul>
<div id="editor"><div class="md-editor"><div id="editor-body"><div class="window_header"><a href="https://www.runoob.com/markdown/md-tutorial.html">Markdown</a></div><div class="CodeMirror"><textarea id="native-editor-input">existing native draft</textarea></div></div><div class="topic-select"><button type="button" class="submit">发布评论</button></div></div></div>
</main></div></body></html>`;

async function setup(t, file, { storage = new Map() } = {}) {
  const consoleErrors = [], requests = [], imageLoads = [], menus = new Map(), writes = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => consoleErrors.push(error.message));
  const dom = new JSDOM(page, { url: 'https://www.nodeseek.com/post-123-1', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const w = dom.window, d = w.document, observers = [], NativeObserver = w.MutationObserver;
  const native = {
    comment: d.getElementById('native-comment-body'), like: d.getElementById('native-like'),
    editor: d.getElementById('editor'), input: d.getElementById('native-editor-input'),
    code: d.querySelector('#native-comment-body code span'), likes: 0, sends: 0,
  };
  native.like.addEventListener('click', event => { event.preventDefault(); native.likes++; });
  d.querySelector('.topic-select .submit').addEventListener('click', event => { event.preventDefault(); native.sends++; });
  w.MutationObserver = class extends NativeObserver {
    constructor(callback) { super(callback); observers.push(this); }
  };
  t.after(() => {
    w.__nsitCustomBackground__?.disconnect?.();
    w.__nodeSeekAuthorInfo__?.disconnect?.();
    observers.forEach(observer => observer.disconnect());
    w.close();
  });
  w.HTMLElement.prototype.getBoundingClientRect = () => ({ x: 0, y: 10000, top: 10000, bottom: 10040, left: 0, right: 800, width: 800, height: 40 });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.scrollTo = () => {};
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.HTMLCanvasElement.prototype.getContext = () => null;
  w.Image = function Image() {
    const image = d.createElement('img');
    let source = '', complete = false, naturalWidth = 0, naturalHeight = 0;
    Object.defineProperties(image, {
      complete: { get: () => complete }, naturalWidth: { get: () => naturalWidth }, naturalHeight: { get: () => naturalHeight },
      src: {
        get: () => source,
        set(value) {
          source = String(value);
          const requested = source;
          imageLoads.push({ url: requested, crossOrigin: image.crossOrigin });
          queueMicrotask(() => {
            if (source !== requested) return;
            complete = true;
            if (requested.includes('fail-image') || image.crossOrigin === 'anonymous') image.dispatchEvent(new w.Event('error'));
            else {
              naturalWidth = 1920; naturalHeight = 1080;
              image.width = 1920; image.height = 1080;
              image.dispatchEvent(new w.Event('load'));
            }
          });
        },
      },
    });
    image.decode = async () => {};
    return image;
  };
  if (!storage.has('nsit-auto-settings-v1')) storage.set('nsit-auto-settings-v1', { dailyCheckin: false, autoReply: false });
  w.GM_getValue = (key, fallback) => storage.has(key) ? storage.get(key) : fallback;
  w.GM_setValue = (key, value) => { storage.set(key, value); writes.push({ key, value }); };
  w.GM_registerMenuCommand = (name, callback) => menus.set(name, callback);
  w.GM_addStyle = css => { const style = d.createElement('style'); style.textContent = css; d.head.append(style); return style; };
  w.GM_xmlhttpRequest = options => {
    requests.push({ kind: 'gm', url: String(options.url), method: options.method || 'GET' });
    queueMicrotask(() => options.onerror?.({ status: 503 }));
    return { abort() {} };
  };
  w.fetch = async (url, init = {}) => {
    requests.push({ kind: 'fetch', url: String(url), method: init.method || 'GET' });
    return { ok: false, status: 503, json: async () => ({}) };
  };
  w.__config__ = { user: { member_id: 42 }, postData: { postId: 123, comments: [{ floorIndex: 1, commentId: 1001 }] } };
  const cm = { getValue: () => native.input.value, setValue: value => { native.input.value = value; }, refresh() {}, focus() {}, setSize() {}, on() {} };
  d.querySelector('.CodeMirror').CodeMirror = cm;
  w.editor = { reply() {}, quote() {} };
  w.eval(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'));
  await pause();
  return {
    w, d, storage, menus, requests, imageLoads, writes, consoleErrors, native,
    open() {
      const open = menus.get('背景与外观');
      assert.equal(typeof open, 'function', 'the real bundle registers the background settings menu');
      open();
      const dialog = d.querySelector('[data-nsit-background-dialog]');
      assert.ok(dialog, 'the real settings menu opens a background dialog');
      assert.equal(dialog.hidden, false);
      return dialog;
    },
    async save(dialog, values) {
      for (const [name, value] of Object.entries(values)) {
        const control = dialog.querySelector(`[name="${name}"]`);
        assert.ok(control, `the real settings dialog exposes ${name}`);
        if (control.type === 'checkbox') control.checked = value;
        else control.value = String(value);
        control.dispatchEvent(new w.Event('input', { bubbles: true }));
        control.dispatchEvent(new w.Event('change', { bubbles: true }));
      }
      const form = dialog.querySelector('form');
      assert.ok(form, 'the background dialog has a real settings form');
      form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
      await pause();
    },
  };
}

function assertNativePreserved(state) {
  const { d, native } = state;
  assert.equal(d.getElementById('native-comment-body'), native.comment);
  assert.equal(d.getElementById('native-like'), native.like);
  assert.equal(d.getElementById('editor'), native.editor);
  assert.equal(d.getElementById('native-editor-input'), native.input);
  assert.equal(native.input.value, 'existing native draft');
  assert.equal(native.code.style.color, 'rgb(200, 50, 50)', 'code highlighting keeps its authored color');
  native.like.click();
  assert.equal(native.likes, 1, 'native comment handlers survive appearance changes');
  assert.equal(native.sends, 0, 'settings never submit the native reply form');
  assert.equal(state.requests.some(request => request.method.toUpperCase() !== 'GET'), false, 'the test never triggers account writes');
}

for (const file of bundles) {
  test(`${file}: background bootstrap is opt-in and adds the real appearance entry without replacing other tools`, async t => {
    const state = await setup(t, file), { w, d } = state;
    assert.ok(w.__nsitCustomBackground__, 'the real main bootstrap installs the background controller');
    assert.equal(d.documentElement.classList.contains('nsit-background-on'), false);
    assert.equal(state.imageLoads.length, 0, 'the disabled default does not load an external image');
    const trigger = d.querySelector('[data-nsit-background-trigger]');
    assert.ok(trigger, 'the personal stats expose an appearance entry');
    assert.equal(trigger.textContent.trim(), '外观');
    assert.equal(trigger.closest('.stat-block'), d.querySelector('.user-stat .stat-block'));
    assert.ok(d.querySelector('[data-nsit-post-filter-trigger]'), 'the existing filter entry remains');
    assert.ok(d.querySelector('[data-nsit-automation-trigger]'), 'the existing automation entry remains');
    trigger.click();
    const dialog = d.querySelector('[data-nsit-background-dialog]');
    assert.ok(dialog);
    assert.equal(dialog.hidden, false);
    for (const name of ['enabled', 'backgroundUrl', 'blur', 'opacity', 'autoContrast', 'autoFocus', 'focusX', 'focusY']) assert.ok(dialog.querySelector(`[name="${name}"]`), `settings expose ${name}`);
    assert.equal(dialog.querySelector('[name="enabled"]').checked, false);
    assertNativePreserved(state);
    assert.deepEqual(state.consoleErrors, []);
  });

  test(`${file}: saved custom background survives a fresh bootstrap and can be disabled and reset`, async t => {
    const first = await setup(t, file), dialog = first.open();
    const opacityControl = dialog.querySelector('[name="opacity"]');
    assert.ok(opacityControl);
    const opacity = Number(opacityControl.max) > 1 ? 82 : 0.82;
    const values = { enabled: true, backgroundUrl: IMAGE_URL, blur: 18, opacity, autoContrast: true, autoFocus: false, focusX: 42, focusY: 61 };
    await first.save(dialog, values);
    assert.equal(first.storage.get(SETTINGS_KEY)?.enabled, true);
    assert.equal(first.storage.get(SETTINGS_KEY)?.backgroundUrl, IMAGE_URL);
    assert.equal(first.d.documentElement.classList.contains('nsit-background-on'), true);
    assert.ok(first.d.querySelector('[data-nsit-background-layer]')?.style.backgroundImage.includes(IMAGE_URL));
    assertNativePreserved(first);
    const second = await setup(t, file, { storage: first.storage });
    assert.equal(second.d.documentElement.classList.contains('nsit-background-on'), true, 'saved settings apply during the next real bootstrap');
    assert.ok(second.d.querySelector('[data-nsit-background-layer]')?.style.backgroundImage.includes(IMAGE_URL));
    const restored = second.open();
    assert.equal(restored.querySelector('[name="backgroundUrl"]').value, IMAGE_URL);
    assert.equal(restored.querySelector('[name="enabled"]').checked, true);
    assert.equal(restored.querySelector('[name="blur"]').value, '18');
    assert.equal(restored.querySelector('[name="opacity"]').value, String(opacity));
    assert.equal(restored.querySelector('[name="autoContrast"]').checked, true);
    assert.equal(restored.querySelector('[name="autoFocus"]').checked, false);
    assert.equal(restored.querySelector('[name="focusX"]').value, '42');
    assert.equal(restored.querySelector('[name="focusY"]').value, '61');
    await second.save(restored, { enabled: false });
    assert.equal(second.storage.get(SETTINGS_KEY)?.enabled, false);
    assert.equal(second.d.documentElement.classList.contains('nsit-background-on'), false);
    const resetDialog = second.open(), reset = resetDialog.querySelector('[data-nsit-background-reset]');
    assert.ok(reset);
    reset.click();
    await pause();
    assert.equal(second.d.documentElement.classList.contains('nsit-background-on'), false);
    assert.equal(Boolean(second.storage.get(SETTINGS_KEY)?.enabled), false);
    assert.equal(second.storage.get(SETTINGS_KEY)?.backgroundUrl || '', '');
    const third = await setup(t, file, { storage: second.storage });
    assert.equal(third.d.documentElement.classList.contains('nsit-background-on'), false, 'reset stays disabled after reopening NodeSeek');
    assert.equal(third.imageLoads.length, 0);
    assertNativePreserved(second);
    assert.deepEqual([...first.consoleErrors, ...second.consoleErrors, ...third.consoleErrors], []);
  });

  test(`${file}: invalid image URLs are rejected without saving or changing the page`, async t => {
    const state = await setup(t, file), dialog = state.open();
    const writesBefore = state.writes.filter(write => write.key === SETTINGS_KEY).length;
    await state.save(dialog, { enabled: true, backgroundUrl: 'javascript:alert(1)' });
    assert.equal(state.writes.filter(write => write.key === SETTINGS_KEY).length, writesBefore);
    assert.equal(state.d.documentElement.classList.contains('nsit-background-on'), false);
    assert.equal(state.imageLoads.length, 0);
    assertNativePreserved(state);
    assert.deepEqual(state.consoleErrors, []);
  });

  test(`${file}: a failed external image leaves the original page and reply editor usable`, async t => {
    const state = await setup(t, file), dialog = state.open();
    await state.save(dialog, { enabled: true, backgroundUrl: 'https://images.example.net/fail-image.webp', autoContrast: true, autoFocus: true });
    assert.ok(state.imageLoads.some(load => load.url.includes('fail-image.webp')), 'the real module attempts the configured image preload');
    assert.equal(state.d.documentElement.classList.contains('nsit-background-on'), false, 'a broken image never applies the custom background');
    assertNativePreserved(state);
    assert.deepEqual(state.consoleErrors, []);
  });
}
