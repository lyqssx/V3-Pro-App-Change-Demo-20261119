/* Existing Figma behavior: pinned reminder/chrome, one scrolling session body. */
(function () {
  var root = document.getElementById('demo');
  var scrollTop = 0;
  var previousInset = 106;
  var previewTimer;
  var serial = 0;
  function current() { return typeof state !== 'undefined' ? state : window.state; }
  function warmNotice(s) {
    var n = s && s.controlNotice;
    return !!(n && (n.backdrop || ['auto','ending','suggestion','critical-battery'].indexOf(n.kind) >= 0 || String(n.text || '').length > 44));
  }
  function offsetAfterInset(top, before, after) { return top > 0 ? Math.max(0, top + after - before) : 0; }
  function sync() {
    var page = root.querySelector('.v4-control');
    if (!page) return;
    if (!page.querySelector('.v3-notice-backdrop')) {
      var wash = document.createElement('div'); wash.className = 'v3-notice-backdrop'; wash.setAttribute('aria-hidden','true');
      wash.innerHTML = '<div class="v3-notice-backdrop-art"><img src="./assets/figma-notice-scroll/wash-color.svg" alt=""></div>';
      page.insertBefore(wash, page.firstChild);
    }
    var body = page.querySelector('.v3-control-scroll');
    var fresh = !body;
    if (fresh) {
      if (window.V3ProCapabilities) window.V3ProCapabilities.enforce();
      var pump = page.querySelector('.v4-pump-row');
      var controls = page.querySelector('.v4-controls');
      if (!pump || !controls) return;
      body = document.createElement('div');
      body.className = 'v3-control-scroll';
      body.setAttribute('aria-label', 'Pump session controls');
      page.insertBefore(body, pump);
      body.appendChild(pump);
      body.appendChild(controls);
      body.addEventListener('scroll', function () { scrollTop = body.scrollTop; }, {passive:true});
    }
    var active = warmNotice(current());
    var inset = active ? 161 : 106;
    var oldTop = fresh ? scrollTop : body.scrollTop;
    var oldInset = fresh ? previousInset : Number(body.dataset.noticeInset || 106);
    if (page.classList.contains('v3-notice-active') !== active) page.classList.toggle('v3-notice-active', active);
    if (fresh || inset !== oldInset) body.scrollTop = offsetAfterInset(oldTop, oldInset, inset);
    body.dataset.noticeInset = String(inset);
    scrollTop = body.scrollTop;
    previousInset = inset;
  }
  function installPreview() {
    var panel = document.querySelector('.demo-trigger-content');
    if (!panel || panel.querySelector('[data-notice-scroll-preview-group]')) return;
    panel.insertAdjacentHTML('beforeend', '<section class="demo-trigger-group" data-notice-scroll-preview-group><h3>消息提醒演示</h3><div class="demo-trigger-grid"><button type="button" class="demo-trigger-action" data-notice-scroll-preview><b>温馨提示（5 秒）</b></button></div></section>');
  }
  function preview() {
    var s = current();
    if (!s || s.page !== 'control') return;
    var id = 'notice-preview-' + Date.now() + '-' + (++serial);
    s.controlNotice = {kind:'demo-reminder', id:id, startedAt:Date.now(), backdrop:true, text:'Let-down detected. You can switch to Expression when you are ready.'};
    if (window.v4View) window.v4View();
    sync();
    clearTimeout(previewTimer);
    previewTimer = setTimeout(function () {
      if (!s.controlNotice || s.controlNotice.id !== id) return;
      s.controlNotice = null;
      if (window.v4View) window.v4View();
      sync();
    }, 5000);
  }
  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('[data-notice-scroll-preview]');
    if (!button) return;
    event.preventDefault(); event.stopImmediatePropagation();
    var host = button.closest('.demo-trigger-root');
    if (host) { host.classList.remove('is-open'); var toggle = host.querySelector('.demo-trigger-toggle'); if (toggle) toggle.setAttribute('aria-expanded','false'); }
    preview();
  }, true);
  function boot() {
    sync(); installPreview();
    new MutationObserver(function () { sync(); installPreview(); }).observe(root, {childList:true, subtree:true, attributes:true, attributeFilter:['class']});
    var host = document.querySelector('.demo-trigger-root');
    if (host) new MutationObserver(installPreview).observe(host, {childList:true,subtree:true});
  }
  window.V3ProNoticeScroll = {preview:preview, offsetAfterInset:offsetAfterInset};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
}());
