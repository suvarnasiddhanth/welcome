Arcade.register({
  id: 'dice-roll',
  title: 'Dice Roll',
  blurb: 'Roll one to six dice and see the total.',
  icon: '🎲',
  mount(c) {
    // which of the 9 grid cells hold a pip for each face
    const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
    let count = 2;
    c.innerHTML = `
      <div class="dice" id="dice"></div>
      <p class="result" aria-live="polite">Ready when you are.</p>
      <div class="row">
        <label>Dice
          <select id="n">${[1, 2, 3, 4, 5, 6].map((n) => `<option ${n === count ? 'selected' : ''}>${n}</option>`).join('')}</select>
        </label>
        <button class="btn" id="roll">Roll</button>
      </div>`;
    const box = c.querySelector('#dice'), out = c.querySelector('.result');
    const face = (v) => `<div class="die" role="img" aria-label="${v}">${
      Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[v].includes(i) ? 'on' : ''}"></i>`).join('')}</div>`;

    c.querySelector('#n').onchange = (e) => { count = +e.target.value; };
    c.querySelector('#roll').onclick = () => {
      const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 6));
      box.innerHTML = rolls.map(face).join('');
      box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
      out.textContent = count > 1 ? `Total: ${rolls.reduce((a, b) => a + b)}` : `You rolled a ${rolls[0]}`;
    };
  },
});
