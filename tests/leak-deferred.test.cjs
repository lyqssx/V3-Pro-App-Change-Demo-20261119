const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function load(legacyLeakEnabled=true){
  const handlers={};const timers=[];let markup='';
  const root={querySelector:s=>s==='.v4-control'?{classList:{add(){}},insertAdjacentHTML(_,html){markup+=html;}}:null,querySelectorAll:()=>[],insertAdjacentHTML(_,html){markup+=html;}};
  const ctx={V3ProSettings:{leakAlertsEnabled:()=>legacyLeakEnabled},state:{page:'control',running:true,paused:false,timer:42},Image:class{},Date,
    document:{readyState:'complete',getElementById:()=>root,querySelector:()=>null,
      addEventListener(type,fn){(handlers[type]??=[]).push(fn);}},
    setTimeout(fn,delay){timers.push({fn,delay});},clearTimeout(){},setInterval(){},v4Home:()=>'<main class="v4-home-cards">',v4Log:()=>'',
    v4View(){markup='';if(ctx.state.page==='home')markup=ctx.v4Home();if(ctx.state.modal==='log')ctx.v4Log();}};
  ctx.window=ctx;vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../leak-flow-r1.js'),'utf8'),ctx);
  return {ctx,timers,save(){const target={closest:s=>s==='#demo [data-v4="save"]'?{}:null};handlers.click.forEach(fn=>fn({target}));},html:()=>markup,action(id){const button={getAttribute:()=>id};
    const target={closest:s=>s==='#demo [data-sa-action]'?button:null};
    handlers.click.forEach(fn=>fn({target,preventDefault(){},stopImmediatePropagation(){}}));}};
}
for(const trigger of ['minor-leak','serious-leak-left','serious-leak-right','serious-leak-both']){
  test(trigger+' stays silent and defers original guide until home after ending',()=>{
    const {ctx,html,action}=load();
    assert.equal(ctx.V3ProLeakFlow.trigger(trigger),true);
    assert.equal(ctx.state.running,true);assert.equal(ctx.state.paused,false);assert.equal(ctx.state.timer,42);
    assert.doesNotMatch(html(),/role="dialog"/);
    ctx.v4View();assert.doesNotMatch(html(),/role="dialog"/);
    ctx.state.page='home';ctx.v4View();assert.doesNotMatch(html(),/role="dialog"/);
    ctx.state.page='control';ctx.state.running=false;ctx.state.modal='log';ctx.v4View();
    assert.doesNotMatch(html(),/Air seal guidance/);
    ctx.state.modal=null;ctx.state.page='home';ctx.v4View();
    assert.match(html(),/sa-home-leak-notice/);assert.match(html(),/Fit Guide/);
    assert.doesNotMatch(html(),/role="dialog"|sa-guide-layer|Self-Check/);
    assert.equal(ctx.state.paused,false);
    action('dismiss-home-leak-notice');assert.doesNotMatch(html(),/sa-home-leak-notice/);
    ctx.v4View();assert.doesNotMatch(html(),/sa-home-leak-notice/);
  });
}
test('normal session never queues a guide',()=>{
  const {ctx,html}=load();ctx.state.running=false;ctx.state.page='home';ctx.v4View();
  assert.doesNotMatch(html(),/sa-home-leak-notice|role="dialog"/);
});

test('initial seal checking and passed states never mount a notice',()=>{
 const {ctx,html}=load();
 for(const stage of ['initial_checking','initial_passed','resolved']) {
  ctx.V3ProLeakFlow.state().stage=stage;ctx.V3ProLeakFlow.state().statusDismissed=false;
  ctx.v4View();assert.doesNotMatch(html(),/sa-status|Checking Seal|Seal check passed/);
 }
});
test('saving amount stays on control; deferred guide waits for explicit home visit',()=>{
 const {ctx,timers,html,save}=load();ctx.V3ProLeakFlow.trigger('minor-leak');
 ctx.state.running=false;ctx.state.modal='logged';ctx.v4View();
 save();
 const close=timers.find(t=>t.delay===2000);assert.ok(close);close.fn();
 assert.equal(ctx.state.page,'control');assert.equal(ctx.state.modal,null);
 assert.doesNotMatch(html(),/sa-home-leak-notice/);
 ctx.state.page='home';ctx.v4View();assert.match(html(),/sa-home-leak-notice/);
});

test('a previously disabled leak alert setting cannot suppress recording or home Guide',()=>{
 const {ctx,html}=load(false);
 ctx.V3ProLeakFlow.trigger('minor-leak');
 assert.equal(ctx.state.v3LeakEvents.length,1);
 assert.equal(ctx.state.running,true);assert.equal(ctx.state.paused,false);
 ctx.state.running=false;ctx.state.page='home';ctx.v4View();
 assert.match(html(),/sa-home-leak-notice/);
 assert.doesNotMatch(html(),/role="dialog"/);
});
