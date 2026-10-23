const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const file = path.join(__dirname, '../src/home-feed.js');
const source = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const pause = (ms = 90) => new Promise(resolve => setTimeout(resolve, ms));
const item = (id, extra = '') => `<li class="post-list-item"><div class="post-list-content"><div class="post-title"><a href="/post-${id}-1">Topic ${id}</a></div><div class="info-author"><a href="/space/${id}">User ${id}</a></div>${extra}</div></li>`;
const pager = (next, position) => `<div class="nsk-pager pager-${position}"><div aria-label="pagination"><a href="/">1</a>${next ? `<a rel="next" href="${next}">Next</a>` : ''}</div></div>`;
function page(cards, next = '', sort = 'replyTime') {
  return `<html><head></head><body><div id="nsk-body-left"><div class="post-list-controler"><div class="sorter"><a data-sort="replyTime" class="${sort === 'replyTime' ? 'selected' : ''}" href="/">Latest reply</a><a data-sort="postTime" class="${sort === 'postTime' ? 'selected' : ''}" href="/?sort=postTime">Latest post</a></div></div>${pager(next, 'top')}<ul class="post-list topic-carousel-panel">${item(9999)}</ul><ul class="post-list">${cards}</ul>${pager(next, 'bottom')}</div></body></html>`;
}
const result = (html, url = 'https://www.nodeseek.com/page-2') => ({ ok: true, status: 200, url, text: async () => html });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function setup(t, options = {}) {
  const dom = new JSDOM(page(options.cards || item(1), options.next === undefined ? '/page-2' : options.next, options.sort), {
    url: options.url || 'https://www.nodeseek.com/', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window;
  const requests = [];
  const observers = [];
  let enabled = options.enabled !== false;
  let now = 100000;
  let loaderTop = 10000;
  w.Date.now = () => now;
  w.featureEnabled = name => name === 'homeAutoLoad' ? enabled : true;
  w.HTMLElement.prototype.getBoundingClientRect = function () {
    const top = this.classList.contains('nsit-home-loader') ? loaderTop : 10000;
    return { x: 0, y: top, left: 0, right: 800, top, bottom: top + 40, width: 800, height: 40 };
  };
  w.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; this.targets = new Set(); observers.push(this); }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); }
  };
  w.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    return options.fetch ? options.fetch(url, init, requests.length) : result(page(item(2)));
  };
  if (options.noObserver) delete w.IntersectionObserver;
  if (options.init) options.init(w);
  if (source) w.eval(`${source}\nwindow.homeFeedController = installHomeFeedLoading();`);
  await pause();
  t.after(() => dom.window.close());
  const refresh = async () => { w.homeFeedController?.refresh(); await pause(); };
  const bottom = async () => {
    for (const observer of [...observers]) {
      const targets = [...observer.targets];
      if (targets.length) observer.callback(targets.map(target => ({ target, isIntersecting: true, intersectionRatio: 1 })));
    }
    await pause();
  };
  return {
    w, d: w.document, requests, refresh, bottom,
    setEnabled(value) { enabled = value; },
    advance(ms) { now += ms; },
    async scrollNearBottom() { loaderTop = 100; w.dispatchEvent(new w.Event('scroll')); await pause(); },
  };
}
const mainList = d => d.querySelector('ul.post-list:not(.topic-carousel-panel)');
const postIDs = d => [...mainList(d).querySelectorAll('.post-title a')].map(a => Number(a.getAttribute('href').match(/post-(\d+)/)?.[1]));

test('homepage appends the next page on intersection without replacing native rows or carousel', async t => {
  const { d, requests, bottom } = await setup(t);
  const original = mainList(d).firstElementChild;
  const carousel = d.querySelector('.topic-carousel-panel');
  let clicks = 0;
  original.querySelector('.post-title a').addEventListener('click', e => { e.preventDefault(); clicks++; });
  assert.equal(requests.length, 0, 'does not fetch before the page bottom is reached');
  assert.equal(d.querySelector('.nsit-home-loader')?.getAttribute('role'), 'status');
  await bottom();
  assert.equal(requests.length, 1);
  assert.equal(new URL(requests[0].url, 'https://www.nodeseek.com/').pathname, '/page-2');
  assert.deepEqual(postIDs(d), [1, 2]);
  assert.equal(mainList(d).firstElementChild, original);
  assert.equal(d.querySelector('.topic-carousel-panel'), carousel);
  assert.equal(carousel.children.length, 1);
  original.querySelector('.post-title a').click();
  assert.equal(clicks, 1);
});

test('near-bottom scrolling loads subsequent pages serially and stops after the last page', async t => {
  const first = deferred();
  const { d, requests, bottom, scrollNearBottom } = await setup(t, {
    fetch: (_url, _init, n) => n === 1 ? first.promise : result(page(item(3)), 'https://www.nodeseek.com/page-3'),
  });
  await scrollNearBottom();
  await bottom();
  await bottom();
  assert.equal(requests.length, 1, 'overlapping bottom notifications share the in-flight request');
  first.resolve(result(page(item(2), '/page-3')));
  await pause();
  await bottom();
  assert.equal(requests.length, 2);
  assert.equal(new URL(requests[1].url, 'https://www.nodeseek.com/').pathname, '/page-3');
  assert.deepEqual(postIDs(d), [1, 2, 3]);
  await bottom();
  await scrollNearBottom();
  assert.equal(requests.length, 2, 'the final page cannot restart loading');
});

test('deduplicates topics repeated across pages while retaining their original nodes', async t => {
  const { d, bottom } = await setup(t, { cards: item(1) + item(2), fetch: () => result(page(item(2) + item(3) + item(3))) });
  const original = mainList(d).lastElementChild;
  await bottom();
  assert.deepEqual(postIDs(d), [1, 2, 3]);
  assert.equal(mainList(d).children[1], original);
});

test('sanitizes imported executable markup while preserving native SVG symbol icons', async t => {
  const extra = '<script>window.homeFeedInjected = true</script><img src="/avatar.png" onerror="window.homeFeedInjected = true"><a class="bad-link" href="javascript:alert(1)">bad</a><svg><use href="#icon-reply"></use></svg>';
  const { d, w, bottom } = await setup(t, { fetch: () => result(page(item(2, extra))) });
  await bottom();
  const imported = mainList(d).lastElementChild;
  assert.deepEqual(postIDs(d), [1, 2]);
  assert.equal(imported.querySelector('script'), null);
  assert.equal(imported.querySelector('img').hasAttribute('onerror'), false);
  assert.notEqual(imported.querySelector('.bad-link').getAttribute('href')?.toLowerCase().startsWith('javascript:'), true);
  assert.equal(imported.querySelector('use').getAttribute('href'), '#icon-reply');
  assert.equal(w.homeFeedInjected, undefined);
});

test('keeps top manual pagination available and hides only the bottom pager while active', async t => {
  const { d, setEnabled, refresh } = await setup(t);
  const top = d.querySelector('.pager-top');
  const bottom = d.querySelector('.pager-bottom');
  assert.equal(bottom.classList.contains('nsit-home-pager-hidden'), true);
  assert.equal(top.classList.contains('nsit-home-pager-hidden'), false);
  assert.ok(top.querySelector('a[rel="next"]'));
  setEnabled(false);
  await refresh();
  assert.equal(bottom.classList.contains('nsit-home-pager-hidden'), false);
  assert.equal(d.querySelector('.nsit-home-loader'), null);
});

test('disabling auto-load removes imported rows and aborts an outstanding request', async t => {
  const pending = deferred();
  const { d, requests, bottom, refresh, setEnabled } = await setup(t, {
    fetch: (_url, _init, n) => n === 1 ? result(page(item(2), '/page-3')) : pending.promise,
  });
  const original = mainList(d).firstElementChild;
  await bottom();
  assert.deepEqual(postIDs(d), [1, 2]);
  await bottom();
  assert.equal(requests.length, 2);
  setEnabled(false);
  await refresh();
  assert.equal(requests[1].init.signal?.aborted, true);
  assert.deepEqual(postIDs(d), [1]);
  assert.equal(mainList(d).firstElementChild, original);
  pending.resolve(result(page(item(3)), 'https://www.nodeseek.com/page-3'));
  await pause();
  assert.deepEqual(postIDs(d), [1]);
});

test('failed loading retains prior topics and retries only after cooldown on another bottom notification', async t => {
  const { d, requests, bottom, advance } = await setup(t, {
    fetch: (_url, _init, n) => n === 1 ? result(page(item(2), '/page-3')) : n === 2 ? Promise.reject(new Error('offline')) : result(page(item(3)), 'https://www.nodeseek.com/page-3'),
  });
  await bottom();
  await bottom();
  assert.equal(requests.length, 2);
  assert.deepEqual(postIDs(d), [1, 2]);
  assert.ok(d.querySelector('.nsit-home-loader')?.textContent.trim(), 'the loader reports the failed request');
  await bottom();
  advance(4999);
  await bottom();
  assert.equal(requests.length, 2);
  advance(2);
  await bottom();
  assert.equal(requests.length, 3);
  assert.deepEqual(postIDs(d), [1, 2, 3]);
});

test('ordinary numbered home pages also load their next page', async t => {
  const { d, requests, bottom } = await setup(t, { url: 'https://www.nodeseek.com/page-2/', cards: item(2), next: '/page-3', fetch: () => result(page(item(3)), 'https://www.nodeseek.com/page-3') });
  await bottom();
  assert.equal(requests.length, 1);
  assert.deepEqual(postIDs(d), [2, 3]);
});

test('scrolling still loads the homepage when IntersectionObserver is unavailable', async t => {
  const { d, requests, scrollNearBottom } = await setup(t, { noObserver: true });
  assert.equal(requests.length, 0);
  await scrollNearBottom();
  assert.equal(requests.length, 1);
  assert.deepEqual(postIDs(d), [1, 2]);
});

test('a carousel without the regular topic list is never treated as the homepage feed', async t => {
  const { d, requests, bottom, scrollNearBottom } = await setup(t, { init: w => mainList(w.document).remove() });
  await bottom();
  await scrollNearBottom();
  assert.equal(requests.length, 0);
  assert.equal(d.querySelector('.nsit-home-loader'), null);
  assert.equal(d.querySelector('.topic-carousel-panel').children.length, 1);
});

test('does not activate on category or topic routes even if they contain a similar list', async t => {
  for (const pathname of ['/categories/general', '/category-1', '/post-123-1', '/page-nope']) {
    const { d, requests, bottom } = await setup(t, { url: `https://www.nodeseek.com${pathname}` });
    await bottom();
    assert.equal(requests.length, 0, pathname);
    assert.equal(d.querySelector('.nsit-home-loader'), null, pathname);
    assert.equal(d.querySelector('.pager-bottom').classList.contains('nsit-home-pager-hidden'), false, pathname);
  }
});

test('a disabled feature and a final homepage without a next link make no requests', async t => {
  for (const options of [{ enabled: false }, { next: '' }]) {
    const { d, requests, bottom, scrollNearBottom } = await setup(t, options);
    await bottom();
    await scrollNearBottom();
    assert.equal(requests.length, 0);
    assert.deepEqual(postIDs(d), [1]);
  }
});

test('does not follow cross-origin pagination or pagination that points back to the current page', async t => {
  for (const next of ['https://example.com/page-2', '/', '/page-8']) {
    const { requests, bottom } = await setup(t, { next });
    await bottom();
    assert.equal(requests.length, 0, next);
  }
});

test('rejects redirected login pages, wrong page routes, missing feeds, and mismatched sorting', async t => {
  const responses = [
    result(page(item(2)), 'https://www.nodeseek.com/login'),
    result(page(item(2)), 'https://www.nodeseek.com/page-3'),
    result('<html><body><form>Verify your browser</form></body></html>'),
    result(page(item(2), '', 'postTime')),
    result(page(item(2)), 'https://example.com/page-2'),
    { ...result(page(item(2))), ok: false, status: 500 },
  ];
  for (const response of responses) {
    const { d, requests, bottom } = await setup(t, { fetch: () => response });
    await bottom();
    assert.equal(requests.length, 1, response.url);
    assert.deepEqual(postIDs(d), [1], response.url);
  }
});

test('retains the current query in next-page loading and refuses a redirect into a different query', async t => {
  const { d, requests, bottom } = await setup(t, {
    url: 'https://www.nodeseek.com/?sort=postTime', next: '/page-2?sort=postTime', sort: 'postTime',
    fetch: () => result(page(item(2), '', 'postTime'), 'https://www.nodeseek.com/page-2?sort=postTime'),
  });
  await bottom();
  assert.equal(requests.length, 1);
  assert.equal(new URL(requests[0].url, 'https://www.nodeseek.com/').search, '?sort=postTime');
  assert.deepEqual(postIDs(d), [1, 2]);
  const wrongQuery = await setup(t, {
    url: 'https://www.nodeseek.com/?sort=postTime', next: '/page-2?sort=postTime', sort: 'postTime',
    fetch: () => result(page(item(2), '', 'postTime'), 'https://www.nodeseek.com/page-2?sort=replyTime'),
  });
  await wrongQuery.bottom();
  assert.equal(wrongQuery.requests.length, 1);
  assert.deepEqual(postIDs(wrongQuery.d), [1]);
});

test('changing the homepage query invalidates pending responses and restores the current list', async t => {
  const pending = deferred();
  const { w, d, requests, bottom, refresh } = await setup(t, { fetch: () => pending.promise });
  await bottom();
  assert.equal(requests.length, 1, 'the page-bottom notification starts loading');
  w.history.replaceState(null, '', '/?view=new');
  await refresh();
  assert.equal(requests[0].init.signal?.aborted, true);
  pending.resolve(result(page(item(2))));
  await pause();
  assert.deepEqual(postIDs(d), [1]);
});

test('switching the selected sort cancels stale loading even when the URL does not change', async t => {
  const pending = deferred();
  const { d, requests, bottom, refresh } = await setup(t, { fetch: () => pending.promise });
  await bottom();
  assert.equal(requests.length, 1, 'the page-bottom notification starts loading');
  d.querySelector('[data-sort="replyTime"]').classList.remove('selected');
  d.querySelector('[data-sort="postTime"]').classList.add('selected');
  await refresh();
  assert.equal(requests[0].init.signal?.aborted, true);
  pending.resolve(result(page(item(2))));
  await pause();
  assert.deepEqual(postIDs(d), [1]);
});

test('replacing the home list ignores a stale response and continues on the new native list', async t => {
  const pending = deferred();
  const { w, d, requests, bottom, refresh } = await setup(t, {
    fetch: (_url, _init, n) => n === 1 ? pending.promise : result(page(item(5))),
  });
  const oldList = mainList(d);
  await bottom();
  assert.equal(requests.length, 1, 'the page-bottom notification starts loading');
  const newList = w.document.createElement('ul');
  newList.className = 'post-list';
  newList.innerHTML = item(4);
  oldList.replaceWith(newList);
  await refresh();
  assert.equal(requests[0].init.signal?.aborted, true);
  pending.resolve(result(page(item(2))));
  await pause();
  assert.deepEqual(postIDs(d), [4]);
  await bottom();
  assert.equal(requests.length, 2);
  assert.deepEqual(postIDs(d), [4, 5]);
});

test('leaving the homepage aborts loading and restores bottom pagination', async t => {
  const pending = deferred();
  const { w, d, requests, bottom, refresh } = await setup(t, { fetch: () => pending.promise });
  await bottom();
  assert.equal(requests.length, 1, 'the page-bottom notification starts loading');
  w.history.replaceState(null, '', '/post-123-1');
  await refresh();
  assert.equal(requests[0].init.signal?.aborted, true);
  assert.equal(d.querySelector('.nsit-home-loader'), null);
  assert.equal(d.querySelector('.pager-bottom').classList.contains('nsit-home-pager-hidden'), false);
  pending.resolve(result(page(item(2))));
  await pause();
  assert.deepEqual(postIDs(d), [1]);
});
