const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const pause=()=>new Promise(resolve=>setTimeout(resolve,30));
const card=(floor,uid)=>`<div class="content-item" id="${floor}"><div class="nsk-content-meta-info"><div><div class="author-info"><a class="author-name" href="/space/${uid}">User${uid}</a></div><div class="content-info">刚刚</div></div></div><article class="post-content">正文</article></div>`;
const response=uid=>({success:true,detail:{member_id:Number(uid),rank:5,coin:2682,stardust:2,nPost:63,nComment:381,created_at:'2024-08-23T09:52:34.000Z'}});
async function setup(t,{html=card(0,19096)+card(1,69223),fetch,cache,autoVisible=true,intersectionObserver=true}={}) {
  const dom=new JSDOM(html,{url:'https://www.nodeseek.com/post-1002235-1',runScripts:'outside-only'});
  const w=dom.window,d=w.document,requests=[],intersections=[];
  t.after(()=>{w.testRuntime?.disconnect();w.close();});
  let enabled=true;
  w.featureEnabled=()=>enabled;
  w.injectStyles=()=>{};
  w.fetch=async(url,options)=>{requests.push({url,options});return fetch?fetch(url,options):{ok:true,json:async()=>response(url.match(/getInfo\/(\d+)/)[1])};};
  w.IntersectionObserver=intersectionObserver?class{constructor(fn){this.fn=fn;intersections.push(this);this.nodes=new Set();}observe(node){this.nodes.add(node);}unobserve(node){this.nodes.delete(node);}disconnect(){this.nodes.clear();}}:undefined;
  if(cache)w.sessionStorage.setItem('nsit-author-info-cache-v1',cache);
  w.eval(`${fs.readFileSync(path.join(__dirname,'../src/author-info.js'),'utf8')}\nwindow.testRuntime=installAuthorInfo();`);
  const visible=(isIntersecting=true)=>intersections.forEach(o=>o.fn([...o.nodes].map(target=>({target,isIntersecting}))));
  await pause();if(autoVisible)visible();await pause();await pause();
  return {w,d,requests,visible,enable(value){enabled=value;w.testRuntime.schedule();}};
}

test('shows official public information for both the topic author and replies',async t=>{
  const h=await setup(t);
  for(const floor of [0,1]) {
    const row=h.d.getElementById(String(floor)).querySelector('[data-nsit-author-info]');
    assert.ok(row);assert.match(row.textContent,/Lv 5/);assert.match(row.textContent,/鸡腿 2682/);
    assert.match(row.textContent,/星辰 2/);assert.match(row.textContent,/主题 63/);assert.match(row.textContent,/评论 381/);assert.match(row.textContent,/加入 \d+ 天/);
  }
  assert.equal(h.requests.length,2);
  assert.equal(h.requests[0].options.credentials,'same-origin');
});

test('deduplicates a user across floors and reused renders',async t=>{
  const h=await setup(t,{html:card(0,19096)+card(1,19096)});
  assert.equal(h.requests.length,1);h.w.testRuntime.schedule();await pause();
  assert.equal(h.d.querySelectorAll('[data-nsit-author-info]').length,2);
  assert.equal(h.requests.length,1);
});

test('handles newly appended nested replies and reads cached users without another request',async t=>{
  const h=await setup(t,{html:card(0,19096)});
  h.d.body.insertAdjacentHTML('beforeend',card(11,19096)+card(12,69223));h.w.testRuntime.schedule();await pause();h.visible();await pause();await pause();
  assert.equal(h.d.querySelectorAll('[data-nsit-author-info]').length,3);assert.equal(h.requests.length,2);
});

test('disabling removes only added information and enabling restores cached values',async t=>{
  const h=await setup(t);h.enable(false);await pause();
  assert.equal(h.d.querySelector('[data-nsit-author-info]'),null);assert.equal(h.d.querySelectorAll('.author-name').length,2);
  h.enable(true);await pause();assert.equal(h.d.querySelectorAll('[data-nsit-author-info]').length,2);assert.equal(h.requests.length,2);
});

test('failed or mismatched profiles never show fabricated information or keep retrying',async t=>{
  const h=await setup(t,{fetch:async()=>({ok:true,json:async()=>response(999)})});
  assert.equal(h.d.querySelector('[data-nsit-author-info]'),null);
  h.w.testRuntime.schedule();await pause();h.visible();await pause();assert.equal(h.requests.length,2);
});

test('missing optional fields stay absent while zero and negative balances remain valid',async t=>{
  const h=await setup(t,{html:card(0,19096),fetch:async()=>({ok:true,json:async()=>({success:true,detail:{member_id:19096,rank:0,coin:-1,nPost:0}})})});
  const text=h.d.querySelector('[data-nsit-author-info]').textContent;
  assert.match(text,/Lv 0/);assert.match(text,/鸡腿 -1/);assert.match(text,/主题 0/);
  assert.doesNotMatch(text,/评论|星辰|加入|NaN|undefined/);
});

test('only requests visible native authors with same-site numeric member ids',async t=>{
  const h=await setup(t,{html:card(0,19096).replace('/space/19096','https://example.com/space/19096')+card(1,'bad')});
  assert.equal(h.requests.length,0);assert.equal(h.d.querySelector('[data-nsit-author-info]'),null);
});

test('defers requests until an author enters the viewport',async t=>{
  const h=await setup(t,{autoVisible:false});assert.equal(h.requests.length,0);
  h.visible();await pause();await pause();assert.equal(h.requests.length,2);
});

test('reuses valid session cache and refreshes expired profiles',async t=>{
  const cache=JSON.stringify([{uid:'19096',at:Date.now(),profile:response(19096).detail},{uid:'69223',at:Date.now()-11*60*1000,profile:response(69223).detail}]);
  const h=await setup(t,{cache});assert.equal(h.requests.length,1);assert.match(h.requests[0].url,/69223/);
  assert.equal(h.d.querySelectorAll('[data-nsit-author-info]').length,2);
});

test('refreshes an expired profile while its author stays visible',async t=>{
  let coin=100;
  const h=await setup(t,{html:card(0,19096),fetch:async()=>({ok:true,json:async()=>({...response(19096),detail:{...response(19096).detail,coin}})})});
  const later=h.w.Date.now()+11*60*1000;h.w.Date.now=()=>later;coin=200;
  h.w.testRuntime.schedule();await pause();await pause();
  assert.equal(h.requests.length,2);assert.match(h.d.querySelector('[data-nsit-author-info]').textContent,/鸡腿 200/);
});

test('retries a visible author after a temporary failure backoff',async t=>{
  let calls=0;
  const h=await setup(t,{html:card(0,19096),fetch:async()=>++calls===1?{ok:false,status:503}:{ok:true,json:async()=>response(19096)}});
  assert.equal(h.requests.length,1);assert.equal(h.d.querySelector('[data-nsit-author-info]'),null);
  h.w.testRuntime.schedule();await pause();assert.equal(h.requests.length,1);
  const later=h.w.Date.now()+4*60*1000;h.w.Date.now=()=>later;
  h.w.testRuntime.schedule();await pause();await pause();
  assert.equal(h.requests.length,2);assert.ok(h.d.querySelector('[data-nsit-author-info]'));
});

test('keeps expired offscreen authors lazy until they become visible again',async t=>{
  const h=await setup(t,{html:card(0,19096)});h.visible(false);
  const later=h.w.Date.now()+11*60*1000;h.w.Date.now=()=>later;
  h.w.testRuntime.schedule();await pause();assert.equal(h.requests.length,1);
  h.visible();await pause();await pause();assert.equal(h.requests.length,2);
});

for(const intersectionObserver of [true,false])test(`cache eviction does not requery freshly displayed authors (IntersectionObserver: ${intersectionObserver})`,async t=>{
  const h=await setup(t,{html:Array.from({length:201},(_,i)=>card(i,i+1)).join(''),intersectionObserver});
  await pause();await pause();
  assert.equal(h.d.querySelectorAll('[data-nsit-author-info]').length,201);
  const count=h.requests.length;await pause();await pause();
  assert.equal(h.requests.length,count,'settled cards must not start a cache eviction request loop');
});

test('rate limits pause the remaining lookup queue and preserve native headers',async t=>{
  const h=await setup(t,{html:[1,2,3,4].map(n=>card(n,n)).join(''),fetch:async()=>({ok:false,status:429})});
  assert.equal(h.requests.length,2);assert.equal(h.d.querySelector('[data-nsit-author-info]'),null);
  assert.equal(h.d.querySelectorAll('.author-name').length,4);
});

test('limits concurrent public profile lookups to two',async t=>{
  const pending=[];let running=0,max=0;
  const h=await setup(t,{html:[1,2,3,4,5].map(n=>card(n,n)).join(''),fetch:(url)=>new Promise(resolve=>{running++;max=Math.max(max,running);pending.push(()=>{running--;resolve({ok:true,json:async()=>response(url.match(/getInfo\/(\d+)/)[1])});});})});
  assert.equal(h.requests.length,2);
  while(pending.length){pending.shift()();await pause();}
  await pause();assert.equal(max,2);assert.equal(h.requests.length,5);assert.equal(h.d.querySelectorAll('[data-nsit-author-info]').length,5);
});
