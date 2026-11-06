/* Arcade: tiny game registry + hash router.
   A game is an object: { id, title, blurb, icon, mount(container) -> optional cleanup fn } */
window.Arcade = (() => {
  const games = [];
  let root, cleanup = null;

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

  function home() {
    root.replaceChildren();
    root.append(el('section', { class: 'hero' }, `
      <h1>I make small games.</h1>
      <p>Hi, I'm Siddhanth Suvarna. Pick one below and play. Each is a self-contained experiment.</p>`));
    const grid = el('ul', { class: 'grid' });
    games.forEach((g) => {
      const li = el('li');
      li.append(el('a', { class: 'tile', href: '#' + g.id }, `
        <span class="icon" aria-hidden="true">${g.icon || '🎮'}</span>
        <strong>${g.title}</strong>
        <span>${g.blurb || ''}</span>`));
      grid.append(li);
    });
    root.append(grid);
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
