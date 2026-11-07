Arcade.register({
  id: 'coin-flip',
  title: 'Coin Flip',
  blurb: 'Heads or tails. Keep a running tally.',
  icon: '🪙',
  mount(c) {
    const EDGE = 14, HALF = 0.047;           // coin thickness: 14 stacked discs, ±4.7% of the coin's diameter
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let heads = 0, tails = 0, angle = 0, busy = false, size = 150, ricochets = 0, pendingFit = false;
    const history = [], timers = [];
    let anims = [];                           // animations of the flight in progress

    const edges = Array.from({ length: EDGE }, (_, i) =>
      `<i class="edge" style="--k:${(-HALF + (2 * HALF * i) / (EDGE - 1)).toFixed(4)}"></i>`).join('');

    c.innerHTML = `
      <div class="coin-wrap">
        <div class="shadow" id="shadow"></div>
        <div class="toss" id="toss" role="button" tabindex="0" aria-label="Flip the coin">
          <div class="coin" id="coin">
            ${edges}
            <div class="face front"><div class="rim"><span>H</span></div><i class="shine"></i></div>
            <div class="face back"><div class="rim"><span>T</span></div><i class="shine"></i></div>
          </div>
        </div>
        <div class="burst" id="burst"></div>
      </div>
      <div class="altitude" id="alt" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M1 20 9 6l4.5 7L16 9l7 11z"/></svg>
        <span class="up">↑</span><span>Height</span><b><span id="altNum">0.0</span> m</b>
      </div>
      <p class="result" aria-live="polite">Ready when you are.</p>
      <div class="row">
        <button class="btn" id="flip">Flip</button>
        <label class="switch"><input type="checkbox" id="rico" role="switch"><span class="knob" aria-hidden="true"></span>Ricochet</label>
      </div>
      <p class="hint" id="hint">Turn on Ricochet to click the coin midair.</p>
      <p class="tally">Heads <b id="h">0</b> · Tails <b id="t">0</b></p>
      <div class="history" id="hist" aria-label="Recent flips"></div>`;

    const $ = (s) => c.querySelector(s);
    const toss = $('#toss'), coin = $('#coin'), shadow = $('#shadow'), burst = $('#burst');
    const out = $('.result'), btn = $('#flip'), rico = $('#rico'), hint = $('#hint');
    c.classList.add('coin-stage');

    const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
    let flightTimers = [];
    const clearFlight = () => { flightTimers.forEach(clearTimeout); flightTimers = []; anims.forEach((a) => a.cancel()); anims = []; };

    // Size the coin so the whole page (coin, button, footer) fits in the window.
    function fit() {
      if (busy) { pendingFit = true; return; }
      const wrap = $('.coin-wrap'), footer = document.querySelector('footer'), main = c.closest('main');
      const top = c.getBoundingClientRect().top + window.scrollY;
      const below = footer.offsetHeight + parseFloat(getComputedStyle(main).paddingBottom);
      const need = top + c.offsetHeight + below;
      const target = wrap.offsetHeight + (document.documentElement.clientHeight - need);
      size = Math.max(70, Math.min(180, Math.floor(target / 2.47)));
      c.style.setProperty('--coin', size + 'px');
    }
    const onResize = () => fit();
    addEventListener('resize', onResize);
    fit();
    if (document.fonts) document.fonts.ready.then(fit);
    // Refit whenever anything around the coin changes size (web font loading in, text wrapping, etc.).
    // The coin area itself isn't observed, so this can't loop.
    let raf = 0;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); });
    [document.querySelector('.top'), document.querySelector('footer'), c.previousElementSibling,
      ...[...c.children].filter((n) => !n.classList.contains('coin-wrap') && !n.classList.contains('altitude'))].forEach((n) => n && ro.observe(n));

    // Sparks escalate with the ricochet combo (level): more of them, farther, brighter, more colours,
    // then streaks, falling arcs and expanding shockwave rings.
    const PALETTE = ['#ffcf3f', '#ffe58a', '#ff9f1c', '#ff4d6d', '#ffffff', '#5ad1ff', '#b388ff'];

    function ring(L, delay, color) {
      const r = document.createElement('i'), d = size * (1.1 + L * 0.25);
      r.className = 'ring';
      r.style.cssText = `width:${d}px;height:${d}px;left:${-d / 2}px;top:${-d / 2}px;border-color:${color};box-shadow:0 0 ${6 + L * 2}px ${color}`;
      burst.append(r);
      r.animate([{ transform: 'scale(.1)', opacity: 0.9 }, { transform: 'scale(1)', opacity: 0 }],
        { duration: 650, delay, easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'backwards' }).onfinish = () => r.remove();
    }

    function sparkle(lift = 0, level = 0) {     // lift: height above the resting spot; level: combo size
      const L = Math.min(level, 8);
      burst.style.transform = `translateY(${-lift}px)`;
      const n = Math.min(90, 14 + L * 9);
      const reach = 1 + L * 0.2;
      const colors = PALETTE.slice(0, Math.min(PALETTE.length, 2 + Math.floor(L * 0.8)));
      if (L >= 2) ring(L, 0, colors[colors.length - 1]);
      if (L >= 5) ring(L, 120, '#ffffff');
      if (L >= 7) ring(L, 240, colors[2]);

      for (let i = 0; i < n; i++) {
        const p = document.createElement('i'), color = colors[Math.floor(Math.random() * colors.length)];
        const streak = L >= 4 && Math.random() < 0.4;
        const w = streak ? 3 : 6 + Math.random() * (2 + L * 1.2), h = streak ? 10 + L * 2 : w;
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
        const r = size * (0.47 + Math.random() * 0.33) * reach;
        const dx = Math.cos(a) * r, dy = Math.sin(a) * r * 0.7;
        const drop = L >= 3 ? size * (0.3 + Math.random() * 0.5) : 0;      // gravity pulls big bursts down
        const rot = streak ? (a * 180) / Math.PI - 90 : 45;
        const spin = streak ? 0 : (Math.random() - 0.5) * (360 + L * 180);
        p.className = 'spark';
        p.style.cssText = `width:${w}px;height:${h}px;left:${-w / 2}px;top:${-h / 2}px;background:${color};box-shadow:0 0 ${4 + L * 2}px ${color}`;
        burst.append(p);
        p.animate([
          { transform: `translate(0,0) rotate(${rot}deg) scale(1)`, opacity: 1 },
          { transform: `translate(${dx * 0.7}px,${dy * 0.7}px) rotate(${rot + spin / 2}deg) scale(1)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${dx}px,${dy + drop}px) rotate(${rot + spin}deg) scale(0)`, opacity: 0 },
        ], { duration: 700 + Math.random() * 300 + L * 80, easing: 'cubic-bezier(.1,.7,.3,1)' }).onfinish = () => p.remove();
      }
      c.querySelectorAll('.shine').forEach((s) => s.animate([
        { transform: 'translateX(-110%)', opacity: 1 }, { transform: 'translateX(110%)', opacity: 1 },
      ], { duration: 650, easing: 'ease-out' }));
    }

    function renderHistory() {
      $('#hist').innerHTML = history.slice(-10).map((r) => `<b class="pip ${r}" title="${r}">${r.toUpperCase()}</b>`).join('');
    }

    function settle(isHeads) {
      isHeads ? heads++ : tails++;
      history.push(isHeads ? 'h' : 't');
      out.textContent = isHeads ? 'Heads!' : 'Tails!';
      $('#h').textContent = heads; $('#t').textContent = tails;
      renderHistory();
    }

    function setBusy(b) {
      busy = b; btn.disabled = b;
      updateClickable();
    }
    // the coin is clickable when idle, or in the air with Ricochet on
    function updateClickable() {
      const ok = !busy || rico.checked;
      toss.classList.toggle('ready', ok);
      toss.setAttribute('aria-disabled', String(!ok));
      hint.textContent = rico.checked ? 'Click the coin midair to knock it higher.' : 'Turn on Ricochet to click the coin midair.';
    }

    // Height meter: while the coin is in the air and above the top of the window, show how high it is.
    // 0.8 m per coin-diameter, so a plain first flip peaks around 1 m regardless of window size.
    const alt = $('#alt'), altNum = $('#altNum');
    let altRaf = 0, lastTxt = '';
    function trackHeight() {
      if (!busy) { alt.classList.remove('show'); altRaf = 0; return; }
      const h = Math.max(0, -new DOMMatrix(getComputedStyle(toss).transform).m42);
      const offscreen = toss.getBoundingClientRect().bottom < 36;
      alt.classList.toggle('show', offscreen);
      if (offscreen) {
        const txt = ((h / size) * 0.8).toFixed(1);
        if (txt !== lastTxt) { altNum.textContent = txt; lastTxt = txt; }
      }
      altRaf = requestAnimationFrame(trackHeight);
    }

    // Read where the coin is right now (position, tilt and spin) from its live transforms.
    function readState() {
      const t = new DOMMatrix(getComputedStyle(toss).transform);
      const k = new DOMMatrix(getComputedStyle(coin).transform);
      return {
        y: t.m42,                                              // negative = above its resting spot
        z: (Math.atan2(t.b, t.a) * 180) / Math.PI,
        a: (Math.atan2(k.m23, k.m22) * 180) / Math.PI,         // spin around the horizontal axis
      };
    }

    // Launch the coin from `from` (a readState() result) up to a new apex, then drop it to the ground.
    function launch(from, count) {
      const isHeads = Math.random() < 0.5;                     // only the last launch decides the result
      const target = isHeads ? 0 : 180;

      // how high: each ricochet goes higher than where it was hit (no cap; the height meter covers off-screen)
      const h0 = Math.max(0, -from.y);
      const apex = h0 + size * (1.27 + 0.2 * count);

      // flight time follows a falling-body curve, so higher throws take longer
      const u = 150 / size;
      const riseT = 60 * Math.sqrt((apex - h0) * u), fallT = 52 * Math.sqrt(apex * u);
      const landT = riseT + fallT, total = landT * 1.163;
      const o1 = riseT / total, o2 = landT / total, o3 = (landT + (total - landT) * 0.5) / total;

      const spins = Math.max(3, Math.round((total / 1800) * (5 + Math.random() * 2.5)));
      const delta = (((target - from.a) % 360) + 360) % 360;
      const next = Math.round((from.a + spins * 360 + delta) / 180) * 180;

      const rise = 'cubic-bezier(.2,.75,.4,1)', fall = 'cubic-bezier(.6,0,.9,.55)';
      const sc = (h) => Math.max(0.25, 1 - h / (size * 2.3));  // shadow shrinks with height
      const sh = (h) => ({ transform: `translateX(-50%) scale(${sc(h).toFixed(3)})`, opacity: +(0.4 * Math.pow(sc(h), 1.6)).toFixed(3) });

      anims = [
        coin.animate([{ transform: `rotateX(${from.a}deg)` }, { transform: `rotateX(${next}deg)` }],
          { duration: total, easing: 'cubic-bezier(.25,.55,.35,1)' }),
        toss.animate([
          { transform: `translateY(${-h0}px) rotate(${from.z}deg)`, offset: 0, easing: rise },
          { transform: `translateY(${-apex}px) rotate(9deg)`, offset: o1, easing: fall },
          { transform: 'translateY(0) rotate(-3deg)', offset: o2, easing: rise },
          { transform: `translateY(${-size * 0.15}px) rotate(1deg)`, offset: o3, easing: fall },
          { transform: 'translateY(0) rotate(0deg)', offset: 1 },
        ], { duration: total }),
        shadow.animate([
          { ...sh(h0), offset: 0, easing: rise }, { ...sh(apex), offset: o1, easing: fall },
          { ...sh(0), offset: o2 }, { ...sh(size * 0.15), offset: o3 }, { ...sh(0), offset: 1 },
        ], { duration: total }),
      ];
      angle = next;
      coin.style.transform = `rotateX(${angle}deg)`;
      if (!altRaf) altRaf = requestAnimationFrame(trackHeight);

      flightTimers.push(later(() => sparkle(0, ricochets), landT));
      flightTimers.push(later(() => {
        settle(isHeads); anims = []; ricochets = 0; setBusy(false);
        if (pendingFit) { pendingFit = false; fit(); }
      }, total));
    }

    function flip() {
      if (busy) { if (rico.checked) ricochet(); return; }   // midair clicks only count with Ricochet on
      setBusy(true); ricochets = 0;
      out.textContent = '…';
      if (still) {                                          // reduced motion: skip the flight
        const isHeads = Math.random() < 0.5;
        angle = Math.round(angle / 180) * 180;
        if ((Math.abs(angle / 180) % 2 === 0) !== isHeads) angle += 180;
        coin.style.transform = `rotateX(${angle}deg)`;
        settle(isHeads); setBusy(false); return;
      }
      launch({ y: 0, z: 0, a: angle }, 0);
    }

    function ricochet() {
      const from = readState();                              // read BEFORE cancelling the animations
      clearFlight();
      ricochets++;
      sparkle(Math.max(0, -from.y), ricochets);
      out.textContent = `Ricochet ×${ricochets}!`;
      launch(from, ricochets);
    }

    btn.onclick = flip;
    toss.onclick = flip;
    toss.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } };
    rico.onchange = updateClickable;
    setBusy(false);

    return () => { timers.forEach(clearTimeout); removeEventListener('resize', onResize); ro.disconnect(); cancelAnimationFrame(raf); cancelAnimationFrame(altRaf); };
  },
});
