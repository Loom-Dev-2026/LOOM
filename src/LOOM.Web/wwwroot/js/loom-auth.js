let cleanup = [];

window.loomAuth = {
  initPage(splitSelector, decoSelector) {
    this.disposePage();
    this.initInputFocus(splitSelector);
    this.initDemoParallax(decoSelector);
    this.initDemoEdge('#authDemoPanel');
  },

  initDemoEdge(panelSelector) {
    this.updateDemoEdge(panelSelector);

    const panel = document.querySelector(panelSelector);
    if (!panel) return;

    const onResize = () => this.updateDemoEdge(panelSelector);
    window.addEventListener('resize', onResize, { passive: true });
    cleanup.push(() => window.removeEventListener('resize', onResize));

    const observer = new MutationObserver(() => this.updateDemoEdge(panelSelector));
    observer.observe(panel, { attributes: true, subtree: true, attributeFilter: ['class'] });
    cleanup.push(() => observer.disconnect());
  },

  updateDemoEdge(panelSelector) {
    const panel = document.querySelector(panelSelector);
    if (!panel) return;

    const canvas = panel.querySelector('.loom-demo-canvas');
    const svg = panel.querySelector('.loom-demo-edge');
    const outPort = panel.querySelector('.loom-demo-port--out');
    const inPort = panel.querySelector('.loom-demo-port--in');
    const base = panel.querySelector('.loom-demo-edge-base');
    const flow = panel.querySelector('.loom-demo-edge-flow');
    if (!canvas || !svg || !outPort || !inPort || !base || !flow) return;

    const canvasRect = canvas.getBoundingClientRect();
    if (canvasRect.width < 1 || canvasRect.height < 1) return;

    const portCenter = (el) => {
      const pr = el.getBoundingClientRect();
      return {
        x: pr.left + pr.width / 2 - canvasRect.left,
        y: pr.top + pr.height / 2 - canvasRect.top
      };
    };

    const a = portCenter(outPort);
    const b = portCenter(inPort);
    const dx = Math.max(48, Math.abs(b.x - a.x) * 0.42);
    const d = `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} C ${(a.x + dx).toFixed(1)} ${a.y.toFixed(1)}, ${(b.x - dx).toFixed(1)} ${b.y.toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;

    svg.setAttribute('viewBox', `0 0 ${canvasRect.width} ${canvasRect.height}`);
    base.setAttribute('d', d);
    flow.setAttribute('d', d);

    const len = base.getTotalLength();
    base.style.setProperty('--edge-len', String(len));
    flow.style.setProperty('--edge-len', String(len));
  },

  disposePage() {
    cleanup.forEach((fn) => fn());
    cleanup = [];
  },

  flashSuccess(selector) {
    const btn = document.querySelector(selector);
    if (!btn) return;

    btn.style.transition = 'background 200ms ease';
    btn.style.background = '#ffffff';
    setTimeout(() => {
      btn.style.background = '';
    }, 220);
  },

  submitAuthForm(token) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/auth/complete';
    form.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'token';
    input.value = token;
    form.appendChild(input);

    document.body.appendChild(form);
    form.submit();
  },

  initInputFocus(splitSelector) {
    const split = document.querySelector(splitSelector);
    if (!split) return;

    const demo = split.querySelector('.loom-auth-demo');

    const setPanelActive = (active) => {
      split.classList.toggle('panel-active', active);
      if (demo) {
        demo.classList.toggle('is-fast', active);
        demo.dataset.speed = active ? 'fast' : 'normal';
      }
    };

    split.querySelectorAll('input').forEach((input) => {
      const onFocus = () => setPanelActive(true);
      const onBlur = () => setPanelActive(false);
      input.addEventListener('focus', onFocus);
      input.addEventListener('blur', onBlur);
      cleanup.push(() => {
        input.removeEventListener('focus', onFocus);
        input.removeEventListener('blur', onBlur);
      });
    });
  },

  initDemoParallax(demoSelector) {
    const panel = document.querySelector(demoSelector);
    if (!panel) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(hover: hover)').matches) return;

    const onMove = (event) => {
      const rect = panel.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      panel.style.setProperty('--demo-ry', `${x * 4}deg`);
      panel.style.setProperty('--demo-rx', `${-y * 3}deg`);
    };

    const onLeave = () => {
      panel.style.setProperty('--demo-ry', '0deg');
      panel.style.setProperty('--demo-rx', '0deg');
    };

    panel.addEventListener('mousemove', onMove, { passive: true });
    panel.addEventListener('mouseleave', onLeave);
    cleanup.push(() => {
      panel.removeEventListener('mousemove', onMove);
      panel.removeEventListener('mouseleave', onLeave);
      panel.style.removeProperty('--demo-ry');
      panel.style.removeProperty('--demo-rx');
    });
  }
};
