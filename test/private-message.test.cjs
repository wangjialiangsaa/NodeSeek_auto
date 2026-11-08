const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

// 照站点私信组件的结构：纯文本 textarea（Markdown 关）/ 工具栏 + CodeMirror（Markdown 开）/ 底部开关与发送按钮。
const page='<div class="message-input"><textarea name="message-input" class="input-area"></textarea><div class="input-area" style="display: none;"><div class="mde-toolbar"></div><div class="cm-wrapper"><div id="code-mirror-editor"><div class="CodeMirror"><textarea></textarea></div></div></div></div><div style="display: flex;"><span>Markdown</span><label class="vue-js-switch"><input type="checkbox" class="v-switch-input"></label><button class="btn">发送</button></div></div>';

async function setup(t,file,{markdown=false,stickers}={}) {
  const dom=new JSDOM(`<html><head></head><body>${page}</body></html>`,{url:'https://www.nodeseek.com/notification#/message?mode=talk&to=7',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document,observers=[],NativeObserver=w.MutationObserver;
  w.MutationObserver=class extends NativeObserver{constructor(callback){super(callback);observers.push(this);}};
  t.after(()=>{w.__nodeSeekAuthorInfo__?.disconnect();observers.forEach(o=>o.disconnect());w.close();});
  const storage=new Map([['nsit-auto-settings-v1',{dailyCheckin:false}]]);
  if(stickers)storage.set('nsit-stickers-v1',stickers);
  w.GM_getValue=(key,fallback)=>storage.has(key)?storage.get(key):fallback;
  w.GM_setValue=(key,value)=>storage.set(key,value);
  w.GM_registerMenuCommand=()=>{};
  w.GM_addStyle=css=>{const s=d.createElement('style');s.textContent=css;d.head.append(s);return s;};
  let uploads=0;
  w.GM_xmlhttpRequest=options=>{queueMicrotask(()=>options.onload({status:200,response:options.method==='GET'?{api_key:'k'}:{success:true,links:{markdown:`![image](https://cdn.nodeimage.com/i/pm-${++uploads}.png)`}}}));return {abort(){}};};
  w.fetch=async()=>({ok:false,status:503,json:async()=>({})});
  w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  const plain=d.querySelector('.message-input > textarea'),md=d.querySelector('.message-input > div.input-area');
  let value='',cursor=0;
  const cm={getValue:()=>value,setValue(v){value=v;cursor=0;},focus(){},refresh(){},on(){},getInputField:()=>d.querySelector('.CodeMirror textarea'),getOption:()=>false,
    lastLine:()=>value.split('\n').length-1,getLine:n=>value.split('\n')[n],
    setCursor(pos){const lines=value.split('\n');cursor=lines.slice(0,pos.line).reduce((n,l)=>n+l.length+1,0)+pos.ch;},
    getCursor:()=>cm.posFromIndex(cursor),indexFromPos(pos){const lines=value.split('\n');return lines.slice(0,pos.line).reduce((n,l)=>n+l.length+1,0)+pos.ch;},
    posFromIndex(i){const before=value.slice(0,i).split('\n');return {line:before.length-1,ch:before.at(-1).length};},
    replaceSelection(text){value=value.slice(0,cursor)+text+value.slice(cursor);cursor+=text.length;},
    replaceRange(text,from,to){const a=cm.indexFromPos(from),b=cm.indexFromPos(to);value=value.slice(0,a)+text+value.slice(b);cursor=a+text.length;},setSelection(){}};
  d.querySelector('.CodeMirror').CodeMirror=cm;
  // 站点开关：切到 Markdown 时把纯文本框的内容带进 CodeMirror。
  const setMode=on=>{plain.style.display=on?'none':'';md.style.display=on?'':'none';if(on)cm.setValue(plain.value);};
  d.querySelector('.vue-js-switch input').addEventListener('change',event=>setMode(event.target.checked));
  if(markdown){d.querySelector('.vue-js-switch input').checked=true;setMode(true);}
  let sends=0;d.querySelector('.message-input button.btn').addEventListener('click',()=>sends++);
  w.eval(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
  await pause(120);
  return {w,d,plain,cm,value:()=>value,setValue:v=>{value=v;cursor=v.length;},sends:()=>sends,markdownOn:()=>plain.style.display==='none'};
}

for(const file of ['NodeSeek Issue Templates.user.js','NodeSeek Issue Templates.min.user.js']) {
  test(`${file}: private messages show the tools next to 发送 even with Markdown off`,async t=>{
    const {d}=await setup(t,file);
    const app=d.getElementById('nsit-app');
    assert.ok(app,'script mounted');
    assert.equal(app.nextElementSibling,d.querySelector('.message-input button.btn'));
    assert.equal(app.closest('.mde-toolbar'),null,'not inside the hidden Markdown toolbar');
    assert.ok(app.querySelector('.nsit-sticker'));
    assert.ok(app.querySelector('.nsit-toolbox'));
  });

  test(`${file}: private messages: clicking a sticker switches on Markdown, keeps typed text and inserts at the end`,async t=>{
    const h=await setup(t,file,{stickers:{groups:[{id:'default',name:'默认',items:[{id:'a',name:'狗头',url:'https://cdn.nodeimage.com/i/dog.png'}]}],active:'default'}});
    h.plain.value='你好';
    h.d.querySelector('[data-nsit-sticker-toggle]').click();
    h.d.querySelector('[data-nsit-sticker-item="a"]').click();
    assert.equal(h.markdownOn(),true);
    assert.equal(h.value(),'你好![狗头](https://cdn.nodeimage.com/i/dog.png)');
  });

  test(`${file}: private messages: pasting an image into the plain box uploads it as Markdown`,async t=>{
    const h=await setup(t,file);
    const image=new h.w.File(['x'],'a.png',{type:'image/png'});
    const event=new h.w.Event('paste',{bubbles:true,cancelable:true});
    Object.defineProperty(event,'clipboardData',{value:{items:[{kind:'file',type:'image/png',getAsFile:()=>image}],files:[image]}});
    h.plain.dispatchEvent(event);
    assert.equal(event.defaultPrevented,true);
    assert.equal(h.markdownOn(),true);
    for(let i=0;i<8;i++)await pause(0);
    assert.match(h.value(),/^!\[image\]\(https:\/\/cdn\.nodeimage\.com\/i\/pm-1\.png\)$/);
  });

  test(`${file}: private messages: Enter sends, Shift+Enter adds a line, empty drafts are not sent`,async t=>{
    const h=await setup(t,file);
    const key=(target,options={})=>{const e=new h.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true,...options});target.dispatchEvent(e);return e;};
    key(h.plain);assert.equal(h.sends(),0,'empty');
    h.plain.value='在吗';h.plain.setSelectionRange(2,2);
    assert.equal(key(h.plain,{shiftKey:true}).defaultPrevented,true);
    assert.equal(h.plain.value,'在吗\n');assert.equal(h.sends(),0);
    assert.equal(key(h.plain).defaultPrevented,true);assert.equal(h.sends(),1);
    h.d.querySelector('.vue-js-switch input').click();
    h.setValue('markdown 内容');
    key(h.d.querySelector('.CodeMirror textarea'));assert.equal(h.sends(),2);
  });
}
