Arcade.register({
  id: 'coin-flip',
  title: 'Coin Flip',
  blurb: 'Heads or tails. Keep a running tally.',
  icon: '🪙',
  mount(c) {
    const EDGE = 14, HALF = 0.047;           // coin thickness: 14 stacked discs, ±4.7% of the coin's diameter
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let heads = 0, tails = 0, angle = 0, busy = false, size = 150, ricochets = 0, pendingFit = false;
    const history = [];
    let anims = [];                           // animations of the flight in progress
    let flight = null;                        // our own description of that flight (see stateAt)
    let escaped = false;                      // the coin has left the atmosphere and needs a reset
    const KEY_REPEAT_MS = 400;                // holding Enter/Space ricochets at most once per this many ms
    const ESC_DONE_TEXT = "I can't see the coin anymore.";   // shown once the coin reaches ORBIT_M
    let lastKeyHit = 0;
    const M_PER_COIN = 0.8;                   // metres per coin-diameter, regardless of window size
    const BOOST = 1.08;                       // each ricochet's kick is 8% stronger than the one before
    const ESCAPE_M = 10000000;                // above 10,000 km the coin never comes back
    const ORBIT_M = 400000000, ESC_MS = 60000; // it keeps climbing to 400,000 km (about the Moon's distance) over 60 s
    const ESC_EASE = (x) => x * x;            // accelerating away

    // Long flights are time-compressed (square-root curve for short hops, logarithmic beyond ~2000px),
    // so even a 10 km climb takes seconds, not minutes.
    const X0 = 2000, LOG_K = 8;
    const airTime = (x, k) => k * (x <= X0 ? Math.sqrt(x) : Math.sqrt(X0) + LOG_K * Math.log(x / X0));
    const fmtHeight = (m) => (m < 1000 ? m.toFixed(1) + ' m' : m < 10000000 ? (m / 1000).toFixed(2) + ' km' : (m / 1000).toFixed(1) + ' km · space');

    // The same cubic-bezier curves CSS uses, so JS can predict exactly where the coin is at any moment
    // without ever touching the DOM (no layout reads, no per-frame style recalculation).
    function bezier(x1, y1, x2, y2) {
      const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
      const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
      const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t;
      return (x) => {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        let lo = 0, hi = 1, t = x;
        for (let i = 0; i < 24; i++) {
          const v = X(t);
          if (Math.abs(v - x) < 1e-5) break;
          v < x ? (lo = t) : (hi = t);
          t = (lo + hi) / 2;
        }
        return Y(t);
      };
    }
    const RISE_CSS = 'cubic-bezier(.2,.75,.4,1)', FALL_CSS = 'cubic-bezier(.6,0,.9,.55)', SPIN_CSS = 'cubic-bezier(.25,.55,.35,1)';
    const RISE = bezier(.2, .75, .4, 1), FALL = bezier(.6, 0, .9, .55), SPIN = bezier(.25, .55, .35, 1);
    const EASE = [RISE, FALL, RISE, FALL];

    // Where is the coin `ms` milliseconds into flight `f`? (height above rest, tilt, spin)
    function stateAt(f, ms) {
      const p = Math.min(1, Math.max(0, ms / f.total));
      let i = 0;
      while (i < 3 && p >= f.os[i + 1]) i++;
      const e = EASE[i]((p - f.os[i]) / (f.os[i + 1] - f.os[i]));
      const lerp = (arr) => arr[i] + (arr[i + 1] - arr[i]) * e;
      const h = lerp(f.hs);
      return { h, y: -h, z: lerp(f.zs), a: f.a0 + (f.next - f.a0) * SPIN(p) };
    }
    // Time into the current flight: read from the animation itself, falling back to the wall clock.
    const curMs = () => { const t = anims[0] && anims[0].currentTime; return t == null ? performance.now() - flight.t0 : Number(t); };

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
        <span class="up">↑</span><span>Height</span><b id="altNum">0.0 m</b>
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

    let flightTimers = [];
    const later = (fn, ms) => { flightTimers.push(setTimeout(fn, ms)); };
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

    const MAX_SPARKS = 150, MAX_RINGS = 15;      // hard budget of live animated elements
    let liveSparks = 0, liveRings = 0;

    function ring(group, L, delay, color) {
      if (liveRings >= MAX_RINGS) return;
      liveRings++;
      const r = document.createElement('i'), d = size * (1.1 + L * 0.25);
      r.className = 'ring';
      r.style.cssText = `width:${d}px;height:${d}px;left:${-d / 2}px;top:${-d / 2}px;border-color:${color}`;
      group.append(r);
      r.animate([{ transform: 'scale(.1)', opacity: 0.9 }, { transform: 'scale(1)', opacity: 0 }],
        { duration: 650, delay, easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'backwards' }).onfinish = () => { liveRings--; r.remove(); };
    }

    function sparkle(lift = 0, level = 0) {     // lift: height above the resting spot; level: combo size
      const L = Math.min(level, 8);
      // every burst lives in its own group, so a later burst can't drag earlier sparks along with it
      const group = document.createElement('div');
      group.className = 'burst-group';
      group.style.transform = `translateY(${-lift}px)`;
      burst.append(group);

      const n = Math.max(0, Math.min(90, 14 + L * 9, MAX_SPARKS - liveSparks));
      const reach = 1 + L * 0.2;
      const colors = PALETTE.slice(0, Math.min(PALETTE.length, 2 + Math.floor(L * 0.8)));
      const glow = n <= 40;                      // glow (box-shadow) is the costly part, so only on smaller bursts
      if (L >= 2) ring(group, L, 0, colors[colors.length - 1]);
      if (L >= 5) ring(group, L, 120, '#ffffff');
      if (L >= 7) ring(group, L, 240, colors[2]);

      const frag = document.createDocumentFragment();
      let left = n;
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
        p.style.cssText = `width:${w}px;height:${h}px;left:${-w / 2}px;top:${-h / 2}px;background:${color}` + (glow ? `;box-shadow:0 0 ${4 + L * 2}px ${color}` : '');
        frag.append(p);
        liveSparks++;
        p.animate([
          { transform: `translate(0,0) rotate(${rot}deg) scale(1)`, opacity: 1 },
          { transform: `translate(${dx * 0.7}px,${dy * 0.7}px) rotate(${rot + spin / 2}deg) scale(1)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${dx}px,${dy + drop}px) rotate(${rot + spin}deg) scale(0)`, opacity: 0 },
        ], { duration: 700 + Math.random() * 300 + L * 80, easing: 'cubic-bezier(.1,.7,.3,1)' }).onfinish = () => {
          liveSparks--; p.remove();
          if (--left === 0) setTimeout(() => group.remove(), 800);   // rings finish within ~900ms
        };
      }
      group.append(frag);
      if (n === 0) setTimeout(() => group.remove(), 1000);

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
      out.setAttribute('aria-live', b ? 'off' : 'polite');   // don't announce every ricochet
      updateClickable();
    }
    // the coin is clickable when idle, or in the air with Ricochet on
    function updateClickable() {
      const ok = !busy || rico.checked;
      toss.classList.toggle('ready', ok);
      toss.setAttribute('aria-disabled', String(!ok));
      if (!escaped) hint.textContent = rico.checked ? 'Click the coin midair to knock it higher.' : 'Turn on Ricochet to click the coin midair.';
    }

    // Where the coin's bottom edge sits in the window when resting; measured once per flip while idle.
    let restBottom = 0, scroll0 = 0;
    const measureRest = () => { restBottom = toss.getBoundingClientRect().bottom; scroll0 = window.scrollY; };
    // Pure arithmetic: is a coin `h` px above its rest spot above the top of the window?
    const isOffscreen = (h) => h > restBottom - (window.scrollY - scroll0) - 36;

    // Height meter: pure calculation, no DOM reads. 0.8 m per coin-diameter, so a plain first flip
    // peaks around 1 m regardless of window size.
    const alt = $('#alt'), altNum = $('#altNum');
    let altRaf = 0, lastTxt = '', altShown = false;
    function trackHeight() {
      if (!flight) { alt.classList.remove('show'); altShown = false; altRaf = 0; return; }
      let m, off = true, done = false;
      if (flight.escape) {                                    // escape: a pure number climbing toward orbit
        const t = Math.min(1, (performance.now() - flight.t0) / ESC_MS);
        m = flight.m0 + (ORBIT_M - flight.m0) * ESC_EASE(t);
        done = t >= 1;
        if (done) out.textContent = ESC_DONE_TEXT;            // runs once: the loop stops after this frame
      } else {
        const h = stateAt(flight, curMs()).h;
        m = (h / size) * M_PER_COIN; off = isOffscreen(h);
      }
      if (off !== altShown) { altShown = off; alt.classList.toggle('show', off); }
      if (off) { const txt = fmtHeight(m); if (txt !== lastTxt) { altNum.textContent = txt; lastTxt = txt; } }
      altRaf = done ? 0 : requestAnimationFrame(trackHeight);
    }

    // Launch the coin from `from` (a stateAt() result) up to a new apex, then drop it to the ground.
    function launch(from, count) {
      const isHeads = Math.random() < 0.5;                     // only the last launch decides the result
      const target = isHeads ? 0 : 180;

      // how high: each ricochet goes higher than where it was hit (no cap; the height meter covers off-screen)
      const h0 = Math.max(0, -from.y);
      const apex = h0 + size * 1.27 * Math.pow(BOOST, count);   // each ricochet's kick is 18% bigger than the last
      if ((apex / size) * M_PER_COIN >= ESCAPE_M) { leaveAtmosphere(from); return; }   // past 10 km: gone for good

      // flight time follows a falling-body curve, so higher throws take longer
      const u = 150 / size;
      const riseT = airTime((apex - h0) * u, 60), fallT = airTime(apex * u, 52);
      const landT = riseT + fallT, total = landT * 1.163;
      const o1 = riseT / total, o2 = landT / total, o3 = (landT + (total - landT) * 0.5) / total;

      const spins = Math.min(60, Math.max(3, Math.round((total / 1800) * (5 + Math.random() * 2.5))));
      const delta = (((target - from.a) % 360) + 360) % 360;
      const next = Math.round((from.a + spins * 360 + delta) / 180) * 180;

      const sc = (h) => Math.max(0.25, 1 - h / (size * 2.3));  // shadow shrinks with height
      const sh = (h) => ({ transform: `translateX(-50%) scale(${sc(h).toFixed(3)})`, opacity: +(0.4 * Math.pow(sc(h), 1.6)).toFixed(3) });

      // heights, tilts and time offsets at the five keyframes: start, apex, landing, bounce, rest
      const hs = [h0, apex, 0, size * 0.15, 0], zs = [from.z, 9, -3, 1, 0], os = [0, o1, o2, o3, 1];
      const ease = (i) => (i % 2 ? FALL_CSS : RISE_CSS);
      flight = { hs, zs, os, a0: from.a, next, total, t0: performance.now() };

      anims = [
        coin.animate([{ transform: `rotateX(${from.a}deg)` }, { transform: `rotateX(${next}deg)` }],
          { duration: total, easing: SPIN_CSS }),
        toss.animate(os.map((o, i) => ({
          transform: `translateY(${-hs[i]}px) rotate(${zs[i]}deg)`, offset: o, ...(i < 4 && { easing: ease(i) }),
        })), { duration: total }),
        shadow.animate(os.map((o, i) => ({ ...sh(hs[i]), offset: o, ...(i < 4 && { easing: ease(i) }) })), { duration: total }),
      ];
      angle = next;
      coin.style.transform = `rotateX(${angle}deg)`;
      if (!altRaf) altRaf = requestAnimationFrame(trackHeight);

      later(() => sparkle(0, ricochets), landT);
      later(() => {
        anims = []; flight = null; ricochets = 0; setBusy(false); settle(isHeads);
        if (pendingFit) { pendingFit = false; fit(); }
      }, total);
    }

    // Past 10 km the coin is thousands of screens above the window, so there is nothing to animate:
    // hide it, let the meter run on its own, and offer a Reset.
    function leaveAtmosphere(from) {
      escaped = true;
      clearFlight();
      toss.style.visibility = shadow.style.visibility = 'hidden';
      flight = { escape: true, m0: (from.h / size) * M_PER_COIN, t0: performance.now() };
      out.setAttribute('aria-live', 'polite');
      out.textContent = 'Left the atmosphere!';
      hint.textContent = 'It is never coming back. Press Reset for a new coin.';
      btn.textContent = 'Reset'; btn.disabled = true;
      later(() => { btn.disabled = false; }, 1500);          // brief delay so a held key can't reset it instantly
      if (!altRaf) altRaf = requestAnimationFrame(trackHeight);
    }

    function reset() {
      escaped = false; flight = null; ricochets = 0; angle = 0;
      clearFlight(); cancelAnimationFrame(altRaf); altRaf = 0;
      alt.classList.remove('show'); altShown = false;
      toss.style.visibility = shadow.style.visibility = '';
      coin.style.transform = 'rotateX(0deg)';
      btn.textContent = 'Flip'; out.textContent = 'Ready when you are.';
      setBusy(false);
      if (pendingFit) { pendingFit = false; fit(); }
    }

    function flip() {
      if (escaped) { if (!btn.disabled) reset(); return; }
      if (busy) { if (rico.checked) ricochet(); return; }   // midair clicks only count with Ricochet on
      measureRest();
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
      if (!flight || flight.escape) return;
      const from = stateAt(flight, curMs());                 // pure maths, no DOM reads
      clearFlight();
      ricochets++;
      if (!isOffscreen(from.h)) sparkle(from.h, ricochets);  // nobody can see sparks above the window
      out.textContent = `Ricochet ×${ricochets}!`;
      launch(from, ricochets);
    }

    btn.onclick = flip;
    toss.onclick = flip;
    toss.onkeydown = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      const now = performance.now();
      if (e.repeat && now - lastKeyHit < KEY_REPEAT_MS) return;   // held key: one hit per KEY_REPEAT_MS
      lastKeyHit = now;
      flip();
    };
    rico.onchange = updateClickable;
    setBusy(false);

    // Customize panel (top-right of the stage): backgrounds now, coin looks later
    const cz = Arcade.customize && Arcade.customize(c);
    if (cz) Arcade.backgrounds.attach(c, cz);

    return () => { if (cz) cz.destroy(); flightTimers.forEach(clearTimeout); removeEventListener('resize', onResize); ro.disconnect(); cancelAnimationFrame(raf); cancelAnimationFrame(altRaf); };
  },
});
