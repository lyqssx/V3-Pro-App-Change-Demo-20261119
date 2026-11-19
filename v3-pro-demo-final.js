/* Final V3 Pro behavior layer: keeps the demo aligned with the App SRD. */
(function () {
  function getState() { return typeof state !== 'undefined' ? state : (window.state || {}); }
  function render() { if (typeof window.v4View === 'function' && !getState().reviewFrozen) window.v4View(); }

  function stripLegacyMarkup(markup) {
    return String(markup || '')
      .replace(/<button[^>]*data-mode=["']mixed["'][\s\S]*?<\/button>/gi, '')
      .replace(/<div class="v4-list-auto">[\s\S]*?<\/div>/gi, '')
      .replace(/<div class="v4-auto-toggle">[\s\S]*?<\/div>/gi, '')
      .replace(/<div class="v4-auto-line">[\s\S]*?<\/div>/gi, '');
  }

  function patchRenderers() {
    if (!window.__v3ProFigmaManualCard) {
      window.v4ManualCard = function () {
        var s = getState();
        var expression = s.mode === 'expression';
        var timer = s.running ? '<span class="v3-pro-manual-timer">' + time(s.timer || 0) + '</span>' : '';
        function tab(mode, label, active) {
          var icon = mode === 'stimulation' && active ? '<span class="v3-pro-heart" aria-hidden="true"><span data-figma-heart-shader></span></span>' : '<img class="v3-pro-mode-icon v3-pro-mode-icon--' + mode + '" src="./assets/figma-v3-control/' + mode + '-' + (active ? 'on' : 'off') + '.svg" alt="">';
          return '<button type="button" class="v3-pro-manual-tab' + (active ? ' is-active' : '') + '" data-v4="mode" data-mode="' + mode + '" aria-pressed="' + active + '">' + icon + '<span>' + label + '</span></button>';
        }
        return '<section class="v3-pro-manual-card" aria-label="Manual pumping modes">' +
          '<button type="button" class="v3-pro-manual-header" data-v4="list" aria-label="Open pumping modes and rhythms"><span class="v3-pro-manual-symbol" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>Manual</span>' + timer + '<img class="v3-pro-manual-arrow" src="./assets/figma-v3-control/manual-arrow.svg" alt=""></button>' +
          '<div class="v3-pro-manual-tabs">' + tab('stimulation', 'Stimulation', !expression) + tab('expression', 'Expression', expression) + '</div></section>';
      };
      window.__v3ProFigmaManualCard = true;
    }
    if (!window.__v3ProFigmaRunningCard) {
      window.v3ProRhythmCard = function () {
        var s = getState();
        return '<section class="v3-pro-figma-boost-card" data-r49-boost-state="running">' +
          '<img class="v3-pro-boost-glow" src="./assets/figma-v3-control/running-bg.svg" alt="">' +
          '<img class="v3-pro-boost-glow-bottom" src="./assets/figma-v3-control/running-ellipse.svg" alt="">' +
          '<div class="v3-pro-figma-boost-card__header"><span class="v3-pro-figma-boost-card__title"><img src="./assets/figma-v3-control/boost-icon.svg" alt="">Milk Boost</span>' +
          '<span class="v3-pro-figma-boost-card__timer">' + time(s.timer || 0) + '</span>' +
          '<button class="v3-pro-figma-boost-card__arrow" data-v4="list" aria-label="Open list"><img src="./assets/figma-v3-control/running-back.svg" alt=""></button></div>' +
          '<div class="v3-pro-figma-boost-card__flow"><span class="v3-pro-boost-timeline"><img src="./assets/figma-v3-control/running-frame.svg" alt=""></span><span>20min</span></div></section>';
      };
      window.v4AutoCard = window.v3ProRhythmCard;
      window.__v3ProFigmaRunningCard = true;
      if (getState().page === 'control') render();
    }
    if (typeof window.v4ManualCard === 'function' && !window.__v3ProManualPatched) {
      var baseManual = window.v4ManualCard;
      window.v4ManualCard = function () { return stripLegacyMarkup(baseManual.apply(this, arguments)); };
      window.__v3ProManualPatched = true;
    }
    if (typeof window.v4List === 'function' && !window.__v3ProListPatched) {
      var baseList = window.v4List;
      window.v4List = function () { return stripLegacyMarkup(baseList.apply(this, arguments)); };
      window.__v3ProListPatched = true;
    }
    if (typeof window.v4Controls === 'function' && !window.__v3ProControlsPatched) {
      var baseControls = window.v4Controls;
      window.v4Controls = function () {
        return baseControls.apply(this, arguments);
      };
      window.__v3ProControlsPatched = true;
    }
  }

  function toggleSide(side) {
    var s = getState();
    var enabledKey = side === 'r' ? 'levelEnabledR' : 'levelEnabledL';
    var levelKey = side === 'r' ? 'levelR' : 'levelL';
    var memoryKey = side === 'r' ? 'levelMemoryR' : 'levelMemoryL';
    if (typeof s[enabledKey] !== 'boolean') s[enabledKey] = Number(s[levelKey]) > 0;
    if (s[enabledKey]) {
      if (Number(s[levelKey]) > 0) s[memoryKey] = Number(s[levelKey]);
      s[enabledKey] = false;
    } else {
      s[levelKey] = Number(s[levelKey]) > 0 ? Number(s[levelKey]) : Math.max(1, Number(s[memoryKey]) || 1);
      s[enabledKey] = true;
      s[memoryKey] = s[levelKey];
    }
    render();
  }
  window.__toggleV57Side = toggleSide;

  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('[data-v57-suction]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleSide(button.getAttribute('data-v57-suction'));
  }, true);


  function sanitize() {
    var s = getState();
    if (s.mode === 'mixed') s.mode = 'stimulation';
    patchRenderers();
  }
  sanitize();
  setInterval(sanitize, 250);
}());
