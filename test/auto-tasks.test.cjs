const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
const settingsKey='nsit-auto-settings-v1';
const future=Date.UTC(2030,0,1);

function threadPage(postId=123,{page=1,next=false,author=8}={}) {
  return `<div class="post-title"><h1><a href="/post-${postId}-1">抽奖帖</a></h1></div><ul class="comments"><li class="content-item" id="${(page-1)*10+1}"><a class="author-name" href="/space/${author}">用户</a><article class="post-content">参与</article></li></ul><nav aria-label="pagination"><span class="pager-cur" href="/post-${postId}-${page}">${page}</span>${next?`<a href="/post-${postId}-${page+1}" rel="next">下一页</a>`:''}</nav>`;
}

// The open page is checked in place; tests that exercise fetching open the post on a page beyond the thread.
const away="https://www.nodeseek.com/post-123-99";

function setup(t,{storage=new Map(),locks=new Set(),settings={dailyCheckin:false},url='https://www.nodeseek.com/post-123-1',uid=7,draft='',link,fetch,historyFetch,threadFetch,commentFetch,confirmReply=true}={}) {
  const postId=Number(new URL(url).pathname.match(/post-(\d+)/)?.[1]||123);
  const href=link??`https://www.nodeseek.com/lucky?post=123&time=${future}&count=1&start=1`;
  const dom=new JSDOM(`<html><head></head><body><article class="content-item" id="0"><a class="author-name" href="/space/8">OP</a><div class="post-content"><a href="${href}">抽奖链接</a></div></article><div id="editor"><div class="md-editor"><div id="editor-body"><div class="window_header"><div>内容 预览 对照</div><div><a href="https://www.runoob.com/markdown/md-tutorial.html">支持 Markdown</a></div></div><textarea aria-label="发言栏"></textarea></div><div class="topic-select"><button class="submit" type="button">发布评论</button></div></div></div></body></html>`,{url,runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document,requests=[],historyRequests=[],threadRequests=[],commentRequests=[],posts=[];
  const observers=[],NativeObserver=w.MutationObserver;
  w.MutationObserver=class extends NativeObserver {constructor(fn){super(fn);observers.push(this);}};
  let runtime;
  t.after(()=>{runtime?.disconnect?.();observers.forEach(o=>o.disconnect());w.close();});
  if(!storage.has(settingsKey))storage.set(settingsKey,settings);
  w.GM_getValue=(key,fallback)=>storage.has(key)?structuredClone(storage.get(key)):fallback;
  w.GM_setValue=(key,value)=>storage.set(key,structuredClone(value));
  w.GM_addStyle=css=>{const s=d.createElement('style');s.textContent=css;d.head.append(s);};
  w.GM_registerMenuCommand=()=>{};w.__NSIT_VENDOR_ASSET__=()=>'';
  w.matchMedia=()=>({matches:false,addEventListener(){}});
  Object.defineProperty(w.navigator,'locks',{configurable:true,value:{async request(name,options,callback){
    if(locks.has(name))return callback(null);locks.add(name);
    try{return await callback({name});}finally{locks.delete(name);}
  }}});
  w.__config__={user:uid?{member_id:uid}:null,postData:{postId,op:{uid:8},comments:[{floorIndex:0,poster:{uid:8},markdown:`[抽奖](${href})`}]}};
  w.fetch=async(...args)=>{
    if(String(args[0]).startsWith('/api/content/list-comments')){historyRequests.push(args);return historyFetch?historyFetch(...args):{ok:true,status:200,json:async()=>({success:true,comments:[]})};}
    if(String(args[0])==='/api/content/new-comment'){const body=JSON.parse(args[1].body);commentRequests.push(body);if(commentFetch)return commentFetch(body);posts.push(body.content);if(confirmReply)w.__config__.postData.comments.push({floorIndex:1,poster:{uid,isMe:true},markdown:body.content});return {ok:true,status:200,json:async()=>({success:true,message:'评论成功'})};}
    if(String(args[0]).startsWith('/post-')){threadRequests.push(args);return threadFetch?threadFetch(...args):{ok:true,status:200,text:async()=>threadPage(postId)};}
    requests.push(args);return fetch?fetch(...args):{ok:true,status:200,json:async()=>({success:true,message:'签到成功'})};
  };
  const input=d.querySelector('#editor-body>textarea');input.value=draft;
  d.querySelector('.submit').addEventListener('click',()=>{
    posts.push(input.value);
    if(confirmReply){w.__config__.postData.comments.push({floorIndex:1,poster:{uid,isMe:true},markdown:input.value});input.value='';}
  });
  const source=['config.js','ui.js','logic.js','toolbar.js','auto-tasks.js'].map(file=>{
    const full=path.join(__dirname,'..','src',file);return fs.existsSync(full)?fs.readFileSync(full,'utf8'):'';
  }).join('\n');
  w.eval(`(function(){${source}\nwindow.testApi={createApp,installToolbar:typeof installEditorToolbar==='function'?installEditorToolbar:null,installQuickReply:typeof installQuickReply==='function'?installQuickReply:null,saveFlags:saveFeatureFlags,applyFlags:applyEditorFeatureFlags,installAuto:typeof installAutomaticTasks==='function'?installAutomaticTasks:null,openSettings:typeof openAutomaticTaskSettings==='function'?openAutomaticTaskSettings:null};})();`);
  const app=w.testApi.createApp({replyMode:true});app._nsitEditor=d.querySelector('#editor-body');d.querySelector('.window_header>div:last-child').prepend(app);
  function install({autoStart=false}={}){assert.equal(typeof w.testApi.installAuto,'function','automatic tasks module exists');runtime=w.testApi.installAuto({autoStart});return runtime;}
  return {w,d,app,input,posts,requests,historyRequests,threadRequests,commentRequests,storage,install,get runtime(){return runtime;}};
}

test('compact toolbar toggle preserves button labels and dismisses on Escape/outside click',async t=>{
  const h=setup(t),{w,d,app}=h;
  const sell=app.querySelector('.nsit-trigger'),image=app.querySelector('.nsit-image-trigger'),editor=h.input;
  assert.equal(typeof w.testApi.installToolbar,'function');w.testApi.installToolbar(app);
  const toggle=app.querySelector('[data-nsit-tools-toggle]'),panel=app.querySelector('[data-nsit-tools-panel]');
  assert.ok(toggle);assert.equal(panel.hidden,true);assert.ok(panel.contains(sell));assert.ok(panel.contains(image));
  assert.equal(sell.textContent,'出🐔模板');assert.equal(image.textContent,'上传图片');
  assert.ok(panel.contains(app.querySelector('[data-nsit-image-status]')));
  assert.equal(d.querySelector('#editor-body>textarea'),editor);
  assert.ok(d.querySelector('.window_header a[href*="runoob"]'));
  toggle.click();assert.equal(toggle.getAttribute('aria-expanded'),'true');assert.equal(panel.hidden,false);
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(panel.hidden,true);
  toggle.click();d.body.click();assert.equal(panel.hidden,true);
  w.testApi.installToolbar(app);assert.equal(app.querySelectorAll('[data-nsit-tools-toggle]').length,1);
});

test('automatic task settings start with an empty phrase and prevent enabling an empty reply',async t=>{
  const h=setup(t);h.install();assert.equal(typeof h.w.testApi.openSettings,'function');h.w.testApi.openSettings();
  const dialog=h.d.querySelector('[data-nsit-auto-dialog]');assert.ok(dialog);
  const phrase=dialog.querySelector('[name="replyText"]'),enabled=dialog.querySelector('[name="autoReply"]');
  assert.equal(phrase.value,'');assert.equal(enabled.checked,false);
  enabled.checked=true;dialog.querySelector('form').dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));
  assert.match(dialog.textContent,/请填写/);assert.equal(h.posts.length,0);
  phrase.value='祝大家好运！';dialog.querySelector('form').dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(h.storage.get(settingsKey).replyText,'祝大家好运！');
});

test('thread default starts collapsed for existing settings and saves without changing automatic tasks',t=>{
  const settings={dailyCheckin:false,autoReply:true,replyText:'接好运！'};
  const h=setup(t,{settings});h.w.testApi.openSettings();
  const dialog=h.d.querySelector('[data-nsit-auto-dialog]');
  const collapsed=dialog.querySelector('[name="threadDefaultCollapsed"]');
  assert.ok(collapsed,'automation settings includes the thread default control');
  assert.equal(collapsed.checked,true,'existing users default to collapsed branches');
  assert.match(collapsed.closest('label').textContent,/楼中楼默认折叠/);
  assert.match(dialog.textContent,/取消.*默认展开/);
  const changes=[];
  h.d.addEventListener('nsit:thread-default-changed',event=>{
    changes.push({collapsed:event.detail.collapsed,saved:h.storage.get(settingsKey).threadDefaultCollapsed});
  });
  const save=()=>dialog.querySelector('form').dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));
  save();assert.deepEqual(changes,[],'saving an unchanged default preserves manual branch state');
  collapsed.checked=false;save();
  assert.deepEqual(h.storage.get(settingsKey),{...settings,threadDefaultCollapsed:false});
  assert.deepEqual(changes,[{collapsed:false,saved:false}],'current page is notified after successful storage');
  save();assert.equal(changes.length,1,'repeated saves do not reset manually adjusted branches');
  h.w.testApi.openSettings();assert.equal(collapsed.checked,false,'reopening settings retains the choice');
  const later=setup(t,{storage:h.storage,url:'https://www.nodeseek.com/post-456-1'});
  later.w.testApi.openSettings();
  assert.equal(later.d.querySelector('[name="threadDefaultCollapsed"]').checked,false,'later pages load the saved default');
  collapsed.checked=true;save();
  assert.deepEqual(changes,[{collapsed:false,saved:false},{collapsed:true,saved:true}]);
});

test('thread default is not applied when reply validation or settings storage fails',t=>{
  const h=setup(t);h.w.testApi.openSettings();
  const dialog=h.d.querySelector('[data-nsit-auto-dialog]');
  const collapsed=dialog.querySelector('[name="threadDefaultCollapsed"]');
  assert.ok(collapsed,'thread default control exists');
  let changes=0;h.d.addEventListener('nsit:thread-default-changed',()=>{changes+=1;});
  collapsed.checked=false;dialog.querySelector('[name="autoReply"]').checked=true;
  const save=()=>dialog.querySelector('form').dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));
  save();assert.match(dialog.textContent,/请填写自定义回复语句/);assert.equal(changes,0);
  assert.deepEqual(h.storage.get(settingsKey),{dailyCheckin:false});
  dialog.querySelector('[name="autoReply"]').checked=false;
  h.w.GM_setValue=()=>{throw new Error('storage unavailable');};
  save();assert.match(dialog.textContent,/设置保存失败/);assert.equal(changes,0);
  assert.deepEqual(h.storage.get(settingsKey),{dailyCheckin:false});
});

test('enabled lottery reply uses native submit once and does not require an API guess',async t=>{
  const h=setup(t,{settings:{dailyCheckin:false,autoReply:true,replyText:'感谢分享！'}});const runtime=h.install();
  await runtime.run();await runtime.run();
  assert.deepEqual(h.posts,['感谢分享！'],JSON.stringify(runtime.status));assert.equal(h.requests.length,0);
});

test('opening a thread with the supplied mode=view lottery replies despite a long personal history',async t=>{
  const h=setup(t,{url:'https://www.nodeseek.com/post-1002045-1',link:'https://www.nodeseek.com/lucky?post=1002045&time=1792720800000&count=1&start=1&duplicate=false&mode=view',settings:{dailyCheckin:false,autoReply:true,replyText:'接好运！'},historyFetch:async()=>({ok:true,status:200,json:async()=>({success:true,comments:[{post_id:999484,floor_id:1}]})})});
  h.w.Date.now=()=>Date.UTC(2026,9,22,13);
  const runtime=h.install();await runtime.run();await runtime.run();
  assert.deepEqual(h.posts,['接好运！'],JSON.stringify(runtime.status));
  assert.equal(h.commentRequests.length,1);assert.equal(h.threadRequests.length,0,'unrelated personal history is not needed');
});

test('entering the lottery thread triggers the saved reply without manually running the task',{timeout:3000},async t=>{
  const h=setup(t,{settings:{dailyCheckin:false,autoReply:true,replyText:'参与一下！'}});
  h.install({autoStart:true});while(!h.posts.length)await tick();
  assert.deepEqual(h.posts,['参与一下！']);
});

for(const [name,options] of [
  ['ordinary thread',{link:'https://www.nodeseek.com/post-555-1'}],
  ['external lottery URL',{link:`https://example.com/lucky?post=123&time=${future}`}],
  ['other thread lottery',{link:`https://www.nodeseek.com/lucky?post=999&time=${future}`}],
  ['expired lottery',{link:'https://www.nodeseek.com/lucky?post=123&time=1600000000000'}],
  ['logged out',{uid:0}],
])test(`auto reply skips ${name}`,async t=>{
  const h=setup(t,{...options,settings:{dailyCheckin:false,autoReply:true,replyText:'感谢分享！'}});const before=h.input.value;
  await h.install().run();assert.equal(h.posts.length,0);assert.equal(h.input.value,before);
});

test('own threads and already replied threads are skipped',async t=>{
  const h=setup(t,{settings:{dailyCheckin:false,autoReply:true,replyText:'谢谢！'}});const runtime=h.install();
  h.w.__config__.postData.op.uid=7;await runtime.run();assert.equal(h.posts.length,0);
  h.w.__config__.postData.op.uid=8;h.w.__config__.postData.comments.push({floorIndex:2,poster:{uid:7},markdown:'旧回复'});
  await runtime.run();assert.equal(h.posts.length,0);
});

test('reply checks later thread pages and skips an older reply outside loaded comments',async t=>{
  let resolvePage;const pending=new Promise(resolve=>{resolvePage=resolve;});
  const h=setup(t,{url:away,settings:{dailyCheckin:false,autoReply:true,replyText:'谢谢'},threadFetch:url=>String(url).endsWith('-1')?{ok:true,text:async()=>threadPage(123,{next:true})}:pending});
  const run=h.install().run();for(let i=0;i<200&&h.threadRequests.length<2;i++)await tick();assert.equal(h.posts.length,0);assert.equal(h.threadRequests.length,2);
  resolvePage({ok:true,status:200,text:async()=>threadPage(123,{page:2,author:7})});
  await run;assert.equal(h.posts.length,0);assert.equal(h.input.value,'');
});

test('thread verification follows pages and blocks replies on failed or unrelated pages',async t=>{
  const settings={dailyCheckin:false,autoReply:true,replyText:'谢谢'};
  const a=setup(t,{url:away,settings,threadFetch:async url=>{const page=Number(String(url).split('-').at(-1));return {ok:true,status:200,text:async()=>threadPage(123,{page,next:page<2})};}});
  await a.install().run();assert.equal(a.threadRequests.length,2);assert.equal(a.posts.length,1);
  assert.deepEqual(a.threadRequests.map(([url])=>url),['/post-123-1','/post-123-2']);
  const b=setup(t,{url:away,settings,threadFetch:async()=>({ok:false,status:503,text:async()=>''})});
  const runtime=b.install();await runtime.run();await runtime.run();assert.equal(b.posts.length,0);assert.equal(b.threadRequests.length,1);
  const c=setup(t,{url:away,settings,threadFetch:async()=>({ok:true,status:200,text:async()=>threadPage(999)})});
  await c.install().run();assert.equal(c.posts.length,0);
});

test('a previous reply beyond ten thread pages still prevents automatic posting',async t=>{
  const h=setup(t,{url:away,settings:{dailyCheckin:false,autoReply:true,replyText:'谢谢'},threadFetch:async url=>{
    const page=Number(String(url).split('-').at(-1));
    return {ok:true,status:200,text:async()=>threadPage(123,{page,next:page<11,author:page===11?7:8})};
  }});
  await h.install().run();assert.equal(h.posts.length,0);assert.equal(h.threadRequests.length,11);
});

for(const [name,response] of [
  ['login redirect',{ok:true,url:'https://www.nodeseek.com/signIn',text:async()=>threadPage()}],
  ['repeated first page',{ok:true,text:async()=>threadPage(123,{page:1,next:true})}],
  ['missing comment author',{ok:true,text:async()=>threadPage().replace(/class="author-name"/,'class="unknown"')}],
  ['missing pagination',{ok:true,text:async()=>threadPage(123,{page:2,next:true}).replace(/<nav[\s\S]*<\/nav>/,'')}],
  ['missing current page',{ok:true,text:async()=>threadPage(123,{page:2}).replace(/<span[\s\S]*<\/span>/,'')}],
  ['empty partial page',{ok:true,text:async()=>'<div class="post-title"><a href="/post-123-1">抽奖帖</a></div><ul class="comments"></ul>'}],
])test(`thread verification skips ${name}`,async t=>{
  let calls=0;
  const h=setup(t,{url:away,settings:{dailyCheckin:false,autoReply:true,replyText:'谢谢'},threadFetch:async()=>++calls===1?{ok:true,text:async()=>threadPage(123,{next:true})}:response});
  await h.install().run();assert.equal(h.posts.length,0);assert.equal(h.input.value,'');
});

test('known later pages are still checked when their next link disappears from a fetched page',async t=>{
  const h=setup(t,{url:away,settings:{dailyCheckin:false,autoReply:true,replyText:'谢谢'},threadFetch:async url=>{
    const page=Number(String(url).split('-').at(-1));
    return {ok:true,text:async()=>threadPage(123,{page,author:page===2?7:8})};
  }});
  const pager=h.d.createElement('nav');pager.setAttribute('aria-label','pagination');pager.innerHTML='<a href="/post-123-2">2</a>';h.d.body.append(pager);
  await h.install().run();assert.equal(h.posts.length,0);assert.equal(h.threadRequests.length,2);
});

test('a complete first page with no comments can receive the first reply',async t=>{
  const h=setup(t,{url:away,settings:{dailyCheckin:false,autoReply:true,replyText:'参与'},threadFetch:async()=>({ok:true,text:async()=>threadPage().replace(/<li[\s\S]*<\/li>/,'')})});
  await h.install().run();assert.deepEqual(h.posts,["参与"],JSON.stringify([h.runtime.status,h.threadRequests.map(r=>r[0])]));
});

test('automatic reply posts through the API and never touches the draft or the native send button',async t=>{
  let resolvePage;const h=setup(t,{url:away,draft:'我正在写的回复',settings:{dailyCheckin:false,autoReply:true,replyText:'谢谢'},threadFetch:()=>new Promise(resolve=>{resolvePage=resolve;})});
  let clicked=false;h.d.querySelector('.submit').addEventListener('click',()=>{clicked=true;},true);
  const run=h.install().run();await tick();h.input.value='正在输入的新草稿';
  assert.equal(h.threadRequests.length,1);
  resolvePage({ok:true,status:200,text:async()=>threadPage()});await run;
  assert.deepEqual(h.commentRequests,[{content:'谢谢',mode:'new-comment',postId:123}]);
  assert.equal(clicked,false);assert.equal(h.input.value,'正在输入的新草稿');
  assert.equal(h.storage.get('nsit-auto-reply-v1-7-123').state,'done');
});

test('uncertain submissions are never automatically repeated after reload',async t=>{
  const storage=new Map();const options={storage,settings:{dailyCheckin:false,autoReply:true,replyText:'祝好运！'},confirmReply:false};
  const a=setup(t,options);await a.install().run();assert.equal(a.posts.length,1);
  const b=setup(t,options);await b.install().run();assert.equal(b.posts.length,0);
});

test('multiple tabs share the reply lock and persistent account scoped record',async t=>{
  const storage=new Map(),locks=new Set(),settings={dailyCheckin:false,autoReply:true,replyText:'接好运！'};
  const a=setup(t,{storage,locks,settings}),b=setup(t,{storage,locks,settings});
  await Promise.all([a.install().run(),b.install().run()]);assert.equal(a.posts.length+b.posts.length,1);
  const c=setup(t,{storage,locks,settings,uid:9});await c.install().run();assert.equal(c.posts.length,1);
});

test('daily checkin validates JSON, runs once per Beijing day and uses fixed rewards',async t=>{
  let now=Date.UTC(2026,9,20,15,59);const h=setup(t,{settings:{dailyCheckin:true}});h.w.Date.now=()=>now;const runtime=h.install();
  await runtime.run();await runtime.run();assert.equal(h.requests.length,1);
  assert.equal(h.requests[0][0],'/api/attendance?random=false');assert.equal(h.requests[0][1].method,'POST');
  assert.equal(h.requests[0][1].credentials,'same-origin');
  now+=2*60*1000;await runtime.run();assert.equal(h.requests.length,2);
});

test('HTTP 200 with unsuccessful JSON is not cached as attendance success',async t=>{
  let success=false;const h=setup(t,{settings:{dailyCheckin:true},fetch:async()=>({ok:true,status:200,json:async()=>({success,message:success?'签到成功':'请稍后再试'})})});
  let now=Date.UTC(2026,9,21);h.w.Date.now=()=>now;const runtime=h.install();await runtime.run();
  success=true;now+=6*60*1000;await runtime.run();assert.equal(h.requests.length,2);
  await runtime.run();assert.equal(h.requests.length,2);
});

test('server already-signed response is terminal for the day',async t=>{
  const h=setup(t,{settings:{dailyCheckin:true},fetch:async()=>({ok:true,status:200,json:async()=>({success:false,message:'今天已经签到过了'})})});
  const runtime=h.install();await runtime.run();await runtime.run();assert.equal(h.requests.length,1);
});

test('not-yet-signed server messages remain retryable failures',async t=>{
  const h=setup(t,{settings:{dailyCheckin:true},fetch:async()=>({ok:true,status:200,json:async()=>({success:false,message:'今日未签到，请稍后重试'})})});
  let now=Date.UTC(2026,9,21);h.w.Date.now=()=>now;const runtime=h.install();
  await runtime.run();now+=6*60*1000;await runtime.run();assert.equal(h.requests.length,2);
  assert.equal(h.storage.get('nsit-auto-checkin-v1-7').done,false);
});

test('changing the configured phrase before submission cancels the pending reply',async t=>{
  const h=setup(t,{url:away,settings:{dailyCheckin:false,autoReply:true,replyText:'旧语句'},threadFetch:async()=>{h.storage.set(settingsKey,{dailyCheckin:false,autoReply:true,replyText:'新语句'});return {ok:true,status:200,text:async()=>threadPage()};}});
  await h.install().run();assert.equal(h.posts.length,0);
});

test('a draw that expires while preparing is not submitted',async t=>{
  const h=setup(t,{url:away,settings:{dailyCheckin:false,autoReply:true,replyText:'祝好运'},threadFetch:async()=>{h.w.Date.now=()=>future+1;return {ok:true,status:200,text:async()=>threadPage()};}});
  await h.install().run();assert.equal(h.posts.length,0);
});

test('stalled attendance times out and does not prevent the reply task',async t=>{
  const h=setup(t,{settings:{dailyCheckin:true,autoReply:true,replyText:'祝好运'},fetch:(_url,options)=>new Promise((resolve,reject)=>{
    options.signal.addEventListener('abort',()=>reject(new Error('request aborted')),{once:true});
  })});
  const nativeTimeout=h.w.setTimeout.bind(h.w);h.w.setTimeout=(fn,delay,...args)=>nativeTimeout(fn,delay===20000?5:delay,...args);
  await h.install().run();assert.equal(h.requests.length,1);assert.equal(h.posts.length,1);
  assert.equal(h.storage.get('nsit-auto-checkin-v1-7').done,false);
});

test('no login, disabled attendance, or missing task lock causes no attendance request',async t=>{
  const a=setup(t,{uid:0,settings:{dailyCheckin:true}});await a.install().run();assert.equal(a.requests.length,0);
  const b=setup(t);await b.install().run();assert.equal(b.requests.length,0);
  const c=setup(t,{settings:{dailyCheckin:true}});Object.defineProperty(c.w.navigator,'locks',{value:undefined});await c.install().run();assert.equal(c.requests.length,0);
});

for(const [name,link] of [
  ['an http link',`http://www.nodeseek.com/lucky?post=123&time=${future}&count=1`],
  ['a link without www',`https://nodeseek.com/lucky?post=123&time=${future}&count=1`],
  ['a /lucky/ path',`https://www.nodeseek.com/lucky/?post=123&time=${future}&count=1`],
  ['a relative link',`/lucky?post=123&time=${future}&count=1&start=1&duplicate=false&mode=view`],
  ['an &amp; escaped link',`https://www.nodeseek.com/lucky?post=123&amp;time=${future}&amp;count=1`],
])test(`auto reply recognizes ${name}`,async t=>{
  const h=setup(t,{link:link.replace(/&/g,'&amp;'),settings:{dailyCheckin:false,autoReply:true,replyText:'参与'}});
  await h.install().run();assert.deepEqual(h.posts,['参与'],JSON.stringify(h.runtime.status));
});

test('auto reply recognizes a lottery link written as plain text or code',async t=>{
  const h=setup(t,{settings:{dailyCheckin:false,autoReply:true,replyText:'参与'}});
  h.d.querySelector('.post-content').innerHTML=`开奖：<code>https://www.nodeseek.com/lucky?post=123&amp;time=${future}&amp;count=1</code>`;
  h.w.__config__.postData.comments[0].markdown='见正文';
  await h.install().run();assert.deepEqual(h.posts,['参与'],JSON.stringify(h.runtime.status));
});

test('a bare lottery path inside another site URL is not treated as this site',async t=>{
  const h=setup(t,{settings:{dailyCheckin:false,autoReply:true,replyText:'参与'}});
  h.d.querySelector('.post-content').textContent=`https://example.com/lucky?post=123&time=${future}`;
  h.w.__config__.postData.comments[0].markdown=`https://example.com/lucky?post=123&time=${future}`;
  await h.install().run();assert.equal(h.posts.length,0);
});

test('auto reply on a later page reads the lottery link from page one',async t=>{
  const link=`https://www.nodeseek.com/lucky?post=123&amp;time=${future}&amp;count=1`;
  const h=setup(t,{url:'https://www.nodeseek.com/post-123-2',settings:{dailyCheckin:false,autoReply:true,replyText:'参与'},
    threadFetch:async url=>({ok:true,status:200,url:String(url),text:async()=>`<div class="content-item" id="0"><div class="post-content"><a href="${link}">开奖</a></div></div>`+threadPage(123,{page:Number(String(url).split('-').at(-1))})})});
  h.d.querySelector('.content-item[id="0"]').remove();
  h.w.__config__.postData.comments=[];
  await h.install().run();assert.deepEqual(h.posts,['参与'],JSON.stringify(h.runtime.status));
});

test('a single-page thread is verified in place without fetching it again',async t=>{
  const h=setup(t,{settings:{dailyCheckin:false,autoReply:true,replyText:'参与'}});
  await h.install().run();assert.deepEqual(h.posts,['参与']);assert.equal(h.threadRequests.length,0);
});

test('other thread pages are fetched concurrently and the open page is skipped',async t=>{
  const resolvers=[];
  const h=setup(t,{settings:{dailyCheckin:false,autoReply:true,replyText:'参与'},threadFetch:url=>new Promise(resolve=>resolvers.push(()=>resolve({ok:true,status:200,text:async()=>threadPage(123,{page:Number(String(url).split('-').at(-1))})})))});
  const pager=h.d.createElement('nav');pager.setAttribute('aria-label','pagination');pager.innerHTML='<a href="/post-123-2">2</a><a href="/post-123-4">4</a>';h.d.body.append(pager);
  const run=h.install().run();
  for(let i=0;i<200&&h.threadRequests.length<3;i++)await tick();
  assert.deepEqual(h.threadRequests.map(([url])=>url),['/post-123-2','/post-123-3','/post-123-4']);
  while(resolvers.length)resolvers.shift()();
  await run;assert.deepEqual(h.posts,['参与']);
});

test('a slow check-in does not hold back the automatic reply',async t=>{
  let finish;const h=setup(t,{settings:{dailyCheckin:true,autoReply:true,replyText:'参与'},fetch:()=>new Promise(resolve=>{finish=resolve;})});
  const run=h.install().run();for(let i=0;i<50&&!h.posts.length;i++)await tick();
  assert.deepEqual(h.posts,['参与']);
  finish({ok:true,status:200,json:async()=>({success:true,message:'签到成功'})});await run;
});

function quickReply(t,options={}){
  const h=setup(t,options);h.w.testApi.installToolbar(h.app);h.w.testApi.installQuickReply(h.app);
  const group=h.app.querySelector('.nsit-quick-reply');
  return {...h,group,send:group.querySelector('[data-nsit-quick-send]'),edit:group.querySelector('[data-nsit-quick-edit]'),panel:group.querySelector('[data-nsit-quick-panel]')};
}

test('quick reply sits next to the tools toggle and sends the saved phrase',async t=>{
  const h=quickReply(t,{storage:new Map([['nsit-quick-reply-v1','感谢分享']])});
  assert.equal(h.app.querySelector('.nsit-toolbox').nextElementSibling,h.group);
  h.send.click();for(let i=0;i<10&&!h.posts.length;i++)await tick();
  assert.deepEqual(h.posts,['感谢分享']);
});

test('quick reply text is edited in its own panel and an empty phrase opens it',async t=>{
  const h=quickReply(t);
  h.send.click();assert.equal(h.panel.hidden,false);assert.equal(h.posts.length,0);
  h.panel.querySelector('textarea').value='  好帖，支持  ';h.panel.querySelector('[data-nsit-quick-save]').click();
  assert.equal(h.panel.hidden,true);assert.equal(h.storage.get('nsit-quick-reply-v1'),'好帖，支持');
  h.edit.click();assert.equal(h.panel.hidden,false);assert.equal(h.panel.querySelector('textarea').value,'好帖，支持');
  h.d.body.click();assert.equal(h.panel.hidden,true);
});

test('quick reply posts through the API, keeps the draft and never clicks the native send button',async t=>{
  const h=quickReply(t,{draft:'我的草稿',storage:new Map([['nsit-quick-reply-v1','感谢分享']])});
  let clicked=false;h.d.querySelector('.submit').addEventListener('click',()=>{clicked=true;},true);
  h.send.click();h.send.click();for(let i=0;i<10&&!h.posts.length;i++)await tick();await tick();
  assert.deepEqual(h.commentRequests,[{content:'感谢分享',mode:'new-comment',postId:123}]);
  assert.equal(clicked,false);assert.equal(h.input.value,'我的草稿');assert.equal(h.send.textContent,'已发送');
});

test('quick reply shows the reason when the site rejects it',async t=>{
  const h=quickReply(t,{storage:new Map([['nsit-quick-reply-v1','感谢分享']]),commentFetch:async()=>({ok:true,status:200,json:async()=>({success:false,message:'评论太频繁'})})});
  h.send.click();for(let i=0;i<10&&!h.commentRequests.length;i++)await tick();await tick();
  assert.equal(h.send.textContent,'未发送：评论太频繁');
});

test('quick reply is hidden when its feature switch is off',async t=>{
  const h=quickReply(t);assert.equal(h.group.style.display,'');
  h.w.testApi.saveFlags({quickReply:false});h.w.testApi.applyFlags(h.app);assert.equal(h.group.style.display,'none');
});

test('a rejected automatic reply is reported and not retried',async t=>{
  const h=setup(t,{settings:{dailyCheckin:false,autoReply:true,replyText:'参与'},commentFetch:async()=>({ok:true,status:200,json:async()=>({success:false,message:'评论太频繁'})})});
  const runtime=h.install();await runtime.run();await runtime.run();
  assert.equal(h.commentRequests.length,1);assert.match(runtime.status.reply,/评论太频繁/);
});

test('an automatic reply records lottery participation',async t=>{
  const h=setup(t,{settings:{dailyCheckin:false,autoReply:true,replyText:'参与'}});
  await h.install().run();
  const stored=JSON.stringify([...h.storage.entries()])+JSON.stringify({...h.w.localStorage});
  assert.match(stored,/participated\\*"\s*:\s*true/,'participation stored');
});
