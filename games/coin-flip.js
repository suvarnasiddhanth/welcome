Arcade.register({
  id: 'coin-flip',
  title: 'Coin Flip',
  blurb: 'Heads or tails. Keep a running tally.',
  icon: '🪙',
  mount(c) {
    const EDGE = 14, HALF = 7;               // coin thickness: 14 stacked discs, ±7px
    const DUR = 1800;                        // total animation time in ms
    const LAND = 0.86;                       // fraction of DUR at which the coin first touches down
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let heads = 0, tails = 0, angle = 0, busy = false;
    const history = [];

    const edges = Array.from({ length: EDGE }, (_, i) =>
      `<i class="edge" style="transform:translateZ(${(-HALF + (2 * HALF * i) / (EDGE - 1)).toFixed(2)}px)"></i>`).join('');

    c.innerHTML = `
      <div class="coin-wrap">
        <div class="shadow" id="shadow"></div>
        <div class="toss" id="toss">
          <div class="coin" id="coin">
            ${edges}
            <div class="face front"><div class="rim"><span>H</span></div><i class="shine"></i></div>
            <div class="face back"><div class="rim"><span>T</span></div><i class="shine"></i></div>
          </div>
        </div>
        <div class="burst" id="burst"></div>
      </div>
      <p class="result" aria-live="polite">Ready when you are.</p>
      <button class="btn" id="flip">Flip</button>
      <p class="tally">Heads <b id="h">0</b> · Tails <b id="t">0</b></p>
      <div class="history" id="hist" aria-label="Recent flips"></div>`;

    const $ = (s) => c.querySelector(s);
    const toss = $('#toss'), coin = $('#coin'), shadow = $('#shadow'), burst = $('#burst');
    const out = $('.result'), btn = $('#flip');
    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));

    function sparkle() {
      for (let i = 0; i < 14; i++) {
        const p = document.createElement('i');
        p.className = 'spark';
        burst.append(p);
        const a = (Math.PI * 2 * i) / 14 + Math.random() * 0.4, r = 70 + Math.random() * 50;
        p.animate([
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: `translate(${Math.cos(a) * r}px,${Math.sin(a) * r * 0.7}px) scale(0)`, opacity: 0 },
        ], { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.1,.7,.3,1)' }).onfinish = () => p.remove();
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

    btn.onclick = () => {
      if (busy) return;
      busy = true; btn.disabled = true;
      out.textContent = '…';
      const isHeads = Math.random() < 0.5;

      // keep angle a multiple of 180: even = heads up, odd = tails up
      const showingHeads = (angle / 180) % 2 === 0;
      const spins = 5 + Math.floor(Math.random() * 3);
      const next = angle + spins * 360 + (showingHeads === isHeads ? 0 : 180);

      if (still) { angle = next; coin.style.transform = `rotateX(${angle}deg)`; settle(isHeads); busy = false; btn.disabled = false; return; }

      // the coin spins end-over-end
      coin.animate([{ transform: `rotateX(${angle}deg)` }, { transform: `rotateX(${next}deg)` }],
        { duration: DUR, easing: 'cubic-bezier(.25,.55,.35,1)' });
      angle = next;
      coin.style.transform = `rotateX(${angle}deg)`;

      // the toss: up, down, one small bounce
      toss.animate([
        { transform: 'translateY(0) rotate(0deg)', offset: 0, easing: 'cubic-bezier(.2,.75,.4,1)' },
        { transform: 'translateY(-190px) rotate(9deg)', offset: 0.46, easing: 'cubic-bezier(.6,0,.9,.55)' },
        { transform: 'translateY(0) rotate(-3deg)', offset: LAND, easing: 'cubic-bezier(.2,.75,.4,1)' },
        { transform: 'translateY(-22px) rotate(1deg)', offset: 0.93, easing: 'cubic-bezier(.6,0,.9,.55)' },
        { transform: 'translateY(0) rotate(0deg)', offset: 1 },
      ], { duration: DUR });

      // the shadow shrinks as the coin climbs and sharpens as it lands
      shadow.animate([
        { transform: 'translateX(-50%) scale(1)', opacity: 0.4, offset: 0 },
        { transform: 'translateX(-50%) scale(.45)', opacity: 0.12, offset: 0.46 },
        { transform: 'translateX(-50%) scale(1)', opacity: 0.4, offset: LAND },
        { transform: 'translateX(-50%) scale(.85)', opacity: 0.3, offset: 0.93 },
        { transform: 'translateX(-50%) scale(1)', opacity: 0.4, offset: 1 },
      ], { duration: DUR });

      later(sparkle, DUR * LAND);
      later(() => { settle(isHeads); busy = false; btn.disabled = false; }, DUR);
    };

    return () => timers.forEach(clearTimeout);
  },
});
