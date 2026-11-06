Arcade.register({
  id: 'coin-flip',
  title: 'Coin Flip',
  blurb: 'Heads or tails. Keep a running tally.',
  icon: '🪙',
  mount(c) {
    let heads = 0, tails = 0, turns = 0, busy = false;
    c.innerHTML = `
      <div class="coin-wrap"><div class="coin" id="coin">
        <div class="face front">H</div><div class="face back">T</div>
      </div></div>
      <p class="result" aria-live="polite">Ready when you are.</p>
      <button class="btn" id="flip">Flip</button>
      <p class="tally">Heads <b id="h">0</b> · Tails <b id="t">0</b></p>`;
    const coin = c.querySelector('#coin'), out = c.querySelector('.result'), btn = c.querySelector('#flip');
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

    btn.onclick = () => {
      if (busy) return;
      busy = true; btn.disabled = true;
      const isHeads = Math.random() < 0.5;
      turns += 1;
      // spin at least 5 full turns, land on the right face
      const deg = turns * 1800 + (isHeads ? 0 : 180);
      coin.style.transition = still ? 'none' : 'transform 1.2s cubic-bezier(.2,.7,.2,1)';
      coin.style.transform = `rotateY(${deg}deg)`;
      setTimeout(() => {
        isHeads ? heads++ : tails++;
        out.textContent = isHeads ? 'Heads!' : 'Tails!';
        c.querySelector('#h').textContent = heads;
        c.querySelector('#t').textContent = tails;
        busy = false; btn.disabled = false;
      }, still ? 0 : 1250);
    };
  },
});
