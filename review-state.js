(() => {
  const screenId = new URLSearchParams(location.search).get('screen');
  if (!screenId || typeof AIR2_SCREEN_REGISTRY === 'undefined') return;
  const screen = AIR2_SCREEN_REGISTRY.find(item => item.id === screenId);
  if (!screen) return;

  Object.assign(state, {
    page:'device', modal:null, mode:'stimulation', auto:false, running:false,
    paused:false, levelL:2, levelR:4, speed:5, both:false, timer:0,
    milkL:0, milkR:0, selectedProgram:null, listExpanded:'Milk Boost',
    fitStage:0, fitAdjust:false, hasLogged:false
  }, screen.state);

  const sideOff = new URLSearchParams(location.search).get('side-off');
  if (sideOff === 'l') state.levelEnabledL = false;
  if (sideOff === 'r') state.levelEnabledR = false;

  v4View();

  /* Control pages are interactive product demos. Keep the review seed state,
     but do not freeze the rendered controls into a static screenshot. */
  if (screen.state && screen.state.page === 'control' && screen.state.modal == null) {
    state.reviewFrozen = false;
    state.reviewScreenId = screen.id;
    root.dataset.reviewScreen = screen.id;
    document.body.classList.remove('review-static');
    document.querySelectorAll('.review-selection-layer, .review-selection-draft').forEach(function (node) { node.remove(); });
    document.title = `${screen.title} · Air2 Demo`;
    return;
  }

  state.reviewFrozen = true;
  state.reviewScreenId = screen.id;
  state.page = `review:${screen.id}`;
  root.dataset.reviewScreen = screen.id;
  document.body.classList.add('review-static');
  document.title = `${screen.title} · Air2 Review`;

  v4View = () => {};
  view = v4View;
})();
