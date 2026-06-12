/**
 * Landing page interactions (intro, nav, canvas demo, scroll reveal).
 */

export function initLanding() {
  if (window.__loomLandingInitialized) return;
  window.__loomLandingInitialized = true;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Theme toggles are handled by Blazor ThemeToggle (theme.js).

    // Intro overlay is controlled by Blazor (IntroOverlay.razor + loom-ui.js).

    // ========== SUBTLE SCROLL PARALLAX ==========
    // Instead of hijacking scroll (which can feel janky), we add subtle scroll-linked
    // parallax effects to make scrolling feel premium without breaking native behavior.
    if (!prefersReducedMotion) {
      let ticking = false;
      const aurora = document.querySelector('.bg-aurora');

      function onScrollParallax() {
        const y = window.scrollY;
        // Aurora blobs drift slightly with scroll
        if (aurora) {
          aurora.style.transform = `translate3d(0, ${y * 0.15}px, 0)`;
        }
        ticking = false;
      }
      window.addEventListener('scroll', () => {
        if (!ticking) {
          requestAnimationFrame(onScrollParallax);
          ticking = true;
        }
      }, { passive: true });
    }

    // ========== CURSOR-REACTIVE GRID — light up grid lines near cursor ==========
    const gridGlow = document.getElementById('gridGlow');
    const gridWash = document.getElementById('gridWash');
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let smoothX = mouseX, smoothY = mouseY;
    let cursorActive = false;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!cursorActive) {
        cursorActive = true;
        if (gridGlow) gridGlow.classList.remove('hidden');
        if (gridWash) gridWash.classList.remove('hidden');
      }
    }, { passive: true });

    document.addEventListener('mouseleave', () => {
      cursorActive = false;
      if (gridGlow) gridGlow.classList.add('hidden');
      if (gridWash) gridWash.classList.add('hidden');
    });
    document.addEventListener('mouseenter', () => {
      cursorActive = true;
      if (gridGlow) gridGlow.classList.remove('hidden');
      if (gridWash) gridWash.classList.remove('hidden');
    });

    function tickGrid() {
      // Smooth lerp for buttery feel
      smoothX += (mouseX - smoothX) * 0.18;
      smoothY += (mouseY - smoothY) * 0.18;
      const x = smoothX + 'px';
      const y = smoothY + 'px';
      if (gridGlow) {
        gridGlow.style.setProperty('--mx', x);
        gridGlow.style.setProperty('--my', y);
      }
      if (gridWash) {
        gridWash.style.setProperty('--mx', x);
        gridWash.style.setProperty('--my', y);
      }
      requestAnimationFrame(tickGrid);
    }
    if (!prefersReducedMotion) requestAnimationFrame(tickGrid);
    // Start hidden until first mouse move
    if (gridGlow) gridGlow.classList.add('hidden');
    if (gridWash) gridWash.classList.add('hidden');

    // ========== Canvas local spotlight ==========
    const canvasArea = document.getElementById('canvasArea');
    const canvasSpotlight = document.getElementById('canvasSpotlight');
    if (canvasArea && canvasSpotlight) {
      canvasArea.addEventListener('mousemove', (e) => {
        const rect = canvasArea.getBoundingClientRect();
        canvasSpotlight.style.transform = `translate(${e.clientX - rect.left}px, ${e.clientY - rect.top}px) translate(-50%, -50%)`;
      }, { passive: true });
    }

    // ========== Draw pipes edge-to-edge from real port coordinates ==========
    const stage = document.getElementById('canvasStage');
    const svg = document.getElementById('connections');
    // edges: [fromPort, toPort] using data-port ids
    const EDGES = [
      ['1-out', '3-in'],
      ['2-out', '4-in'],
      ['3-out', '5-in'],
      ['4-out', '5-in'],
      ['5-out', '6-in'],
      ['3-out', '6-in'],
    ];

    function portCenter(id) {
      const el = stage.querySelector(`[data-port="${id}"]`);
      if (!el) return null;
      const pr = el.getBoundingClientRect();
      const sr = stage.getBoundingClientRect();
      const scale = sr.width / stage.offsetWidth || 1;
      return {
        x: (pr.left + pr.width / 2 - sr.left) / scale,
        y: (pr.top + pr.height / 2 - sr.top) / scale,
      };
    }

    function buildPipes() {
      if (!stage || !svg) return;
      svg.setAttribute('viewBox', `0 0 ${stage.offsetWidth} ${stage.offsetHeight}`);
      svg.innerHTML = '';
      EDGES.forEach((edge, i) => {
        const a = portCenter(edge[0]);
        const b = portCenter(edge[1]);
        if (!a || !b) return;
        // horizontal-biased cubic bezier — smooth S-curve between ports
        const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
        const d = `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
        const ns = 'http://www.w3.org/2000/svg';

        const base = document.createElementNS(ns, 'path');
        base.setAttribute('d', d);
        base.setAttribute('class', `connection-path c${i + 1}`);

        const flow = document.createElementNS(ns, 'path');
        flow.setAttribute('d', d);
        flow.setAttribute('class', `connection-flow f${i + 1}`);

        // set dash length to actual path length so draw + flow animate correctly
        svg.appendChild(base);
        svg.appendChild(flow);
        const len = base.getTotalLength();
        base.style.setProperty('--len', len);
        flow.style.setProperty('--len', len);
      });
    }

    // Scale the fixed 1100px stage down to fit narrower canvases
    function fitStage() {
      if (!stage || !canvasArea) return;
      const avail = canvasArea.clientWidth - 48;
      const scale = Math.min(1, avail / 1100);
      stage.style.setProperty('--stage-scale', scale);
    }

    function layoutCanvas() {
      fitStage();
      requestAnimationFrame(buildPipes);
    }

    if (stage && svg) {
      layoutCanvas();
      window.addEventListener('resize', layoutCanvas, { passive: true });
      setTimeout(layoutCanvas, 200);
      if (document.readyState === 'complete') {
        setTimeout(layoutCanvas, 0);
      } else {
        window.addEventListener('load', layoutCanvas, { once: true });
      }
    }

    // ========== Feature card cursor-tracked glow ==========
    document.querySelectorAll('.feature-card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--mouse-x', `${x}%`);
        card.style.setProperty('--mouse-y', `${y}%`);
      }, { passive: true });
    });

    // ========== Subtle 3D tilt on canvas frame ==========
    const canvasFrame = document.getElementById('canvasFrame');
    const canvasDemo = document.getElementById('canvasDemo');
    if (canvasFrame && canvasDemo && !prefersReducedMotion && window.matchMedia('(hover: hover)').matches) {
      let targetRx = 0, targetRy = 0, curRx = 0, curRy = 0;
      canvasDemo.addEventListener('mousemove', (e) => {
        const rect = canvasDemo.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        targetRy = px * 4;   // max 4deg
        targetRx = -py * 3;  // max 3deg
      }, { passive: true });
      canvasDemo.addEventListener('mouseleave', () => {
        targetRx = 0; targetRy = 0;
      });
      function tiltLoop() {
        curRx += (targetRx - curRx) * 0.08;
        curRy += (targetRy - curRy) * 0.08;
        canvasFrame.style.setProperty('--rx', `${curRx}deg`);
        canvasFrame.style.setProperty('--ry', `${curRy}deg`);
        requestAnimationFrame(tiltLoop);
      }
      requestAnimationFrame(tiltLoop);
    }

    // ========== Sticky nav scroll state + active section highlight ==========
    const nav = document.getElementById('mainNav');
    const navLinks = document.querySelectorAll('.nav-links a[data-section]');
    const sections = ['features', 'how'].map(id => document.getElementById(id)).filter(Boolean);

    function onScroll() {
      const y = window.scrollY;
      if (nav) nav.classList.toggle('scrolled', y > 30);

      // Active nav highlight
      let active = null;
      const mid = y + window.innerHeight * 0.35;
      for (const s of sections) {
        if (s.offsetTop <= mid && s.offsetTop + s.offsetHeight > mid) {
          active = s.id;
          break;
        }
      }
      navLinks.forEach(a => a.classList.toggle('active', a.dataset.section === active));
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // ========== Scroll reveal on intersection ==========
    if ('IntersectionObserver' in window) {
      const revealObs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            revealObs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

      document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => revealObs.observe(el));
    } else {
      document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => el.classList.add('in-view'));
    }

    // ========== Stat counter animation ==========
    if ('IntersectionObserver' in window && !prefersReducedMotion) {
      const counterObs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const target = parseInt(el.dataset.count, 10);
            const suffix = el.dataset.suffix || '';
            const duration = 1400;
            const start = performance.now();
            const hasEm = el.querySelector('em');
            const emHTML = hasEm ? hasEm.outerHTML : '';

            function step(now) {
              const t = Math.min((now - start) / duration, 1);
              const eased = 1 - Math.pow(1 - t, 3);
              const val = Math.round(target * eased);
              el.innerHTML = val + (emHTML || suffix);
              if (t < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
            counterObs.unobserve(el);
          }
        });
      }, { threshold: 0.5 });

      document.querySelectorAll('.stat .num[data-count]').forEach(el => counterObs.observe(el));
    }

    // ========== Smooth anchor scroll with offset already handled via CSS scroll-padding ==========
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', (e) => {
        const href = a.getAttribute('href');
        if (href.length > 1) {
          const target = document.querySelector(href);
          if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    });
}

export function disposeLanding() {
  window.__loomLandingInitialized = false;
}
