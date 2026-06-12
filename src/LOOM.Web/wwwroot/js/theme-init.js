(function() {
  try {
    var theme = localStorage.getItem('loom_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
