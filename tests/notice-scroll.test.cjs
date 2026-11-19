const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
function load(){
  const timers=new Map();let next=1;let now=100;let renders=0;
  const root={querySelector:()=>null};
  const c={state:{page:'control',running:true,paused:false,timer:32,mode:'stimulation',levelL:2,levelR:4},document:{readyState:'loading',getElementById:()=>root,querySelector:()=>null,addEventListener(){}},Date:{now:()=>now},setTimeout(fn,delay){const id=next++;timers.set(id,{fn,at:now+delay});return id;},clearTimeout(id){timers.delete(id);}};
  c.window=c;c.v4View=()=>renders++;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../notice-scroll.js'),'utf8'),c);
  return {c,tick(ms){now+=ms;for(const [id,t] of timers){if(t.at<=now){timers.delete(id);t.fn();}}},renders:()=>renders};
}
test('five-second reminder preview does not change pumping state or expire early',()=>{
  const {c,tick}=load();c.V3ProNoticeScroll.preview();
  assert.ok(c.state.controlNotice);tick(4999);assert.ok(c.state.controlNotice);tick(1);assert.equal(c.state.controlNotice,null);
  assert.equal(c.state.running,true);assert.equal(c.state.paused,false);assert.equal(c.state.timer,32);assert.equal(c.state.mode,'stimulation');assert.equal(c.state.levelL,2);
});
test('the preview timeout cannot clear a later real device notice',()=>{
  const {c,tick}=load();c.V3ProNoticeScroll.preview();c.state.controlNotice={id:'actual-device-notice',kind:'critical-battery'};tick(5000);assert.equal(c.state.controlNotice.id,'actual-device-notice');
});
test('inset changes preserve visible scrolled content and keep the top at zero',()=>{
  const {c}=load();const offset=c.V3ProNoticeScroll.offsetAfterInset;
  assert.equal(offset(0,106,161),0);assert.equal(offset(320,161,106),265);assert.equal(offset(265,106,161),320);assert.equal(offset(20,161,106),0);
});
