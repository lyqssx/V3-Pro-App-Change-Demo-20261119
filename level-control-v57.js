/* Figma-backed level control with mode-specific ranges. */
(function () {
  var drag = null;
  var TRAVEL = 134;
  var BOTH_MAX_DELTA = 3;
  // Keep the overlay mounted until click, so the gesture cannot hit controls below.
  function interceptWarningOutside(event) {
    var warning = document.querySelector('.v57-side-warning');
    if (!warning) return;
    var sheet = warning.querySelector('.v57-side-warning__sheet');
    if (sheet && sheet.contains(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type === 'click') warning.remove();
  }
  ['pointerdown', 'pointerup', 'click'].forEach(function (type) {
    window.addEventListener(type, interceptWarningOutside, true);
  });

  function maximum() {
    return state.mode === 'stimulation' ? 5 : 15;
  }

  function clamp(value, max) {
    return Math.max(1, Math.min(max, Math.round(Number(value) || 1)));
  }

  function ensureLevelState(max) {
    state.levelL = clamp(state.levelL, max);
    state.levelR = clamp(state.levelR, max);
    if (!Number.isFinite(Number(state.levelMemoryL)) || Number(state.levelMemoryL) <= 0) {
      state.levelMemoryL = state.levelL || 1;
    }
    if (!Number.isFinite(Number(state.levelMemoryR)) || Number(state.levelMemoryR) <= 0) {
      state.levelMemoryR = state.levelR || 1;
    }
    if (typeof state.levelEnabledL !== 'boolean') state.levelEnabledL = state.levelL > 0;
    if (typeof state.levelEnabledR !== 'boolean') state.levelEnabledR = state.levelR > 0;
  }

  function syncSidePower(side) {
    var key = side === 'r' ? 'levelR' : 'levelL';
    var memoryKey = side === 'r' ? 'levelMemoryR' : 'levelMemoryL';
    var enabledKey = side === 'r' ? 'levelEnabledR' : 'levelEnabledL';
    if (state[key] > 0) {
      state[memoryKey] = state[key];
      state[enabledKey] = true;
    } else {
      state[enabledKey] = false;
    }
  }

  function tickMarkup(max) {
    return Array.from({ length: max }, function () { return '<i></i>'; }).join('');
  }

  function position(value, max) {
    return max ? Math.round((max - value) / (max - 1) * TRAVEL) : TRAVEL;
  }

  function sideMarkup(side, value, max) {
    var label = side === 'l' ? 'L' : 'R';
    var enabled = side === 'l' ? state.levelEnabledL : state.levelEnabledR;
    var displayedValue = String(value);
    return '<section class="v57-side ' + (enabled ? '' : 'is-disabled') + '">' +
      '<div class="v57-side-head"><div class="v57-side-label">' + label + '</div>' +
      '<a class="v57-side-toggle ' + (enabled ? 'is-on' : 'is-off') + '" href="?screen=control-manual-idle' + (enabled ? '&side-off=' + side : '') + '&v=20261117-side-toggle" data-v57-side-toggle="' + side + '" data-side="' + side + '" role="button" aria-label="' + label + ' side ' + (enabled ? 'On' : 'Off') + '" aria-pressed="' + enabled + '">' + (enabled ? 'On' : 'Off') + '</a></div>' +
      '<div class="v57-track ' + (enabled ? '' : 'is-disabled') + '" data-v57-level="' + side + '" role="slider" aria-disabled="' + (!enabled) + '" aria-label="' +
        (label === 'L' ? 'Left' : 'Right') + ' suction level" aria-valuemin="1" aria-valuemax="' + max +
        '" aria-valuenow="' + value + '" aria-valuetext="' + displayedValue + '">' +
        '<input class="v57-range-hit" data-v57-range="' + side + '" type="range" min="1" max="' + max + '" value="' + value + '" ' + (!enabled ? 'disabled ' : '') + 'aria-label="' + (label === 'L' ? 'Left' : 'Right') + ' suction level">' +
        '<span class="v57-ticks" aria-hidden="true">' + tickMarkup(max) + '</span>' +
        '<span class="v57-value" style="--v57-top:' + position(value, max) + 'px">' + displayedValue + '</span>' +
      '</div>' +
    '</section>';
  }

  function speedMarkup() {
    return '<section class="v4-speed"><h2>Speed</h2><div class="v4-speed-list">' +
      [1, 2, 3, 4, 5].map(function (number) {
        return '<button data-v4="speed" data-speed="' + number + '" class="' +
          (state.speed === number ? 'active' : '') + '">' + number + '</button>';
      }).join('') + '</div></section>';
  }

  window.v4Controls = function () {
    var max = maximum();
    ensureLevelState(max);
    return '<section class="v4-levels v57-levels ' + (max === 5 ? 'is-stimulation' : 'is-expression') + '">' +
      '<header class="v57-level-head"><img src="./assets/figma-level-v57/gauge.svg?v=2" alt="">' +
        'Level <span>1-' + max + '</span></header>' +
      '<div class="v57-level-body">' +
        sideMarkup('l', state.levelL, max) +
        '<section class="v57-both ' + (state.levelEnabledL && state.levelEnabledR ? '' : 'is-disabled') + '">' +
          '<div class="v57-both-label"><img src="./assets/figma-level-v57/link.svg?v=2" alt="">Both</div>' +
          '<button class="v57-both-track" type="button" data-v57-both aria-disabled="' + (!(state.levelEnabledL && state.levelEnabledR)) + '" role="slider" aria-label="Adjust both suction levels" aria-valuemin="-' + BOTH_MAX_DELTA + '" aria-valuemax="' + BOTH_MAX_DELTA + '" aria-valuenow="0">' +
            '<span class="v57-both-lines" aria-hidden="true">' +
              '<i style="--line-width:32px"></i><i style="--line-width:24px"></i><i style="--line-width:18px"></i>' +
              '<i style="--line-width:12px"></i><i style="--line-width:14px"></i><i style="--line-width:8px"></i>' +
              '<i style="--line-width:4px"></i>' +
            '</span>' +
            '<span class="v57-both-knob"><img src="./assets/figma-level-v57/both-adjust.svg?v=2" alt=""></span>' +
          '</button>' +
        '</section>' +
        sideMarkup('r', state.levelR, max) +
      '</div>' +
    '</section>' + speedMarkup();
  };

  function updateRailDom(side) {
    var max = maximum();
    var key = side === 'r' ? 'levelR' : 'levelL';
    var rail = document.querySelector('#demo [data-v57-level="' + side + '"]');
    if (!rail) return;
    var value = clamp(state[key], max);
    var pill = rail.querySelector('.v57-value');
    rail.setAttribute('aria-valuemin', '1');
    rail.setAttribute('aria-valuemax', String(max));
    var range = rail.querySelector('[data-v57-range]');
    if (range) { range.min = '1'; range.max = String(max); range.value = String(value); }
    rail.setAttribute('aria-valuenow', String(value));
    if (pill) {
      pill.textContent = String(value);
      pill.style.setProperty('--v57-top', position(value, max) + 'px');
    }
  }

  function renderValues() {
    updateRailDom('l');
    updateRailDom('r');
  }

  function setRailFromPointer(event) {
    if (!drag || drag.kind !== 'rail' || event.pointerId !== drag.id) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var rect = drag.element.getBoundingClientRect();
    var scale = rect.height / 170;
    var ratio = Math.max(0, Math.min(1, (event.clientY - rect.top - 18 * scale) / (TRAVEL * scale)));
    state[drag.key] = clamp(1 + (1 - ratio) * (drag.max - 1), drag.max);
    syncSidePower(drag.side);
    updateRailDom(drag.side);
  }

  function setBothDelta(delta) {
    if (!drag || drag.kind !== 'both') return;
    delta = Math.max(-BOTH_MAX_DELTA, Math.min(BOTH_MAX_DELTA, delta));
    if (delta === drag.delta) return;
    drag.delta = delta;
    state.levelL = clamp(drag.baseL + delta, drag.max);
    state.levelR = clamp(drag.baseR + delta, drag.max);
    drag.element.setAttribute('aria-valuenow', String(delta));
    var knob = drag.element.querySelector('.v57-both-knob');
    if (knob) knob.style.transform = 'translateY(' + (-delta * 15) + 'px)';
    renderValues();
  }

  function setBothFromPointer(event) {
    if (!drag || drag.kind !== 'both' || event.pointerId !== drag.id) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var scale = drag.element.getBoundingClientRect().height / 170 || 1;
    var distance = (drag.startY - event.clientY) / scale;
    var delta = distance === 0 ? 0 : Math.sign(distance) * Math.min(BOTH_MAX_DELTA, Math.floor(Math.abs(distance) / 18));
    setBothDelta(delta);
  }


  function toggleSide(side) {
    var levelKey = side === 'r' ? 'levelR' : 'levelL';
    var memoryKey = side === 'r' ? 'levelMemoryR' : 'levelMemoryL';
    var enabledKey = side === 'r' ? 'levelEnabledR' : 'levelEnabledL';
    if (state[enabledKey]) {
      if (Number(state[levelKey]) > 0) state[memoryKey] = state[levelKey];
      state[enabledKey] = false;
    } else {
      state[levelKey] = Number(state[levelKey]) > 0 ? state[levelKey] : 1;
      state[memoryKey] = state[levelKey];
      state[enabledKey] = true;
    }
    if (typeof v4View === 'function') v4View();
  }
  window.__toggleV57Side = toggleSide;

  function disableSide(side) {
    var levelKey = side === 'r' ? 'levelR' : 'levelL';
    var memoryKey = side === 'r' ? 'levelMemoryR' : 'levelMemoryL';
    var enabledKey = side === 'r' ? 'levelEnabledR' : 'levelEnabledL';
    if (Number(state[levelKey]) > 0) state[memoryKey] = state[levelKey];
    state[enabledKey] = false;
    if (typeof v4View === 'function') v4View();
  }

  function restoreSide(side) {
    var levelKey = side === 'r' ? 'levelR' : 'levelL';
    var memoryKey = side === 'r' ? 'levelMemoryR' : 'levelMemoryL';
    var enabledKey = side === 'r' ? 'levelEnabledR' : 'levelEnabledL';
    state[levelKey] = Number(state[levelKey]) > 0 ? state[levelKey] : 1;
    if (Number(state[levelKey]) <= 0) state[levelKey] = Math.max(1, Number(state[memoryKey]) || 1);
    state[memoryKey] = state[levelKey];
    state[enabledKey] = true;
    if (typeof v4View === 'function') v4View();
  }

  window.addEventListener('input', function (event) {
    var range = event.target.closest && event.target.closest('#demo [data-v57-range]');
    if (!range) return;
    var side = range.getAttribute('data-v57-range');
    var key = side === 'r' ? 'levelR' : 'levelL';
    if (state[side === 'r' ? 'levelEnabledR' : 'levelEnabledL'] === false) return;
    state[key] = clamp(Number(range.value), maximum());
    syncSidePower(side);
    updateRailDom(side);
  }, true);

  window.addEventListener('pointerdown', function (event) {
    // Own the whole side header on pointer-down. This prevents the rail's
    // gesture layer from swallowing the switch before a click is emitted.
    var rangeHit = event.target.closest && event.target.closest('#demo [data-v57-range]');
    if (rangeHit) return;
    var rail = event.target.closest && event.target.closest('#demo [data-v57-level]');
    var both = event.target.closest && event.target.closest('#demo [data-v57-both]');
    if (!rail && !both) return;
    if (rail && ((rail.dataset.v57Level === 'l' && state.levelEnabledL === false) || (rail.dataset.v57Level === 'r' && state.levelEnabledR === false))) return;
    if (both && (state.levelEnabledL === false || state.levelEnabledR === false)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var max = maximum();
    var element = rail || both;
    element.classList.add('is-dragging');
    element.setPointerCapture && element.setPointerCapture(event.pointerId);
    if (rail) {
      var side = rail.dataset.v57Level;
      drag = { kind: 'rail', id: event.pointerId, element: rail, side: side,
        key: side === 'r' ? 'levelR' : 'levelL', max: max };
      setRailFromPointer(event);
    } else {
      drag = { kind: 'both', id: event.pointerId, element: both, startY: event.clientY,
        baseL: clamp(state.levelL, max), baseR: clamp(state.levelR, max), max: max, delta: 0, moved: false };
    }
  }, true);

  window.addEventListener('pointermove', function (event) {
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.kind === 'rail') setRailFromPointer(event);
    else {
      if (Math.abs(drag.startY - event.clientY) > 4) drag.moved = true;
      setBothFromPointer(event);
    }
  }, true);

  function release(event) {
    if (!drag || (event && event.pointerId !== drag.id)) return;
    var active = drag;
    if (active.kind === 'both' && !active.moved && event) {
      var rect = active.element.getBoundingClientRect();
      setBothDelta(event.clientY < rect.top + rect.height / 2 ? 1 : -1);
    }
    active.element.classList.remove('is-dragging');
    if (active.kind === 'both') {
      var knob = active.element.querySelector('.v57-both-knob');
      if (knob) knob.style.transform = '';
      active.element.setAttribute('aria-valuenow', '0');
    }
    drag = null;
    if (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    if (typeof v4View === 'function') v4View();
  }

  window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', release, true);

  window.addEventListener('keydown', function (event) {
    var rail = event.target.closest && event.target.closest('#demo [data-v57-level]');
    var both = event.target.closest && event.target.closest('#demo [data-v57-both]');
    if (!rail && !both) return;
    if (rail && ((rail.dataset.v57Level === 'l' && state.levelEnabledL === false) || (rail.dataset.v57Level === 'r' && state.levelEnabledR === false))) return;
    if (both && (state.levelEnabledL === false || state.levelEnabledR === false)) return;
    var direction = (event.key === 'ArrowUp' || event.key === 'ArrowRight') ? 1 :
      (event.key === 'ArrowDown' || event.key === 'ArrowLeft') ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var max = maximum();
    if (rail) {
      var side = rail.dataset.v57Level;
      var key = side === 'r' ? 'levelR' : 'levelL';
      state[key] = clamp(state[key] + direction, max);
      syncSidePower(side);
    } else {
      state.levelL = clamp(state.levelL + direction, max);
      state.levelR = clamp(state.levelR + direction, max);
      syncSidePower('l');
      syncSidePower('r');
    }
    if (typeof v4View === 'function') v4View();
  }, true);


  function syncSideDom(side, enabled) {
    var section = root.querySelector('.v57-side:nth-of-type(' + (side === 'l' ? '1' : '3') + ')');
    var toggle = root.querySelector('[data-v57-side-toggle="' + side + '"]');
    var track = root.querySelector('[data-v57-level="' + side + '"]');
    if (!section || !toggle || !track) return;
    section.classList.toggle('is-disabled', !enabled);
    toggle.classList.toggle('is-on', enabled);
    toggle.classList.toggle('is-off', !enabled);
    toggle.textContent = enabled ? 'On' : 'Off';
    toggle.setAttribute('aria-label', (side === 'l' ? 'L' : 'R') + ' side ' + (enabled ? 'On' : 'Off'));
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.setAttribute('href', '?screen=control-manual-idle' + (enabled ? '&side-off=' + side : '') + '&v=20261117-side-toggle');
    track.classList.toggle('is-disabled', !enabled);
    track.setAttribute('aria-disabled', String(!enabled));
    var range = track.querySelector('[data-v57-range]');
    if (range) range.disabled = !enabled;
  }

  function syncBothDom() {
    var both = root.querySelector('[data-v57-both]');
    var section = both && both.closest('.v57-both');
    var enabled = state.levelEnabledL && state.levelEnabledR;
    if (section) section.classList.toggle('is-disabled', !enabled);
    if (both) both.setAttribute('aria-disabled', String(!enabled));
  }

  function showBothOffPrompt() {
    var old = root.querySelector('.v57-side-warning');
    if (old) old.remove();
    var warning = document.createElement('div');
    warning.className = 'v57-side-warning';
    warning.innerHTML = '<div class="v57-side-warning__sheet" role="dialog" aria-modal="true" aria-label="Cannot turn off both sides"><h3>Cannot turn off both sides</h3><p>To stop pumping on both sides, choose End Pumping. Choose Cancel to keep the current session unchanged.</p><div><button type="button" data-v57-warning-end>End Pumping</button><button type="button" data-v57-warning-cancel>Cancel</button></div></div>';
    root.appendChild(warning);
    warning.querySelector('[data-v57-warning-cancel]').addEventListener('click', function (event) {
      event.preventDefault(); event.stopImmediatePropagation(); warning.remove();
    });
    warning.querySelector('[data-v57-warning-end]').addEventListener('click', function (event) {
      event.preventDefault(); event.stopImmediatePropagation();
      state.running = false;
      state.paused = false;
      state.modal = 'log';
      warning.remove();
      if (typeof v4View === 'function') v4View();
    });
  }

  function bindSideLinks() {
    if (!root) return;
    root.querySelectorAll('[data-v57-side-toggle]').forEach(function (link) {
      if (link.dataset.v57LocalBound === '1') return;
      link.dataset.v57LocalBound = '1';
      link.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        var side = link.dataset.v57SideToggle;
        var enabledKey = side === 'l' ? 'levelEnabledL' : 'levelEnabledR';
        var otherKey = side === 'l' ? 'levelEnabledR' : 'levelEnabledL';
        if (state[enabledKey] && state[otherKey] === false) {
          showBothOffPrompt();
          return;
        }
        state[enabledKey] = !state[enabledKey];
        syncSideDom(side, state[enabledKey]);
        syncBothDom();
      });
    });
  }

  bindSideLinks();
  if (root) new MutationObserver(bindSideLinks).observe(root, {childList:true, subtree:true});
})();
