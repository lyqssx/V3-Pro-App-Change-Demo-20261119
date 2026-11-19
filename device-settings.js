/* Figma 1842:19167 / 19030 / 19365. Preferences simulate device storage. */
(function () {
  // Retain the completed assistant UI for a future coordinated release.
  var STABILITY_ASSISTANT_UI_ENABLED = false;
  var root = document.getElementById('demo');
  var storageKey = 'v3-pro-device-settings';
  var defaults = { leakAlerts: true, adaptive: true, brightness: 50, name: 'V3 Pro' };
  var preferences = Object.assign({}, defaults);
  try { Object.assign(preferences, JSON.parse(localStorage.getItem(storageKey) || '{}')); } catch (_) {}
  // Separate the simulated device's saved state from App presentation preferences.
  var deviceStorageKey = 'v3-pro-device-leak-detection';
  var deviceLeakEnabled = defaults.leakAlerts;
  var reportedLeakEnabled = null;
  var leakSettingPending = false;
  try {
    var savedDeviceState = JSON.parse(localStorage.getItem(deviceStorageKey) || 'null');
    deviceLeakEnabled = typeof savedDeviceState === 'boolean' ? savedDeviceState : preferences.leakAlerts !== false;
  } catch (_) {}
  delete preferences.leakAlerts;
  delete preferences.nightAuto;
  preferences.brightness = Math.max(5, Math.min(80, Number(preferences.brightness) || 50));
  var returnPage = 'control';
  var dialog = null;
  var asset = './assets/settings-figma/';
  function escapeText(value) { return String(value).replace(/[&<>"']/g, function (c) { return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function enabled() { return reportedLeakEnabled === true; }
  function save() { try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch (_) {} }
  function connected() { return state.connected !== false && state.bluetoothConnected !== false && !state.air2Offline && new URLSearchParams(location.search).get('device-connected') !== '0'; }
  var toastTimer;
  function toast(message) {
    if (message === 'Device locked. Please unlock it on the device.' && window.V3ProTravelLock) { window.V3ProTravelLock.showBlocked(); return; }
    var previous = root.querySelector('.ds-command-toast');
    if (previous) previous.remove();
    var notice = document.createElement('div');
    notice.className = 'ds-command-toast'; notice.setAttribute('role', 'status'); notice.textContent = message;
    root.appendChild(notice); clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { notice.remove(); }, 2600);
  }
  function commandBlockReason() {
    if (!connected()) return 'Device not connected.';
    if (window.V3ProTravelLock ? window.V3ProTravelLock.isLocked() : (state.travelLocked || new URLSearchParams(location.search).get('travel-lock') === '1')) return 'Device locked. Please unlock it on the device.';
    return '';
  }
  function canExecute(notify) { var reason = commandBlockReason(); if (reason && notify !== false) toast(reason); return !reason; }
  var commandResponder = function () { return new URLSearchParams(location.search).get('command-result') || 'success'; };
  function submit(apply, rollback) {
    var initialReason = commandBlockReason();
    if (initialReason) { if (rollback) rollback(); toast(initialReason); return Promise.resolve(false); }
    return Promise.resolve().then(commandResponder).then(function (result) {
      var reason = commandBlockReason();
      if (!reason && result !== 'success' && result !== true) reason = result === 'timeout' ? 'The request timed out. Please try again.' : 'Unable to complete the action. Please try again.';
      if (reason) { if (rollback) rollback(); toast(reason); return false; }
      apply(); return true;
    }).catch(function () { if (rollback) rollback(); toast('Unable to complete the action. Please try again.'); return false; });
  }
  function publishAdaptive() {
    state.v3ProCapabilities = state.v3ProCapabilities || {};
    state.v3ProCapabilities.adaptiveBrightness = !!preferences.adaptive;
    state.v3ProCapabilities.screenBrightness = preferences.brightness;
  }
  function reportBrightness(value) {
    if (typeof value.adaptive === 'boolean') preferences.adaptive = value.adaptive;
    if (Number.isFinite(value.brightness)) preferences.brightness = Math.max(5, Math.min(80, value.brightness));
    publishAdaptive(); save();
    if (!render(true)) { if (window.V3ProCapabilities) window.V3ProCapabilities.enforce(); }
    return true;
  }
  function setAdaptive(on) { return submit(function () { reportBrightness({adaptive:!!on}); }); }
  function setBrightness(value) {
    return submit(function () { reportBrightness({brightness:Math.round(Number(value))}); }, function () { render(true); });
  }
  publishAdaptive();
  function pump(size) { return '<span class="ds-pump ds-pump-' + size + '"><img src="' + asset + 'pump.png" alt="V3 Pro pump"></span>'; }
  function toggle(key, label) { return '<button class="ds-switch" role="switch" aria-label="' + label + '" aria-checked="' + (key === 'leakAlerts' ? enabled() : !!preferences[key]) + '" data-settings-toggle="' + key + '" ' + (leakSettingPending && key === 'leakAlerts' ? 'disabled' : '') + ' aria-disabled="' + !connected() + '"' + '><span></span></button>'; }
  function chrome() {
    return '<div class="ds-status"><span>7:41</span><span><img src="./assets/figma-v2/status-cellular.svg" alt=""><img src="./assets/figma-v2/status-wifi.svg" alt=""><img src="./assets/figma-v2/status-battery.svg" alt=""></span></div>' +
      '<header class="ds-toolbar"><button class="ds-back" data-settings-action="back" aria-label="Back"><img src="' + asset + 'back.svg" alt=""></button><h1>Setting</h1></header>';
  }
  function chevron() { return '<img class="ds-chevron" src="' + asset + 'chevron.svg" alt="">'; }
  function leakAlertCard() {
    return '<div class="ds-card ds-leak"><div class="ds-setting-row"><div><b>Leak Detection</b><p>Receive air leak alerts and fit guidance.</p></div>' + toggle('leakAlerts', 'Leak Detection') + '</div></div>';
  }
  function settings() {
    return '<main class="ds-content">' +
      '<button class="ds-device ds-card" data-settings-action="info">' + pump('small') + '<span class="ds-device-copy"><b>' + escapeText(preferences.name) + '</b><span class="ds-battery"><img src="' + asset + 'battery-80.svg" alt="Battery 80 percent"></span></span>' + chevron() + '</button>' +
      '<section class="ds-group"><h2>Device Features</h2>' +
      (STABILITY_ASSISTANT_UI_ENABLED ? leakAlertCard() : '') +
      '<div class="ds-card ds-controls"><div class="ds-brightness"><label for="ds-brightness">Screen/Button Brightness</label><output for="ds-brightness">' + preferences.brightness + '%</output><input id="ds-brightness" type="range" min="5" max="80" step="1" aria-label="Screen/Button Brightness" value="' + preferences.brightness + '" style="--ds-progress:' + ((preferences.brightness - 5) / 75 * 100) + '%" aria-disabled="' + !connected() + '" ' + '></div>' +
      '<div class="ds-setting-row"><div><b>Adaptive Brightness</b>' + (!preferences.adaptive ? '<p>Automatically adjusts screen, button, and night light brightness based on ambient light.</p>' : '') + '</div>' + toggle('adaptive', 'Adaptive Brightness') + '</div>' +
      '</div></section>' +
      '<section class="ds-group"><h2>General Settings</h2><div class="ds-card ds-general"><button data-settings-action="firmware"><b>Firmware Upgrade</b><span>New <i></i>' + chevron() + '</span></button><button data-settings-action="restore"><b>Restore Factory</b>' + chevron() + '</button></div></section>' +
      '<button class="ds-delete ds-card" data-settings-action="delete">Delete</button></main>';
  }
  function infoRow(label, value, copy) { return '<div class="ds-info-row"><b>' + label + '</b><span>' + escapeText(value) + (copy ? '<button aria-label="Copy ' + label + '" data-settings-copy="' + escapeText(value) + '"><img src="' + asset + 'copy.svg" alt=""></button>' : '') + '</span></div>'; }
  function deviceInfo() {
    return '<main class="ds-info-content"><div class="ds-device-hero">' + pump('large') + '<button class="ds-rename" data-settings-action="rename"><b>' + escapeText(preferences.name) + '</b><img src="' + asset + 'edit.svg" alt="Edit device name"></button></div>' +
      '<div class="ds-card ds-info-card">' + infoRow('Model', 'V3 Pro') + infoRow('SN', 'SN- DAC1101FDF49', true) + infoRow('MAC', 'SN- DAC1101FDF49', true) + infoRow('Firmware Version', '46') + '</div></main>';
  }
  function modal() {
    if (!dialog) return '';
    var title = dialog === 'restore' ? 'Restore Factory Settings?' : dialog === 'delete' ? 'Remove This Device?' : dialog === 'rename' ? 'Device Name' : 'Firmware Upgrade';
    var copy = dialog === 'restore' ? 'This will reset your device settings to their defaults.' : dialog === 'delete' ? 'Remove this device from the demo?' : dialog === 'firmware' ? 'Your demo is up to date.' : '';
    return '<div class="ds-dialog-backdrop"><section class="ds-dialog" role="dialog" aria-modal="true" aria-label="' + title + '"><h2>' + title + '</h2>' + (copy ? '<p>' + copy + '</p>' : '') + (dialog === 'rename' ? '<input data-settings-name maxlength="32" aria-label="Device name" value="' + escapeText(preferences.name) + '">' : '') + '<button data-settings-action="dialog-confirm">' + (dialog === 'rename' ? 'Save' : dialog === 'firmware' ? 'Done' : 'Confirm') + '</button>' + (dialog !== 'firmware' ? '<button data-settings-action="dialog-cancel">Cancel</button>' : '') + '</section></div>';
  }
  function render(force) {
    if (state.page !== 'settings' && state.page !== 'device-info') return false;
    if (!force && root.querySelector('.ds-page')) return true;
    var scroll = root.querySelector('.ds-content');
    var top = scroll ? scroll.scrollTop : 0;
    root.innerHTML = '<section class="v4 ds-page">' + chrome() + (state.page === 'settings' ? settings() : deviceInfo()) + '<i class="ds-home-indicator"></i>' + modal() + '</section>';
    scroll = root.querySelector('.ds-content'); if (scroll) scroll.scrollTop = top;
    return true;
  }
  function reportLeakState(on) {
    if (typeof on !== 'boolean') return false;
    deviceLeakEnabled = on;
    reportedLeakEnabled = on;
    try { localStorage.setItem(deviceStorageKey, JSON.stringify(on)); } catch (_) {}
    if (!on && window.V3ProLeakFlow) {
      var f = window.V3ProLeakFlow.state();
      if (['guide','complete','rechecking','unresolved_confirm'].indexOf(f.stage) >= 0) {
        f.stage = 'guide_closed'; f.backgroundMonitoring = false;
      }
    }
    if (!render(true)) window.v4View();
    return true;
  }
  function setLeakAlerts(on) {
    if (leakSettingPending || !canExecute()) return Promise.resolve(false);
    leakSettingPending = true;
    render(true);
    // Mock a device command acknowledgement/report. UI changes only on that report.
    return submit(function () { leakSettingPending = false; reportLeakState(!!on); }, function () { leakSettingPending = false; render(true); });
  }
  function refreshDeviceState() {
    if (!connected()) return;
    try {
      var saved = JSON.parse(localStorage.getItem(deviceStorageKey) || 'null');
      if (typeof saved === 'boolean') deviceLeakEnabled = saved;
    } catch (_) {}
    reportLeakState(deviceLeakEnabled);
  }
  function install() {
    var baseView = window.v4View;
    window.v4View = v4View = function () { if (!render(false)) return baseView.apply(this, arguments); };
    window.view = window.v4View;
    document.addEventListener('click', function (event) {
      var el = event.target.closest('button'); if (!el || !root.contains(el)) return;
      var settingsGear = el.matches('.v4-control .v4-top > button:last-child') || (state.page === 'home' && /setting/i.test(el.innerHTML));
      var action = el.getAttribute('data-settings-action');
      var key = el.getAttribute('data-settings-toggle');
      var copy = el.getAttribute('data-settings-copy');
      if (!settingsGear && !action && !key && !copy) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (settingsGear) { returnPage = state.page; state.page = 'settings'; dialog = null; refreshDeviceState(); render(true); return; }
      if (key) {
        if (!canExecute()) return;
        if (key === 'leakAlerts') setLeakAlerts(!enabled());
        else if (key === 'adaptive') setAdaptive(!preferences.adaptive);
        return;
      }
      if (copy) { if (navigator.clipboard) navigator.clipboard.writeText(copy).then(function () { el.setAttribute('aria-label', 'Copied'); }).catch(function () {}); return; }
      if (action === 'back') {
        state.page = state.page === 'device-info' ? 'settings' : returnPage;
        dialog = null; if (!render(true)) window.v4View();
      } else if (action === 'info') { state.page = 'device-info'; render(true); }
      else if (action === 'dialog-cancel') { dialog = null; render(true); }
      else if (action === 'dialog-confirm') {
        if (dialog === 'rename') { var input = root.querySelector('[data-settings-name]'); preferences.name = input.value.trim() || 'V3 Pro'; save(); }
        if (dialog === 'restore') { submit(function () { preferences = Object.assign({}, defaults); delete preferences.leakAlerts; publishAdaptive(); save(); reportLeakState(defaults.leakAlerts); }); }
        if (dialog === 'delete') { state.page = 'device'; }
        dialog = null; if (!render(true)) window.v4View();
      } else { dialog = action; render(true); }
    }, true);
    document.addEventListener('input', function (event) {
      if (event.target.id !== 'ds-brightness') return;
      var value = Number(event.target.value);
      if (!canExecute(false)) { event.target.value = preferences.brightness; return; }
      event.target.style.setProperty('--ds-progress', ((value - 5) / 75 * 100) + '%');
      var output = root.querySelector('output[for="ds-brightness"]');
      if (output) output.textContent = value + '%';
    });
    document.addEventListener('change', function (event) {
      if (event.target.id === 'ds-brightness') setBrightness(event.target.value);
    });
    document.addEventListener('click', function (event) {
      if (event.target.id === 'ds-brightness' && !connected()) { event.preventDefault(); canExecute(); }
    }, true);
  }
  // Initial connection report comes from the simulated device, not the App default.
  reportedLeakEnabled = deviceLeakEnabled;
  window.V3ProSettings = {
    connected: connected, canExecute: canExecute, submit: submit,
    adaptiveEnabled: function () { return !!preferences.adaptive; },
    setAdaptiveBrightness: setAdaptive, setBrightness: setBrightness, reportBrightness: reportBrightness,
    snapshot: function () { return {adaptive:!!preferences.adaptive, brightness:preferences.brightness, leakAlerts:enabled()}; },
    leakAlertsEnabled: enabled,
    setLeakAlerts: setLeakAlerts,
    reportLeakDetection: reportLeakState,
    refreshDeviceState: refreshDeviceState,
    pairNewDevice: function () { return reportLeakState(defaults.leakAlerts); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
}());
