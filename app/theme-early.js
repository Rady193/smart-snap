// Runs in <head>, before anything is drawn: applies the appearance that was last
// used, so the window does not open dark and then switch to light.
// (renderer.js stores the choice as JSON under "appTheme".)
(function () {
  var theme = 'dark';
  try {
    var saved = JSON.parse(localStorage.getItem('appTheme'));
    if (saved === 'light' || saved === 'dark') theme = saved;
  } catch (e) { /* first start: keep dark */ }
  document.documentElement.dataset.theme = theme;
})();
