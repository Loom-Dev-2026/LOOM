let cleanup = [];

export function initAuthPage() {
  disposeAuthPage();

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shell = document.getElementById('authShell');
  const stage = document.getElementById('workflowStage');
  const card = document.getElementById('loginCard');

  if (shell && !reduceMotion) {
    let raf = 0;
    let targetX = 50;
    let targetY = 45;
    let currentX = targetX;
    let currentY = targetY;

    const onMove = (event) => {
      targetX = (event.clientX / window.innerWidth) * 100;
      targetY = (event.clientY / window.innerHeight) * 100;
      if (!raf) raf = requestAnimationFrame(tickShell);
    };

    const tickShell = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      shell.style.setProperty('--mx', `${currentX}%`);
      shell.style.setProperty('--my', `${currentY}%`);

      if (Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05) {
        raf = requestAnimationFrame(tickShell);
      } else {
        raf = 0;
      }
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    cleanup.push(() => {
      window.removeEventListener('mousemove', onMove);
      if (raf) cancelAnimationFrame(raf);
    });
  }

  if (stage && !reduceMotion && window.matchMedia('(hover: hover)').matches) {
    const onMove = (event) => {
      const rect = stage.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      stage.style.setProperty('--stage-ry', `${x * 5}deg`);
      stage.style.setProperty('--stage-rx', `${-y * 4}deg`);
    };
    const onLeave = () => {
      stage.style.setProperty('--stage-ry', '0deg');
      stage.style.setProperty('--stage-rx', '0deg');
    };

    stage.addEventListener('mousemove', onMove, { passive: true });
    stage.addEventListener('mouseleave', onLeave);
    cleanup.push(() => {
      stage.removeEventListener('mousemove', onMove);
      stage.removeEventListener('mouseleave', onLeave);
    });
  }

  if (card && !reduceMotion && window.matchMedia('(hover: hover)').matches) {
    const onMove = (event) => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      card.style.setProperty('--card-mx', `${x * 100}%`);
      card.style.setProperty('--card-my', `${y * 100}%`);
      card.style.setProperty('--card-ry', `${(x - 0.5) * 7}deg`);
      card.style.setProperty('--card-rx', `${-(y - 0.5) * 6}deg`);
    };
    const onLeave = () => {
      card.style.setProperty('--card-ry', '0deg');
      card.style.setProperty('--card-rx', '0deg');
    };

    card.addEventListener('mousemove', onMove, { passive: true });
    card.addEventListener('mouseleave', onLeave);
    cleanup.push(() => {
      card.removeEventListener('mousemove', onMove);
      card.removeEventListener('mouseleave', onLeave);
    });
  }

  animateCounters(reduceMotion);
}

function animateCounters(reduceMotion) {
  const counters = Array.from(document.querySelectorAll('.metric-count'));
  if (!counters.length) return;

  if (reduceMotion) {
    counters.forEach((counter) => {
      counter.textContent = `${counter.dataset.count}${counter.dataset.suffix || ''}`;
    });
    return;
  }

  const run = (counter) => {
    const target = Number(counter.dataset.count || 0);
    const suffix = counter.dataset.suffix || '';
    const decimals = Number.isInteger(target) ? 0 : 2;
    const start = performance.now();
    const duration = 1300;

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = target * eased;
      counter.textContent = `${value.toFixed(decimals)}${suffix}`;
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        run(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.35 });

    counters.forEach((counter) => observer.observe(counter));
    cleanup.push(() => observer.disconnect());
    return;
  }

  counters.forEach(run);
}

export function disposeAuthPage() {
  cleanup.forEach((fn) => fn());
  cleanup = [];
}
