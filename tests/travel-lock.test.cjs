const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function load(search=''){
  const handlers={};const layers=[];
  const host={contains:t=>t.inside!==false,querySelector:s=>s==='[data-travel-lock-dialog]'?layers[0]||null:null,appendChild:n=>layers.push(n)};
  const ctx={state:{travelLocked:false,running:true,paused:false,levelL:2,levelR:4},URLSearchParams,location:{search},setTimeout(){},clearTimeout(){},MutationObserver:class{observe(){}},
    addEventListener(t,fn){(handlers[t]??=[]).push(fn);},
    document:{readyState:'loading',getElementById:()=>host,querySelector:()=>null,addEventListener(){},createElement:()=>({setAttribute(){},remove(){layers.splice(layers.indexOf(this),1);}})}};
  ctx.window=ctx;vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../travel-lock.js'),'utf8'),ctx);
  return {ctx,layers,dispatch(type,target,key){const e={type,target,key,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};for(const fn of handlers[type]||[]){fn(e);if(e.stopped)break;}return e;}};
}
function action(name){return {closest:s=>s==='[data-v4]'?{getAttribute:()=>name}:null};}
function control(){return {closest:s=>s==='[data-v4]'?null:{id:'',matches:()=>false,querySelector:()=>null}};}
test('locked device rejects commands but allows page navigation',()=>{
  const {ctx,dispatch}=load();ctx.V3ProTravelLock.setLocked(true);
  for(const name of ['start','pause','finish','mode','manual','confirm','speed'])assert.equal(dispatch('click',action(name)).stopped,true,name);
  for(const name of ['list','home','device','control','cancel'])assert.equal(dispatch('click',action(name)).stopped,undefined,name);
  assert.equal(ctx.state.running,true);assert.equal(ctx.state.paused,false);assert.equal(ctx.state.levelL,2);
});
test('drag, native range and keyboard command paths are blocked',()=>{
  const {ctx,dispatch}=load();ctx.V3ProTravelLock.setLocked(true);
  for(const type of ['pointerdown','pointermove','pointerup','click','input','change'])assert.equal(dispatch(type,control()).stopped,true,type);
  assert.equal(dispatch('keydown',control(),'ArrowDown').stopped,true);
  assert.equal(dispatch('keydown',control(),'Home').stopped,true);
  assert.equal(dispatch('keydown',control(),'Tab').stopped,undefined);
});
test('one pointer gesture creates one leak-style bottom sheet with exact guidance',()=>{
  const {ctx,dispatch,layers}=load();ctx.V3ProTravelLock.setLocked(true);
  dispatch('pointerdown',action('start'));dispatch('pointerup',action('start'));dispatch('click',action('start'));
  assert.equal(layers.length,1);
  assert.match(layers[0].className,/sa-guide-layer/);
  assert.match(layers[0].innerHTML,/sa-fit-guide-panel/);
  assert.match(layers[0].innerHTML,/Device locked. Please unlock it on the device./);
  assert.match(layers[0].innerHTML,/Stimulation \(heart\)/);
  assert.match(layers[0].innerHTML,/R \(right\)/);
  assert.match(layers[0].innerHTML,/assets\/v3-pro-main.png/);
});
test('unlock trigger overrides a locked URL seed and restores command availability',()=>{
  const {ctx,dispatch,layers}=load('?travel-lock=1');
  assert.equal(ctx.V3ProTravelLock.isLocked(),true);
  dispatch('click',action('start'));assert.equal(layers.length,1);
  ctx.V3ProTravelLock.setLocked(false);
  assert.equal(layers.length,0);
  assert.equal(dispatch('click',action('start')).stopped,undefined);
  assert.equal(ctx.V3ProTravelLock.isLocked(),false);
});
