const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

function setup(t,{codeMirror=false,request}={}) {
  const dom=new JSDOM('<html><head></head><body><form><div id="editor-body"><div class="window_header"></div><textarea>left right</textarea></div><button class="submit">发布评论</button></form></body></html>',{url:'https://www.nodeseek.com/post-123-1',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document,requests=[],storage=new Map();
  t.after(()=>w.close());
  w.__NSIT_VENDOR_ASSET__=()=>'';
  w.GM_getValue=(key,fallback)=>storage.get(key)??fallback;
  w.GM_setValue=(key,value)=>storage.set(key,value);
  w.GM_addStyle=css=>{const style=d.createElement('style');style.textContent=css;d.head.append(style);};
  w.matchMedia=()=>({matches:false,addEventListener(){}});
  w.GM_xmlhttpRequest=options=>{
    requests.push(options);
    if(request)request(options);
    else queueMicrotask(()=>options.onload({status:200,response:options.method==='GET'?{api_key:'test-key'}:{success:true,links:{markdown:'![image](https://nodeimage.com/test.png)'}}}));
    return {abort(){}};
  };
  const source=['config.js','ui.js','logic.js','image-upload.js'].map(file=>{
    const location=path.join(__dirname,'..','src',file);
    return fs.existsSync(location)?fs.readFileSync(location,'utf8'):'';
  }).join('\n');
  w.eval(`(function(){${source}\nwindow.createTestApp=createApp;window.installTestUploads=typeof installImageUploads==='function'?installImageUploads:()=>{};window.testUploader=typeof uploadNodeImage==='function'?uploadNodeImage:null;})();`);
  const app=w.createTestApp({replyMode:true});
  d.querySelector('.window_header').append(app);
  app._nsitEditor=d.querySelector('#editor-body');
  let input=d.querySelector('#editor-body>textarea');
  let cm;
  if(codeMirror) {
    let value=input.value,start=5,end=5;
    const wrapper=d.createElement('div');wrapper.className='CodeMirror';
    wrapper.innerHTML='<textarea></textarea>';input.replaceWith(wrapper);input=wrapper.querySelector('textarea');
    cm={getValue:()=>value,getCursor:which=>({line:0,ch:which==='to'?end:start}),indexFromPos:pos=>pos.ch,posFromIndex:index=>({line:0,ch:index}),getSelection:()=>value.slice(start,end),focus(){},
      replaceRange(text,from,to=from){value=value.slice(0,from.ch)+text+value.slice(to.ch);start=end=from.ch+text.length;},
      replaceSelection(text){this.replaceRange(text,{line:0,ch:start},{line:0,ch:end});},
      setSelection(from,to=from){start=from.ch;end=to.ch;},
    };
    wrapper.CodeMirror=cm;
  } else input.setSelectionRange(5,5);
  w.installTestUploads(app);
  const file=name=>new w.File(['fixture'],name||'pasted.png',{type:'image/png'});
  const paste=(files=[file()],target=input)=>{
    const event=new w.Event('paste',{bubbles:true,cancelable:true});
    Object.defineProperty(event,'clipboardData',{value:{items:files.map(f=>({kind:'file',type:f.type,getAsFile:()=>f})),files}});
    target.dispatchEvent(event);return event;
  };
  return {w,d,app,input,cm,requests,storage,file,paste,value:()=>cm?cm.getValue():input.value};
}

test('pink image chooser follows the sell template and can select multiple images',async t=>{
  const {d,app,file,requests,value}=setup(t);
  const sell=app.querySelector('.nsit-trigger'),button=app.querySelector('.nsit-image-trigger');
  assert.ok(button,'upload button exists');
  assert.equal(sell.nextElementSibling,button);
  assert.equal(button.textContent,'上传图片');
  const picker=app.querySelector('[data-nsit-image-files]');
  assert.equal(picker.multiple,true);
  assert.equal(picker.accept,'image/*');
  let opened=0;picker.click=()=>opened++;button.click();assert.equal(opened,1);
  Object.defineProperty(picker,'files',{value:[file()]});
  picker.dispatchEvent(new d.defaultView.Event('change',{bubbles:true}));
  await tick();await tick();
  assert.equal(requests.filter(r=>r.method==='POST').length,1);
  assert.match(value(),/^left !\[image\].*right$/s);
});

for(const codeMirror of [false,true]) {
  test(`${codeMirror?'CodeMirror':'textarea'}: paste uploads at cursor and preserves typing during request`,async t=>{
    let finish;
    const h=setup(t,{codeMirror,request:options=>{
      if(options.method==='GET')queueMicrotask(()=>options.onload({status:200,response:{api_key:'key'}}));
      else finish=()=>options.onload({status:200,response:{success:true,links:{markdown:'![shot](https://nodeimage.com/shot.png)'}}});
    }});
    const event=h.paste();assert.equal(event.defaultPrevented,true);
    await tick();
    assert.equal(h.requests.at(-1).data.get('image').name,'pasted.png');
    if(codeMirror)h.cm.replaceRange(' added',{line:0,ch:h.value().length});
    else {h.input.value+=' added';h.input.dispatchEvent(new h.w.Event('input',{bubbles:true}));}
    finish();await tick();
    assert.equal(h.value(),'left ![shot](https://nodeimage.com/shot.png)right added');
    assert.match(h.app.querySelector('[data-nsit-image-status]').textContent,/已上传/);
  });
}

test('normal text and template fields keep their native paste behavior',async t=>{
  const h=setup(t);
  assert.equal(h.paste([]).defaultPrevented,false);
  assert.equal(h.paste([h.file()],h.app.querySelector('input')).defaultPrevented,false);
  await tick();assert.equal(h.requests.length,0);assert.equal(h.value(),'left right');
});

test('concurrent batches stay in paste order even if responses finish out of order',async t=>{
  const pending=[];
  const h=setup(t,{request:options=>{
    if(options.method==='GET')queueMicrotask(()=>options.onload({status:200,response:{api_key:'key'}}));
    else pending.push(options);
  }});
  h.paste([h.file('one.png'),h.file('two.png')]);await tick();
  h.paste([h.file('three.png')]);await tick();
  for(const name of ['three.png','two.png','one.png']) {
    const request=pending.find(r=>r.data.get('image').name===name);assert.ok(request);
    request.onload({status:200,response:{success:true,links:{markdown:`![${name}](https://nodeimage.com/${name})`}}});await tick();
  }
  assert.equal(h.value(),'left ![one.png](https://nodeimage.com/one.png)\n![two.png](https://nodeimage.com/two.png)![three.png](https://nodeimage.com/three.png)right');
});

test('failed upload restores selected draft and offers login and retry',async t=>{
  let authorized=false;
  const h=setup(t,{request:options=>queueMicrotask(()=>options.onload(authorized?{status:200,response:options.method==='GET'?{api_key:'key'}:{success:true,links:{markdown:'![ok](https://nodeimage.com/ok.png)'}}}:{status:401,response:{}}))});
  h.input.setSelectionRange(0,4);h.paste();await tick();await tick();
  assert.equal(h.value(),'left right');
  const status=h.app.querySelector('[data-nsit-image-status]');assert.match(status.textContent,/登录/);
  assert.equal(status.querySelector('a').href,'https://www.nodeimage.com/');
  authorized=true;status.querySelector('button').click();await tick();await tick();
  assert.match(h.value(),/!\[ok\]/);assert.match(h.value(),/right/);
});

test('stale API key is refreshed once and shared uploader remains usable for cards',async t=>{
  const h=setup(t,{request:options=>queueMicrotask(()=>options.onload(options.method==='GET'?{status:200,response:{api_key:'fresh'}}:options.headers['X-API-Key']==='stale'?{status:401,response:{}}:{status:200,response:{success:true,links:{markdown:'![ok](https://nodeimage.com/ok.png)'}}}))});
  h.storage.set('nsit-nodeimage-api-key','stale');
  assert.equal(typeof h.w.testUploader,'function');
  assert.equal(await h.w.testUploader(h.file()),'![ok](https://nodeimage.com/ok.png)');
  assert.deepEqual(h.requests.map(r=>r.method),['POST','GET','POST']);
});

test('timeout or removed editor never loses a draft or leaves uploading state stuck',async t=>{
  let pending;
  const h=setup(t,{request:options=>{
    if(options.method==='GET')queueMicrotask(()=>options.onload({status:200,response:{api_key:'key'}}));else pending=options;
  }});
  h.paste();await tick();assert.ok(pending.timeout>0);
  pending.ontimeout();await tick();assert.equal(h.value(),'left right');
  assert.match(h.app.querySelector('[data-nsit-image-status]').textContent,/超时/);
  h.paste();await tick();const draft=h.value();h.app._nsitEditor.remove();
  pending.onload({status:200,response:{success:true,links:{markdown:'![late](https://nodeimage.com/late.png)'}}});
  await tick();assert.equal(h.value(),draft);
});

test('pasting after repeated installation uploads once, and deleting a pending image prevents insertion',async t=>{
  let pending;
  const h=setup(t,{request:options=>{
    if(options.method==='GET')queueMicrotask(()=>options.onload({status:200,response:{api_key:'key'}}));else pending=options;
  }});
  h.w.installTestUploads(h.app);h.w.installTestUploads(h.app);
  h.paste();await tick();assert.equal(h.requests.filter(r=>r.method==='POST').length,1);
  h.input.value='replacement draft';h.input.dispatchEvent(new h.w.Event('input',{bubbles:true}));
  pending.onload({status:200,response:{success:true,links:{markdown:'![late](https://nodeimage.com/late.png)'}}});
  await tick();assert.equal(h.value(),'replacement draft');
});

test('temporary upload markers cannot be submitted by click, form submit, or Ctrl+Enter',async t=>{
  let pending;
  const h=setup(t,{request:options=>{
    if(options.method==='GET')queueMicrotask(()=>options.onload({status:200,response:{api_key:'key'}}));else pending=options;
  }});
  h.paste();await tick();
  const post=h.d.querySelector('.submit');
  const click=new h.w.MouseEvent('click',{bubbles:true,cancelable:true});post.dispatchEvent(click);
  assert.equal(click.defaultPrevented,true);
  const submit=new h.w.Event('submit',{bubbles:true,cancelable:true});post.form.dispatchEvent(submit);
  assert.equal(submit.defaultPrevented,true);
  const key=new h.w.KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true,cancelable:true});h.input.dispatchEvent(key);
  assert.equal(key.defaultPrevented,true);
  pending.onload({status:200,response:{success:true,links:{markdown:'![ok](https://nodeimage.com/ok.png)'}}});await tick();
  const after=new h.w.KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true,cancelable:true});h.input.dispatchEvent(after);
  assert.equal(after.defaultPrevented,false);
});

test('oversize image is rejected locally and the selected text is restored',async t=>{
  const h=setup(t),file=h.file();Object.defineProperty(file,'size',{value:100*1024*1024+1});
  h.input.setSelectionRange(0,4);h.paste([file]);await tick();
  assert.equal(h.requests.length,0);assert.equal(h.value(),'left right');
  assert.match(h.app.querySelector('[data-nsit-image-status]').textContent,/100 MB/);
});

test('undoing a finished upload cannot publish its temporary marker',async t=>{
  const h=setup(t);h.paste();const withMarker=h.value();await tick();await tick();
  h.input.value=withMarker;h.input.dispatchEvent(new h.w.Event('input',{bubbles:true}));
  const event=new h.w.KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true,cancelable:true});h.input.dispatchEvent(event);
  assert.equal(h.value(),'left right');
});

test('retry retains text selected after the first upload failed',async t=>{
  let fail=true;
  const h=setup(t,{request:options=>queueMicrotask(()=>options.onload(fail?{status:500,response:{}}:{status:200,response:options.method==='GET'?{api_key:'key'}:{success:true,links:{markdown:'![ok](https://nodeimage.com/ok.png)'}}}))});
  h.paste();await tick();await tick();h.input.setSelectionRange(5,10);fail=false;
  h.app.querySelector('[data-nsit-image-status] button').click();await tick();await tick();
  assert.equal(h.value(),'left right![ok](https://nodeimage.com/ok.png)');
});

test('multiple failures restore the whole selected draft without extra separators',async t=>{
  const h=setup(t,{request:options=>queueMicrotask(()=>options.onload({status:401,response:{}}))});
  h.input.setSelectionRange(0,4);h.paste([h.file('one.png'),h.file('two.png')]);await tick();await tick();
  assert.equal(h.value(),'left right');
});

const transferEvent=(w,type,data,extra={})=>{
  const event=new w.Event(type,{bubbles:true,cancelable:true});
  Object.defineProperty(event,type==='paste'?'clipboardData':'dataTransfer',{value:data});
  for(const [key,value] of Object.entries(extra))Object.defineProperty(event,key,{value});
  return event;
};
const okUpload=options=>{
  if(options.method==='GET')queueMicrotask(()=>options.onload({status:200,response:{api_key:'key'}}));
  else queueMicrotask(()=>options.onload({status:200,response:{success:true,links:{markdown:'![p](https://nodeimage.com/p.png)'}}}));
};
const transfer=(files,html='')=>({items:files.map(f=>({kind:'file',type:f.type,getAsFile:()=>f})),files,types:files.length?['Files']:['text/html'],getData:type=>type==='text/html'?html:''});

test('dropping an image onto the editor uploads it; dropping text is left alone',async t=>{
  const h=setup(t,{request:okUpload});
  const text=transferEvent(h.w,'drop',transfer([],'<b>hi</b>'));h.input.dispatchEvent(text);
  assert.equal(text.defaultPrevented,false);
  const over=transferEvent(h.w,'dragover',transfer([h.file('drag.png')]));h.input.dispatchEvent(over);
  assert.equal(over.defaultPrevented,true,'the editor accepts dragged files');
  const drop=transferEvent(h.w,'drop',transfer([h.file('drag.png')]));h.input.dispatchEvent(drop);
  assert.equal(drop.defaultPrevented,true);await tick();await tick();
  assert.equal(h.requests.at(-1).data.get('image').name,'drag.png');
  assert.match(h.value(),/!\[p\]\(https:\/\/nodeimage\.com\/p\.png\)/);
});

test('phone keyboards inserting a picture through beforeinput are uploaded',async t=>{
  const h=setup(t,{request:okUpload});
  const event=transferEvent(h.w,'beforeinput',transfer([h.file('keyboard.png')]),{inputType:'insertFromPaste'});
  h.input.dispatchEvent(event);assert.equal(event.defaultPrevented,true);await tick();await tick();
  assert.equal(h.requests.at(-1).data.get('image').name,'keyboard.png');
  const typing=transferEvent(h.w,'beforeinput',null,{inputType:'insertText'});h.input.dispatchEvent(typing);
  assert.equal(typing.defaultPrevented,false,'ordinary typing is untouched');
});

test('clipboard images without a MIME type or only as inline data are uploaded',async t=>{
  const h=setup(t,{request:okUpload});
  const untyped=new h.w.File(['x'],'IMG_0001.JPG',{type:''});
  assert.equal(h.input.dispatchEvent(transferEvent(h.w,'paste',transfer([untyped]))),false);await tick();await tick();
  assert.equal(h.requests.at(-1).data.get('image').name,'IMG_0001.JPG');
  const inline=transferEvent(h.w,'paste',transfer([],'<p><img src="data:image/png;base64,aGVsbG8="></p>'));
  h.input.dispatchEvent(inline);assert.equal(inline.defaultPrevented,true);await tick();await tick();
  const uploaded=h.requests.at(-1).data.get('image');
  assert.equal(uploaded.type,'image/png');assert.match(uploaded.name,/^pasted-\d+-0\.png$/);
  const notImage=new h.w.File(['x'],'notes.txt',{type:''});
  assert.equal(h.input.dispatchEvent(transferEvent(h.w,'paste',transfer([notImage]))),true,'other files keep native paste');
});
