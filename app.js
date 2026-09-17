/* ═══════════════════════════════════════════════════════════════════════════
   Happy Birthday, Ushna — behaviour
   Flow: gate → letter → descent → post → reveal
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  /* ── 0 · Small helpers ──────────────────────────────────────────────────── */

  const $  = (sel, root = document) => root.querySelector(sel);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const rand  = (lo, hi) => lo + Math.random() * (hi - lo);

  /* Some older WebKit builds return undefined from play(); normalise to a
     promise so the autoplay fallback chip always behaves. */
  const safePlay = (el) => {
    try {
      const p = el.play();
      return p && typeof p.then === 'function' ? p : Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const say = (msg) => { const el = $('#live'); if (el) el.textContent = msg; };

  /* iOS Safari can throw if currentTime is written before any metadata has
     loaded, so rewinding is always best-effort. */
  const rewind = (el) => {
    try { el.currentTime = 0; } catch (err) { /* not ready yet — harmless */ }
  };

  /* The reveal is scored from 10s into final.mp3, where the track actually
     starts. Seeking before metadata is ready is unreliable (and throws on old
     WebKit), so this waits for loadedmetadata when it has to. */
  const FINAL_START = 10;

  const seek = (el, t) => {
    const apply = () => { try { el.currentTime = t; } catch (err) { /* harmless */ } };
    if (el.readyState >= 1) apply();
    else el.addEventListener('loadedmetadata', apply, { once: true });
  };

  /* ── 1 · The letter, embedded verbatim ──────────────────────────────────── */

  const LETTER = `Happy Birthday Ushna Nadeem ! 💖

I know you've been feeling like your days all look the same. Shift, sleep, repeat, and then it's tomorrow already. I get why that gets to you. But you're measuring it wrong. Working nights is hard in ways most people never see: the tiredness that doesn't go away, missing out on things because you're asleep when everyone else is awake, and still showing up and doing the job properly anyway. Doing that quietly, for months, isn't boring. It's just under-appreciated.

The routine you're living isn't who you are. It's a phase you're handling well. There's a difference, and I think you forget it.

Also, you're not great at taking compliments, so I'll keep this simple. You're one of the best people I know. Not in a dramatic way, in an everyday one. You show up. You listen even when what I'm saying isn't interesting. You remember the small things. You check in. Most people don't do that, and you do it without making it a big deal.

And your life isn't boring. It's just quiet right now. Quiet isn't the same as empty, and it definitely isn't the same as wasted.

So for today, eat more cake than is reasonable.

I hope this year is a good one for you. Genuinely. And if any part of it isn't, you know where I am.

Happy birthday. 🎂`;

  /* ── 2 · Scene switching ────────────────────────────────────────────────── */

  const SCENES = ['#scene-gate', '#scene-letter', '#descent',
                  '#scene-post', '#scene-reveal'];

  function show(selector) {
    SCENES.forEach((sel) => {
      const el = $(sel);
      if (el) el.classList.toggle('is-off', sel !== selector);
    });
  }

  /* ── 3 · Audio ──────────────────────────────────────────────────────────── */

  const VOL = { loop: 0.72, final: 0.88 };

  const Audio2 = {
    loopEl:  $('#music-loop'),
    finalEl: $('#music-final'),
    chip:    $('#sound-chip'),
    current: null,
    finalWarmed: false,
    ramps:   new WeakMap(),

    ramp(el, to, ms = 1200) {
      const pending = this.ramps.get(el);
      if (pending) cancelAnimationFrame(pending);

      const from = el.volume;
      const t0 = performance.now();

      const step = (now) => {
        const k = Math.min(1, (now - t0) / ms);
        el.volume = clamp(from + (to - from) * k, 0, 1);
        if (k < 1) this.ramps.set(el, requestAnimationFrame(step));
        else this.ramps.delete(el);
      };
      this.ramps.set(el, requestAnimationFrame(step));
    },

    /* Called synchronously inside the consent tap so the gesture is honoured. */
    startLoop() {
      const el = this.loopEl;
      this.current = el;
      rewind(el);
      el.volume = 0;

      this.ramp(el, VOL.loop, 1800);

      safePlay(el)
        .then(() => this.chip.classList.add('is-hidden'))
        .catch(() => this.chip.classList.remove('is-hidden'));
    },

    crossToFinal() {
      if (this.current === this.finalEl) return;

      this.ramp(this.loopEl, 0, 1100);
      window.setTimeout(() => this.loopEl.pause(), 1150);

      const el = this.finalEl;
      this.current = el;
      // Deliberately not rewind() — the reveal opens 10s in.
      seek(el, FINAL_START);
      el.volume = 0;

      this.ramp(el, VOL.final, 1600);
      safePlay(el)
        .then(() => this.chip.classList.add('is-hidden'))
        .catch(() => this.chip.classList.remove('is-hidden'));
    },

    retry() {
      const el = this.current || this.loopEl;
      safePlay(el).then(() => {
        this.ramp(el, el === this.finalEl ? VOL.final : VOL.loop, 900);
        this.chip.classList.add('is-hidden');
      }).catch(() => {});
    },

    /* The final track is far larger than the loop, so it is not fetched at load
       time. Fetching it once the letter is underway means it is already buffered
       by the time the reveal needs it.
       Assigning preload = 'auto' alone is NOT enough in this layout: the element
       is a child of <body>, not of a display:none scene, so the browser sees it
       as visible-and-paused and deliberately does not buffer past metadata.
       A one-off load() kicks the fetch off properly — but it must only ever run
       ONCE and only while the track is still idle. Calling load() after
       crossToFinal() resets the media element to duration 0 and silently kills
       playback, which is exactly what a late warm-up used to do. */
    warmFinal() {
      if (this.finalWarmed) return;
      this.finalWarmed = true;

      // Never disturb a track that is already playing or buffered past metadata.
      if (this.current === this.finalEl || this.finalEl.readyState > 1) return;

      this.finalEl.preload = 'auto';
      try { this.finalEl.load(); } catch (err) { /* non-fatal */ }
    },
  };

  $('#sound-chip').addEventListener('click', () => Audio2.retry());

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      Audio2.loopEl.pause();
      Audio2.finalEl.pause();
    } else if (Audio2.current) {
      // Coming back to the tab resumes whichever track was in play.
      safePlay(Audio2.current).catch(() => {});
    }
  });

  /* ── 4 · Floating hearts ────────────────────────────────────────────────── */

  const HEART_COLORS = ['#ff5a78', '#ff97ab', '#d81e3f', '#ffd76e', '#ffb3c1'];

  function seedHearts(container, count) {
    if (!container || reduceMotion) return;

    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const h = document.createElement('span');
      h.className = 'heart';
      h.style.left      = `${rand(2, 94).toFixed(2)}%`;
      h.style.setProperty('--s',     `${rand(11, 27).toFixed(1)}px`);
      h.style.setProperty('--dur',   `${rand(9, 19).toFixed(1)}s`);
      h.style.setProperty('--delay', `${(-rand(0, 18)).toFixed(1)}s`);
      h.style.setProperty('--peak',  rand(0.28, 0.7).toFixed(2));
      h.style.setProperty('--sway',  `${rand(-34, 34).toFixed(0)}px`);
      h.style.color = HEART_COLORS[i % HEART_COLORS.length];
      frag.appendChild(h);
    }
    container.appendChild(frag);
  }

  seedHearts($('#hearts-gate'), 22);

  /* ── 5 · Act 1 · Consent gate ───────────────────────────────────────────── */

  const consentBox   = $('#consent-box');
  const consentBtn   = $('#consent-btn');
  const gateHint     = $('#gate-hint');
  const gateScene    = $('#scene-gate');
  const letterScene  = $('#scene-letter');

  consentBox.addEventListener('change', () => {
    consentBtn.disabled = !consentBox.checked;
    gateHint.textContent = consentBox.checked
      ? 'Thank you. Take your time in here.'
      : 'Tick the box to continue.';
    gateHint.classList.toggle('is-ready', consentBox.checked);
  });

  consentBtn.addEventListener('click', () => {
    if (!consentBox.checked) return;

    Audio2.startLoop();               // must stay inside the gesture

    // Creating the context here means the monkey cue later needs no new
    // gesture of its own.
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    } catch (err) { audioCtx = null; }

    document.body.classList.remove('is-locked');
    gateScene.classList.add('is-leaving');

    window.setTimeout(() => {
      show('#scene-letter');
      window.scrollTo(0, 0);
      seedHearts($('#hearts-letter'), 12);
      typewriter.start();

      // Give the loop a head start, then fetch the big final track behind it.
      window.setTimeout(() => Audio2.warmFinal(), 4000);
    }, 700);
  });

  /* ── 6 · Act 2 · The typewriter ─────────────────────────────────────────── */

  const letterEl  = $('#letter');
  const caretEl   = $('#caret');
  const scrollCue = $('#scroll-cue');
  const descentEl = $('#descent');

  const BODY = document.createTextNode('');
  letterEl.insertBefore(BODY, caretEl);

  /* Brisk but still legible — fast enough that nobody is waiting for it, slow
     enough to read as typing rather than a page render. 30ms per character plus
     the pauses below works out at roughly 22 characters a second, so the full
     ~1,270-character letter unfolds in about a minute.
     Tapping the text toggles 1x / 3x, which takes it to ~20 seconds. */
  const PUNCT_PAUSE = {
    '.': 190, ',': 110, '!': 210, '?': 210, '…': 280,
    '\n': 320, '—': 130, ';': 140, ':': 140,
  };
  const BASE_MS = 30;

  const typewriter = {
    idx: 0,
    acc: 0,
    last: 0,
    speed: 1,
    running: false,
    done: false,
    following: true,
    lastFollow: 0,

    start() {
      $('#letter-full').textContent = LETTER;

      if (reduceMotion) { this.finish(); return; }

      this.running = true;
      requestAnimationFrame((ts) => this.tick(ts));
    },

    tick(ts) {
      if (!this.running) return;

      if (!this.last) this.last = ts;
      const dt = Math.min(ts - this.last, 140);
      this.last = ts;
      this.acc += dt * this.speed;

      let guard = 0;
      while (this.idx < LETTER.length && guard++ < 90) {
        const ch = LETTER[this.idx];
        const cost = BASE_MS + (PUNCT_PAUSE[ch] || 0);
        if (this.acc < cost) break;
        this.acc -= cost;
        this.idx++;

        // Never split a surrogate pair (emoji) across frames.
        const code = ch.charCodeAt(0);
        if (code >= 0xD800 && code <= 0xDBFF && this.idx < LETTER.length) this.idx++;
      }

      BODY.data = LETTER.slice(0, this.idx);

      if (this.idx >= LETTER.length) { this.finish(); return; }
      requestAnimationFrame((next) => this.tick(next));
    },

    finish() {
      if (this.done) return;
      this.done = true;
      this.running = false;
      this.idx = LETTER.length;
      BODY.data = LETTER;

      caretEl.style.display = 'none';

      unlockDescent();
      scrollCue.classList.remove('is-hidden');
      say('The letter is finished. Scroll down when you are ready.');
    },

    cycleSpeed() {
      if (this.done) return;
      this.speed = this.speed === 1 ? 3 : 1;
      say(this.speed === 3 ? 'Reading faster.' : 'Normal speed.');
    },  };

  letterEl.addEventListener('click', () => typewriter.cycleSpeed());
  scrollCue.addEventListener('click', () => {
    descentEl.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* Auto-follow: nudge the page down only once the caret drops into the lower
     quarter of the screen, so the text advances line by line instead of the
     page constantly creeping. Yields immediately to a deliberate swipe up. */
  let touchStartY = 0;

  window.addEventListener('touchstart', () => { touchStartY = window.scrollY; },
    { passive: true });

  window.addEventListener('touchend', () => {
    if (window.scrollY < touchStartY - 40) typewriter.following = false;
  }, { passive: true });

  function autoFollow(now) {
    if (!typewriter.running || !typewriter.following) return;

    const caretTop = caretEl.getBoundingClientRect().top;
    const restLine = window.innerHeight * 0.78;   // where we let the caret sit
    if (caretTop < restLine) return;

    if (now - typewriter.lastFollow < 260) return;
    typewriter.lastFollow = now;

    window.scrollBy({
      top: caretTop - window.innerHeight * 0.62,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }

  /* ── 7 · Act 3 · The descent ────────────────────────────────────────────── */

  const zoomEl     = $('#descent-zoom');
  const vignetteEl = $('.vignette');
  const locket     = $('#locket');
  const descentCue = $('#descent-cue');
  const descentSkip = $('#descent-skip');

  let descentTotal = 0;
  let lastP = -1;

  function measureDescent() {
    descentTotal = Math.max(1, descentEl.offsetHeight - window.innerHeight);
  }

  /* The descent is display:none until the letter is done, so it has no
     measurable height before then — reveal it and measure in one step. */
  function unlockDescent() {
    descentEl.classList.remove('is-off');
    measureDescent();
    lastP = -1;
    updateDescent();
  }

  function updateDescent() {
    if (descentEl.classList.contains('is-off')) return;

    // A resize while hidden (or a late font swap) can leave a stale height.
    if (descentTotal <= 1) measureDescent();

    const p = clamp(-descentEl.getBoundingClientRect().top / descentTotal, 0, 1);
    if (Math.abs(p - lastP) < 0.0015) return;
    lastP = p;

    const eased = Math.pow(p, 2.15);
    zoomEl.style.setProperty('--zoom', (1 + eased * 5.4).toFixed(3));
    if (vignetteEl) vignetteEl.style.setProperty('--vig', (0.28 + p * 0.55).toFixed(3));

    const live = p > 0.5;
    locket.dataset.live = String(live);
    locket.tabIndex = live ? 0 : -1;
    locket.setAttribute('aria-hidden', String(!live));

    descentCue.style.opacity = p > 0.72 ? '0' : '1';
    descentSkip.classList.toggle('is-hidden', p < 0.55);
  }

  locket.addEventListener('click', () => {
    if (locket.dataset.live !== 'true') return;
    post.begin();
  });

  descentSkip.addEventListener('click', () => post.begin());

  /* ── 8 · Act 4 · The post ───────────────────────────────────────────────── */

  const postScene = $('#scene-post');
  const deckEl    = $('#deck');
  const deckCount = $('#deck-count');
  const deckHint  = $('#deck-hint');
  const deckDots  = $('#deck-dots');
  const deckPrev  = $('#deck-prev');
  const deckNext  = $('#deck-next');
  const commentsEl = $('#comments');
  const postEnd   = $('#post-end');
  const likeBtn   = $('#like-btn');
  const likeCount = $('#like-count');
  const burstBox  = $('#burst');

  const PHOTOS = 8;
  const BASE_LIKES = 1284;
  const LIKE_STEP  = 7;          // the like button is a counter, not a real like

  const COMMENTS = [
    { u: 'ayesha_kh',   c: 'happiest birthday ushna 💕 you deserve everything' },
    { u: 'bilal.ahmed',  c: 'HB Ushna! cake bachana thora sa 😄' },
    { u: 'hamza_malik',  c: 'many many happy returns, stay blessed' },
    { u: 'sana.r',       c: 'this is so sweet, someone went all out 🥹' },
    { u: 'hassanbuilt',  c: 'everyone say happy birthday or else' },
    { u: 'zainab.qures', c: 'the prettiest 🌸 have the bestest day' },
    { u: 'omar_ch',      c: 'happy birthday Ushna! wishing you a great year' },
    { u: 'mariam88',     c: 'welcome to the best year yet inshaAllah ✨' },
  ];

  /* Heartbeat counter for the fake like total. */
  let likesShown = BASE_LIKES;
  function setLikes(n) {
    likesShown = n;
    likeCount.textContent = n.toLocaleString('en-US');
  }
  setLikes(BASE_LIKES);

  const post = {
    idx: 0,
    opened: false,
    started: false,
    seen: new Set([0]),
    timer: null,
    cooling: false,

    begin() {
      if (this.opened) return;
      this.opened = true;

      show('#scene-post');
      window.scrollTo(0, 0);
      seedHearts($('#hearts-post'), 10);

      // The fake activity lands a beat after the post does, so it reads as
      // something happening rather than a page that was just drawn.
      window.setTimeout(() => this.driftLikes(), 1400);
      this.timer = window.setInterval(() => this.driftLikes(), 3400);
    },

    /* Not a live feed — just enough movement to feel alive. */
    driftLikes() {
      if (postScene.classList.contains('is-off')) return;
      if (likeBtn.dataset.mine === 'true') return;
      setLikes(likesShown + Math.floor(rand(1, 5)));
    },

    go(next) {
      const target = clamp(next, 0, PHOTOS - 1);
      if (target === this.idx) return;

      this.idx = target;
      this.dismissHint();
      this.render();
      this.seen.add(target);

      if (target === PHOTOS - 1) this.end();
    },

    render() {
      deckEl.style.transform = `translate3d(${-this.idx * 100}%, 0, 0)`;
      deckCount.textContent = `${this.idx + 1}/${PHOTOS}`;
      deckDots.querySelectorAll('.dot').forEach((d, i) => {
        d.classList.toggle('is-on', i === this.idx);
      });

      deckPrev.disabled = this.idx === 0;
      deckNext.disabled = this.idx === PHOTOS - 1;
    },

    /* The "swipe" hint is only retired once she has actually swiped — hiding it
       in render() would hide it on the very first paint. */
    dismissHint() {
      deckHint.classList.add('is-hidden');
    },

    /* The end prompt only appears once the last photo has actually been seen. */
    end() {
      if (postEnd.classList.contains('is-on')) return;
      postEnd.classList.add('is-on');
      postScene.classList.add('is-ended');
      say('You have seen all eight photos.');
    },

    cool() {
      this.cooling = true;
      window.setTimeout(() => { this.cooling = false; }, 520);
    },
  };

  /* Build the carousel, the dots and the comments once. */
  (function buildDeck() {
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= PHOTOS; i++) {
      const fig = document.createElement('figure');
      fig.className = 'slide';
      const img = document.createElement('img');
      img.src = `assets/${i}.jpeg`;
      img.alt = `Ushna, photo ${i} of ${PHOTOS}`;
      img.draggable = false;
      img.loading = i <= 2 ? 'eager' : 'lazy';
      fig.appendChild(img);
      frag.appendChild(fig);
    }
    deckEl.appendChild(frag);

    for (let i = 0; i < PHOTOS; i++) {
      const d = document.createElement('span');
      d.className = 'dot';
      deckDots.appendChild(d);
    }

    const cfrag = document.createDocumentFragment();
    COMMENTS.forEach((entry, i) => {
      const row = document.createElement('p');
      row.className = 'comment';
      row.style.setProperty('--i', String(i));
      row.innerHTML =
        `<strong>${entry.u}</strong> ${entry.c}` +
        `<span class="comment__meta">${Math.floor(rand(2, 46))}w ` +
        `<b>${Math.floor(rand(1, 9))} likes</b></span>`;
      cfrag.appendChild(row);
    });
    commentsEl.appendChild(cfrag);

    post.render();
  })();

  deckNext.addEventListener('click', () => post.go(post.idx + 1));
  deckPrev.addEventListener('click', () => post.go(post.idx - 1));

  /* Keyboard parity for the arrows. */
  postScene.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') post.go(post.idx + 1);
    else if (event.key === 'ArrowLeft') post.go(post.idx - 1);
  });

  /* Horizontal swipe / drag on the deck. */
  (function wireDeck() {
    let x0 = null;
    let y0 = 0;
    let moved = false;

    deckEl.addEventListener('pointerdown', (event) => {
      x0 = event.clientX;
      y0 = event.clientY;
      moved = false;
    });

    deckEl.addEventListener('pointermove', (event) => {
      if (x0 === null) return;
      if (Math.abs(event.clientX - x0) > 8) moved = true;
    });

    const finish = (event) => {
      if (x0 === null) return;
      const dx = event.clientX - x0;
      const dy = event.clientY - y0;
      x0 = null;

      if (Math.abs(dy) > Math.abs(dx)) return;      // that was a scroll
      if (moved && Math.abs(dx) > 42) post.go(post.idx + (dx < 0 ? 1 : -1));
    };

    deckEl.addEventListener('pointerup', finish);
    deckEl.addEventListener('pointercancel', () => { x0 = null; });
    deckEl.addEventListener('dragstart', (event) => event.preventDefault());
  })();

  /* One tap = one like. Tapping again takes it back, and the total always
     settles back on the same baseline so it can never drift. The ring ripple
     and heart beat in CSS are the feedback — the petal burst lives in the
     reveal scene, which is not on screen yet. */
  likeBtn.addEventListener('click', () => {
    const mine = likeBtn.dataset.mine === 'true';
    likeBtn.dataset.mine = String(!mine);
    likeBtn.setAttribute('aria-pressed', String(!mine));
    likeBtn.classList.toggle('is-liked', !mine);

    setLikes(BASE_LIKES + (!mine ? LIKE_STEP : 0));
    if (!mine) say('Liked.');
  });

  /* ── 9 · The monkey ─────────────────────────────────────────────────────── */

  const flashEl = $('#flash');
  const bdayBtn = $('#bday-btn');

  /* Synthesised, and deliberately so — it keeps the page dependency-free and
     avoids shipping a recording of someone else's voice. Two quick whoops
     built from an oscillator plus a noise tail. */
  let audioCtx = null;

  function monkeyNoise(ctx, at, dur, gain) {
    const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 2.4);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1150;
    bp.Q.value = 1.6;

    const g = ctx.createGain();
    g.gain.value = gain;

    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(at);
  }

  function whoop(ctx, at, f0, f1, dur, gain) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0, at);
    osc.frequency.exponentialRampToValueAtTime(f1, at + dur * 0.8);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2600, at);
    lp.frequency.exponentialRampToValueAtTime(900, at + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    osc.connect(lp).connect(g).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + dur + 0.05);

    monkeyNoise(ctx, at, Math.min(0.22, dur), gain * 0.35);
  }

  function monkeySound() {
    if (!audioCtx) return;

    const el = Audio2.current;
    const to = el === Audio2.finalEl ? VOL.final : VOL.loop;

    // Duck the music through the normal volume ramp so the gag lands over the
    // top of it, then bring it back. Volume only — never the media graph.
    if (el) {
      Audio2.ramp(el, to * 0.22, 90);
      window.setTimeout(() => Audio2.ramp(el, to, 900), 520);
    }

    const t = audioCtx.currentTime + 0.02;
    whoop(audioCtx, t,        520, 1500, 0.30, 0.20);
    whoop(audioCtx, t + 0.26, 640, 1750, 0.26, 0.17);
    whoop(audioCtx, t + 0.50, 480, 1200, 0.34, 0.13);
  }

  function flashThen() {
    flashEl.classList.add('is-on');
    monkeySound();

    if (reduceMotion) {
      window.setTimeout(() => { flashEl.classList.remove('is-on'); reveal(); }, 180);
      return;
    }

    window.setTimeout(() => {
      flashEl.classList.remove('is-on');
      reveal();
    }, 620);
  }

  bdayBtn.addEventListener('click', () => {
    if (post.cooling) return;
    post.cool();
    window.clearInterval(post.timer);
    flashThen();
  });

  /* ── 10 · Petals ────────────────────────────────────────────────────────── */

  const PETAL_COLORS = ['#ff5a78', '#ff97ab', '#ffd76e', '#d81e3f', '#fff0f3', '#ffb3c1'];

  function petals(container, cx, cy, count) {
    if (!container || reduceMotion) return;

    const cb = container.getBoundingClientRect();
    const ox = cx - cb.left;
    const oy = cy - cb.top;
    const frag = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'petal';
      const angle = rand(0, Math.PI * 2);
      const dist  = rand(90, 260);
      p.style.left = `${ox}px`;
      p.style.top  = `${oy}px`;
      p.style.background = PETAL_COLORS[i % PETAL_COLORS.length];
      p.style.width = p.style.height = `${rand(7, 17).toFixed(1)}px`;
      p.style.setProperty('--dx', `${(Math.cos(angle) * dist).toFixed(0)}px`);
      p.style.setProperty('--dy', `${(Math.sin(angle) * dist).toFixed(0)}px`);
      p.style.setProperty('--dur', `${rand(0.7, 1.5).toFixed(2)}s`);
      frag.appendChild(p);
    }

    container.appendChild(frag);
    window.setTimeout(() => {
      container.querySelectorAll('.petal').forEach((n) => n.remove());
    }, 1800);
  }

  /* ── 11 · Fireworks ─────────────────────────────────────────────────────── */

  const skyEl = $('#sky');

  const fire = {
    ctx: null,
    rockets: [],
    sparks: [],
    running: false,
    viewW: 0,
    viewH: 0,
    dpr: 1,

    /* Sized off the element itself so the canvas stays crisp on retina. */
    fit() {
      if (!this.ctx) return;
      const box = skyEl.getBoundingClientRect();
      // Never below 1x — a short viewport on a 1x display would otherwise
      // leave a backing store smaller than the CSS box and blur the sparks.
      this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      this.viewW = Math.max(1, Math.round(box.width));
      this.viewH = Math.max(1, Math.round(box.height));
      skyEl.width  = Math.round(this.viewW * this.dpr);
      skyEl.height = Math.round(this.viewH * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    },

    /* One shell, straight up from the bottom edge. */
    launch(speed = 1) {
      const w = this.viewW;
      this.rockets.push({
        x: rand(w * 0.22, w * 0.78),
        y: this.viewH + 8,
        vx: rand(-26, 26),
        vy: -rand(430, 560) * speed,
        targetY: rand(this.viewH * 0.14, this.viewH * 0.42),
        hue: rand(330, 380) % 360,
        dead: false,
      });
    },

    explode(x, y, hue) {
      const n = Math.round(rand(46, 78));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand(-0.06, 0.06);
        const sp = rand(70, 235);
        this.sparks.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 1,
          decay: rand(0.008, 0.018),
          hue: hue + rand(-26, 26),
          r: rand(1.1, 2.6),
        });
      }
      // A soft core so the burst reads as light, not just dots.
      for (let i = 0; i < 14; i++) {
        this.sparks.push({
          x, y,
          vx: rand(-40, 40),
          vy: rand(-40, 40),
          life: 1,
          decay: rand(0.02, 0.04),
          hue, r: rand(2.5, 4.5),
        });
      }
    },

    step() {
      const ctx = this.ctx;
      if (!ctx) return;

      ctx.clearRect(0, 0, this.viewW, this.viewH);
      ctx.globalCompositeOperation = 'lighter';

      for (const r of this.rockets) {
        if (r.dead) continue;
        r.vy += 620 * 0.016;
        r.x += r.vx * 0.016;
        r.y += r.vy * 0.016;

        ctx.beginPath();
        ctx.fillStyle = `hsl(${r.hue} 100% 78%)`;
        ctx.arc(r.x, r.y, 2.2, 0, Math.PI * 2);
        ctx.fill();

        if (r.y <= r.targetY || r.vy >= -30) {
          r.dead = true;
          this.explode(r.x, r.y, r.hue);
        }
      }

      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const s = this.sparks[i];
        s.vy += 78 * 0.016;                 // gravity
        s.vx *= 0.985;
        s.vy *= 0.985;
        s.x += s.vx * 0.016;
        s.y += s.vy * 0.016;
        s.life -= s.decay;

        if (s.life <= 0) { this.sparks.splice(i, 1); continue; }

        ctx.globalAlpha = clamp(s.life, 0, 1) * 0.95;
        ctx.beginPath();
        ctx.fillStyle = `hsl(${s.hue} 100% ${58 + s.life * 22}%)`;
        ctx.arc(s.x, s.y, s.r * (0.4 + s.life * 0.8), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      this.rockets = this.rockets.filter((r) => !r.dead);

      if (this.sparks.length === 0 && this.rockets.length === 0 && !this.running) {
        ctx.clearRect(0, 0, this.viewW, this.viewH);
        return;
      }

      requestAnimationFrame(() => this.step());
    },

    start() {
      if (!this.ctx || this.running) return;
      this.running = true;
      this.fit();
      requestAnimationFrame(() => this.step());
    },

    stop() {
      this.running = false;
      this.rockets.length = 0;
      this.sparks.length = 0;
    },

    /* Timed so the reveal reads: one shell first, then the sky fills in. */
    run() {
      if (reduceMotion) return;
      this.start();
      this.launch(0.92);

      [760, 1500, 2400, 3200, 4300].forEach((ms, i) => {
        window.setTimeout(() => this.launch(rand(0.95, 1.25)), ms);
      });
      window.setTimeout(() => this.launch(1.1), 5400);

      // Keep a slow trickle going rather than an endless barrage.
      window.setInterval(() => {
        if (!this.running || this.sparks.length > 520) return;
        this.launch(rand(0.9, 1.2));
      }, 2100);
    },
  };

  if (skyEl && skyEl.getContext) {
    fire.ctx = skyEl.getContext('2d');
    window.addEventListener('resize', () => {
      if (fire.running) fire.fit();
    });
  }

  /* ── 12 · Act 5 · Reveal ────────────────────────────────────────────────── */

  const revealScene = $('#scene-reveal');
  const discEl  = $('#disc');
  const armEl   = $('#tonearm');
  const tilesEl = $('#tiles');
  const flipEl  = $('#name-flip');

  /* ── The flipping name ──────────────────────────────────────────────────── */

  const NAMES = ['Ushna', 'Nadeem'];
  const FLIP_HOLD = 2600;      // ms each name stays put
  const FLIP_MS   = 520;       // must match the CSS transition

  let flipTimer = null;
  let flipIdx = 0;

  /* Swaps the word with a 3D turn: the current name rotates out, the next one
     rotates in. Guarded against re-entry so a slow frame cannot stack turns. */
  function flipName() {
    if (!flipEl) return;
    if (flipEl.classList.contains('is-turning')) return;

    flipEl.classList.add('is-turning');

    window.setTimeout(() => {
      flipIdx = (flipIdx + 1) % NAMES.length;
      flipEl.textContent = NAMES[flipIdx];
      flipEl.classList.remove('is-turning');
    }, reduceMotion ? 0 : FLIP_MS / 2);
  }

  function startFlip() {
    if (!flipEl || flipTimer || reduceMotion) return;
    flipTimer = window.setInterval(flipName, FLIP_HOLD);
  }

  function stopFlip() {
    window.clearInterval(flipTimer);
    flipTimer = null;
  }

  // Don't animate a name nobody is looking at.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopFlip();
    else if (revealScene.classList.contains('is-lit')) startFlip();
  });

  const TILE_COUNT = 8;      // one per photo, so all eight are represented
  const TILE_COLS  = 2;
  const TILE_TILT  = 11;     // degrees, maximum absolute rotation
  const TILE_SWAY  = 8;      // px, half-amplitude of the horizontal float
  const TILE_FLOAT = 20;     // px, half-amplitude of the vertical float

  /* One tile per photo, drifting behind the turntable. The monkey is
     deliberately never among them.
     Every tile owns a grid cell, and the tile is sized so that the tile plus
     its ENTIRE animation envelope fits inside that cell. Since the cells are
     disjoint, no two tiles can ever overlap, however the random jitter lands. */
  function seedTiles() {
    if (!tilesEl || tilesEl.childElementCount) return;

    // seedTiles() runs after the reveal is shown, so the column has a size.
    const colW  = tilesEl.clientWidth  || window.innerWidth;
    const boxH  = tilesEl.clientHeight || window.innerHeight;
    const rows  = Math.ceil(TILE_COUNT / TILE_COLS);
    const cellW = colW / TILE_COLS;
    const cellH = boxH / rows;

    /* Rotating a w x 1.25w tile by TILE_TILT widens its bounding box to
       w * (cos + 1.25 sin) and heightens it to w * (sin + 1.25 cos). Invert
       both, leaving room for the full float in BOTH directions, to get the
       largest w that still fits inside one cell. */
    const rad    = TILE_TILT * Math.PI / 180;
    const wideK  = Math.cos(rad) + 1.25 * Math.sin(rad);
    const tallK  = Math.sin(rad) + 1.25 * Math.cos(rad);
    const margin = 10;

    const byWidth  = (cellW - 2 * TILE_SWAY  - margin) / wideK;
    const byHeight = (cellH - 2 * TILE_FLOAT - margin) / tallK;
    const w = Math.max(56, Math.min(byWidth, byHeight));
    const h = w * 1.25;

    const aabbW = w * wideK;
    const aabbH = w * tallK;

    // The union over the whole animation. This must stay inside the cell.
    const spanW = aabbW + 2 * TILE_SWAY;
    const spanH = aabbH + 2 * TILE_FLOAT;
    const slackX = Math.max(0, cellW - spanW);
    const slackY = Math.max(0, cellH - spanH);

    const frag = document.createDocumentFragment();
    for (let i = 0; i < TILE_COUNT; i++) {
      const col = i % TILE_COLS;
      const row = Math.floor(i / TILE_COLS);

      // Centre the union box in the cell, then jitter inside the leftover.
      const spanLeft = col * cellW + slackX / 2 + rand(-slackX / 2, slackX / 2);
      const spanTop  = row * cellH + slackY / 2 + rand(-slackY / 2, slackY / 2);

      // Walk back from the union box to the element's own centre.
      const cx = spanLeft + TILE_SWAY  + aabbW / 2;
      const cy = spanTop  + TILE_FLOAT + aabbH / 2;

      const t = document.createElement('span');
      t.className = 'tile';
      t.style.backgroundImage = `url("assets/${(i % 8) + 1}.jpeg")`;
      t.style.left = `${(cx - w / 2).toFixed(1)}px`;
      t.style.top  = `${(cy - h / 2).toFixed(1)}px`;
      t.style.setProperty('--s', `${w.toFixed(0)}px`);
      t.style.setProperty('--float', `${TILE_FLOAT}px`);
      t.style.setProperty('--dur', `${rand(22, 34).toFixed(1)}s`);
      t.style.setProperty('--delay', `${(-rand(0, 22)).toFixed(1)}s`);
      t.style.setProperty('--sway', `${rand(-TILE_SWAY, TILE_SWAY).toFixed(1)}px`);
      t.style.setProperty('--tilt', `${rand(-TILE_TILT, TILE_TILT).toFixed(1)}deg`);
      frag.appendChild(t);
    }
    tilesEl.appendChild(frag);
  }

  function reveal() {
    show('#scene-reveal');
    window.scrollTo(0, 0);

    seedHearts($('#hearts-reveal'), 18);
    seedTiles();

    // The record starts turning and the track starts in the same frame.
    Audio2.crossToFinal();
    revealScene.classList.add('is-lit');
    discEl.classList.add('is-spinning');
    startFlip();

    window.setTimeout(() => armEl.classList.add('is-down'), reduceMotion ? 0 : 420);
    window.setTimeout(() => revealScene.classList.add('is-named'),
      reduceMotion ? 200 : 900);

    fire.run();

    const b = burstBox.getBoundingClientRect();
    petals(burstBox, b.left + b.width / 2, b.top + b.height * 0.42, 26);

    say('Happy birthday, Ushna.');
  }

  /* ── 13 · Scroll + resize plumbing ──────────────────────────────────────── */

  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame((now) => {
      autoFollow(now);
      updateDescent();
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  window.addEventListener('resize', () => {
    measureDescent();
    lastP = -1;
    updateDescent();
  });

  window.addEventListener('orientationchange', () => {
    window.setTimeout(() => {
      measureDescent();
      lastP = -1;
      updateDescent();
    }, 260);
  });

  measureDescent();
  updateDescent();
  $('#letter-full').textContent = LETTER;
})();
