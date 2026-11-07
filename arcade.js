/* Arcade: tiny game registry + hash router.
   A game is an object: { id, title, blurb, icon, mount(container) -> optional cleanup fn } */
window.Arcade = (() => {
  const games = [];
  let root, cleanup = null, active = 0; // `active` persists so you return to the same slide

  const register = (game) => {
    if (!game.id || !game.mount) throw new Error('Game needs an id and mount()');
    games.push(game);
  };

  const el = (tag, attrs = {}, html = '') => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    n.innerHTML = html;
    return n;
  };

    /* Infinite carousel: every slide gets a signed offset from the active one,
     wrapped around the ring, so there is no end to scroll past. */
  function carousel(parent) {
    const n = games.length;
    const wrap = el('div', { class: 'carousel', role: 'region', 'aria-roledescription': 'carousel', 'aria-label': 'Games', tabindex: '0' });
    const track = el('ul', { class: 'track' });
    const slides = games.map((g) => {
      const li = el('li', { class: 'slide' });
      const a = el('a', { class: 'tile', href: '#' + g.id }, `
        <span class="icon" aria-hidden="true">${g.icon || '🎮'}</span>
        <strong>${g.title}</strong>
        <span class="blurb">${g.blurb || ''}</span>
        <span class="play">Play</span>`);
      li.append(a); track.append(li);
      return { li, a };
    });
    const prev = el('button', { class: 'nav prev', 'aria-label': 'Previous game' }, '‹');
    const next = el('button', { class: 'nav next', 'aria-label': 'Next game' }, '›');
    const dots = el('div', { class: 'dots' });
    const dotEls = games.map((g, i) => {
      const d = el('button', { 'aria-label': 'Go to ' + g.title });
      d.onclick = () => go(i); dots.append(d); return d;
    });
    wrap.append(track, prev, next);
    parent.append(wrap, dots);
 
    function render() {
      slides.forEach((s, i) => {
        let o = (((i - active) % n) + n) % n;       // 0..n-1
        if (o > n / 2) o -= n;                       // wrap to -n/2..n/2
        s.li.style.setProperty('--o', o);
        s.li.style.setProperty('--a', Math.abs(o));
        s.li.style.zIndex = 10 - Math.abs(o);
        const here = o === 0;
        s.li.classList.toggle('far', Math.abs(o) > 2);
        s.li.classList.toggle('current', here);
        s.a.tabIndex = here ? 0 : -1;
        s.li.setAttribute('aria-hidden', Math.abs(o) > 2 ? 'true' : 'false');
      });
      dotEls.forEach((d, i) => d.setAttribute('aria-current', i === active ? 'true' : 'false'));
    }
    const go = (i) => { active = ((i % n) + n) % n; render(); };
 
    prev.onclick = () => go(active - 1);
    next.onclick = () => go(active + 1);
    wrap.onkeydown = (e) => {
      if (e.key === 'ArrowLeft') { go(active - 1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { go(active + 1); e.preventDefault(); }
    };
 
    // clicking a side card brings it to the centre; clicking the centre card opens it
    slides.forEach((s, i) => s.a.addEventListener('click', (e) => {
      if (dragged) { e.preventDefault(); return; }
      if (i !== active) { e.preventDefault(); go(i); }
    }));
 
    // drag / swipe
    let startX = null, dragged = false;
    track.addEventListener('pointerdown', (e) => { startX = e.clientX; dragged = false; });
    addEventListener('pointerup', onUp);
    function onUp(e) {
      if (startX === null) return;
      const dx = e.clientX - startX; startX = null;
      if (Math.abs(dx) > 40) { dragged = true; go(active + (dx < 0 ? 1 : -1)); setTimeout(() => (dragged = false), 0); }
    }
 
    render();
    return () => removeEventListener('pointerup', onUp);
  }

  function home() {
    root.replaceChildren();
    root.append(el('section', { class: 'hero' }, `
      <h1>Take your pick.</h1>
      <p>Hi, I'm Siddhanth Suvarna. Pick one below and play. Each is a self-contained experiment.</p>`));
    cleanup = carousel(root);
  }

  function play(game) {
    root.replaceChildren();
    root.append(el('a', { class: 'home-link', href: '#' }, '← All games'));
    root.append(el('h2', {}, game.title));
    const stage = el('section', { class: 'stage', 'aria-label': game.title });
    root.append(stage);
    cleanup = game.mount(stage) || null;
  }

  function route() {
    if (typeof cleanup === 'function') cleanup();
    cleanup = null;
    const game = games.find((g) => g.id === location.hash.slice(1));
    game ? play(game) : home();
    document.title = (game ? game.title + ' · ' : '') + 'Siddhanth Suvarna';
    window.scrollTo(0, 0);
  }

  return {
    register,
    start(el) { root = el; addEventListener('hashchange', route); route(); },
  };
})();
