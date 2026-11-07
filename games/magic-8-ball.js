Arcade.register({
  id: 'magic-8-ball',
  title: 'Magic 8-Ball',
  blurb: 'Ask a yes-or-no question. Get an answer.',
  icon: '🎱',
  mount(c) {
    const ANSWERS = [
      'It is certain', 'Without a doubt', 'Yes, definitely', 'You may rely on it', 'Most likely', 'Signs point to yes',
      'Reply hazy, try again', 'Ask again later', 'Cannot predict now', 'Concentrate and ask again',
      "Don't count on it", 'My reply is no', 'Very doubtful', 'Outlook not so good', 'My sources say no',
    ];
    c.innerHTML = `
      <div class="ball" id="ball"><div class="eight"><span id="ans">8</span></div></div>
      <label class="q">Your question <input id="q" type="text" placeholder="Will it work?" maxlength="80"></label>
      <button class="btn" id="shake">Shake</button>
      <p class="sr" aria-live="polite" id="sr"></p>`;
    const ball = c.querySelector('#ball'), ans = c.querySelector('#ans');
    c.querySelector('#shake').onclick = () => {
      const a = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
      ball.classList.remove('shaking'); void ball.offsetWidth; ball.classList.add('shaking');
      ans.textContent = '…';
      setTimeout(() => {
        ans.textContent = a; ans.classList.toggle('long', a.length > 14);
        c.querySelector('#sr').textContent = a;
      }, 600);
    };
  },
});
