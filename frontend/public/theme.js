// Runs before styles and React to prevent an incorrect initial theme.
(function () {
  var saved;
  try { saved = localStorage.getItem('plutus-theme'); } catch (_) {}
  var theme = saved === 'light' || saved === 'dark' ? saved :
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
