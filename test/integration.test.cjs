const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const card=(floor,body)=>`<li class="content-item" id="${floor}" data-comment-id="${1000+floor}"><div class="nsk-content-meta-info"><div class="avatar-wrapper"><img class="avatar-normal"></div><a class="author-name">User${floor}</a><a class="floor-link" href="#${floor}">#${floor}</a></div><article class="post-content">${body}</article><div class="comment-menu"><button>回复</button></div></li>`;
async function setup(t,file,{url='https://www.nodeseek.com/post-123-1',fetch,flags={},settings={threadDefaultCollapsed:false}}={}) {
  const dom=new JSDOM(`<html><head></head><body><header id="nsk-head"></header><main><ul class="comments">${card(1,'root')}${card(2,'<p><a href="/member?t=User1">@User1</a> <a href="/post-123-1#1">#1</a><br>child</p>')}</ul><div class="post-bottom-pager"><nav aria-label="pagination"><a rel="next" href="/post-123-2">下一页</a></nav></div><div id="editor"><div class="md-editor"><div id="editor-body"><div class="window_header"><a href="https://www.runoob.com/markdown/md-tutorial.html">Markdown</a></div><div class="CodeMirror"></div></div><div class="topic-select"><button class="submit">发布评论</button></div></div></div></main></body></html>`,{url,runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document,menus=new Map(),intersections=[];
  d.body.insertAdjacentHTML('afterbegin','<aside id="nsk-right-panel-container"><div class="user-stat"><div class="stat-block"><div data-v-native><a data-v-native href="/progress"><svg data-v-native class="iconpark-icon"></svg><span data-v-native>等级 Lv 5</span></a></div></div><div class="stat-block"><div data-v-native><a data-v-native href="/my-post"><svg data-v-native class="iconpark-icon"></svg><span data-v-native>主题帖 153</span></a></div></div></div></aside>');
  const observers=[],NativeObserver=w.MutationObserver;
  w.MutationObserver=class extends NativeObserver{constructor(callback){super(callback);observers.push(this);}};
  t.after(()=>{w.__nodeSeekAuthorInfo__?.disconnect();observers.forEach(o=>o.disconnect());w.close();});
  const storage=new Map([['nsit-auto-settings-v1',settings]]);
  w.GM_getValue=(key,fallback)=>storage.has(key)?storage.get(key):fallback;
  w.GM_setValue=(key,value)=>storage.set(key,value);
  w.GM_registerMenuCommand=(name,fn)=>menus.set(name,fn);
  w.GM_addStyle=css=>{const s=d.createElement('style');s.textContent=css;d.head.append(s);return s;};
  w.GM_xmlhttpRequest=options=>{queueMicrotask(()=>options.onerror?.({status:503}));return {abort(){}};};
  w.fetch=fetch|| (async()=>({ok:false,status:503,json:async()=>({})}));
  w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  w.IntersectionObserver=class{constructor(callback){this.callback=callback;intersections.push(this);}observe(target){this.target=target;}unobserve(target){if(this.target===target)this.target=null;}disconnect(){this.target=null;}};
  w.__config__={postData:{postId:123,comments:[{floorIndex:1,commentId:1001},{floorIndex:2,commentId:1002}]}};
  let draft='existing draft';
  const cm={getValue:()=>draft,setValue:value=>{draft=value;},refresh(){},focus(){},setSize(){},on(){}};
  d.querySelector('.CodeMirror').CodeMirror=cm;
  w.editor={reply(i){draft+=` @${w.__config__.postData.comments[i].poster.name}`;},quote(){}};
  w.localStorage.setItem('nsit-feature-flags-v1',JSON.stringify(flags));
  const editor=d.getElementById('editor');
  w.eval(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
  await pause(180);
  return {w,d,editor,cm,menus,storage,bottom(){for(const o of intersections)if(o.target)o.callback([{target:o.target,isIntersecting:true}]);}};
}

for(const file of ['NodeSeek Issue Templates.user.js','NodeSeek Issue Templates.min.user.js']) {
  test(`${file}: automation settings apply default folding immediately and preserve manual choices on unrelated saves`,async t=>{
    const {w,d,storage}=await setup(t,file,{settings:{}});
    const child=d.getElementById('2');
    assert.equal(child.classList.contains('nst-branch-hidden'),true,'existing settings without a preference default to folded');
    assert.equal(w.getComputedStyle(d.getElementById('1').querySelector('.floor-link')).display,'none');
    d.querySelector('[data-nsit-automation-trigger]').click();
    const dialog=d.querySelector('[data-nsit-auto-dialog]'),input=dialog.querySelector('[name="threadDefaultCollapsed"]');
    assert.ok(input);assert.equal(input.checked,true);
    const save=()=>dialog.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    input.checked=false;save();await pause(150);
    assert.equal(storage.get('nsit-auto-settings-v1').threadDefaultCollapsed,false);
    assert.equal(child.classList.contains('nst-branch-hidden'),false);
    d.getElementById('1').querySelector('.nst-branch-toggle').click();save();await pause(150);
    assert.equal(child.classList.contains('nst-branch-hidden'),true,'saving unchanged defaults does not reset a manual fold');
    d.getElementById('1').querySelector('.nst-branch-toggle').click();
    input.checked=true;save();await pause(150);
    assert.equal(storage.get('nsit-auto-settings-v1').threadDefaultCollapsed,true);
    assert.equal(child.classList.contains('nst-branch-hidden'),true);
    d.querySelector('[data-nst-mode="raw"]').click();
    assert.equal(child.classList.contains('nst-branch-hidden'),false);
    assert.notEqual(w.getComputedStyle(d.getElementById('1').querySelector('.floor-link')).display,'none');
    d.querySelector('[data-nst-mode="thread"]').click();
    assert.equal(child.classList.contains('nst-branch-hidden'),true);
  });
  test(`${file}: templates, threaded reading and native editor coexist`,async t=>{
    const {d,editor,cm,menus}=await setup(t,file);
    assert.ok(d.querySelector('.nsit-trigger'));
    assert.ok(d.querySelector('.nsit-buy-trigger'));
    const tools=d.querySelector('[data-nsit-tools-toggle]'),panel=d.querySelector('[data-nsit-tools-panel]');
    assert.ok(tools);assert.equal(panel.hidden,true);
    assert.ok(panel.contains(d.querySelector('.nsit-image-trigger')));
    tools.click();assert.equal(panel.hidden,false);
    assert.equal(panel.querySelector('.nsit-auto-open'),null);
    d.body.click();assert.equal(panel.hidden,true);
    const automation=d.querySelector('[data-nsit-automation-trigger]');assert.ok(automation);
    assert.equal(automation.textContent.trim(),'自动化');
    assert.ok(d.querySelectorAll('.user-stat > .stat-block')[1].contains(automation));
    automation.click();
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
    d.getElementById('2').querySelector('.post-content').innerHTML='<p><strong>真实页面正文</strong>，句末回复@User1 <a href="/post-123-1#1">#1</a></p>';
    await pause(160);
    assert.equal(d.getElementById('2').dataset.nstDepth,'1');
    assert.equal(d.getElementById('2').querySelector('.nst-relation a').getAttribute('href'),'/post-123-1#1');
    assert.equal(d.getElementById('2').querySelector('.post-content').textContent,'真实页面正文，句末回复@User1 #1');
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
    assert.equal(d.querySelector('.nst-branch-toggle,.nst-branch-hidden,.nst-has-children'),null);
    assert.equal(d.querySelector('.post-bottom-pager').classList.contains('nst-pagination-hidden'),false);
    assert.equal(cm.getValue(),'existing draft');
    assert.ok(d.querySelector('.nsit-trigger'));
    flag.checked=true;flag.dispatchEvent(new d.defaultView.Event('change',{bubbles:true}));await pause(120);
    assert.equal(d.querySelectorAll('.nst-modebar').length,1);
    assert.equal(d.querySelectorAll('.nst-editor-head').length,1);
    const fold=d.getElementById('1').querySelector('.nst-branch-toggle');assert.ok(fold);
    fold.click();
    assert.equal(d.getElementById('2').classList.contains('nst-branch-hidden'),true);
    flag.checked=false;flag.dispatchEvent(new d.defaultView.Event('change',{bubbles:true}));await pause(120);
    assert.equal(d.querySelector('.nst-branch-toggle,.nst-branch-hidden,.nst-branch-collapsed'),null);
    assert.equal(d.getElementById('2').style.getPropertyValue('--nst-toggle-x'),'');
    assert.equal(cm.getValue(),'existing draft');
  });
  test(`${file}: My replies reveals a folded native floor before scrolling`,async t=>{
    const {w,d}=await setup(t,file);
    let scrolledTo=null, visible=false;
    w.HTMLElement.prototype.scrollIntoView=function(){scrolledTo=this;visible=!this.classList.contains('nst-branch-hidden');};
    const fold=d.getElementById('1').querySelector('.nst-branch-toggle');assert.ok(fold);fold.click();
    const button=d.createElement('button');button.dataset.nsitRepliedFloor='2';d.body.append(button);
    button.click();
    assert.equal(scrolledTo,d.getElementById('2'),'My replies targets the native numeric comment ID');
    assert.equal(visible,true,'My replies reveals the floor before scrolling');
    assert.equal(fold.getAttribute('aria-expanded'),'true');
  });
  test(`${file}: page changes filter posts at once and restore entries within a frame`,async t=>{
    const {w,d}=await setup(t,file);
    w.localStorage.setItem('nsit-post-filter-rules-v1',JSON.stringify([{id:'r1',keywords:'广告',action:'hide'}]));
    const list=d.createElement('ul');d.querySelector('main').append(list);
    list.insertAdjacentHTML('beforeend','<li class="post-list-item"><div class="post-list-content"><div class="post-title"><a href="/post-77-1">广告 帖子</a></div></div></li>');
    await Promise.resolve();await Promise.resolve();
    assert.equal(list.firstElementChild.classList.contains('nsit-filter-hidden'),true,'filtering runs in the observer callback, before the next frame');
    d.querySelector('[data-nsit-automation-entry]').remove();
    for(let i=0;i<40;i++)d.querySelector('main').append(d.createElement('span'));
    await pause(60);
    assert.equal(d.querySelectorAll('[data-nsit-automation-entry]').length,1,'a burst of page changes re-renders entries once, without duplicates');
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

for(const file of ['NodeSeek Issue Templates.user.js','NodeSeek Issue Templates.min.user.js']) {
  test(`${file}: author profiles work in native replies and respect the feature switch`,async t=>{
    let profileRequests=0;
    const h=await setup(t,file,{fetch:async url=>{
      if(!String(url).includes('/api/account/getInfo/'))return {ok:false};
      profileRequests++;return {ok:true,json:async()=>({success:true,detail:{member_id:19096,rank:5,coin:2682,nPost:63,nComment:381}})};
    }});
    const author=h.d.getElementById('2').querySelector('.author-name'),header=h.d.createElement('div');
    header.className='author-info';author.before(header);header.append(author);author.href='/space/19096';
    await pause(80);h.bottom();await pause(100);
    assert.match(h.d.querySelector('[data-nsit-author-info]').textContent,/Lv 5/);assert.equal(profileRequests,1);
    h.menus.get('功能开关')();const flag=h.d.querySelector('[data-nsit-flag="authorInfo"]');assert.ok(flag);
    flag.checked=false;flag.dispatchEvent(new h.w.Event('change',{bubbles:true}));await pause(80);
    assert.equal(h.d.querySelector('[data-nsit-author-info]'),null);assert.equal(author.isConnected,true);
    flag.checked=true;flag.dispatchEvent(new h.w.Event('change',{bubbles:true}));await pause(80);
    assert.match(h.d.querySelector('[data-nsit-author-info]').textContent,/鸡腿 2682/);assert.equal(profileRequests,1);
  });

  test(`${file}: native reply Enter shortcut is installed`,async t=>{
    const {d,cm}=await setup(t,file,{flags:{threadedReading:false}});
    const input=d.createElement('textarea');d.querySelector('.CodeMirror').append(input);
    cm.getInputField=()=>input;
    let sends=0;d.querySelector('button.submit').addEventListener('click',()=>sends++);
    const event=new d.defaultView.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
    input.dispatchEvent(event);
    assert.equal(event.defaultPrevented,true);assert.equal(sends,1);
    assert.equal(cm.getValue(),'existing draft');
  });
}

for(const file of ['NodeSeek Issue Templates.user.js','NodeSeek Issue Templates.min.user.js']) {
  test(`${file}: highlight rules take preset, custom and hex colors and can be recolored from the list`,async t=>{
    const {w,d}=await setup(t,file);
    const list=d.createElement('ul');d.querySelector('main').append(list);
    list.insertAdjacentHTML('beforeend','<li class="post-list-item"><div class="post-list-content"><div class="post-title"><a href="/post-77-1">出 香港 小鸡</a></div></div></li>');
    d.querySelector('[data-nsit-post-filter-trigger]').click();
    const panel=d.querySelector('[data-nsit-post-filter-panel]');
    panel.querySelector('[data-nsit-filter-tab="highlight"]').click();
    panel.querySelector('[data-nsit-filter-action="new"]').click();
    const form=()=>panel.querySelector('[data-nsit-post-filter-form]');
    assert.equal(form().querySelector('.nsit-filter-color-field').classList.contains('is-hidden'),false);
    assert.equal(form().querySelectorAll('[data-nsit-filter-swatch]').length,9);
    form().querySelector('[data-nsit-filter-swatch="#bbdefb"]').click();
    assert.equal(form().querySelector('[name="color"]').value,'#bbdefb');
    assert.equal(form().querySelector('[data-nsit-filter-hex]').value,'#bbdefb');
    assert.equal(form().querySelector('[data-nsit-filter-swatch="#bbdefb"]').getAttribute('aria-pressed'),'true');
    const hex=form().querySelector('[data-nsit-filter-hex]');hex.value='FF8800';hex.dispatchEvent(new w.Event('input',{bubbles:true}));
    assert.equal(form().querySelector('[name="color"]').value,'#ff8800');
    assert.equal(form().querySelector('[data-nsit-filter-swatch="#bbdefb"]').getAttribute('aria-pressed'),'false');
    form().querySelector('[name="keywords"]').value='香港';
    form().dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    const post=list.firstElementChild;
    assert.equal(JSON.parse(w.localStorage.getItem('nsit-post-filter-rules-v1'))[0].color,'#ff8800');
    assert.equal(post.classList.contains('nsit-filter-highlighted'),true);
    assert.equal(post.style.getPropertyValue('--nsit-filter-highlight'),'#ff8800');
    const recolor=panel.querySelector('[data-nsit-filter-recolor]');assert.ok(recolor,'list dot is a color picker');
    recolor.value='#c8e6c9';recolor.dispatchEvent(new w.Event('input',{bubbles:true}));recolor.dispatchEvent(new w.Event('change',{bubbles:true}));
    assert.equal(JSON.parse(w.localStorage.getItem('nsit-post-filter-rules-v1'))[0].color,'#c8e6c9');
    assert.equal(post.style.getPropertyValue('--nsit-filter-highlight'),'#c8e6c9');
  });
}
