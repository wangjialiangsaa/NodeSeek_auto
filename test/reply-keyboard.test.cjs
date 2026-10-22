const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');

function setup(t,{codeMirror=false,url='https://www.nodeseek.com/post-123-1'}={}) {
  const dom=new JSDOM('<div id="editor"><div class="md-editor"><div id="editor-body"><textarea></textarea><div id="nsit-app"><textarea name="remarks"></textarea></div></div><div class="topic-select"><button class="submit">发布评论</button></div></div></div>',{url,runScripts:'outside-only'});
  t.after(()=>dom.window.close());
  const w=dom.window,d=w.document,input=d.querySelector('#editor-body>textarea'),app=d.getElementById('nsit-app');
  app._nsitEditor=d.getElementById('editor-body');
  input.value='准备发送的内容';
  let sends=0,inputs=0,cm;
  d.querySelector('.submit').addEventListener('click',()=>sends++);
  input.addEventListener('input',()=>inputs++);
  if(codeMirror) {
    const wrapper=d.createElement('div');wrapper.className='CodeMirror';input.before(wrapper);wrapper.append(input);
    cm=wrapper.CodeMirror={getValue:()=>input.value,getInputField:()=>input,getOption:()=>false,replaceSelection:text=>input.setRangeText(text,input.selectionStart,input.selectionEnd,'end')};
  }
  w.eval(`const APP_ID='nsit-app';\n${fs.readFileSync(path.join(__dirname,'../src/toolbar.js'),'utf8')}\nwindow.installKeys=installReplyKeyboard;`);
  w.installKeys(app);
  const key=(options={},target=input)=>{const e=new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true,...options});target.dispatchEvent(e);return e;};
  return {w,d,input,app,cm,key,sends:()=>sends,inputs:()=>inputs};
}

for(const codeMirror of [false,true]) {
  test(`${codeMirror?'CodeMirror':'textarea'}: Enter sends once without changing the draft`,t=>{
    const h=setup(t,{codeMirror});
    assert.equal(h.key().defaultPrevented,true);
    assert.equal(h.sends(),1);assert.equal(h.input.value,'准备发送的内容');
    h.key({repeat:true});assert.equal(h.sends(),1);
  });
  test(`${codeMirror?'CodeMirror':'textarea'}: Shift+Enter replaces the selection with a newline`,t=>{
    const h=setup(t,{codeMirror});h.input.value='abcd';h.input.setSelectionRange(1,3);
    assert.equal(h.key({shiftKey:true}).defaultPrevented,true);
    assert.equal(h.sends(),0);assert.equal(h.input.value,'a\nd');assert.equal(h.input.selectionStart,2);
    if(!codeMirror) assert.equal(h.inputs(),1);
  });
}

test('IME selection and modifier shortcuts do not send',t=>{
  const h=setup(t);
  for(const options of [{isComposing:true},{keyCode:229},{ctrlKey:true},{metaKey:true},{altKey:true},{key:'a'}]) {
    assert.equal(h.key(options).defaultPrevented,false);
  }
  h.input.dispatchEvent(new h.w.CompositionEvent('compositionstart',{bubbles:true}));
  assert.equal(h.key().defaultPrevented,false);assert.equal(h.sends(),0);
  h.input.dispatchEvent(new h.w.CompositionEvent('compositionend',{bubbles:true}));
  h.key();assert.equal(h.sends(),1);
});

test('empty drafts, disabled send and readonly editors cannot submit',t=>{
  const h=setup(t);h.input.value=' \n';h.key();assert.equal(h.sends(),0);
  h.input.value='draft';h.d.querySelector('.submit').disabled=true;h.key();assert.equal(h.sends(),0);
  h.d.querySelector('.submit').disabled=false;h.input.readOnly=true;h.key();assert.equal(h.sends(),0);
});

test('CodeMirror search fields and script settings keep their normal Enter behavior',t=>{
  const h=setup(t,{codeMirror:true});
  const dialog=h.d.createElement('div');dialog.className='CodeMirror-dialog';dialog.innerHTML='<input>';
  h.input.parentElement.append(dialog);
  assert.equal(h.key({},dialog.firstChild).defaultPrevented,false);
  assert.equal(h.key({},h.app.querySelector('textarea')).defaultPrevented,false);
  assert.equal(h.sends(),0);
});

test('readonly CodeMirror and native edit/save buttons cannot submit',t=>{
  const h=setup(t,{codeMirror:true});h.cm.getOption=()=>true;assert.equal(h.key().defaultPrevented,false);assert.equal(h.sends(),0);
  h.cm.getOption=()=>false;h.d.querySelector('.submit').textContent='保存修改';assert.equal(h.key().defaultPrevented,false);assert.equal(h.sends(),0);
});

test('new topic pages are unaffected',t=>{
  const h=setup(t,{url:'https://www.nodeseek.com/editor'});
  assert.equal(h.key().defaultPrevented,false);assert.equal(h.sends(),0);
});

test('reinstalling for the same editor does not duplicate submissions',t=>{
  const h=setup(t);h.w.installKeys(h.app);h.key();assert.equal(h.sends(),1);
});
