const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function load(mode='stimulation',dom={}) {
  const listeners={}; let warning=null;
  const root={querySelectorAll:()=>[],...dom.root};
  const ctx={state:{mode,levelL:2,levelR:4,levelEnabledL:true,levelEnabledR:true},root,
    document:{querySelector:s=>s==='.v57-side-warning'?warning:null,...dom.document},
    MutationObserver:class{observe(){}},
    addEventListener(type,fn){(listeners[type]??=[]).push(fn);}};
  ctx.window=ctx;ctx.v4View=()=>ctx.v4Controls();
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../level-control-v57.js'),'utf8'),ctx);
  return {ctx,setWarning:w=>warning=w,dispatch(type,target,key,overrides={}){
    const e={type,target,key,button:0,pointerType:'mouse',pointerId:1,clientY:160,...overrides,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
    for(const listener of listeners[type]||[]){listener(e);if(e.stopped)break;}return e;
  }};
}
test('both modes normalize legacy zero values and render only valid suction steps',()=>{
  for(const [mode,max] of [['stimulation',5],['expression',15]]){
    const {ctx}=load(mode);ctx.state.levelL=0;ctx.state.levelR=-1;
    const markup=ctx.v4Controls();
    assert.equal(ctx.state.levelL,1);assert.equal(ctx.state.levelR,1);
    assert.match(markup,new RegExp('type="range" min="1" max="'+max+'"'));
    assert.doesNotMatch(markup,/aria-valuemin="0"|type="range" min="0"/);
    assert.equal((markup.match(/<span class="v57-ticks"/g)||[]).length,2);
  }
});
test('keyboard and dual adjustment stop at one; disabled sides stay closed',()=>{
  for(const mode of ['stimulation','expression']){
    const {ctx,dispatch}=load(mode);ctx.state.levelL=1;ctx.state.levelR=1;
    const rail={dataset:{v57Level:'l'}};
    dispatch('keydown',{closest:s=>s.includes('data-v57-level')?rail:null},'ArrowDown');
    assert.equal(ctx.state.levelL,1);
    dispatch('keydown',{closest:s=>s.includes('data-v57-both')?{}:null},'ArrowDown');
    assert.equal(ctx.state.levelR,1);
    ctx.state.levelEnabledL=false;
    dispatch('keydown',{closest:s=>s.includes('data-v57-level')?rail:null},'ArrowUp');
    assert.equal(ctx.state.levelEnabledL,false);
  }
});
test('outside gesture is consumed before underlying controls and only click dismisses',()=>{
  const {ctx,dispatch,setWarning}=load();let dismissed=0;
  setWarning({querySelector:()=>({contains:()=>false}),remove(){dismissed++;setWarning(null);}});
  const target={closest:s=>s.includes('data-v57-level')?{dataset:{v57Level:'r'}}:null};
  assert.equal(dispatch('pointerdown',target).stopped,true);
  assert.equal(dismissed,0);
  assert.equal(dispatch('pointerup',target).stopped,true);
  assert.equal(dismissed,0);
  assert.equal(dispatch('click',target).stopped,true);
  assert.equal(dismissed,1);
  assert.equal(ctx.state.levelR,4);
  assert.equal(ctx.state.levelEnabledR,true);
});

test('Both limits each drag to three steps in either mode at any rendered scale',()=>{
  for(const mode of ['stimulation','expression']) for(const scale of [1,1.5,2]) {
    const {ctx,dispatch}=load(mode);
    ctx.state.levelL=1;ctx.state.levelR=1;
    const knob={style:{}};const attrs={};
    const both={classList:{add(){},remove(){}},setPointerCapture(){},
      getBoundingClientRect:()=>({top:0,height:170*scale}),
      setAttribute:(k,v)=>attrs[k]=v,querySelector:()=>knob};
    const target={closest:s=>s.includes('data-v57-both')?both:null};
    dispatch('pointerdown',target);
    dispatch('pointermove',target,undefined,{clientY:160-36*scale});
    assert.equal(ctx.state.levelL,3);
    dispatch('pointermove',target,undefined,{clientY:-1000});
    assert.equal(ctx.state.levelL,4);assert.equal(ctx.state.levelR,4);
    assert.equal(attrs['aria-valuenow'],'3');
    dispatch('pointerup',target,undefined,{clientY:-1000});
    assert.equal(knob.style.transform,'');
    dispatch('pointerdown',target);
    dispatch('pointermove',target,undefined,{clientY:1000});
    assert.equal(ctx.state.levelL,1);assert.equal(ctx.state.levelR,1);
    dispatch('pointerup',target,undefined,{clientY:1000});
    assert.match(ctx.v4Controls(),/aria-valuemin="-3" aria-valuemax="3"/);
  }
});

test('last-side warning offers only end and cancel; cancel preserves state',()=>{
  for(const action of ['cancel','end']) {
    const callbacks={};let click;let removed=false;
    const warning={querySelector:s=>({addEventListener:(_,fn)=>callbacks[s]=fn}),remove(){removed=true;}};
    const link={dataset:{v57SideToggle:'r'},addEventListener:(_,fn)=>click=fn};
    const {ctx}=load('stimulation',{root:{querySelectorAll:()=>[link],querySelector:()=>null,appendChild(){}},document:{createElement:()=>warning}});
    ctx.state.levelEnabledL=false;ctx.state.running=true;ctx.state.paused=false;
    const e={preventDefault(){},stopImmediatePropagation(){}};click(e);
    assert.match(warning.innerHTML,/>取消</);
    assert.doesNotMatch(warning.innerHTML,/warning-close|warning-open|开启左侧|开启右侧/);
    callbacks['[data-v57-warning-'+action+']'](e);
    assert.equal(removed,true);assert.equal(ctx.state.levelEnabledL,false);assert.equal(ctx.state.levelEnabledR,true);
    assert.equal(ctx.state.levelL,2);assert.equal(ctx.state.levelR,4);
    assert.equal(ctx.state.running,action==='cancel');
    if(action==='end')assert.equal(ctx.state.modal,'log');
  }
});
