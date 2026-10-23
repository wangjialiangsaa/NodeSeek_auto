const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const source = `function featureEnabled(){return true;}\n${fs.readFileSync(path.join(__dirname,'../src/auto-tasks.js'),'utf8')}\n${fs.readFileSync(path.join(__dirname,'../src/threaded.js'),'utf8')}\ninstallThreadedReading();`;
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
const contextKey = 'nst:reply-context:123';
const ref = (floor,page=1) => `<a href="/member?t=User${floor}">@User${floor}</a> <a href="/post-123-${page}#${floor}">#${floor}</a><br>`;
const reply = (floor,parent=null,parentPage=1) => `<li class="content-item" id="${floor}" data-comment-id="${1000+floor}"><div class="nsk-content-meta-info"><div class="avatar-wrapper"><img class="avatar-normal"></div><div class="author-info"><a class="author-name" href="/space/${floor}">User${floor}</a></div><div class="floor-link-wrapper"><a class="floor-link" href="#${floor}">#${floor}</a></div></div><article class="post-content">${parent===null?'':ref(parent,parentPage)}Comment ${floor}</article><div class="comment-menu"><button type="button" class="native-reply">回复</button></div></li>`;
const pager = page => `<div class="post-bottom-pager"><nav aria-label="pagination"><a rel="next" href="/post-123-${page}">${page}</a></nav></div>`;
const page = (cards,next=null) => `<ul class="comments">${cards}</ul>${next===null?'':pager(next)}`;
const floors = d => [...d.querySelectorAll('ul.comments > li.content-item')].map(card=>Number(card.id)).sort((a,b)=>a-b);
const sessionEntries = w => Array.from({length:w.sessionStorage.length},(_,index)=>{const key=w.sessionStorage.key(index);return [key,w.sessionStorage.getItem(key)];});
function toggle(d,floor) {
  const button=d.getElementById(String(floor)).querySelector('.nst-branch-toggle');
  assert.ok(button,`floor ${floor} has a branch toggle`);
  return button;
}
function assertFloorMetadata(marker) {
  for(const key of ['collapsed','initializedBranches']) {
    assert.ok(Array.isArray(marker[key]),`${key} contains floor IDs`);
    assert.ok(marker[key].every(floor=>Number.isSafeInteger(floor) && floor>0),`${key} stores only positive integer floors`);
  }
  if(Object.hasOwn(marker,'defaultCollapsed')) assert.equal(typeof marker.defaultCollapsed,'boolean');
}

async function setup(t,cards,options={}) {
  const dom=new JSDOM(`<html><head></head><body><main><div class="content-item" id="0"><a class="author-name">OP</a><article class="post-content">Topic</article></div><div class="comment-container"><ul class="comments">${cards}</ul>${options.pagination||''}</div><div id="editor"><div class="md-editor"><form class="reply-form"><div id="editor-body"><div class="CodeMirror"></div><textarea class="draft"></textarea></div><div class="topic-select"><button type="button" class="submit">发布评论</button></div></form></div></div></main></body></html>`,{url:options.url||'https://www.nodeseek.com/post-123-1',runScripts:'outside-only',pretendToBeVisual:true});
  t.after(()=>dom.window.close());
  const w=dom.window,d=w.document,requests=[],scrolls=[],intersections=[];
  const storage=new Map([['nsit-auto-settings-v1',{threadDefaultCollapsed:options.defaultCollapsed===true}]]);
  w.GM_getValue=(key,fallback)=>storage.has(key)?storage.get(key):fallback;
  w.GM_setValue=(key,value)=>storage.set(key,value);
  w.GM_registerMenuCommand=()=>{};
  for(const [key,value] of options.session||[]) w.sessionStorage.setItem(key,value);
  w.scrollTo=()=>{};
  w.HTMLElement.prototype.scrollIntoView=function(){scrolls.push({floor:this.id,visible:!this.classList.contains('nst-branch-hidden'),floors:floors(d)});};
  w.IntersectionObserver=class {
    constructor(callback){this.callback=callback;intersections.push(this);}
    observe(target){this.target=target;}
    disconnect(){this.target=null;}
  };
  w.fetch=async url=>{
    const pathname=new URL(typeof url==='string'?url:url.url,w.location.href).pathname;
    requests.push(pathname);
    const result=options.fetch?await options.fetch(pathname,requests.filter(request=>request===pathname).length):options.pages?.[pathname];
    const html=typeof result==='string'?result:result?.html;
    const status=result?.status??(typeof html==='string'?200:404);
    return {ok:status>=200 && status<300,status,url:w.location.origin+pathname,text:async()=>html||''};
  };
  d.querySelector('.draft').value=options.draft??'A local draft';
  if(Object.hasOwn(options,'codeMirrorValue')) d.querySelector('.CodeMirror').CodeMirror={getValue:()=>options.codeMirrorValue,refresh(){},focus(){}};
  if(options.init) options.init(w);
  w.eval(source);
  await pause(180);
  return {w,d,requests,scrolls,bottom:()=>intersections.forEach(observer=>{if(observer.target)observer.callback([{target:observer.target,isIntersecting:true}]);})};
}

test('conversation context restores retained imported nodes after the native list contents are rewritten',async t=>{
  const {d,bottom,requests}=await setup(t,reply(1)+reply(2,1),{pagination:pager(2),pages:{'/post-123-2':page(reply(11,2))}});
  bottom();await pause(180);
  const imported=d.getElementById('11'),body=imported.querySelector('.post-content'),list=d.querySelector('ul.comments');
  let clicks=0;body.addEventListener('click',()=>clicks++);
  assert.deepEqual(floors(d),[1,2,11]);
  d.querySelector('.submit').addEventListener('click',()=>{list.innerHTML=reply(1)+reply(2,1)+reply(12,11,2);});
  d.querySelector('.submit').click();await pause(180);bottom();await pause(60);
  assert.deepEqual(floors(d),[1,2,11,12]);
  assert.equal(d.querySelector('ul.comments'),list);
  assert.equal(d.getElementById('11'),imported,'the imported native node is retained, not cloned');
  assert.equal(d.getElementById('12').dataset.nstDepth,'3');
  body.click();assert.equal(clicks,1);
  assert.deepEqual(requests,['/post-123-2'],'retained pages are restored without fetching them again');
  for(const mode of ['raw','quote']) {
    d.querySelector(`[data-nst-mode="${mode}"]`).click();
    assert.deepEqual([...list.querySelectorAll(':scope > li.content-item')].map(card=>Number(card.id)),[1,2,11,12],`${mode} mode restores retained cards in chronological order`);
  }
});

test('conversation context migrates imported nodes and manual folds when the same-page list is replaced',async t=>{
  const {d,bottom}=await setup(t,reply(1)+reply(2,1),{defaultCollapsed:true,pagination:pager(2),pages:{'/post-123-2':page(reply(11,2))}});
  toggle(d,1).click();bottom();await pause(180);
  const imported=d.getElementById('11'),body=imported.querySelector('.post-content');
  let clicks=0;body.addEventListener('click',()=>clicks++);
  assert.equal(toggle(d,1).getAttribute('aria-expanded'),'true');
  assert.equal(toggle(d,2).getAttribute('aria-expanded'),'false');
  const replacement=d.createElement('ul');replacement.className='comments';replacement.innerHTML=reply(1)+reply(2,1)+reply(12,11,2);
  d.querySelector('ul.comments').replaceWith(replacement);await pause(180);
  assert.deepEqual(floors(d),[1,2,11,12]);
  assert.equal(d.getElementById('11'),imported);
  assert.equal(d.getElementById('12').dataset.nstDepth,'3');
  assert.equal(toggle(d,1).getAttribute('aria-expanded'),'true','list replacement preserves the manually opened root');
  assert.equal(toggle(d,2).getAttribute('aria-expanded'),'false','independent nested folds remain intact');
  body.click();assert.equal(clicks,1);
  assert.equal(d.querySelectorAll('.nst-modebar').length,1);
  assert.equal(d.querySelectorAll('.nst-auto-load').length,1);
});

test('conversation context survives a transient missing list during native rerendering',async t=>{
  const {d,bottom,requests}=await setup(t,reply(1)+reply(2,1),{defaultCollapsed:true,pagination:pager(2),pages:{'/post-123-2':page(reply(11,2))}});
  toggle(d,1).click();bottom();await pause(180);
  const imported=d.getElementById('11');
  d.querySelector('ul.comments').remove();await pause(180);
  const replacement=d.createElement('ul');replacement.className='comments';replacement.innerHTML=reply(1)+reply(2,1)+reply(12,11,2);
  d.querySelector('.comment-container').prepend(replacement);await pause(180);
  assert.deepEqual(floors(d),[1,2,11,12]);
  assert.equal(d.getElementById('11'),imported);
  assert.equal(d.getElementById('12').dataset.nstDepth,'3');
  assert.equal(toggle(d,1).getAttribute('aria-expanded'),'true');
  assert.equal(toggle(d,2).getAttribute('aria-expanded'),'false');
  assert.deepEqual(requests,['/post-123-2']);
  assert.equal(d.querySelectorAll('.nst-modebar').length,1);
  assert.equal(d.querySelectorAll('.nst-auto-load').length,1);
});

test('native reply submission saves only page metadata and restores the conversation in the next document',async t=>{
  let submits=0;
  const first=await setup(t,reply(1)+reply(2,1),{pagination:pager(2),draft:'Private reply text stays in the editor',pages:{'/post-123-2':page(reply(11,2))},init:w=>{
    w.document.querySelector('.submit').addEventListener('click',()=>submits++);
  }});
  first.bottom();await pause(180);
  assert.equal(submits,0);
  assert.equal(first.w.sessionStorage.getItem(contextKey),null,'opening the editor does not prepare a navigation marker');
  first.d.querySelector('.nst-editor-toggle').click();
  const before=Date.now();first.d.querySelector('.submit').click();
  assert.equal(submits,1,'the native submission listener still runs once');
  const serialized=first.w.sessionStorage.getItem(contextKey);
  assert.ok(serialized,'a user submission records the loaded page range');
  const marker=JSON.parse(serialized);
  assertFloorMetadata(marker);
  assert.equal(marker.firstPage,1);assert.equal(marker.lastPage,2);
  assert.ok(marker.at>=before && marker.at<=Date.now());
  assert.doesNotMatch(serialized,/Private reply text|Comment/,'the marker contains no draft or comment bodies');
  let accidentalSubmits=0;
  const restored=await setup(t,reply(11,2)+reply(12,11,2),{url:'https://www.nodeseek.com/post-123-2#12',session:sessionEntries(first.w),defaultCollapsed:true,pages:{'/post-123-1':page(reply(1)+reply(2,1),2)},init:w=>{
    w.document.querySelector('.submit').addEventListener('click',()=>accidentalSubmits++);
  }});
  assert.deepEqual(floors(restored.d),[1,2,11,12]);
  assert.equal(restored.d.getElementById('11').dataset.nstDepth,'2');
  assert.equal(restored.d.getElementById('12').dataset.nstDepth,'3');
  assert.equal(restored.d.getElementById('12').classList.contains('nst-branch-hidden'),false);
  assert.ok(restored.scrolls.some(entry=>entry.floor==='12' && entry.visible && entry.floors.includes(1)),'the submitted reply is located after restoring its ancestors');
  assert.deepEqual(restored.requests,['/post-123-1']);
  assert.equal(accidentalSubmits,0,'restoring context never submits a reply');
  assert.equal(restored.w.sessionStorage.getItem(contextKey),null,'the navigation marker is consumed once');
});

test('native submission preserves independent manual folds across documents',async t=>{
  const first=await setup(t,reply(1)+reply(2,1)+reply(4),{defaultCollapsed:true,pagination:pager(2),pages:{'/post-123-2':page(reply(11,2)+reply(12,4))}});
  toggle(first.d,1).click();first.bottom();await pause(180);
  toggle(first.d,4).click();
  assert.equal(toggle(first.d,2).getAttribute('aria-expanded'),'false');
  first.d.querySelector('.submit').click();
  const marker=JSON.parse(first.w.sessionStorage.getItem(contextKey));
  assertFloorMetadata(marker);
  assert.ok(marker.collapsed.includes(2));
  assert.ok(!marker.collapsed.includes(1) && !marker.collapsed.includes(4));
  const restored=await setup(t,reply(11,2)+reply(12,4)+reply(13,12,2),{url:'https://www.nodeseek.com/post-123-2#13',session:sessionEntries(first.w),defaultCollapsed:true,pages:{'/post-123-1':page(reply(1)+reply(2,1)+reply(4),2)}});
  assert.deepEqual(floors(restored.d),[1,2,4,11,12,13]);
  assert.equal(toggle(restored.d,1).getAttribute('aria-expanded'),'true');
  assert.equal(toggle(restored.d,2).getAttribute('aria-expanded'),'false');
  assert.equal(restored.d.getElementById('11').classList.contains('nst-branch-hidden'),true);
  assert.equal(toggle(restored.d,4).getAttribute('aria-expanded'),'true');
  assert.equal(restored.d.getElementById('13').classList.contains('nst-branch-hidden'),false);
  assert.ok(restored.scrolls.some(entry=>entry.floor==='13' && entry.visible && entry.floors.length===6));
});

test('restored earlier pages retain chronological raw and quote order without replacing native cards',async t=>{
  const marker=JSON.stringify({firstPage:1,lastPage:2,at:Date.now()});
  let native11,native12;
  const {d}=await setup(t,reply(11,2)+reply(12,11,2),{url:'https://www.nodeseek.com/post-123-2#12',session:[[contextKey,marker]],pages:{'/post-123-1':page(reply(1)+reply(2,1),2)},init:w=>{
    native11=w.document.getElementById('11');native12=w.document.getElementById('12');
  }});
  for(const mode of ['raw','quote']) {
    d.querySelector(`[data-nst-mode="${mode}"]`).click();
    assert.deepEqual([...d.querySelectorAll('ul.comments > li.content-item')].map(card=>Number(card.id)),[1,2,11,12],`${mode} mode keeps chronological floor order`);
    assert.equal(d.getElementById('11'),native11);
    assert.equal(d.getElementById('12'),native12);
  }
});

test('changed default fold preference takes precedence over saved submission folds',async t=>{
  const marker=JSON.stringify({firstPage:1,lastPage:2,at:Date.now(),defaultCollapsed:true,collapsed:[2],initializedBranches:[1,2]});
  const {d}=await setup(t,reply(11,2)+reply(12),{url:'https://www.nodeseek.com/post-123-2#12',session:[[contextKey,marker]],defaultCollapsed:false,pages:{'/post-123-1':page(reply(1)+reply(2,1),2)}});
  assert.deepEqual(floors(d),[1,2,11,12]);
  assert.equal(toggle(d,1).getAttribute('aria-expanded'),'true');
  assert.equal(toggle(d,2).getAttribute('aria-expanded'),'true');
  assert.equal(d.getElementById('11').classList.contains('nst-branch-hidden'),false);
});

test('failed conversation restoration keeps native replies and retries on a later scroll',async t=>{
  let submits=0;
  const marker=JSON.stringify({firstPage:1,lastPage:2,at:Date.now()});
  const {w,d,requests,bottom}=await setup(t,reply(11,2)+reply(12,11,2),{url:'https://www.nodeseek.com/post-123-2#12',session:[[contextKey,marker]],fetch:(pathname,count)=>pathname==='/post-123-1'?(count===1?{status:503}:page(reply(1)+reply(2,1),2)):undefined,init:w=>{
    w.document.querySelector('.submit').addEventListener('click',()=>submits++);
  }});
  assert.deepEqual(floors(d),[11,12],'failed retrieval does not remove the native new reply');
  assert.match(d.querySelector('.nst-auto-load').textContent,/上下文.*失败|恢复.*失败/);
  assert.doesNotMatch(d.querySelector('.nst-auto-load').textContent,/全部.*已加载/);
  const retryTime=Date.now()+10000;w.Date.now=()=>retryTime;
  w.dispatchEvent(new w.Event('scroll'));bottom();await pause(180);
  assert.deepEqual(floors(d),[1,2,11,12]);
  assert.equal(d.getElementById('12').dataset.nstDepth,'3');
  assert.deepEqual(requests,['/post-123-1','/post-123-1']);
  assert.equal(submits,0);
});

test('native submission refetches original native context after rewriting the same list to the final page',async t=>{
  let submits=0;
  const {d,bottom,requests}=await setup(t,reply(1)+reply(2,1),{pagination:pager(2),pages:{'/post-123-1':page(reply(1)+reply(2,1),2),'/post-123-2':page(reply(11,2))}});
  bottom();await pause(180);
  const list=d.querySelector('ul.comments'),imported=d.getElementById('11');
  d.querySelector('.submit').addEventListener('click',()=>{submits++;list.innerHTML=reply(11,2)+reply(12,11,2);});
  d.querySelector('.submit').click();await pause(240);
  assert.equal(d.querySelector('ul.comments'),list);
  assert.deepEqual(floors(d),[1,2,11,12]);
  assert.equal(d.getElementById('12').dataset.nstDepth,'3');
  assert.notEqual(d.getElementById('11'),imported,'freshly rendered native content wins over a retained copy');
  assert.equal(d.querySelectorAll('[id="11"]').length,1);
  assert.deepEqual(requests,['/post-123-2','/post-123-1']);
  assert.equal(submits,1,'context retrieval never repeats the native submission');
});

test('ordinary native comment removal does not resurrect content without a submission',async t=>{
  const {d,bottom,requests}=await setup(t,reply(1)+reply(2,1),{pagination:pager(2),pages:{'/post-123-1':page(reply(1)+reply(2,1),2),'/post-123-2':page(reply(11,2))}});
  bottom();await pause(180);
  d.getElementById('2').remove();await pause(180);bottom();await pause(60);
  assert.deepEqual(floors(d),[1,11]);
  assert.deepEqual(requests,['/post-123-2']);
});

test('conversation context restores every missing saved page when a new reply starts a later page',async t=>{
  const marker=JSON.stringify({firstPage:1,lastPage:2,at:Date.now()});
  const {d,requests,scrolls}=await setup(t,reply(21,11,2),{url:'https://www.nodeseek.com/post-123-3#21',session:[[contextKey,marker]],defaultCollapsed:true,pages:{'/post-123-1':page(reply(1)+reply(2,1),2),'/post-123-2':page(reply(11,2),3)}});
  assert.deepEqual(floors(d),[1,2,11,21]);
  assert.equal(d.querySelectorAll('[id="21"]').length,1,'the new native reply is retained without duplication');
  assert.equal(d.getElementById('21').dataset.nstDepth,'3');
  assert.equal(d.getElementById('21').classList.contains('nst-branch-hidden'),false);
  assert.deepEqual([...requests].sort(),['/post-123-1','/post-123-2']);
  assert.ok(scrolls.some(entry=>entry.floor==='21' && entry.visible && entry.floors.length===4));
});

test('native reply form submission reads CodeMirror when its textarea is empty',async t=>{
  let submits=0;
  const {w,d}=await setup(t,reply(1),{draft:'',codeMirrorValue:'A CodeMirror reply',init:w=>{
    w.document.querySelector('.reply-form').addEventListener('submit',event=>{submits++;event.preventDefault();});
  }});
  d.querySelector('.reply-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(submits,1);
  const serialized=w.sessionStorage.getItem(contextKey);assert.ok(serialized);
  const marker=JSON.parse(serialized);
  assert.equal(marker.firstPage,1);assert.equal(marker.lastPage,1);
  assert.doesNotMatch(serialized,/CodeMirror reply/);
});

test('conversation context ignores empty drafts and submission controls outside the editor',async t=>{
  const {w,d}=await setup(t,reply(1),{draft:' \n\t '});
  d.querySelector('.submit').click();
  assert.equal(w.sessionStorage.getItem(contextKey),null);
  d.querySelector('.reply-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(w.sessionStorage.getItem(contextKey),null);
  d.querySelector('.draft').value='A real editor draft';
  const unrelated=d.createElement('button');unrelated.className='submit';unrelated.type='button';d.body.append(unrelated);unrelated.click();
  assert.equal(w.sessionStorage.getItem(contextKey),null,'another form cannot create reply context');
});

test('conversation context ignores expired markers and markers belonging to another topic',async t=>{
  for(const scenario of [
    {name:'expired marker',key:contextKey,at:Date.now()-11*60*1000},
    {name:'another topic',key:'nst:reply-context:999',at:Date.now()}
  ]) await t.test(scenario.name,async t=>{
    const {d,requests}=await setup(t,reply(11,2)+reply(12,11,2),{url:'https://www.nodeseek.com/post-123-2#12',session:[[scenario.key,JSON.stringify({firstPage:1,lastPage:2,at:scenario.at})]],pages:{'/post-123-1':page(reply(1)+reply(2,1),2)}});
    assert.deepEqual(floors(d),[11,12]);
    assert.deepEqual(requests,[]);
  });
});

test('native submission can jump far ahead while restoring only the pages already read',async t=>{
  const marker=JSON.stringify({firstPage:1,lastPage:2,at:Date.now()});
  const {d,requests,scrolls}=await setup(t,reply(201,11,2),{url:'https://www.nodeseek.com/post-123-20#201',session:[[contextKey,marker]],defaultCollapsed:true,pages:{'/post-123-1':page(reply(1)+reply(2,1),2),'/post-123-2':page(reply(11,2),3)}});
  assert.deepEqual(floors(d),[1,2,11,201]);
  assert.equal(d.getElementById('201').dataset.nstDepth,'3');
  assert.deepEqual([...requests].sort(),['/post-123-1','/post-123-2'],'unread intervening pages are not fetched');
  assert.ok(scrolls.some(entry=>entry.floor==='201' && entry.visible && entry.floors.length===4));
});

test('repeated submissions preserve sparse loaded pages without fetching unread gaps',async t=>{
  const marker=JSON.stringify({firstPage:1,lastPage:2,at:Date.now()});
  const pages={'/post-123-1':page(reply(1)+reply(2,1),2),'/post-123-2':page(reply(11,2),3)};
  const first=await setup(t,reply(201,11,2),{url:'https://www.nodeseek.com/post-123-20#201',session:[[contextKey,marker]],pages});
  assert.deepEqual(floors(first.d),[1,2,11,201]);
  first.d.querySelector('.submit').click();
  const saved=JSON.parse(first.w.sessionStorage.getItem(contextKey));
  assert.deepEqual([...saved.pages].sort((a,b)=>a-b),[1,2,20]);
  const restored=await setup(t,reply(201,11,2)+reply(202,201,20),{url:'https://www.nodeseek.com/post-123-20#202',session:sessionEntries(first.w),pages});
  assert.deepEqual(floors(restored.d),[1,2,11,201,202]);
  assert.deepEqual([...restored.requests].sort(),['/post-123-1','/post-123-2']);
  assert.equal(restored.d.getElementById('202').dataset.nstDepth,'4');
  assert.ok(restored.scrolls.some(entry=>entry.floor==='202' && entry.visible && entry.floors.length===5));
});

test('conversation context ignores navigation before the first previously loaded page',async t=>{
  const marker=JSON.stringify({firstPage:2,lastPage:3,at:Date.now()});
  const {d,requests}=await setup(t,reply(1),{url:'https://www.nodeseek.com/post-123-1',session:[[contextKey,marker]],pages:{'/post-123-2':page(reply(11)), '/post-123-3':page(reply(21))}});
  assert.deepEqual(floors(d),[1]);
  assert.deepEqual(requests,[]);
});
