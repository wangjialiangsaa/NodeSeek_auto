const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const file = path.join(__dirname, '../src/threaded.js');
const automaticSource = fs.readFileSync(path.join(__dirname, '../src/auto-tasks.js'), 'utf8');
const source = fs.existsSync(file) ? `function featureEnabled(){return true;}\n${automaticSource}\n${fs.readFileSync(file, 'utf8')}\ninstallThreadedReading();` : '';
const pause = ms => new Promise(r => setTimeout(r, ms));
const reply = (floor, body, author = `User${floor}`, style = '') => `<li class="content-item" id="${floor}" data-comment-id="${1000 + floor}" style="${style}"><div class="nsk-content-meta-info"><div class="avatar-wrapper"><img class="avatar-normal"></div><div><div class="author-info"><a class="author-name" href="/space/${floor}">${author}</a></div></div><div class="floor-link-wrapper"><a class="floor-link" href="#${floor}">#${floor}</a></div></div><article class="post-content">${body}</article><div class="comment-menu"><button class="native-reply">回复</button></div></li>`;
const ref = (floor, topic = '123', page = 1) => `<a href="/member?t=User${floor}">@User${floor}</a> <a href="/post-${topic}-${page}#${floor}">#${floor}</a><br>`;
async function setup(t, cards, options = {}) {
  const dom = new JSDOM(`<html><head></head><body><header id="nsk-head"></header><main><div class="content-item" id="0"><div class="author-info"><a class="author-name">OP</a></div><article class="post-content">主题正文</article></div><div class="comment-container"><ul class="comments">${cards}</ul>${options.pagination || ''}</div>${options.editor ? '<div id="editor"><div class="md-editor"><div id="editor-body"><div class="CodeMirror"></div><textarea class="draft">未写完的草稿</textarea></div><div class="topic-select"><button class="submit">发布评论</button></div></div></div>' : ''}</main></body></html>`, { url: options.url || 'https://www.nodeseek.com/post-123-1', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  const storage = options.storage || new Map();
  if (options.defaultCollapsed === null) storage.delete('nsit-auto-settings-v1');
  else storage.set('nsit-auto-settings-v1', { ...storage.get('nsit-auto-settings-v1'), threadDefaultCollapsed: options.defaultCollapsed === true });
  w.GM_getValue = (k, d) => storage.has(k) ? storage.get(k) : d;
  w.GM_setValue = (k, v) => storage.set(k, v);
  w.GM_registerMenuCommand = () => {};
  if (options.fetch) w.fetch = options.fetch;
  const intersections = [];
  w.IntersectionObserver = class {
    constructor(callback) { this.callback=callback; intersections.push(this); }
    observe(target) { this.target=target; }
    disconnect() { this.target=null; }
  };
  if (options.init) options.init(w);
  if (options.geometry) {
    w.HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.closest('.nst-branch-hidden')) return {left:0,top:0,right:0,bottom:0,width:0,height:0,x:0,y:0};
      const card = this.closest('li.content-item');
      const rank = card ? Number(card.style.order || card.id) : 0;
      const left = card ? 20 + Number(card.style.getPropertyValue('--nst-indent') || 0) * 22 : 0;
      const top = rank * 120;
      return {left,top,right:left+40,bottom:top+40,width:40,height:40,x:left,y:top};
    };
    w.HTMLElement.prototype.getClientRects = function () { return this.closest('.nst-branch-hidden') ? [] : [this.getBoundingClientRect()]; };
  }
  w.eval(source);
  await pause(120);
  t.after(() => dom.window.close());
  return { w, d: w.document, storage, bottom:()=>intersections.forEach(o=>{if(o.target)o.callback([{target:o.target,isIntersecting:true}]);}) };
}
function mode(d, value) {
  const b = d.querySelector(`[data-nst-mode="${value}"]`);
  assert.ok(b, `${value} mode control exists`);
  b.click();
}
function branchToggle(d, floor) {
  const button = d.getElementById(String(floor)).querySelector('button.nst-branch-toggle');
  assert.ok(button, `floor ${floor} has a branch toggle`);
  return button;
}
function hiddenFloors(d) {
  return [...d.querySelectorAll('ul.comments > li.nst-branch-hidden')].map(card=>Number(card.id)).sort((a,b)=>a-b);
}

test('groups a reply under its parent while preserving native DOM and handlers', async t => {
  const { d } = await setup(t, reply(1, '<p>第一条</p>') + reply(2, '<p>另一条</p>') + reply(3, `<p>${ref(1)}回答</p>`));
  assert.equal(d.getElementById('3').dataset.nstDepth, '1');
  assert.ok(Number(d.getElementById('3').style.order) < Number(d.getElementById('2').style.order));
  let clicked = 0;
  d.getElementById('3').querySelector('.native-reply').onclick = () => clicked++;
  mode(d, 'quote'); mode(d, 'thread');
  d.getElementById('3').querySelector('.native-reply').click();
  assert.equal(clicked, 1);
  assert.equal(d.querySelectorAll('[id="3"]').length, 1);
});

test('does not infer parents from a plain mention, another topic, a code sample or a quoted link', async t => {
  const { d } = await setup(t, reply(1, 'one') + reply(2, '<p><a href="/member?t=User1">@User1</a> hello</p>') + reply(3, `<p>${ref(1, '999')}another topic</p>`) + reply(4, `<blockquote><p>${ref(1)}quotation</p></blockquote><p>My comment</p>`) + reply(5, `<pre><code>${ref(1)}</code></pre>`));
  for (const id of ['2', '3', '4', '5']) assert.equal(d.getElementById(id).dataset.nstDepth, '0');
});

test('nested replies follow numeric ancestry even when pinned cards precede the parent', async t => {
  const { d } = await setup(t, reply(4, `<p>${ref(3)}nested</p>`) + reply(1, 'one') + reply(2, 'two') + reply(3, `<p>${ref(1)}child</p>`));
  assert.equal(d.getElementById('4').dataset.nstDepth, '2');
  const visual = [...d.querySelectorAll('ul.comments > li')].sort((a,b) => Number(a.style.order) - Number(b.style.order)).map(n=>n.id);
  assert.deepEqual(visual, ['1','3','4','2']);
});

test('groups the screenshot conversation when native reply links follow the message', async t => {
  const { d } = await setup(t,
    reply(14, '<p>交易说明</p>', 'magnorns') +
    reply(15, '<p>1750出给你了，改油<a href="/member?t=magnorns">@magnorns</a> <a href="/post-123-1#14">#14</a></p>', 'wandu') +
    reply(16, '<p><a href="/member?t=wandu">@wandu</a> <a href="/post-123-1#15">#15</a><br>好，没问题</p>', 'magnorns') +
    reply(17, '<p><strong>怎么交易</strong>，中介的话我不出中介费，而且找个靠谱的中介<a href="/member?t=magnorns">@magnorns</a> <a href="/post-123-1#16">#16</a></p>', 'wandu'));
  for (const [floor, depth] of [['14','0'],['15','1'],['16','2'],['17','3']]) assert.equal(d.getElementById(floor).dataset.nstDepth, depth);
  const last=d.getElementById('17');
  assert.equal(last.querySelector('.nst-relation a').getAttribute('href'), '/post-123-1#16');
  assert.match(last.querySelector('.nst-relation').textContent, /magnorns/);
  assert.equal(last.querySelector('strong').closest('.nst-reply-prefix'), null);
  assert.match(last.querySelector('.post-content').textContent, /怎么交易，中介的话我不出中介费，而且找个靠谱的中介/);
  mode(d,'raw');assert.equal(last.querySelector('.nst-relation'),null);
  assert.equal(last.querySelector('strong').closest('.nst-reply-prefix'),null);
  assert.ok(last.querySelector('a[href="/post-123-1#16"]'));
});

test('recognizes a native reply pair in a later paragraph with inline formatting', async t => {
  const {d}=await setup(t,reply(1,'parent')+reply(2,'<p>第一段正文</p><p>第二段 <strong><a href="/space/1">@User1</a></strong> <em><a href="/post-123-1#1">#1</a></em></p>'));
  const child=d.getElementById('2');assert.equal(child.dataset.nstDepth,'1');
  assert.equal(child.querySelector('.nst-relation a').getAttribute('href'),'/post-123-1#1');
  assert.equal(child.querySelector('.post-content').textContent,'第一段正文第二段 @User1 #1');
  assert.equal(child.querySelector('strong').closest('.nst-reply-prefix'),null);
});

test('groups the real NodeSeek conversation with unlinked recipient text', async t => {
  const { d } = await setup(t,
    reply(14, '<p><a href="/member?t=wandu">@wandu</a> <a href="/post-997159-1#6">#6</a> 大哥要出了记得联系我</p>', 'magnorns') +
    reply(15, '<p>1750出给你了，改油@magnorns <a href="/post-997159-2#14">#14</a></p>\n', 'wandu') +
    reply(16, '<p><a href="/member?t=wandu">@wandu</a> <a href="/post-997159-2#15">#15</a> 好，没问题</p>', 'magnorns') +
    reply(17, '<p>怎么交易，中介的话我不出中介费，而且找个靠谱的中介@magnorns <a href="/post-997159-2#16">#16</a></p>\n', 'wandu') +
    reply(18, '<p><a href="/member?t=wandu">@wandu</a> <a href="/post-997159-2#15">#15</a> 稍等我一会儿</p>', 'magnorns'),
    { url: 'https://www.nodeseek.com/post-997159-2' });
  for (const [floor, depth] of [['14','0'],['15','1'],['16','2'],['17','3'],['18','2']]) {
    assert.equal(d.getElementById(floor).dataset.nstDepth, depth, `floor ${floor}`);
  }
  const last = d.getElementById('17'), body = last.querySelector('.post-content');
  assert.equal(last.querySelector('.nst-relation a').getAttribute('href'), '/post-997159-2#16');
  assert.match(last.querySelector('.nst-relation').textContent, /magnorns/);
  assert.equal(body.textContent.trim(), '怎么交易，中介的话我不出中介费，而且找个靠谱的中介@magnorns #16');
  assert.equal(body.querySelector('.nst-reply-prefix'), null);
  mode(d, 'quote');
  assert.match(last.querySelector('.nst-auto-quote').textContent, /好，没问题/);
  mode(d, 'raw');
  assert.equal(last.querySelector('.nst-relation'), null);
  assert.equal(body.textContent.trim(), '怎么交易，中介的话我不出中介费，而且找个靠谱的中介@magnorns #16');
});

test('unlinked recipients require the target author and exclude unsafe or ambiguous references', async t => {
  const { d } = await setup(t,
    reply(1, 'one', 'magnorns') + reply(2, 'two', 'wandu') +
    reply(3, '<p>正文@someone <a href="/post-123-1#1">#1</a></p>') +
    reply(4, '<p>正文@magnorns <a href="/post-999-1#1">#1</a></p>') +
    reply(5, '<blockquote><p>正文@magnorns <a href="/post-123-1#1">#1</a></p></blockquote>') +
    reply(6, '<pre><code>正文@magnorns <a href="/post-123-1#1">#1</a></code></pre>') +
    reply(7, '<p>正文@magnorns<br> <a href="/post-123-1#1">#1</a></p>') +
    reply(8, '<p>正文<a href="https://example.com/member?t=magnorns">@magnorns</a> <a href="/post-123-1#1">#1</a></p>') +
    reply(9, '<p>正文@magnorns2 <a href="/post-123-1#1">#1</a></p>') +
    reply(10, '<p>同时回复@magnorns <a href="/post-123-1#1">#1</a> 和@wandu <a href="/post-123-1#2">#2</a></p>') +
    reply(11, '<p>正文@magnorns</p>') +
    reply(12, '<p>参见 <a href="/post-123-1#1">#1</a></p>'));
  for (const floor of ['3','4','5','6','7','8','9','10','11','12']) {
    assert.equal(d.getElementById(floor).dataset.nstDepth, '0', `floor ${floor}`);
  }
});

test('wrapped leading reply headers never hide the message contained in the same wrapper',async t=>{
  const {d}=await setup(t,reply(1,'parent')+reply(2,`<p><span>${ref(1)}<strong>必须保留的正文</strong></span></p>`));
  const child=d.getElementById('2');assert.equal(child.dataset.nstDepth,'1');
  assert.equal(child.querySelector('strong').closest('.nst-reply-prefix'),null);
  mode(d,'quote');assert.match(child.querySelector('.post-content').textContent,/必须保留的正文/);
});

test('ignores ordinary references, separated mentions, quoted pairs and ambiguous reply targets',async t=>{
  const {d}=await setup(t,reply(1,'one')+reply(2,'two')+
    reply(3,'<p>参见 <a href="/post-123-1#1">#1</a></p>')+
    reply(4,'<p>正文 <a href="/member?t=User1">@User1</a> 提到的 <a href="/post-123-1#1">#1</a></p>')+
    reply(5,`<p>正文</p><blockquote><p>${ref(1)}引用</p></blockquote>`)+
    reply(6,`<p>正文</p><pre><code>${ref(1)}</code></pre>`)+
    reply(7,'<p>正文 <a href="https://example.com/member?t=User1">@User1</a> <a href="/post-123-1#1">#1</a></p>')+
    reply(8,`<p>同时回复 ${ref(1)}和 ${ref(2)}</p>`)+
    reply(9,`<p>正文 <code>${ref(1)}</code></p>`)+
    reply(10,`<p>正文 ${ref(1,'999')}</p>`));
  for(const id of ['3','4','5','6','7','8','9','10'])assert.equal(d.getElementById(id).dataset.nstDepth,'0',`floor ${id}`);
});

test('keeps cross-page parents as explicit links without inventing local nesting', async t => {
  const { d } = await setup(t, reply(11, `<p>${ref(2, '123', 1)}cross page</p>`), { url: 'https://www.nodeseek.com/post-123-2' });
  assert.equal(d.getElementById('11').dataset.nstDepth, '0');
  const link = d.querySelector('#\\31 1 .nst-relation a');
  assert.ok(link);
  assert.equal(link.getAttribute('href'), '/post-123-1#2');
});

test('quote mode shows a safe parent excerpt and raw mode restores exact card styles', async t => {
  const oldStyle = 'margin-left: 7px !important; order: 9;';
  const { d } = await setup(t, reply(1, '<p>父评论 <img alt="图片说明" src="/x.png"></p>') + reply(2, `<p>${ref(1)}answer</p>`, 'User2', oldStyle));
  mode(d, 'quote');
  assert.match(d.querySelector('.nst-auto-quote').textContent, /父评论/);
  assert.equal(d.querySelector('.nst-auto-quote img'), null);
  mode(d, 'raw');
  assert.equal(d.getElementById('2').getAttribute('style'), oldStyle);
  assert.equal(d.querySelector('.nst-auto-quote'), null);
  assert.equal(d.querySelector('ul.comments').classList.contains('nst-thread'), false);
  assert.ok(d.getElementById('2').querySelector('article a[href="/post-123-1#1"]'));
});

test('rejects self references and future floors', async t => {
  const { d } = await setup(t, reply(1, `<p>${ref(1)}self</p>`) + reply(2, `<p>${ref(3)}future</p>`) + reply(3, 'three'));
  assert.equal(d.getElementById('1').dataset.nstDepth, '0');
  assert.equal(d.getElementById('2').dataset.nstDepth, '0');
});

test('reprocesses dynamically added replies without duplicate UI', async t => {
  const { d } = await setup(t, reply(1, 'one'));
  d.querySelector('ul.comments').insertAdjacentHTML('beforeend', reply(2, `<p>${ref(1)}dynamic</p>`));
  await pause(180);
  assert.equal(d.getElementById('2').dataset.nstDepth, '1');
  assert.equal(d.querySelectorAll('.nst-modebar').length, 1);
  assert.equal(d.querySelectorAll('.nst-relation').length, 1);
});

test('highlights only new replies on a previously visited page', async t => {
  const storage = new Map();
  const first = await setup(t, reply(1, 'one'), { storage });
  first.w.dispatchEvent(new first.w.Event('pagehide'));
  const second = await setup(t, reply(1, 'one') + reply(2, 'new'), { storage });
  assert.equal(second.d.getElementById('1').classList.contains('nst-new'), false);
  assert.equal(second.d.getElementById('2').classList.contains('nst-new'), true);
  const third = await setup(t, reply(11, 'first visit of page two'), { storage, url:'https://www.nodeseek.com/post-123-2' });
  assert.equal(third.d.getElementById('11').classList.contains('nst-new'), false);
});

test('caps deep indentation without losing reply relationships', async t => {
  let cards = reply(1, 'root');
  for (let i=2; i<=12; i++) cards += reply(i, `<p>${ref(i-1)}deep</p>`);
  const { d } = await setup(t, cards);
  assert.equal(d.getElementById('12').dataset.nstDepth, '11');
  assert.ok(Number(d.getElementById('12').style.getPropertyValue('--nst-indent')) <= 4);
});

test('does not hide unrelated blockquotes in thread mode', async t => {
  const { d } = await setup(t, reply(1, 'one') + reply(2, `<p>${ref(1)}answer</p><blockquote>保留的文献引用</blockquote>`));
  assert.equal(d.querySelector('blockquote').textContent, '保留的文献引用');
  assert.equal(d.querySelector('blockquote').classList.contains('nst-auto-quote'), false);
});

test('reply to floor zero jumps to the visible topic instead of requesting a preview', async t => {
  const { d } = await setup(t, reply(1, `<p>${ref(0)}reply to topic</p>`));
  assert.equal(d.querySelector('.nst-relation button'), null);
  mode(d, 'quote');
  assert.match(d.querySelector('.nst-auto-quote').textContent, /主题正文/);
});

test('cross-page preview renders text only and can be collapsed', async t => {
  let calls = 0;
  const fetch = async () => { calls++; return {ok:true,url:'https://www.nodeseek.com/post-123-1', text:async()=>`<ul class="comments">${reply(2, '<p>远端父评论<img src=x onerror="alert(1)"></p><script>alert(1)</script>')}</ul>`}; };
  const { d } = await setup(t, reply(11, `<p>${ref(2)}cross page</p>`), {url:'https://www.nodeseek.com/post-123-2', fetch});
  d.querySelector('.nst-relation button').click(); await pause(180);
  assert.match(d.querySelector('.nst-auto-quote').textContent,/远端父评论/);
  assert.equal(d.querySelector('.nst-auto-quote img,.nst-auto-quote script'),null);
  assert.doesNotMatch(d.querySelector('.nst-auto-quote').textContent,/alert/);
  d.querySelector('.nst-relation button').click();
  assert.equal(d.querySelector('.nst-auto-quote'),null);
  d.querySelector('.nst-relation button').click(); await pause(30);
  assert.equal(calls,1);
});

test('a challenge page reports preview failure without inserting remote markup', async t => {
  const { d } = await setup(t, reply(11, `<p>${ref(2)}cross page</p>`), {url:'https://www.nodeseek.com/post-123-2', fetch:async()=>({ok:true,text:async()=>'<h1>Just a moment</h1>'})});
  d.querySelector('.nst-relation button').click(); await pause(30);
  assert.equal(d.querySelector('.nst-auto-quote'),null);
  assert.equal(d.querySelector('.nst-relation button').textContent,'重试预览');
});

test('leaving the topic restores styles and removes the controls', async t => {
  const oldStyle = 'padding: 3px;';
  const { w, d } = await setup(t, reply(1,'one','User1',oldStyle) + reply(2,`<p>${ref(1)}child</p>`));
  w.history.pushState({},'', '/categories/daily'); w.dispatchEvent(new w.PopStateEvent('popstate')); await pause(140);
  assert.equal(d.querySelector('.nst-modebar'),null);
  assert.equal(d.getElementById('1').getAttribute('style'),oldStyle);
  assert.equal(d.querySelector('.nst-relation'),null);
});

test('checking for new replies requires explicit user action and preserves native nodes', async t => {
  let calls = 0;
  const fetch = async () => { calls++; return {ok:true,text:async()=>`<ul class="comments">${reply(1,'one')}${reply(2,'new')}</ul>`}; };
  const { d } = await setup(t,reply(1,'one'),{fetch});
  assert.equal(calls,0);
  const card = d.getElementById('1');
  [...d.querySelectorAll('.nst-modebar button')].find(n=>n.textContent==='检查新回复').click(); await pause(30);
  assert.equal(calls,1);
  assert.ok([...d.querySelectorAll('.nst-modebar button')].some(n=>n.textContent==='发现 1 条 · 刷新'));
  assert.equal(d.getElementById('1'),card);
  assert.equal(d.getElementById('2'),null);
});

test('scrolling preserves existing connector nodes when layout has not changed', async t => {
  const { w, d } = await setup(t,reply(1,'one') + reply(2,`<p>${ref(1)}child</p>`),{geometry:true});
  const path = d.querySelector('.nst-connectors path');
  assert.ok(path);
  w.dispatchEvent(new w.Event('scroll')); await pause(40);
  assert.equal(d.querySelector('.nst-connectors path'),path);
});

const pager = page => `<div class="nsk-pager post-bottom-pager"><div aria-label="pagination"><a rel="next" href="/post-123-${page}">${page}</a></div></div>`;
test('scrolling to the end loads the next page once, deduplicates pins and joins reply ancestry', async t => {
  let calls=0, resolve;
  const response = new Promise(r=>resolve=r);
  const { d, bottom } = await setup(t,reply(1,'root'),{pagination:pager(2),fetch:()=>{calls++;return response;}});
  bottom(); bottom();
  assert.equal(calls,1);
  resolve({ok:true,url:'https://www.nodeseek.com/post-123-2',text:async()=>`<ul class="comments">${reply(1,'pinned')}${reply(11,`<p>${ref(1)}next-page reply</p>`)}</ul>`});
  await pause(180);
  assert.equal(d.querySelectorAll('[id="1"]').length,1);
  assert.equal(d.getElementById('11')?.dataset.nstDepth,'1');
  assert.equal(d.getElementById('11').classList.contains('nst-new'),false);
  assert.equal(d.getElementById('11').querySelector('.floor-link').getAttribute('href'),'/post-123-2#11');
  bottom(); await pause(30); assert.equal(calls,1);
  assert.match(d.querySelector('.nst-auto-load').textContent,/全部|末尾/);
});

test('loading failure keeps existing comments and can retry on a later scroll', async t => {
  let calls=0;
  const { w,d,bottom } = await setup(t,reply(1,'keep'),{pagination:pager(2),fetch:async()=>{calls++;return {ok:false,status:503};}});
  bottom(); await pause(30);
  assert.equal(d.getElementById('1').querySelector('article').textContent,'keep');
  assert.match(d.querySelector('.nst-auto-load').textContent,/失败/);
  bottom(); assert.equal(calls,1);
  const now=w.Date.now(); w.Date.now=()=>now+10000;
  w.dispatchEvent(new w.Event('scroll')); bottom(); await pause(30);
  assert.equal(calls,2);
});

test('a late pagination response does not append to a different route', async t => {
  let resolve;
  const {w,d,bottom}=await setup(t,reply(1,'one'),{pagination:pager(2),fetch:()=>new Promise(r=>resolve=r)});
  bottom();
  w.history.pushState({},'','/categories/daily'); w.dispatchEvent(new w.PopStateEvent('popstate')); await pause(130);
  resolve({ok:true,text:async()=>`<ul class="comments">${reply(11,'late')}</ul>`}); await pause(60);
  assert.equal(d.getElementById('11'),null);
  assert.equal(d.querySelector('.nst-auto-load'),null);
});

test('fixes the original editor, expands on reply and preserves draft and submit listener', async t => {
  const {d}=await setup(t,reply(1,'one'),{editor:true});
  const editor=d.getElementById('editor'), draft=d.querySelector('.draft');
  assert.ok(editor.classList.contains('nst-fixed-editor'));
  assert.ok(d.querySelector('.nst-editor-spacer'));
  d.querySelector('.native-reply').click(); await pause(30);
  assert.equal(editor.classList.contains('nst-editor-collapsed'),false);
  assert.equal(d.querySelector('.draft'),draft);
  assert.equal(draft.value,'未写完的草稿');
  let submits=0;d.querySelector('.submit').onclick=()=>submits++;
  d.querySelector('.nst-editor-toggle').click();d.querySelector('.nst-editor-toggle').click();
  d.querySelector('.submit').click();assert.equal(submits,1);
});

test('newly loaded reply uses the same native editor and keeps existing draft content', async t => {
  const {d,bottom}=await setup(t,reply(1,'root'),{editor:true,pagination:pager(2),fetch:async()=>({ok:true,text:async()=>`<ul class="comments">${reply(11,'loaded')}</ul>`}),init:w=>{
    w.__config__={postData:{postId:123,comments:[]}};
    w.editor={reply(i){w.document.querySelector('.draft').value+=` @${w.__config__.postData.comments[i].poster.name}`;},quote(){}};
  }});
  bottom();await pause(150);
  const card=d.getElementById('11');assert.ok(card);
  [...card.querySelectorAll('button,.menu-item')].find(n=>n.textContent.trim()==='回复').click();await pause(30);
  assert.match(d.querySelector('.draft').value,/未写完的草稿.*@User11/);
  assert.equal(d.getElementById('editor').classList.contains('nst-editor-collapsed'),false);
});

test('appended HTML is sanitized and its unsafe menu is replaced with working actions', async t => {
  const {d,bottom}=await setup(t,reply(1,'one'),{pagination:pager(2),fetch:async()=>({ok:true,text:async()=>`<ul class="comments">${reply(11,'<p onclick="evil()">safe<img src=x onerror="evil()"><script>evil()</script><a href="javascript:evil()">bad</a></p>')}</ul>`})});
  bottom();await pause(150);
  const card=d.getElementById('11');assert.ok(card);
  assert.equal(card.querySelector('script,[onclick],[onerror],[href^="javascript:"]'),null);
  assert.ok([...card.querySelectorAll('button')].some(b=>b.textContent==='回复'));
});

test('continues loading while a short or duplicate-only page leaves the sentinel in view', async t => {
  const calls=[];
  const {d,bottom}=await setup(t,reply(1,'root'),{pagination:pager(2),fetch:async url=>{
    calls.push(url);
    const page=Number(url.match(/-(\d+)$/)[1]);
    return {ok:true,text:async()=>`<ul class="comments">${page===2?reply(1,'duplicate pinned'):reply(21,'last page')}</ul>${page===2?pager(3):''}`};
  }});
  bottom(); await pause(220);
  assert.deepEqual(calls,['/post-123-2','/post-123-3']);
  assert.ok(d.getElementById('21'));
  assert.equal(d.querySelectorAll('[id="1"]').length,1);
});

test('reuses native menus with the imported metadata index and releases them on navigation', async t => {
  const imported={floorIndex:11,commentId:1011,poster:{name:'Imported'},markdown:'original markdown',time:{createdDate:'2026-10-21',editedDate:null}};
  let mounted=0,destroyed=0,replyIndex=-1;
  const {w,d,bottom}=await setup(t,reply(1,'root'),{editor:true,pagination:pager(2),fetch:async()=>({ok:true,text:async()=>`<ul class="comments">${reply(11,'loaded')}</ul><script>window.__config__=${JSON.stringify({postData:{postId:123,comments:[imported]}})};</script>`}),init:w=>{
    w.__config__={postData:{postId:123,comments:[{floorIndex:1,commentId:1001}]}};
    w.editor={reply(i){replyIndex=i;}};
    class Menu {
      setIndex(i){this.index=i;assert.equal(w.__config__.postData.comments[i].markdown,'original markdown');}
      $mount(node){mounted++;node.className='comment-menu';const b=w.document.createElement('button');b.textContent='回复';b.onclick=()=>w.editor.reply(this.index);node.append(b);}
      $destroy(){destroyed++;}
    }
    w.document.querySelector('.comment-menu').__vue__={constructor:Menu,$options:{}};
  }});
  bottom();await pause(150);
  assert.equal(mounted,1);
  d.getElementById('11').querySelector('button').click();assert.equal(replyIndex,1);
  assert.equal(w.__config__.postData.comments.length,2);
  w.history.pushState({},'','/categories/daily');w.dispatchEvent(new w.PopStateEvent('popstate'));await pause(150);
  assert.equal(destroyed,1);assert.equal(w.__config__.postData.comments.length,1);
  assert.equal(d.getElementById('editor').classList.contains('nst-fixed-editor'),false);
  assert.equal(d.querySelector('.draft').value,'未写完的草稿');
});

test('branch folding preserves independent nested state and native reply and quote handlers', async t => {
  let original, nativeReply, nativeQuote;
  const actions = [];
  const { w, d } = await setup(t, reply(1,'root') + reply(2,ref(1)+'child') + reply(3,ref(2)+'grandchild') + reply(4,ref(1)+'sibling') + reply(5,'independent root'), {init:w=>{
    original=w.document.getElementById('3');
    nativeReply=original.querySelector('.native-reply');
    nativeReply.addEventListener('click',()=>actions.push('reply'));
    nativeQuote=w.document.createElement('button'); nativeQuote.textContent='引用';
    nativeQuote.addEventListener('click',()=>actions.push('quote'));
    original.querySelector('.comment-menu').append(nativeQuote);
  }});
  const root=branchToggle(d,1), nested=branchToggle(d,2);
  assert.equal(root.type,'button'); assert.equal(nested.type,'button');
  assert.equal(root.getAttribute('aria-expanded'),'true');
  const count=root.querySelector('.nst-branch-count'); assert.ok(count);
  assert.ok(count.hidden || w.getComputedStyle(count).display==='none','expanded branches hide the folded count');
  for(const id of [3,4,5]) assert.equal(d.getElementById(String(id)).querySelector('.nst-branch-toggle'),null,'leaf comments have no fold control');
  nested.click();
  assert.deepEqual(hiddenFloors(d),[3]);
  assert.equal(branchToggle(d,2).getAttribute('aria-expanded'),'false');
  branchToggle(d,1).click();
  assert.deepEqual(hiddenFloors(d),[2,3,4]);
  assert.equal(d.getElementById('1').classList.contains('nst-branch-collapsed'),true);
  assert.equal(w.getComputedStyle(d.getElementById('1')).display==='none',false,'the parent remains visible');
  assert.equal(w.getComputedStyle(d.getElementById('3')).display,'none','hidden descendants are actually removed from layout');
  assert.equal(branchToggle(d,1).querySelector('.nst-branch-count').textContent.trim(),'另外 3 条回复');
  assert.notEqual(w.getComputedStyle(branchToggle(d,1).querySelector('.nst-branch-count')).display,'none');
  branchToggle(d,1).click();
  assert.deepEqual(hiddenFloors(d),[3]);
  assert.equal(branchToggle(d,2).getAttribute('aria-expanded'),'false','reopening the parent preserves the nested fold');
  branchToggle(d,2).click();
  assert.deepEqual(hiddenFloors(d),[]);
  assert.equal(d.getElementById('3'),original);
  assert.equal(original.querySelector('.native-reply'),nativeReply);
  assert.ok(original.contains(nativeQuote));
  nativeReply.click(); nativeQuote.click();
  assert.deepEqual(actions,['reply','quote']);
  assert.equal(d.querySelectorAll('ul.comments > li.content-item').length,5,'native comments remain direct list children');
});

test('branch folding survives dynamic descendants and updates the total hidden reply count', async t => {
  const { d } = await setup(t,reply(1,'root') + reply(2,ref(1)+'child') + reply(3,'independent'));
  const original=d.getElementById('1');
  branchToggle(d,1).click();
  d.querySelector('ul.comments').insertAdjacentHTML('beforeend',reply(4,ref(2)+'new grandchild') + reply(5,ref(1)+'new sibling'));
  await pause(180);
  assert.deepEqual(hiddenFloors(d),[2,4,5]);
  assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'false');
  assert.equal(branchToggle(d,1).querySelector('.nst-branch-count').textContent.trim(),'另外 3 条回复');
  assert.equal(d.getElementById('1'),original);
  assert.equal(original.querySelectorAll('.nst-branch-toggle').length,1);
  branchToggle(d,1).click();
  assert.deepEqual(hiddenFloors(d),[]);
  assert.equal(branchToggle(d,2).getAttribute('aria-expanded'),'true');
});

test('branch folding includes newly loaded page descendants without hiding another root', async t => {
  const { d, bottom } = await setup(t,reply(1,'root') + reply(2,ref(1)+'child'), {pagination:pager(2),fetch:async()=>({ok:true,text:async()=>`<ul class="comments">${reply(1,'pinned duplicate')}${reply(11,ref(2)+'new grandchild')}${reply(12,ref(1)+'new sibling')}${reply(13,'independent root')}</ul>`})});
  const original=d.getElementById('2');
  branchToggle(d,1).click(); bottom(); await pause(180);
  assert.deepEqual(hiddenFloors(d),[2,11,12]);
  assert.equal(branchToggle(d,1).querySelector('.nst-branch-count').textContent.trim(),'另外 3 条回复');
  assert.equal(d.getElementById('2'),original);
  assert.equal(d.querySelectorAll('[id="1"]').length,1);
  assert.equal(d.getElementById('13').classList.contains('nst-branch-hidden'),false);
  branchToggle(d,1).click();
  assert.deepEqual(hiddenFloors(d),[]);
  assert.equal(d.getElementById('11').dataset.nstDepth,'2');
});

test('branch folding is suspended in quote and raw modes and fully cleared on navigation', async t => {
  const rootStyle='padding: 3px;', childStyle='margin-left: 7px !important; order: 9;';
  const { w, d } = await setup(t,reply(1,'root','User1',rootStyle) + reply(2,ref(1)+'child','User2',childStyle) + reply(3,ref(2)+'grandchild'));
  const original=d.getElementById('2');
  branchToggle(d,2).click(); branchToggle(d,1).click();
  for(const value of ['quote','raw']) {
    mode(d,value);
    assert.equal(d.querySelector('.nst-branch-toggle,.nst-branch-hidden,.nst-branch-collapsed'),null);
    assert.equal(d.getElementById('1').getAttribute('style'),rootStyle);
    assert.equal(original.getAttribute('style'),childStyle);
    assert.equal(d.getElementById('2'),original);
    mode(d,'thread');
    assert.deepEqual(hiddenFloors(d),[2,3]);
    assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'false');
    assert.equal(branchToggle(d,2).getAttribute('aria-expanded'),'false');
  }
  w.history.pushState({},'','/categories/daily'); w.dispatchEvent(new w.PopStateEvent('popstate')); await pause(140);
  assert.equal(d.querySelector('.nst-branch-toggle,.nst-branch-hidden,.nst-branch-collapsed,.nst-connectors'),null);
  assert.equal(d.getElementById('1').getAttribute('style'),rootStyle);
  assert.equal(original.getAttribute('style'),childStyle);
  w.history.pushState({},'','/post-123-1'); w.dispatchEvent(new w.PopStateEvent('popstate')); await pause(140);
  assert.deepEqual(hiddenFloors(d),[]);
  assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'true','a fresh route does not inherit the previous route fold state');
});

test('branch folding follows all descendants beyond the visual indentation cap', async t => {
  let cards=reply(1,'root');
  for(let floor=2;floor<=12;floor++) cards+=reply(floor,ref(floor-1)+'deep reply');
  const { d } = await setup(t,cards+reply(13,'independent root'));
  assert.equal(d.getElementById('12').dataset.nstDepth,'11');
  assert.ok(Number(d.getElementById('12').style.getPropertyValue('--nst-indent'))<=4);
  branchToggle(d,11).click(); branchToggle(d,2).click();
  assert.deepEqual(hiddenFloors(d),[3,4,5,6,7,8,9,10,11,12]);
  assert.equal(branchToggle(d,2).querySelector('.nst-branch-count').textContent.trim(),'另外 10 条回复');
  branchToggle(d,2).click();
  assert.deepEqual(hiddenFloors(d),[12]);
  branchToggle(d,1).click();
  assert.deepEqual(hiddenFloors(d),[2,3,4,5,6,7,8,9,10,11,12]);
  assert.equal(branchToggle(d,1).querySelector('.nst-branch-count').textContent.trim(),'另外 11 条回复');
  assert.equal(d.getElementById('13').classList.contains('nst-branch-hidden'),false);
});

test('branch folding opens every ancestor before locating a new reply', async t => {
  const storage=new Map([['nst:page:123:1',{known:[1,2,4,5],pending:[]}]]);
  let scrolledTo=null, visibleAtScroll=false;
  const { d } = await setup(t,reply(1,'root') + reply(2,ref(1)+'child') + reply(3,ref(2)+'new grandchild') + reply(4,ref(1)+'sibling') + reply(5,'independent root'),{storage,init:w=>{
    w.HTMLElement.prototype.scrollIntoView=function(){scrolledTo=this.id;visibleAtScroll=!this.classList.contains('nst-branch-hidden') && w.getComputedStyle(this).display!=='none';};
  }});
  assert.equal(d.getElementById('3').classList.contains('nst-new'),true);
  branchToggle(d,2).click(); branchToggle(d,1).click();
  assert.deepEqual(hiddenFloors(d),[2,3,4]);
  d.querySelector('.nst-updates').click(); await pause(40);
  assert.equal(scrolledTo,'3');
  assert.equal(visibleAtScroll,true,'the target is revealed before scrolling');
  assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'true');
  assert.equal(branchToggle(d,2).getAttribute('aria-expanded'),'true');
  assert.deepEqual(hiddenFloors(d),[]);
  assert.equal(d.getElementById('3').classList.contains('nst-new'),false);
});

test('branch folding removes hidden SVG connections while preserving visible branches', async t => {
  const { d } = await setup(t,reply(1,'root') + reply(2,ref(1)+'child') + reply(3,ref(2)+'grandchild') + reply(4,ref(1)+'sibling') + reply(5,'independent root') + reply(6,ref(5)+'other child'),{geometry:true});
  const initial=d.querySelectorAll('.nst-connectors path').length;
  assert.ok(initial>1);
  branchToggle(d,1).click(); await pause(40);
  const remaining=d.querySelectorAll('.nst-connectors path').length;
  assert.ok(remaining>0 && remaining<initial,'only visible branches retain connector paths');
  branchToggle(d,5).click(); await pause(40);
  assert.equal(d.querySelectorAll('.nst-connectors path').length,0,'no paths remain when every child is hidden');
  branchToggle(d,1).click(); await pause(40);
  assert.ok(d.querySelectorAll('.nst-connectors path').length>0,'expanding a branch restores its connections');
  assert.equal(d.getElementById('6').classList.contains('nst-branch-hidden'),true,'the other branch stays folded');
});

test('branch folding reveals a hashchange target without opening an unrelated branch', async t => {
  const { w, d } = await setup(t,reply(1,'root') + reply(2,ref(1)+'child') + reply(3,ref(2)+'target') + reply(4,'other root') + reply(5,ref(4)+'other child'));
  branchToggle(d,2).click(); branchToggle(d,1).click(); branchToggle(d,4).click();
  assert.deepEqual(hiddenFloors(d),[2,3,5]);
  w.location.hash='#3'; await pause(140);
  assert.equal(w.location.hash,'#3');
  assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'true');
  assert.equal(branchToggle(d,2).getAttribute('aria-expanded'),'true');
  assert.equal(branchToggle(d,4).getAttribute('aria-expanded'),'false');
  assert.deepEqual(hiddenFloors(d),[5]);
});

test('branch folding reveals a custom floor event target without opening an unrelated branch', async t => {
  const { w, d } = await setup(t,reply(1,'root') + reply(2,ref(1)+'child') + reply(3,ref(2)+'target') + reply(4,'other root') + reply(5,ref(4)+'other child'));
  branchToggle(d,2).click(); branchToggle(d,1).click(); branchToggle(d,4).click();
  assert.deepEqual(hiddenFloors(d),[2,3,5]);
  d.dispatchEvent(new w.CustomEvent('nsit:reveal-floor',{detail:{floor:3}})); await pause(40);
  assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'true');
  assert.equal(branchToggle(d,2).getAttribute('aria-expanded'),'true');
  assert.equal(branchToggle(d,4).getAttribute('aria-expanded'),'false');
  assert.deepEqual(hiddenFloors(d),[5]);
});

test('branch folding reveals repeated clicks on a link whose hash is already current', async t => {
  const { w, d } = await setup(t,reply(1,'root') + reply(2,ref(1)+'child') + reply(3,ref(2)+'target'),{url:'https://www.nodeseek.com/post-123-1#3',init:w=>{
    w.document.getElementById('0').querySelector('article').insertAdjacentHTML('beforeend','<a id="jump-again" href="#3">查看 #3</a>');
  }});
  const link=d.getElementById('jump-again');
  let hashChanges=0; w.addEventListener('hashchange',()=>hashChanges++);
  for(let attempt=0;attempt<2;attempt++) {
    branchToggle(d,2).click(); branchToggle(d,1).click();
    assert.deepEqual(hiddenFloors(d),[2,3]);
    link.click(); await pause(140);
    assert.equal(w.location.hash,'#3');
    assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'true');
    assert.equal(branchToggle(d,2).getAttribute('aria-expanded'),'true');
    assert.deepEqual(hiddenFloors(d),[],'clicking the existing hash reveals its target again');
    assert.equal(d.getElementById('jump-again'),link);
  }
  assert.equal(hashChanges,0,'same-hash links need a click handler because hashchange does not fire');
});

test('floor navigation preserves the original-page action for newly loaded comments', async t => {
  const { w, d, bottom } = await setup(t,reply(1,'root'),{pagination:pager(2),fetch:async()=>({ok:true,text:async()=>`<ul class="comments">${reply(11,'loaded')}</ul>`})});
  bottom(); await pause(180);
  const link=d.getElementById('11').querySelector('.nst-loaded-menu a');
  assert.equal(link.textContent,'原页操作');
  assert.equal(link.target,'_blank');
  const click=new w.MouseEvent('click',{bubbles:true,cancelable:true,button:0});
  link.dispatchEvent(click);
  assert.equal(click.defaultPrevented,false,'the original-page action must open its native page in a new tab');
  assert.equal(d.getElementById('11').classList.contains('nst-focus'),false,'opening the original page must not become an in-page jump');
});

test('floor navigation preserves explicit frame targets and download links', async t => {
  const { w, d } = await setup(t,reply(1,'root'),{init:w=>{
    w.document.getElementById('0').querySelector('article').insertAdjacentHTML('beforeend','<a id="frame-link" href="#1" target="reply-details">打开详情</a><a id="download-link" href="#1" download="reply.html">下载</a>');
  }});
  for(const id of ['frame-link','download-link']) {
    const click=new w.MouseEvent('click',{bubbles:true,cancelable:true,button:0});
    d.getElementById(id).dispatchEvent(click);
    assert.equal(click.defaultPrevented,false,`${id} retains the action selected by its native attributes`);
    assert.equal(d.getElementById('1').classList.contains('nst-focus'),false);
  }
});

test('thread preferences collapse all branches when the setting is absent or enabled', async t => {
  for(const defaultCollapsed of [null,true]) {
    await t.test(defaultCollapsed===null?'missing settings':'enabled setting', async t => {
      const { d } = await setup(t,reply(1,'root') + reply(2,ref(1)+'child') + reply(3,ref(2)+'grandchild') + reply(4,ref(1)+'sibling') + reply(5,'independent root'),{defaultCollapsed});
      assert.deepEqual(hiddenFloors(d),[2,3,4]);
      assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'false');
      assert.equal(branchToggle(d,2).getAttribute('aria-expanded'),'false');
      assert.equal(branchToggle(d,1).querySelector('.nst-branch-count').textContent.trim(),'另外 3 条回复');
      branchToggle(d,1).click();
      assert.deepEqual(hiddenFloors(d),[3],'nested branches also start folded');
      assert.equal(d.getElementById('5').classList.contains('nst-branch-hidden'),false);
    });
  }
});

test('thread preferences keep existing and newly created branches expanded when disabled', async t => {
  const { d } = await setup(t,reply(1,'root') + reply(2,ref(1)+'child'),{defaultCollapsed:false});
  assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'true');
  assert.deepEqual(hiddenFloors(d),[]);
  d.querySelector('ul.comments').insertAdjacentHTML('beforeend',reply(3,ref(2)+'new grandchild'));
  await pause(180);
  assert.equal(branchToggle(d,2).getAttribute('aria-expanded'),'true');
  assert.deepEqual(hiddenFloors(d),[]);
});

test('thread preferences initialize new branches without refolding manually opened branches', async t => {
  const { d } = await setup(t,reply(1,'root') + reply(2,ref(1)+'child'),{defaultCollapsed:true});
  assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'false');
  branchToggle(d,1).click();
  d.getElementById('2').querySelector('.post-content').append(' edited'); await pause(180);
  assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'true','an ordinary DOM refresh retains the manual choice');
  d.querySelector('ul.comments').insertAdjacentHTML('beforeend',reply(3,ref(2)+'new grandchild') + reply(4,ref(1)+'new sibling'));
  await pause(180);
  assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'true');
  assert.equal(branchToggle(d,2).getAttribute('aria-expanded'),'false','a previous leaf adopts the default when it first gains a reply');
  assert.deepEqual(hiddenFloors(d),[3]);
  branchToggle(d,2).click();
  d.querySelector('ul.comments').insertAdjacentHTML('beforeend',reply(5,ref(2)+'another grandchild'));
  await pause(180);
  assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'true');
  assert.equal(branchToggle(d,2).getAttribute('aria-expanded'),'true');
  assert.deepEqual(hiddenFloors(d),[]);
});

test('thread preferences apply to newly loaded branches while preserving opened ancestors', async t => {
  const { d, bottom } = await setup(t,reply(1,'root') + reply(2,ref(1)+'child'),{defaultCollapsed:true,pagination:pager(2),fetch:async()=>({ok:true,text:async()=>`<ul class="comments">${reply(11,ref(2)+'new child')}${reply(12,ref(11)+'deep child')}${reply(13,'new root')}${reply(14,ref(13)+'new root child')}</ul>`})});
  assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'false');
  branchToggle(d,1).click(); bottom(); await pause(180);
  assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'true');
  for(const floor of [2,11,13]) assert.equal(branchToggle(d,floor).getAttribute('aria-expanded'),'false');
  assert.deepEqual(hiddenFloors(d),[11,12,14]);
  branchToggle(d,2).click();
  assert.deepEqual(hiddenFloors(d),[12,14]);
});

test('thread preferences immediately apply saved changes to every current branch', async t => {
  const { w, d, storage } = await setup(t,reply(1,'root') + reply(2,ref(1)+'child') + reply(3,ref(2)+'grandchild') + reply(4,'other root') + reply(5,ref(4)+'other child'),{defaultCollapsed:false});
  branchToggle(d,1).click();
  storage.set('nsit-auto-settings-v1',{threadDefaultCollapsed:true});
  d.dispatchEvent(new w.CustomEvent('nsit:thread-default-changed')); await pause(40);
  for(const floor of [1,2,4]) assert.equal(branchToggle(d,floor).getAttribute('aria-expanded'),'false');
  assert.deepEqual(hiddenFloors(d),[2,3,5]);
  storage.set('nsit-auto-settings-v1',{threadDefaultCollapsed:false});
  d.dispatchEvent(new w.CustomEvent('nsit:thread-default-changed')); await pause(40);
  for(const floor of [1,2,4]) assert.equal(branchToggle(d,floor).getAttribute('aria-expanded'),'true');
  assert.deepEqual(hiddenFloors(d),[]);
});

test('thread preferences changed in quote or raw mode take effect on returning to threads', async t => {
  const { w, d, storage } = await setup(t,reply(1,'root') + reply(2,ref(1)+'child') + reply(3,ref(2)+'grandchild'),{defaultCollapsed:false});
  mode(d,'quote');
  storage.set('nsit-auto-settings-v1',{threadDefaultCollapsed:true});
  d.dispatchEvent(new w.CustomEvent('nsit:thread-default-changed')); await pause(40);
  assert.deepEqual(hiddenFloors(d),[]);
  assert.equal(d.querySelector('.nst-branch-toggle'),null);
  mode(d,'thread');
  assert.deepEqual(hiddenFloors(d),[2,3]);
  assert.equal(branchToggle(d,2).getAttribute('aria-expanded'),'false');
  mode(d,'raw');
  storage.set('nsit-auto-settings-v1',{threadDefaultCollapsed:false});
  d.dispatchEvent(new w.CustomEvent('nsit:thread-default-changed')); await pause(40);
  assert.deepEqual(hiddenFloors(d),[]);
  assert.equal(d.querySelector('.nst-branch-toggle'),null);
  mode(d,'thread');
  assert.deepEqual(hiddenFloors(d),[]);
  assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'true');
  assert.equal(branchToggle(d,2).getAttribute('aria-expanded'),'true');
});

test('thread preferences preserve manual choices across modes and reapply them on a new page', async t => {
  const { w, d } = await setup(t,reply(1,'root') + reply(2,ref(1)+'child') + reply(3,ref(2)+'grandchild'),{defaultCollapsed:true});
  assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'false');
  branchToggle(d,1).click();
  assert.deepEqual(hiddenFloors(d),[3]);
  for(const value of ['quote','raw']) {
    mode(d,value);
    assert.deepEqual(hiddenFloors(d),[]);
    assert.equal(d.querySelector('.nst-branch-toggle'),null);
    mode(d,'thread');
    assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'true');
    assert.equal(branchToggle(d,2).getAttribute('aria-expanded'),'false');
    assert.deepEqual(hiddenFloors(d),[3]);
  }
  w.history.pushState({},'','/post-123-2'); w.dispatchEvent(new w.PopStateEvent('popstate')); await pause(140);
  assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'false');
  assert.equal(branchToggle(d,2).getAttribute('aria-expanded'),'false');
  assert.deepEqual(hiddenFloors(d),[2,3]);
});

test('thread preferences reveal an initial hash once without undoing later manual folds', async t => {
  const scrolls=[];
  const { d } = await setup(t,reply(1,'root') + reply(2,ref(1)+'child') + reply(3,ref(2)+'target') + reply(4,'other root') + reply(5,ref(4)+'other child'),{defaultCollapsed:true,url:'https://www.nodeseek.com/post-123-1#3',init:w=>{
    w.HTMLElement.prototype.scrollIntoView=function(){scrolls.push({floor:this.id,visible:!this.classList.contains('nst-branch-hidden') && w.getComputedStyle(this).display!=='none'});};
  }});
  assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'true');
  assert.equal(branchToggle(d,2).getAttribute('aria-expanded'),'true');
  assert.equal(branchToggle(d,4).getAttribute('aria-expanded'),'false');
  assert.deepEqual(hiddenFloors(d),[5]);
  assert.ok(scrolls.some(entry=>entry.floor==='3' && entry.visible),'the initial hash target is revealed before scrolling');
  const initialScrollCount=scrolls.length;
  branchToggle(d,1).click();
  d.getElementById('4').querySelector('.post-content').append(' refreshed'); await pause(180);
  assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'false');
  assert.deepEqual(hiddenFloors(d),[2,3,5]);
  assert.equal(scrolls.length,initialScrollCount,'ordinary refresh does not process the initial hash again');
});

test('thread presentation hides only floor links while retaining native badges and controls', async t => {
  let link, wrapper, badge, clicked=0;
  const { w, d } = await setup(t,reply(1,'root') + reply(2,ref(1)+'child'),{init:w=>{
    wrapper=w.document.getElementById('1').querySelector('.floor-link-wrapper');
    link=wrapper.querySelector('.floor-link');
    badge=w.document.createElement('button'); badge.textContent='原生徽标'; badge.addEventListener('click',()=>clicked++); wrapper.append(badge);
  }});
  assert.equal(w.getComputedStyle(link).display,'none');
  assert.notEqual(w.getComputedStyle(wrapper).display,'none');
  assert.notEqual(w.getComputedStyle(badge).display,'none');
  badge.click(); assert.equal(clicked,1);
  for(const value of ['quote','raw']) {
    mode(d,value);
    assert.notEqual(w.getComputedStyle(link).display,'none');
    assert.equal(d.getElementById('1').querySelector('.floor-link'),link);
    assert.equal(link.getAttribute('href'),'#1');
    mode(d,'thread');
    assert.equal(w.getComputedStyle(link).display,'none');
  }
  w.history.pushState({},'','/categories/daily'); w.dispatchEvent(new w.PopStateEvent('popstate')); await pause(140);
  assert.notEqual(w.getComputedStyle(link).display,'none');
  badge.click(); assert.equal(clicked,2);
});

test('thread presentation retains parent authors and navigation without visible floor numbers', async t => {
  const { d } = await setup(t,reply(1,'root') + reply(2,ref(1)+'child') + reply(11,ref(8)+'cross-page child'));
  const local=d.getElementById('2').querySelector('.nst-relation a');
  assert.equal(local.textContent,'回复 User1');
  assert.equal(local.getAttribute('href'),'/post-123-1#1');
  const remote=d.getElementById('11').querySelector('.nst-relation a');
  assert.match(remote.textContent,/回复 User8/);
  assert.doesNotMatch(remote.textContent,/#8/);
  assert.equal(remote.getAttribute('href'),'/post-123-1#8');
  assert.ok(d.getElementById('11').querySelector('.nst-relation button'),'unloaded parents retain their preview action');
});

test('pending floor navigation locates a later-page target when its parent was already opened', async t => {
  const scrolls=[];
  const { d, bottom } = await setup(t,reply(1,'root') + reply(2,ref(1)+'existing child'),{defaultCollapsed:true,url:'https://www.nodeseek.com/post-123-1#11',pagination:pager(2),fetch:async()=>({ok:true,text:async()=>`<ul class="comments">${reply(11,ref(1)+'target')}</ul>`}),init:w=>{
    w.HTMLElement.prototype.scrollIntoView=function(){scrolls.push({floor:this.id,visible:!this.classList.contains('nst-branch-hidden')});};
  }});
  assert.deepEqual(scrolls,[],'an absent target cannot be scrolled to yet');
  branchToggle(d,1).click();
  assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'true');
  bottom(); await pause(180);
  assert.ok(d.getElementById('11'));
  assert.equal(d.getElementById('11').classList.contains('nst-branch-hidden'),false);
  assert.deepEqual(scrolls,[{floor:'11',visible:true}],'the pending target is located even without another ancestor state change');
  d.getElementById('1').querySelector('.post-content').append(' refreshed'); await pause(180);
  assert.deepEqual(scrolls,[{floor:'11',visible:true}],'the resolved initial hash is not replayed on refresh');
});

test('pending floor navigation retains a later hashchange until its hidden target is loaded', async t => {
  const scrolls=[];
  const { w, d, bottom } = await setup(t,reply(1,'root') + reply(2,ref(1)+'existing child'),{defaultCollapsed:true,pagination:pager(2),fetch:async()=>({ok:true,text:async()=>`<ul class="comments">${reply(11,ref(1)+'target')}</ul>`}),init:w=>{
    w.HTMLElement.prototype.scrollIntoView=function(){scrolls.push({floor:this.id,visible:!this.classList.contains('nst-branch-hidden')});};
  }});
  w.location.hash='#11'; await pause(140);
  assert.deepEqual(scrolls,[]);
  assert.equal(d.getElementById('11'),null);
  bottom(); await pause(180);
  assert.ok(d.getElementById('11'));
  assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'true');
  assert.equal(d.getElementById('11').classList.contains('nst-branch-hidden'),false);
  assert.deepEqual(scrolls,[{floor:'11',visible:true}]);
  branchToggle(d,1).click();
  d.getElementById('1').querySelector('.post-content').append(' refreshed'); await pause(180);
  assert.equal(branchToggle(d,1).getAttribute('aria-expanded'),'false','a later manual fold stays closed');
  assert.equal(d.getElementById('11').classList.contains('nst-branch-hidden'),true);
  assert.deepEqual(scrolls,[{floor:'11',visible:true}],'the completed navigation is not replayed');
});
