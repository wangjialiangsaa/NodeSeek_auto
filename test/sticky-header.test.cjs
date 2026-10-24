const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

function setup(t, { withHeader = true } = {}) {
  const dom = new JSDOM(`<html><head><style>body>header{position:relative}</style></head><body>${withHeader ? '<header><div id="nsk-head"><a href="/">NodeSeek</a><form><input value="keep search"></form></div></header>' : ''}<main id="nsk-body">Content</main></body></html>`, { url: 'https://www.nodeseek.com/', runScripts: 'outside-only' });
  const w = dom.window, d = w.document, resizeObservers = [];
  let height = 40, layoutReads = 0;
  const geometry = header => { header.getBoundingClientRect = () => { layoutReads++; return { height }; }; };
  if (withHeader) geometry(d.querySelector('body>header'));
  w.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.targets = new Set(); resizeObservers.push(this); }
    observe(node) { this.targets.add(node); }
    disconnect() { this.targets.clear(); }
  };
  w.eval(fs.readFileSync(path.join(__dirname, '../src/sticky-header.js'), 'utf8') + '\nwindow.controller = installStickyHeader();');
  t.after(() => { w.controller?.disconnect(); w.close(); });
  return { w, d, controller: w.controller, resizeObservers, setHeight(value) { height = value; }, geometry, layoutReads: () => layoutReads };
}

test('pins the outer header in normal flow, preserving navigation and measuring anchor clearance', t => {
  const { w, d, controller } = setup(t);
  const header = d.querySelector('body>header'), nav = d.querySelector('#nsk-head');
  assert.ok(header.classList.contains('nsit-pinned-header'));
  assert.ok(!nav.classList.contains('nsit-pinned-header'), 'the short inner div cannot contain the sticky header');
  assert.equal(w.getComputedStyle(header).position, 'sticky');
  assert.equal(w.getComputedStyle(header).top, '0px');
  assert.ok(Number(w.getComputedStyle(header).zIndex) < 100000, 'settings overlays stay above navigation');
  assert.equal(d.documentElement.style.getPropertyValue('--nsit-header-height'), '40px');
  assert.match(w.getComputedStyle(d.documentElement).scrollPaddingTop, /--nsit-header-height/);
  const input = nav.querySelector('input');
  for (let i = 0; i < 10; i++) controller.refresh();
  assert.equal(d.querySelector('#nsk-head'), nav);
  assert.equal(nav.querySelector('input'), input);
  assert.equal(input.value, 'keep search');
  assert.equal(d.querySelectorAll('body>header').length, 1);
});

test('resize updates the anchor clearance and unchanged refreshes do not rewrite attributes', async t => {
  const { w, d, controller, resizeObservers, setHeight, layoutReads } = setup(t);
  const header = d.querySelector('body>header');
  const size = resizeObservers.find(observer => observer.targets.has(header));
  assert.ok(size, 'header wraps and responsive height changes must be observed');
  setHeight(76.2); size.callback([{ target: header }]);
  assert.equal(d.documentElement.style.getPropertyValue('--nsit-header-height'), '77px');
  const changes = [], observer = new w.MutationObserver(records => changes.push(...records));
  const before = layoutReads();
  observer.observe(d.documentElement, { attributes: true, subtree: true });
  for (let i = 0; i < 10; i++) controller.refresh();
  await Promise.resolve(); observer.disconnect();
  assert.equal(changes.length, 0, 'ordinary page mutations must not cause a header style loop');
  assert.equal(layoutReads(), before, 'ordinary page mutations must not force repeated layout measurements');
});

test('handles a delayed or replaced header and releases only its own classes and observers', t => {
  const { w, d, controller, geometry, resizeObservers } = setup(t, { withHeader: false });
  assert.ok(!d.documentElement.classList.contains('nsit-header-pinned'));
  const header = d.createElement('header'); header.innerHTML = '<div id="nsk-head">NodeSeek</div>'; geometry(header);
  d.body.prepend(header); controller.refresh();
  assert.ok(header.classList.contains('nsit-pinned-header'));
  const replacement = header.cloneNode(true); geometry(replacement); header.replaceWith(replacement); controller.refresh();
  assert.ok(!header.classList.contains('nsit-pinned-header'));
  assert.ok(resizeObservers.some(observer => observer.targets.has(replacement)));
  assert.equal(resizeObservers.filter(observer => observer.targets.has(header)).length, 0);
  controller.disconnect();
  assert.ok(!replacement.classList.contains('nsit-pinned-header'));
  assert.ok(!d.documentElement.classList.contains('nsit-header-pinned'));
  assert.equal(d.documentElement.style.getPropertyValue('--nsit-header-height'), '');
  assert.ok(resizeObservers.every(observer => observer.targets.size === 0));
  controller.refresh(); w.dispatchEvent(new w.Event('resize'));
  assert.ok(!replacement.classList.contains('nsit-pinned-header'));
});

test('background styles injected after pinning cannot release the header', t => {
  const { w, d } = setup(t);
  w.eval(fs.readFileSync(path.join(__dirname, '../src/background.js'), 'utf8') + '\ninjectBackgroundStyles();');
  d.documentElement.classList.add('nsit-background-on');
  const header = d.querySelector('body>header');
  assert.equal(w.getComputedStyle(header).position, 'sticky');
  assert.equal(w.getComputedStyle(header).backdropFilter, '', 'reuse the background pseudo element without another filtered surface');
  d.documentElement.classList.remove('nsit-background-on');
  assert.equal(w.getComputedStyle(header).position, 'sticky');
});
