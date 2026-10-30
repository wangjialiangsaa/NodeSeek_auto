const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

function setup(t,{codeMirror=false,saved,request}={}) {
  const dom=new JSDOM('<html><head></head><body><form><div id="editor-body"><div class="window_header"></div><textarea>left right</textarea></div><button class="submit">发布评论</button></form></body></html>',{url:'https://www.nodeseek.com/post-123-1',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document,requests=[],storage=new Map(),prompts=[],confirms=[];
  t.after(()=>w.close());
  if(saved)storage.set('nsit-stickers-v1',saved);
  w.__NSIT_VENDOR_ASSET__=()=>'';
  w.GM_getValue=(key,fallback)=>storage.get(key)??fallback;
  w.GM_setValue=(key,value)=>storage.set(key,value);
  w.GM_addStyle=css=>{const style=d.createElement('style');style.textContent=css;d.head.append(style);};
  w.matchMedia=()=>({matches:false,addEventListener(){}});
  w.prompt=(...args)=>{prompts.push(args);return prompts.answers?.shift()??null;};
  w.confirm=message=>{confirms.push(message);return true;};
  let uploads=0;
  w.GM_xmlhttpRequest=options=>{
    requests.push(options);
    if(request)request(options);
    else queueMicrotask(()=>options.onload({status:200,response:options.method==='GET'?{api_key:'test-key'}:{success:true,links:{markdown:`![image](https://cdn.nodeimage.com/i/sticker-${++uploads}.png)`}}}));
    return {abort(){}};
  };
  const source=['config.js','ui.js','logic.js','image-upload.js','toolbar.js','stickers.js','auto-tasks.js'].map(file=>fs.readFileSync(path.join(__dirname,'..','src',file),'utf8')).join('\n');
  w.eval(`(function(){${source}\nwindow.createTestApp=createApp;window.installTestToolbar=installEditorToolbar;window.installTestStickers=installStickers;window.installTestUploads=installImageUploads;window.saveTestFlags=saveFeatureFlags;window.applyTestFlags=applyEditorFeatureFlags;})();`);
  const app=w.createTestApp({replyMode:true});
  d.querySelector('.window_header').append(app);
  app._nsitEditor=d.querySelector('#editor-body');
  let input=d.querySelector('#editor-body>textarea');
  let cm;
  if(codeMirror) {
    let value=input.value,start=5,end=5;
    const wrapper=d.createElement('div');wrapper.className='CodeMirror';
    wrapper.innerHTML='<textarea></textarea>';input.replaceWith(wrapper);input=wrapper.querySelector('textarea');
    cm={getValue:()=>value,focus(){},replaceSelection(text){value=value.slice(0,start)+text+value.slice(end);start=end=start+text.length;}};
    wrapper.CodeMirror=cm;
  } else input.setSelectionRange(5,5);
  w.installTestUploads(app);
  w.installTestToolbar(app);
  w.installTestStickers(app);
  const file=name=>new w.File(['fixture'],name||'image.png',{type:'image/png'});
  const paste=(files=[file()],target=input)=>{
    const event=new w.Event('paste',{bubbles:true,cancelable:true});
    Object.defineProperty(event,'clipboardData',{value:{items:files.map(f=>({kind:'file',type:f.type,getAsFile:()=>f})),files}});
    target.dispatchEvent(event);return event;
  };
  const q=selector=>app.querySelector(selector);
  const answer=(...values)=>{prompts.answers=values;};
  const stored=()=>{const value=storage.get('nsit-stickers-v1');return value===undefined?undefined:JSON.parse(JSON.stringify(value));};
  return {w,d,app,q,input,cm,requests,storage,stored,prompts,confirms,answer,file,paste,value:()=>cm?cm.getValue():input.value};
}

test('sticker button sits left of the tools toggle and opens a panel with a default group',async t=>{
  const {q}=setup(t);
  const sticker=q('.nsit-sticker'),toolbox=q('.nsit-toolbox');
  assert.ok(sticker,'sticker button exists');
  assert.equal(sticker.nextElementSibling,toolbox);
  const toggle=q('[data-nsit-sticker-toggle]'),panel=q('[data-nsit-sticker-panel]');
  assert.equal(panel.hidden,true);
  toggle.click();
  assert.equal(panel.hidden,false);
  assert.equal(toggle.getAttribute('aria-expanded'),'true');
  assert.equal(q('[data-nsit-sticker-group]').textContent,'默认');
  assert.match(q('.nsit-sticker-empty').textContent,/粘贴图片/);
});

test('pasting while the panel is open uploads to the gallery and saves into the current group, not the editor',async t=>{
  const h=setup(t);
  h.q('[data-nsit-sticker-toggle]').click();
  const event=h.paste([h.file('doge.png'),h.file('image.png')]);
  assert.equal(event.defaultPrevented,true);
  assert.equal(h.q('[data-nsit-sticker-grid]').querySelectorAll('[data-pending]').length,2);
  for(let i=0;i<6;i++)await tick();
  const items=h.stored().groups[0].items;
  assert.deepEqual(items.map(item=>item.name),['doge','表情2']);
  assert.match(items[0].url,/^https:\/\/cdn\.nodeimage\.com\/i\/sticker-\d\.png$/);
  assert.equal(h.value(),'left right','editor untouched');
  assert.equal(h.q('[data-nsit-sticker-grid]').querySelectorAll('[data-nsit-sticker-item] img').length,2);
});

test('pasting with the panel closed still goes to the normal image upload',async t=>{
  const h=setup(t);
  h.paste();
  for(let i=0;i<6;i++)await tick();
  assert.equal(h.stored(),undefined);
  assert.match(h.value(),/!\[image\]\(https:\/\/cdn\.nodeimage\.com/);
});

for(const codeMirror of [false,true]) {
  test(`${codeMirror?'CodeMirror':'textarea'}: clicking a sticker inserts it at the cursor and closes the panel`,async t=>{
    const h=setup(t,{codeMirror,saved:{groups:[{id:'default',name:'默认',items:[{id:'a',name:'狗头',url:'https://cdn.nodeimage.com/i/dog.png'}]}],active:'default'}});
    h.q('[data-nsit-sticker-toggle]').click();
    h.q('[data-nsit-sticker-item="a"]').click();
    assert.equal(h.value(),'left ![狗头](https://cdn.nodeimage.com/i/dog.png)right');
    assert.equal(h.q('[data-nsit-sticker-panel]').hidden,true);
  });
}

test('groups can be created, switched, renamed and deleted; uploads land in the active group',async t=>{
  const h=setup(t);
  h.q('[data-nsit-sticker-toggle]').click();
  h.answer('猫猫');
  h.q('[data-nsit-sticker-add-group]').click();
  let data=h.stored();
  assert.deepEqual(data.groups.map(group=>group.name),['默认','猫猫']);
  assert.equal(data.active,data.groups[1].id);
  h.paste([h.file('cat.png')]);
  for(let i=0;i<6;i++)await tick();
  data=h.stored();
  assert.equal(data.groups[1].items[0].name,'cat');
  assert.equal(data.groups[0].items.length,0);
  h.q('[data-nsit-sticker-manage]').click();
  h.answer('喵');
  h.q('[data-nsit-sticker-rename-group]').click();
  assert.equal(h.stored().groups[1].name,'喵');
  h.q('[data-nsit-sticker-delete-group]').click();
  assert.equal(h.confirms.length,1);
  assert.deepEqual(h.stored().groups.map(group=>group.name),['默认']);
  h.q('[data-nsit-sticker-delete-group]').click();
  assert.equal(h.stored().groups.length,1,'last group kept');
  assert.match(h.q('[data-nsit-sticker-status]').textContent,/至少保留/);
});

test('in manage mode stickers can be renamed, moved and deleted instead of inserted',async t=>{
  const h=setup(t,{saved:{groups:[{id:'default',name:'默认',items:[{id:'a',name:'狗头',url:'https://cdn.nodeimage.com/i/dog.png'},{id:'b',name:'笑',url:'https://cdn.nodeimage.com/i/lol.png'}]},{id:'g2',name:'收藏',items:[]}],active:'default'}});
  h.q('[data-nsit-sticker-toggle]').click();
  h.q('[data-nsit-sticker-manage]').click();
  h.answer('大狗头');
  h.q('[data-nsit-sticker-item="a"]').click();
  assert.equal(h.stored().groups[0].items[0].name,'大狗头');
  assert.equal(h.value(),'left right');
  h.answer('1');
  h.q('[data-nsit-sticker-item="b"] [data-nsit-sticker-action="move"]').click();
  assert.deepEqual(h.stored().groups.map(group=>group.items.map(item=>item.id)),[['a'],['b']]);
  h.q('[data-nsit-sticker-item="a"] [data-nsit-sticker-action="delete"]').click();
  assert.deepEqual(h.stored().groups[0].items,[]);
});

test('failed uploads report in the panel and are not saved',async t=>{
  const h=setup(t,{request:options=>queueMicrotask(()=>options.onload(options.method==='GET'?{status:200,response:{api_key:'k'}}:{status:500,response:{success:false,message:'图库满了'}}))});
  h.q('[data-nsit-sticker-toggle]').click();
  h.paste();
  for(let i=0;i<6;i++)await tick();
  assert.equal(h.stored(),undefined);
  assert.match(h.q('[data-nsit-sticker-status]').textContent,/上传失败/);
});

test('sticker button follows its feature flag and the panel closes on outside click',async t=>{
  const h=setup(t);
  h.q('[data-nsit-sticker-toggle]').click();
  h.d.body.click();
  assert.equal(h.q('[data-nsit-sticker-panel]').hidden,true);
  h.w.saveTestFlags({stickers:false});
  h.w.applyTestFlags(h.app);
  assert.equal(h.q('.nsit-sticker').style.display,'none');
});
