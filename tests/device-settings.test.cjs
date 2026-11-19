const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function load(saved = {}) {
  const storage = new Map(Object.entries(saved));
  const notices = [];
  const root = {querySelector(){return null;},appendChild(el){notices.push(el.textContent);}};
  const ctx = {state:{page:'control'},location:{search:''},URLSearchParams,Promise,Number,JSON,
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    document:{readyState:'loading',getElementById:()=>root,addEventListener(){},createElement:()=>({setAttribute(){},remove(){}})},
    setTimeout(){return 1;},clearTimeout(){}};
  ctx.window = ctx; ctx.v4View=()=>{};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../device-settings.js'),'utf8'),ctx);
  return {ctx,api:ctx.V3ProSettings,notices,storage};
}
test('adaptive acknowledgement updates the shared night-light presentation and persists', async()=>{
  const {ctx,api,storage}=load();
  assert.equal(api.adaptiveEnabled(),true);
  const command=api.setAdaptiveBrightness(false);
  assert.equal(api.adaptiveEnabled(),true,'must wait for the device acknowledgement');
  assert.equal(await command,true);
  assert.equal(ctx.state.v3ProCapabilities.adaptiveBrightness,false);
  assert.equal(JSON.parse(storage.get('v3-pro-device-settings')).adaptive,false);
  assert.equal(await api.setAdaptiveBrightness(true),true);
  assert.equal(ctx.state.v3ProCapabilities.adaptiveBrightness,true);
});
test('failure, timeout, travel lock and disconnection preserve device settings', async()=>{
  for(const [search,message] of [['?command-result=failed','操作失败，请重试'],['?command-result=timeout','指令超时，请重试'],['?travel-lock=1','设备已锁定，请至设备解锁。'],['?device-connected=0','设备未连接']]){
    const {ctx,api,notices}=load();ctx.location.search=search;
    assert.equal(await api.setAdaptiveBrightness(false),false);
    assert.equal(api.adaptiveEnabled(),true);
    assert.equal(await api.setBrightness(70),false);
    assert.equal(api.snapshot().brightness,50);
    assert.equal(await api.setLeakAlerts(false),false);
    assert.equal(api.leakAlertsEnabled(),true);
    assert.ok(notices.includes(message));
  }
});
test('screen brightness is 5–80 percent and device reports refresh shared state',async()=>{
  const {ctx,api}=load();
  await api.setBrightness(0);assert.equal(api.snapshot().brightness,5);
  await api.setBrightness(100);assert.equal(api.snapshot().brightness,80);
  api.reportBrightness({brightness:35,adaptive:false});
  assert.equal(ctx.state.v3ProCapabilities.screenBrightness,35);
  assert.equal(ctx.state.v3ProCapabilities.adaptiveBrightness,false);
});
test('old removed automatic-on setting cannot survive in saved preferences', async()=>{
  const {api,storage}=load({'v3-pro-device-settings':JSON.stringify({nightAuto:true,adaptive:false,brightness:95})});
  assert.equal(api.adaptiveEnabled(),false);
  assert.equal(api.snapshot().brightness,80);
  await api.setAdaptiveBrightness(true);
  assert.equal('nightAuto' in JSON.parse(storage.get('v3-pro-device-settings')),false);
});
