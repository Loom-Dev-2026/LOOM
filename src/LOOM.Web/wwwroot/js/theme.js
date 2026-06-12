export function getTheme() {
  try {
    return localStorage.getItem('loom_theme') || 'dark';
  } catch {
    return 'dark';
  }
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('loom_theme', theme);
  } catch {
    /* ignore */
  }
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  setTheme(current === 'dark' ? 'light' : 'dark');
  return document.documentElement.getAttribute('data-theme');
}
