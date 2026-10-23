const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const source = fs.readFileSync(path.join(__dirname, '../src/background.js'), 'utf8');
const wait = (ms = 5) => new Promise(resolve => setTimeout(resolve, ms));
const key = 'nsit-background-settings-v1';
const firstURL = 'https://cdn.example.com/first.png';
const secondURL = 'https://cdn.example.com/second.png';
// JSDOM leaves inherited CSS var() colors unresolved. Resolve the actual
// cascade rather than replacing the browser/theme rules with a mock palette.
function color(w, node, property) {
  let value = w.getComputedStyle(node).getPropertyValue(property);
  for (let i = 0; i < 15 && value.includes('var('); i++) value = value.replace(/var\((--[\w-]+)\)/g, (_, name) => {
    for (let element = node; element; element = element.parentElement) {
      const found = w.getComputedStyle(element).getPropertyValue(name).trim();
      if (found) return found;
    }
    return '';
  });
  if (/^#[a-f0-9]{3}$/i.test(value)) value = '#' + [...value.slice(1)].map(x => x + x).join('');
  if (/^#[a-f0-9]{6}$/i.test(value)) return `rgb(${value.slice(1).match(/../g).map(c => parseInt(c, 16)).join(', ')})`;
  return value.replace(/,\s*/g, ', ');
}

function setup(t, { bright = true } = {}) {
  const dom = new JSDOM(`<html><head><style>
    body{--bg-main-color:#fff;--bg-sub-color:#f5f5f5;--text-color:#222;--body-text:#222;background:#ddd;color:#111}body.dark-layout{--bg-main-color:#272727;--bg-sub-color:#3b3b3b;--text-color:#ddd;--body-text:#ddd;background:#333;color:#ddd}
    textarea,.native-popup{color:var(--text-color);background-color:var(--bg-main-color)}
    #editor{position:fixed;bottom:0}.post-content pre{color:#dedede;background:#282828}.hljs-keyword{color:#ff80ab}
    .badge{color:#e3a000;background:#493000}.active-vote{color:#17b749}.pink-upload{color:#fff;background:#e35d9f}
    </style></head><body><div id="nsk-body"><article class="post-content">Native text<pre><code><span class="hljs-keyword">const</span> answer = 42</code></pre></article>
    <span class="badge">Lv5</span><button class="active-vote">鸡腿</button><button class="pink-upload">上传图片</button>
    <div class="native-popup">Native popup</div><div id="editor" class="nst-fixed-editor"><div class="md-editor"><textarea>draft stays</textarea><div class="CodeMirror"><span class="cm-keyword" style="color:#e080e0">if</span></div></div></div></div></body></html>`, { url: 'https://www.nodeseek.com/post-10-1', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, d = w.document, storage = new Map(), loads = [];
  w.ensureStatSettingsTrigger = () => {};
  w.GM_getValue = (k, fallback) => storage.has(k) ? storage.get(k) : fallback;
  w.GM_setValue = (k, value) => storage.set(k, JSON.parse(JSON.stringify(value)));
  w.Image = class {
    constructor() { this.naturalWidth = 1600; this.naturalHeight = 900; }
    set src(value) { this.url = value; loads.push(this); }
    removeAttribute() {}
  };
  const data = new Uint8ClampedArray(64 * 64 * 4).fill(bright ? 255 : 0);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  w.HTMLCanvasElement.prototype.getContext = () => ({ fillRect() {}, drawImage() {}, getImageData: () => ({ data }) });
  w.eval(`${source}\nwindow.controller = installCustomBackground();`);
  t.after(() => { w.controller.disconnect(); w.close(); });
  return { w, d, storage, loads, controller: w.controller };
}
const enabled = backgroundUrl => ({ enabled: true, backgroundUrl, opacity: 35, autoContrast: true, autoFocus: true });

test('power saving keeps the full resolution background while disabling live blur and allows restoring it', async t => {
  const { w, d, loads, controller } = setup(t);
  const pending = controller.apply(enabled(firstURL)); loads[0].onload(); await pending;
  assert.equal(d.documentElement.style.getPropertyValue('--nsbg-backdrop'), 'none');
  assert.ok(d.querySelector('[data-nsit-background-layer]').style.backgroundImage.includes(firstURL));
  await controller.apply({ ...enabled(firstURL), lowPower: false, blur: 16 });
  assert.equal(d.documentElement.style.getPropertyValue('--nsbg-backdrop'), 'blur(16px)');
  await controller.apply({ ...enabled(firstURL), lowPower: false, blur: 0 });
  assert.equal(d.documentElement.style.getPropertyValue('--nsbg-backdrop'), 'none', 'zero blur must release the filter surface');
  w.eval('openBackgroundSettings()');
  const form = d.querySelector('[data-nsit-background-dialog] form');
  assert.equal(form.elements.namedItem('lowPower').checked, true);
  assert.equal(form.elements.namedItem('blur').disabled, true);
  form.elements.namedItem('lowPower').checked = false;
  form.elements.namedItem('lowPower').dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal(form.elements.namedItem('blur').disabled, false);
});

test('unchanged settings, viewport and unrelated body classes do not rewrite background styles or recalculate framing', async t => {
  const { w, d, loads, controller } = setup(t);
  const autoPosition = w.backgroundAutoPosition;
  let framingCalls = 0;
  w.backgroundAutoPosition = (...args) => { framingCalls++; return autoPosition(...args); };
  const pending = controller.apply(enabled(firstURL)); loads[0].onload(); await pending;
  loads.find(image => image.crossOrigin).onload(); await wait();
  const before = framingCalls, mutations = [];
  const observer = new w.MutationObserver(records => mutations.push(...records));
  observer.observe(d.documentElement, { attributes: true });
  await controller.apply(enabled(firstURL));
  d.body.classList.add('menu-open');
  w.dispatchEvent(new w.Event('resize'));
  await wait(130);
  observer.disconnect();
  assert.equal(framingCalls, before, 'unchanged background inputs must reuse the framing');
  assert.equal(mutations.length, 0, 'no root class/style writes are needed for unrelated activity');
  await controller.apply({ ...enabled(firstURL), opacity: 90 });
  d.body.classList.add('dark-layout'); await wait();
  assert.equal(framingCalls, before, 'panel opacity and native theme do not change the image crop');
  Object.defineProperty(w, 'innerWidth', { value: 480, configurable: true });
  w.dispatchEvent(new w.Event('resize')); await wait(130);
  assert.equal(framingCalls, before + 1, 'a genuinely changed viewport must recalculate framing');
});

test('wallpaper display and image analysis use the full image URL and report the decoded source resolution', async t => {
  const { d, loads, storage, controller } = setup(t);
  const original = 'https://cn.bing.com/th?id=OHR.NaejangsanNP_EN-US7010419904_UHD.jpg&pid=hp';
  const pending = controller.apply(enabled(original + '&w=384&h=216&rs=1&c=4'), { persist: true });
  assert.equal(loads[0].url, original);
  loads[0].naturalWidth = 3840; loads[0].naturalHeight = 2160;
  loads[0].onload(); await pending;
  assert.ok(d.querySelector('[data-nsit-background-layer]').style.backgroundImage.includes(original));
  assert.equal(storage.get(key).backgroundUrl, original);
  assert.equal(loads.find(image => image.crossOrigin).url, original);
  assert.match(controller.status, /3840 × 2160/);
});

test('an older image finishing after a newer selection cannot overwrite the visible background or saved URL', async t => {
  const { d, storage, loads, controller } = setup(t);
  const a = controller.apply(enabled(firstURL), { persist: true });
  const b = controller.apply(enabled(secondURL), { persist: true });
  loads[1].onload();
  assert.equal((await b).ok, true);
  loads[0].onload();
  assert.equal((await a).cancelled, true);
  assert.equal(storage.get(key).backgroundUrl, secondURL);
  assert.ok(d.querySelector('[data-nsit-background-layer]').style.backgroundImage.includes(secondURL));
  loads.find(image => image.crossOrigin).onerror();
  await wait();
  assert.equal(d.documentElement.dataset.nsitBackgroundTone, 'dark');
});

test('disabling while an image loads prevents late application and late settings writes', async t => {
  const { d, storage, loads, controller } = setup(t);
  const pending = controller.apply(enabled(firstURL), { persist: true });
  await controller.apply({ enabled: false, backgroundUrl: secondURL }, { persist: true });
  loads[0].onload();
  assert.equal((await pending).cancelled, true);
  assert.equal(d.documentElement.classList.contains('nsit-background-on'), false);
  assert.equal(storage.get(key).enabled, false);
  assert.equal(storage.get(key).backgroundUrl, secondURL);
});

test('image sampling upgrades to a light palette on bright images, but cannot reenable a disabled background', async t => {
  const { d, loads, controller } = setup(t);
  const pending = controller.apply(enabled(firstURL)); loads[0].onload(); await pending;
  assert.equal(d.documentElement.dataset.nsitBackgroundTone, 'dark', 'first render protects text before sampling');
  loads.find(image => image.crossOrigin).onload(); await wait();
  assert.equal(d.documentElement.dataset.nsitBackgroundTone, 'light');
  assert.equal(d.documentElement.style.getPropertyValue('--nsbg-ink'), '#18212f');
  await controller.apply({ enabled: false });
  assert.equal(d.querySelector('[data-nsit-background-layer]'), null);
  assert.equal(d.documentElement.style.getPropertyValue('--nsbg-ink'), '');
});

test('native theme changes reapply the requested native palette without discarding the background or drafts', async t => {
  const { w, d, loads, controller } = setup(t);
  const pending = controller.apply({ ...enabled(firstURL), autoContrast: false }); loads[0].onload(); await pending;
  const layer = d.querySelector('[data-nsit-background-layer]');
  assert.equal(d.documentElement.dataset.nsitBackgroundTone, 'light');
  d.body.classList.add('dark-layout'); await wait();
  assert.equal(d.documentElement.dataset.nsitBackgroundTone, 'dark');
  assert.equal(d.querySelector('[data-nsit-background-layer]'), layer);
  assert.equal(d.querySelector('textarea').value, 'draft stays');
  assert.equal(w.getComputedStyle(d.querySelector('#editor')).position, 'fixed');
});

test('background styling preserves syntax, badges and selected action colors, and leaves fixed-position ancestors unfiltered', async t => {
  const { w, d, loads, controller } = setup(t);
  const preserved = ['.post-content pre', '.post-content pre code', '.hljs-keyword', '.badge', '.active-vote', '.pink-upload', '.cm-keyword'].map(s => [s, w.getComputedStyle(d.querySelector(s)).color]);
  const pending = controller.apply(enabled(firstURL)); loads[0].onload(); await pending;
  for (const [selector, color] of preserved) assert.equal(w.getComputedStyle(d.querySelector(selector)).color, color, selector);
  for (const selector of ['body', '#nsk-body', '#editor']) {
    const css = w.getComputedStyle(d.querySelector(selector));
    assert.ok(!css.filter || css.filter === 'none', selector + ' must not blur its own text or trap fixed children');
    assert.ok(!css.backdropFilter || css.backdropFilter === 'none', selector + ' must not establish a fixed-position containing block');
    assert.ok(!css.transform || css.transform === 'none');
  }
});

test('manual framing updates its background position on resize without loading the image again', async t => {
  const { w, d, loads, controller } = setup(t);
  const pending = controller.apply({ ...enabled(firstURL), autoFocus: false, focusX: 80, focusY: 25 }); loads[0].onload(); await pending;
  loads.find(image => image.crossOrigin).onerror(); await wait();
  const count = loads.length;
  Object.defineProperty(w, 'innerWidth', { value: 480, configurable: true });
  w.dispatchEvent(new w.Event('resize')); await wait(130);
  assert.equal(loads.length, count);
  assert.equal(d.querySelector('[data-nsit-background-layer]').style.backgroundPosition, '80% 25%');
});

test('adaptive bright text never pairs with an unchanged white native popup, while the plain editor retains its native colors', async t => {
  const { w, d, loads, controller } = setup(t, { bright: false });
  const pending = controller.apply(enabled(firstURL)); loads[0].onload(); await pending;
  assert.equal(d.documentElement.dataset.nsitBackgroundTone, 'dark');
  assert.notEqual(color(w, d.querySelector('.native-popup'), 'background-color'), 'rgb(255, 255, 255)', 'native surfaces using the adaptive text token need a matching background token');
  const editor = d.querySelector('textarea');
  assert.equal(color(w, editor, 'background-color'), 'rgb(255, 255, 255)');
  assert.equal(color(w, editor, 'color'), 'rgb(34, 34, 34)', 'plain editor text must retain its original theme along with its solid surface');
  d.body.classList.add('dark-layout'); await wait();
  assert.equal(color(w, editor, 'background-color'), 'rgb(39, 39, 39)');
  assert.equal(color(w, editor, 'color'), 'rgb(221, 221, 221)');
});

test('previews do not persist and closing a preview restores the previously saved appearance', async t => {
  const { w, d, loads, storage, controller } = setup(t);
  w.eval('openBackgroundSettings()');
  const modal = d.querySelector('[data-nsit-background-dialog]');
  modal.querySelector('[name=enabled]').checked = true;
  modal.querySelector('[name=backgroundUrl]').value = firstURL;
  modal.querySelector('[data-nsit-background-preview]').click();
  loads[0].onload(); await wait();
  assert.equal(storage.has(key), false);
  assert.equal(d.documentElement.classList.contains('nsit-background-on'), true);
  modal.querySelector('[data-nsit-background-close]').click(); await wait();
  assert.equal(d.documentElement.classList.contains('nsit-background-on'), false);
  loads.find(image => image.crossOrigin).onload(); await wait();
  assert.equal(d.querySelector('[data-nsit-background-layer]'), null, 'late sampling cannot restore the dismissed preview');
  assert.equal(controller.status, '已恢复论坛原有外观');
});

test('previewing multiple backgrounds keeps the saved image cached so dismissing never depends on its host still being online', async t => {
  const { w, d, loads, controller } = setup(t);
  const saved = controller.apply(enabled(firstURL), { persist: true }); loads[0].onload(); await saved;
  w.eval('openBackgroundSettings()');
  for (const url of [secondURL, 'https://cdn.example.com/third.png', 'https://cdn.example.com/fourth.png']) {
    const pending = controller.apply(enabled(url));
    loads.findLast(image => image.url === url && !image.crossOrigin).onload(); await pending;
  }
  const before = loads.length;
  d.querySelector('[data-nsit-background-close]').click(); await wait();
  assert.equal(loads.length, before, 'the original saved image is retained for preview restoration');
  assert.ok(d.querySelector('[data-nsit-background-layer]').style.backgroundImage.includes(firstURL));
});
