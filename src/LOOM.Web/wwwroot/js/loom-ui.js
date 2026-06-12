/**
 * Minimal browser UI helpers (intro gate, body classes). No workflow/backend logic.
 */

export function hasIntroPlayed() {
  try {
    return sessionStorage.getItem('loom_intro_played') === '1';
  } catch {
    return false;
  }
}

export function markIntroPlayed() {
  try {
    sessionStorage.setItem('loom_intro_played', '1');
  } catch {
    /* ignore */
  }
}

export function setIntroActive(active) {
  document.body.classList.toggle('intro-active', !!active);
  if (!active) {
    document.body.classList.remove('intro-skipped');
  }
}

export function skipIntro() {
  document.body.classList.add('intro-skipped');
  setIntroActive(false);
}
