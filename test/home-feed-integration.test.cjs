const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const pause = (ms = 180) => new Promise(resolve => setTimeout(resolve, ms));
const item = (id, title = `Topic ${id}`) => `<li class="post-list-item"><div class="post-list-content"><div class="post-title"><a href="/post-${id}-1">${title}</a></div><div class="info-author"><a href="/space/${id}">User ${id}</a></div></div></li>`;
const pager = (next, place) => `<div class="nsk-pager pager-${place}"><div aria-label="pagination"><a href="/">1</a>${next ? `<a href="${next}" rel="next">Next</a>` : ''}</div></div>`;
const page = (items, next = '') => `<html><head></head><body><header id="nsk-head"></header><main id="nsk-body-left"><div class="post-list-controler"><div class="sorter"><a class="selected" data-sort="replyTime" href="/">Latest reply</a><a data-sort="postTime" href="/?sort=postTime">Latest post</a></div></div>${pager(next, 'top')}<ul class="post-list topic-carousel-panel">${item(9999, 'Carousel stays untouched')}</ul><ul class="post-list">${items}</ul>${pager(next, 'bottom')}</main><aside id="nsk-right-panel-container"><div class="user-stat"><div class="stat-block"><div data-v-native><a data-v-native href="/progress"><svg data-v-native class="iconpark-icon"></svg><span data-v-native>等级 Lv 5</span></a></div></div><div class="stat-block"><div data-v-native><a data-v-native href="/my-post"><svg data-v-native class="iconpark-icon"></svg><span data-v-native>主题帖 153</span></a></div></div></div></aside></body></html>`;
const mainList = d => d.querySelector('ul.post-list:not(.topic-carousel-panel)');
const row = (d, id) => mainList(d).querySelector(`.post-title a[href="/post-${id}-1"]`)?.closest('.post-list-item');

async function setup(t, file, { flags = {}, rules = [], replied = {}, fetch } = {}) {
  const consoleErrors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => consoleErrors.push(error.message));
  const dom = new JSDOM(page(item(1, 'Original native topic'), '/page-2'), {
    url: 'https://www.nodeseek.com/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole,
  });
  const w = dom.window, d = w.document;
  const observers = [], intersections = [], menus = new Map(), requests = [], gmRequests = [];
  const NativeObserver = w.MutationObserver;
  w.MutationObserver = class extends NativeObserver {
    constructor(callback) { super(callback); observers.push(this); }
  };
  t.after(() => { w.__nodeSeekAuthorInfo__?.disconnect(); observers.forEach(observer => observer.disconnect()); w.close(); });
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    return { x: 0, y: 10000, left: 0, right: 800, top: 10000, bottom: 10040, width: 800, height: 40 };
  };
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.scrollTo = () => {};
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; this.targets = new Set(); intersections.push(this); }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); }
  };
  const storage = new Map([['nsit-auto-settings-v1', { autoReply: false, autoCheckIn: false }]]);
  w.GM_getValue = (key, fallback) => storage.has(key) ? storage.get(key) : fallback;
  w.GM_setValue = (key, value) => storage.set(key, value);
  w.GM_registerMenuCommand = (name, callback) => menus.set(name, callback);
  w.GM_addStyle = css => { const style = d.createElement('style'); style.textContent = css; d.head.append(style); return style; };
  w.GM_xmlhttpRequest = options => {
    gmRequests.push(options.url);
    queueMicrotask(() => options.onerror?.({ status: 503 }));
    return { abort() {} };
  };
  w.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    if (fetch) return fetch(url, init);
    if (new URL(String(url), w.location.href).pathname !== '/page-2') return { ok: false, status: 503, json: async () => ({}) };
    return {
      ok: true, status: 200, url: 'https://www.nodeseek.com/page-2',
      text: async () => page(item(2, 'Blocked offer') + item(3, 'Participating topic') + item(4, 'Featured release')),
    };
  };
  w.__config__ = { user: { member_id: 42 } };
  w.localStorage.setItem('nsit-feature-flags-v1', JSON.stringify(flags));
  w.localStorage.setItem('nsit-post-filter-rules-v1', JSON.stringify(rules));
  w.localStorage.setItem('nsit-replied-posts-v1-42', JSON.stringify(replied));
  w.eval(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'));
  await pause();
  return {
    w, d, menus, requests, gmRequests, consoleErrors,
    async bottom() {
      for (const observer of intersections) {
        const targets = [...observer.targets];
        if (targets.length) observer.callback(targets.map(target => ({ target, isIntersecting: true, intersectionRatio: 1 })));
      }
      await pause();
    },
    async setHomeEnabled(enabled) {
      const open = menus.get('功能开关');
      assert.equal(typeof open, 'function', 'the bundled homepage registers the real feature menu');
      open();
      const control = d.querySelector('[data-nsit-flag="homeAutoLoad"]');
      assert.ok(control, 'the real feature dialog exposes homepage loading');
      control.checked = enabled;
      control.dispatchEvent(new w.Event('change', { bubbles: true }));
      await pause();
      return control;
    },
  };
}

for (const file of ['NodeSeek Issue Templates.user.js', 'NodeSeek Issue Templates.min.user.js']) {
  test(`${file}: homepage bootstrap filters loaded topics and adds the current user's replied labels`, async t => {
    const { w, d, requests, gmRequests, bottom, consoleErrors } = await setup(t, file, {
      rules: [
        { id: 'blocked', keywords: 'blocked', action: 'hide', enabled: true },
        { id: 'featured', keywords: 'featured', action: 'highlight', color: '#aabbcc', enabled: true },
      ],
      replied: { 3: [5] },
    });
    const native = row(d, 1), carousel = d.querySelector('.topic-carousel-panel');
    let clicks = 0;
    native.querySelector('.post-title a').addEventListener('click', event => { event.preventDefault(); clicks++; });
    assert.ok(d.querySelector('.nsit-home-loader'), 'the bundled main installs homepage loading by default');
    assert.equal(d.querySelector('.pager-bottom').classList.contains('nsit-home-pager-hidden'), true);
    assert.equal(requests.length, 0, 'background features do not make homepage network requests before scrolling');
    await bottom();
    assert.equal(requests.length, 1);
    assert.equal(new URL(requests[0].url, w.location.href).pathname, '/page-2');
    assert.equal(row(d, 1), native);
    assert.equal(d.querySelector('.topic-carousel-panel'), carousel);
    assert.equal(carousel.children.length, 1);
    assert.ok(row(d, 2)?.classList.contains('nsit-filter-hidden'), 'new rows pass through the actual content filter');
    assert.equal(w.getComputedStyle(row(d, 2)).display, 'none');
    assert.equal(row(d, 4)?.classList.contains('nsit-filter-highlighted'), true);
    assert.equal(row(d, 4).style.getPropertyValue('--nsit-filter-highlight'), '#aabbcc');
    assert.equal(row(d, 3)?.querySelector('[data-nsit-replied-post-label]')?.textContent, '已回复');
    assert.equal(row(d, 1).querySelector('[data-nsit-replied-post-label]'), null);
    native.querySelector('.post-title a').click();
    assert.equal(clicks, 1);
    await bottom();
    assert.equal(requests.length, 1, 'the final imported page stops loading');
    assert.equal(row(d, 3).querySelectorAll('[data-nsit-replied-post-label]').length, 1);
    assert.equal(gmRequests.length, 0, 'no image upload or automated account action was performed');
    assert.deepEqual(consoleErrors, []);
  });

  test(`${file}: homepage feature starts disabled and its real UI toggles loading and restores native pagination`, async t => {
    const { w, d, requests, bottom, setHomeEnabled, consoleErrors } = await setup(t, file, { flags: { homeAutoLoad: false } });
    const native = row(d, 1), top = d.querySelector('.pager-top'), bottomPager = d.querySelector('.pager-bottom');
    await bottom();
    assert.equal(requests.length, 0);
    assert.equal(d.querySelector('.nsit-home-loader'), null);
    assert.equal(bottomPager.classList.contains('nsit-home-pager-hidden'), false);
    const control = await setHomeEnabled(true);
    assert.equal(control.checked, true);
    assert.ok(d.querySelector('.nsit-home-loader'));
    assert.equal(bottomPager.classList.contains('nsit-home-pager-hidden'), true);
    assert.equal(top.classList.contains('nsit-home-pager-hidden'), false);
    await bottom();
    assert.equal(requests.length, 1);
    assert.ok(row(d, 2));
    assert.equal(row(d, 1), native);
    await setHomeEnabled(false);
    assert.equal(d.querySelector('.nsit-home-loader'), null);
    assert.equal(row(d, 2), undefined);
    assert.equal(mainList(d).children.length, 1);
    assert.equal(row(d, 1), native);
    assert.equal(bottomPager.classList.contains('nsit-home-pager-hidden'), false);
    assert.equal(top.querySelector('a[rel="next"]').getAttribute('href'), '/page-2');
    assert.equal(JSON.parse(w.localStorage.getItem('nsit-feature-flags-v1')).homeAutoLoad, false);
    await bottom();
    assert.equal(requests.length, 1);
    await setHomeEnabled(true);
    await bottom();
    assert.equal(requests.length, 2, 'reenabling starts cleanly from the original next page');
    assert.ok(row(d, 2));
    assert.equal(row(d, 1), native);
    assert.equal(d.querySelectorAll('.nsit-home-loader').length, 1);
    assert.deepEqual(consoleErrors, []);
  });
}
