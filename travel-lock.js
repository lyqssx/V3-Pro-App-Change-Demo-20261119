/* A simulated device response gate. Register before legacy command handlers. */
(function () {
  var host = document.getElementById('demo');
  var pointerNotified = false;
  var lockNoticeTimer = null;
  var lockNoticeSerial = 0;
  function current() { return typeof state !== 'undefined' ? state : window.state; }
  current().travelLocked = new URLSearchParams(location.search).get('travel-lock') === '1';
  function isLocked() { return current().travelLocked === true; }
  function showNotice() {
    if (host.querySelector('[data-travel-lock-dialog]')) return;
    var overlay = document.createElement('div');
    overlay.className = 'sa-layer sa-guide-layer v3-travel-lock-layer';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Travel lock unlock guide');
    overlay.setAttribute('data-travel-lock-dialog', '');
    overlay.innerHTML = '<div class="sa-scrim"></div><section class="sa-fit-guide-panel">' +
      '<header class="sa-guide-header"><div class="sa-guide-title"><h2>Device locked</h2></div><button type="button" class="v4-circle v3-travel-lock-close" data-travel-lock-dismiss aria-label="Close travel lock guide"><img src="./assets/travel-lock-white-close.svg" alt=""></button></header>' +
      '<p class="v3-travel-lock-message">Device locked. Please unlock it on the device.</p>' +
      '<p class="v3-unlock-instruction">Press and hold the <b>Stimulation (heart)</b> and <b>R (right)</b> buttons together for <b>5 seconds</b> to unlock the device.</p>' +
      '<div class="v3-unlock-art" role="img" aria-label="Device buttons: hold Stimulation and R together for 5 seconds"><div class="v3-unlock-device"><img src="./assets/v3-pro-main.png" alt="V3 Pro device"><span class="v3-unlock-target v3-unlock-target--heart"></span><span class="v3-unlock-target v3-unlock-target--right"></span></div><span class="v3-unlock-duration">Hold both for 5 seconds</span></div>' +
      '<button type="button" class="sa-primary v3-unlock-dismiss" data-travel-lock-dismiss>Got it</button></section>';

    host.appendChild(overlay);
  }
  var commandActions = ['start','pause','finish','mode','manual','confirm','speed','auto','side-toggle'];
  function commandTarget(target) {
    if (!target || !target.closest || !host.contains(target)) return null;
    var control = target.closest('[data-v57-side-toggle],[data-v57-level],[data-v57-both],[data-v3-light-toggle],[data-v3-light-track],[data-settings-toggle],#ds-brightness,[data-v57-warning-end]');
    if (control) return control;
    var action = target.closest('[data-v4]');
    return action && commandActions.indexOf(action.getAttribute('data-v4')) >= 0 ? action : null;
  }
  function restorePreview(control) {
    if (control.id === 'ds-brightness' && window.V3ProSettings) control.value = window.V3ProSettings.snapshot().brightness;
    var range = control.matches && control.matches('[data-v57-range]') ? control : control.querySelector && control.querySelector('[data-v57-range]');
    if (range) range.value = current()[range.getAttribute('data-v57-range') === 'r' ? 'levelR' : 'levelL'];
  }
  function guard(event) {
    if (event.type === 'pointerdown') pointerNotified = false;
    if (!isLocked()) return;
    var control = commandTarget(event.target);
    if (!control) return;
    if (event.type === 'keydown' && ['Enter',' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].indexOf(event.key) < 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    restorePreview(control);
    if (event.type === 'pointerdown') { showNotice(); pointerNotified = true; }
    else if (event.type === 'click') { if (!pointerNotified) showNotice(); pointerNotified = false; }
    else if (event.type === 'keydown' && !event.repeat) showNotice();
  }
  ['pointerdown','pointermove','pointerup','click','keydown','input','change'].forEach(function (type) {
    window.addEventListener(type, guard, {capture:true, passive:false});
  });
  function setLocked(value) {
    var s = current();
    var wasLocked = s.travelLocked === true;
    s.travelLocked = !!value;
    pointerNotified = false;
    var old = host.querySelector('[data-travel-lock-dialog]');
    if (old) old.remove();
    if (s.travelLocked && !wasLocked) {
      // Simulate the device's lock/pause report; preserve the current session.
      if (s.running) s.paused = true;
      var id = 'travel-lock-enabled-' + (++lockNoticeSerial);
      s.controlNotice = {kind:'travel-lock-enabled',id:id,startedAt:Date.now(),backdrop:true,
        text:'Travel lock enabled. Pumping is paused.'};
      clearTimeout(lockNoticeTimer);
      lockNoticeTimer = setTimeout(function () {
        if (!s.controlNotice || s.controlNotice.id !== id) return;
        s.controlNotice = null;
        if (window.v4View) window.v4View();
      }, 5000);
      if (window.v4View) window.v4View();
    }
    updateTriggerStatus();
  }
  function updateTriggerStatus() {
    var status = document.querySelector('[data-travel-lock-status]');
    if (status) status.textContent = '模拟设备：旅行锁' + (isLocked() ? '已打开' : '已关闭');
  }
  function installTriggers() {
    var content = document.querySelector('.demo-trigger-content');
    if (!content || content.querySelector('[data-travel-lock-controls]')) return;
    content.insertAdjacentHTML('beforeend', '<section class="demo-trigger-group" data-travel-lock-controls><h3>旅行锁</h3><div class="demo-trigger-grid"><button type="button" class="demo-trigger-action is-primary" data-travel-lock-trigger="on"><b>旅行锁打开</b></button><button type="button" class="demo-trigger-action" data-travel-lock-trigger="off"><b>旅行锁关闭</b></button></div><p class="sa-trigger-status" data-travel-lock-status></p></section>');
    updateTriggerStatus();
  }
  document.addEventListener('click', function (event) {
    var dismiss = event.target.closest && event.target.closest('[data-travel-lock-dismiss]');
    if (dismiss) { event.preventDefault(); event.stopImmediatePropagation(); var dialog = dismiss.closest('[data-travel-lock-dialog]'); if (dialog) dialog.remove(); return; }
    var button = event.target.closest && event.target.closest('[data-travel-lock-trigger]');
    if (!button) return;
    event.preventDefault(); event.stopImmediatePropagation();
    setLocked(button.getAttribute('data-travel-lock-trigger') === 'on');
    var root = button.closest('.demo-trigger-root');
    if (root) { root.classList.remove('is-open'); var toggle = root.querySelector('.demo-trigger-toggle'); if (toggle) toggle.setAttribute('aria-expanded', 'false'); }
  }, true);
  function boot() {
    installTriggers();
    new MutationObserver(installTriggers).observe(document.body, {childList:true, subtree:true});
  }
  window.V3ProTravelLock = {isLocked:isLocked, setLocked:setLocked, showBlocked:showNotice};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
}());
