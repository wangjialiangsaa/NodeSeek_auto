const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const card=(floor,body)=>`<li class="content-item" id="${floor}" data-comment-id="${1000+floor}"><div class="nsk-content-meta-info"><div class="avatar-wrapper"><img class="avatar-normal"></div><a class="author-name">User${floor}</a><a class="floor-link" href="#${floor}">#${floor}</a></div><article class="post-content">${body}</article><div class="comment-menu"><button>回复</button></div></li>`;
async function setup(t,file,{url='https://www.nodeseek.com/post-123-1',fetch,flags={}}={}) {
  const dom=new JSDOM(`<html><head></head><body><header id="nsk-head"></header><main><ul class="comments">${card(1,'root')}${card(2,'<p><a href="/member?t=User1">@User1</a> <a href="/post-123-1#1">#1</a><br>child</p>')}</ul><div class="post-bottom-pager"><nav aria-label="pagination"><a rel="next" href="/post-123-2">下一页</a></nav></div><div id="editor"><div class="md-editor"><div id="editor-body"><div class="window_header"><a href="https://www.runoob.com/markdown/md-tutorial.html">Markdown</a></div><div class="CodeMirror"></div></div><div class="topic-select"><button class="submit">发布评论</button></div></div></div></main></body></html>`,{url,runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document,menus=new Map(),intersections=[];
  const observers=[],NativeObserver=w.MutationObserver;
  w.MutationObserver=class extends NativeObserver{constructor(callback){super(callback);observers.push(this);}};
  t.after(()=>{observers.forEach(o=>o.disconnect());w.close();});
  const storage=new Map();
  w.GM_getValue=(key,fallback)=>storage.has(key)?storage.get(key):fallback;
  w.GM_setValue=(key,value)=>storage.set(key,value);
  w.GM_registerMenuCommand=(name,fn)=>menus.set(name,fn);
  w.GM_addStyle=css=>{const s=d.createElement('style');s.textContent=css;d.head.append(s);return s;};
  w.GM_xmlhttpRequest=options=>{queueMicrotask(()=>options.onerror?.({status:503}));return {abort(){}};};
  w.fetch=fetch|| (async()=>({ok:false,status:503,json:async()=>({})}));
  w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  w.IntersectionObserver=class{constructor(callback){this.callback=callback;intersections.push(this);}observe(target){this.target=target;}disconnect(){this.target=null;}};
  w.__config__={postData:{postId:123,comments:[{floorIndex:1,commentId:1001},{floorIndex:2,commentId:1002}]}};
  let draft='existing draft';
  const cm={getValue:()=>draft,setValue:value=>{draft=value;},refresh(){},focus(){},setSize(){},on(){}};
  d.querySelector('.CodeMirror').CodeMirror=cm;
  w.editor={reply(i){draft+=` @${w.__config__.postData.comments[i].poster.name}`;},quote(){}};
  w.localStorage.setItem('nsit-feature-flags-v1',JSON.stringify(flags));
  const editor=d.getElementById('editor');
  w.eval(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
  await pause(180);
  return {w,d,editor,cm,menus,bottom(){for(const o of intersections)if(o.target)o.callback([{target:o.target,isIntersecting:true}]);}};
}

for(const file of ['NodeSeek Issue Templates.user.js','NodeSeek Issue Templates.min.user.js']) {
  test(`${file}: templates, threaded reading and native editor coexist`,async t=>{
    const {d,editor,cm,menus}=await setup(t,file);
    assert.ok(d.querySelector('.nsit-trigger'));
    assert.ok(d.querySelector('.nsit-buy-trigger'));
    const tools=d.querySelector('[data-nsit-tools-toggle]'),panel=d.querySelector('[data-nsit-tools-panel]');
    assert.ok(tools);assert.equal(panel.hidden,true);
    assert.ok(panel.contains(d.querySelector('.nsit-image-trigger')));
    tools.click();assert.equal(panel.hidden,false);
    panel.querySelector('.nsit-auto-open').click();assert.equal(panel.hidden,true);
    const taskDialog=d.querySelector('[data-nsit-auto-dialog]');assert.equal(taskDialog.hidden,false);
    assert.equal(taskDialog.querySelector('[name="replyText"]').value,'');
    assert.equal(taskDialog.querySelector('[name="autoReply"]').checked,false);
    taskDialog.querySelector('[data-nsit-auto-close]').click();
    assert.equal(typeof menus.get('自动任务设置'),'function');
    tools.click();panel.querySelector('.nsit-trigger:not(.nsit-buy-trigger):not(.nsit-calc-trigger)').click();
    assert.equal(panel.hidden,true);assert.ok(d.getElementById('nsit-app').classList.contains('nsit-open'));
    d.querySelector('.nsit-shell [data-action="close"]').click();
    assert.equal(d.getElementById('nsit-app').classList.contains('nsit-open'),false);
    assert.ok(d.querySelector('.nst-modebar'));
    assert.equal(d.getElementById('2').dataset.nstDepth,'1');
    d.getElementById('2').querySelector('.post-content').innerHTML='<p><strong>正文保留</strong>，句末回复 <a href="/member?t=User1">@User1</a> <a href="/post-123-1#1">#1</a></p>';
    await pause(160);
    assert.equal(d.getElementById('2').dataset.nstDepth,'1');
    assert.equal(d.getElementById('2').querySelector('strong').closest('.nst-reply-prefix'),null);
    assert.equal(d.getElementById('editor'),editor);
    assert.ok(editor.classList.contains('nst-fixed-editor'));
    assert.equal(cm.getValue(),'existing draft');
    menus.get('功能开关')();
    assert.equal(editor.classList.contains('nst-editor-collapsed'),false);
    const flag=d.querySelector('[data-nsit-flag="threadedReading"]');assert.ok(flag);
    flag.checked=false;flag.dispatchEvent(new d.defaultView.Event('change',{bubbles:true}));await pause(120);
    assert.equal(d.querySelector('.nst-modebar'),null);
    assert.equal(editor.classList.contains('nst-fixed-editor'),false);
    assert.equal(d.querySelector('.post-bottom-pager').classList.contains('nst-pagination-hidden'),false);
    assert.equal(cm.getValue(),'existing draft');
    assert.ok(d.querySelector('.nsit-trigger'));
    flag.checked=true;flag.dispatchEvent(new d.defaultView.Event('change',{bubbles:true}));await pause(120);
    assert.equal(d.querySelectorAll('.nst-modebar').length,1);
    assert.equal(d.querySelectorAll('.nst-editor-head').length,1);
  });
}

test('integrated auto pagination deduplicates and replies through the existing editor',async t=>{
  const {d,editor,cm,bottom}=await setup(t,'NodeSeek Issue Templates.user.js',{fetch:async()=>({ok:true,text:async()=>`<ul class="comments">${card(1,'pin')}${card(11,'loaded')}</ul>`})});
  bottom();await pause(160);
  assert.equal(d.querySelectorAll('[id="1"]').length,1);
  const loaded=d.getElementById('11');assert.ok(loaded);
  [...loaded.querySelectorAll('button')].find(b=>b.textContent==='回复').click();
  assert.match(cm.getValue(),/^existing draft @User11$/);
  assert.equal(editor.classList.contains('nst-editor-collapsed'),false);
});

test('a disabled reading feature starts without a dock or automatic page requests',async t=>{
  let pageRequests=0;
  const {d}=await setup(t,'NodeSeek Issue Templates.user.js',{flags:{threadedReading:false},fetch:async url=>{if(String(url).includes('/post-123-2'))pageRequests++;return {ok:false};}});
  assert.equal(d.querySelector('.nst-modebar'),null);
  assert.equal(d.querySelector('.nst-fixed-editor'),null);
  assert.equal(pageRequests,0);
  assert.ok(d.querySelector('.nsit-trigger'));
});

test('posting pages retain the native editor layout',async t=>{
  const {d}=await setup(t,'NodeSeek Issue Templates.user.js',{url:'https://www.nodeseek.com/editor'});
  assert.equal(d.querySelector('.nst-fixed-editor'),null);
  assert.equal(d.querySelector('.nst-modebar'),null);
  assert.ok(d.querySelector('.nsit-trigger'));
});
