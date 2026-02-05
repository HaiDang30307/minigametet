// ==============================
// Simple SPA Tết Mini Game
// ==============================

// ----- Global state -----
const AppState = {
  stage: "start", // "start" | 1 | 2 | 3 | 4 | 5 | 6 | "final"
  quiz: {
    questions: [],
    index: 0,
    correct: 0,
    wrong: 0
  },
  cards: {
    items: [],
    flips: 0,
    matches: 0
  },
  math: {
    questions: [],
    index: 0,
    correct: 0,
    wrong: 0
  },
  audio: {
    enabled: false,
    ctx: null
  }
};

const stageContainer = document.getElementById("stageContainer");
const stagePills = document.querySelectorAll(".stage-pill");
const appEl = document.getElementById("app");

const fxCanvas = document.getElementById("fxCanvas");
const fxCtx = fxCanvas.getContext("2d");
const screenFlash = document.getElementById("screenFlash");

const musicToggle = document.getElementById("musicToggle");
const musicLabel = musicToggle.querySelector(".music-label");

let musicOscLoop = null;
let musicRunning = false;
let fireworksRunning = false;
const fireworks = [];

// ==============================
// Utility helpers
// ==============================

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function setStage(newStage) {
  AppState.stage = newStage;
  updateStagePills();
  renderStage();
}

function updateStagePills() {
  stagePills.forEach((pill) => {
    const num = parseInt(pill.dataset.stage, 10);
    pill.classList.remove("active");
    pill.classList.remove("completed");

    if (AppState.stage === "start" || AppState.stage === "final") {
      // none active
    } else if (typeof AppState.stage === "number") {
      if (num === AppState.stage) pill.classList.add("active");
      else if (num < AppState.stage) pill.classList.add("completed");
    } else {
      // final screen – mark all completed
      pill.classList.add("completed");
    }
  });
}

function clearStageContainer() {
  stageContainer.innerHTML = "";
}

function createStageView(className) {
  const view = document.createElement("section");
  view.className = `stage-view ${className}`;
  stageContainer.appendChild(view);

  // force layout then activate for animation
  requestAnimationFrame(() => view.classList.add("active"));
  return view;
}

// ==============================
// Stage loader helpers (for external HTML stages)
// ==============================

function loadCssOnce(href) {
  const abs = new URL(href, window.location.href).href;
  const existing = document.querySelector(`link[rel="stylesheet"][data-dynamic="1"][href="${abs}"]`);
  if (existing) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = abs;
  link.dataset.dynamic = "1";
  document.head.appendChild(link);
}

function loadScriptOnce(src) {
  const abs = new URL(src, window.location.href).href;
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-dynamic="1"][src="${abs}"]`);
    if (existing) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = abs;
    s.async = true;
    s.dataset.dynamic = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load script: ${abs}`));
    document.body.appendChild(s);
  });
}

async function injectStageHtmlInto(viewEl, htmlPath) {
  // Fetch stage HTML
  const res = await fetch(htmlPath, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load ${htmlPath}`);
  const text = await res.text();

  // Parse and extract assets
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");
  const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"][href]'));
  const scripts = Array.from(doc.querySelectorAll("script[src]"));

  // Load CSS first
  links.forEach((l) => loadCssOnce(l.getAttribute("href")));

  // Inject body content (if provided) otherwise whole document element
  const body = doc.body;
  const fragment = document.createDocumentFragment();
  Array.from(body.childNodes).forEach((n) => fragment.appendChild(n));
  viewEl.appendChild(fragment);

  // Load scripts after DOM is present
  for (const sc of scripts) {
    await loadScriptOnce(sc.getAttribute("src"));
  }
}

function showFlash() {
  screenFlash.style.opacity = "1";
  setTimeout(() => {
    screenFlash.style.opacity = "0";
  }, 250);
}

function screenShake() {
  appEl.classList.remove("screen-shake");
  void appEl.offsetWidth; // reflow
  appEl.classList.add("screen-shake");
  setTimeout(() => appEl.classList.remove("screen-shake"), 350);
}

function resizeCanvas() {
  fxCanvas.width = window.innerWidth;
  fxCanvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ==============================
// Audio helpers (simple WebAudio)
// ==============================

// Background music using HTMLAudioElement
let bgAudio = null;
function ensureBgAudio() {
  if (bgAudio) return bgAudio;
  try {
    bgAudio = new Audio("assets/music.mp3");
    bgAudio.loop = true;
    bgAudio.volume = 0.35;
    bgAudio.preload = "auto";
  } catch (_) {}
  return bgAudio;
}
function startBgMusic() {
  if (!AppState.audio.enabled) return;
  const a = ensureBgAudio();
  if (!a) return;
  if (a.paused) a.play().catch(() => {});
}
function stopBgMusic() {
  const a = bgAudio;
  if (!a) return;
  try { a.pause(); } catch (_) {}
}

function ensureAudioContext() {
  if (!AppState.audio.ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    AppState.audio.ctx = new AudioCtx();
  }
}

function playClick(freq = 900, duration = 0.05, gain = 0.15) {
  if (!AppState.audio.enabled) return;
  ensureAudioContext();
  const ctx = AppState.audio.ctx;
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g).connect(ctx.destination);
  const now = ctx.currentTime;
  osc.start(now);
  osc.stop(now + duration);
}

function playSoftBell(freq = 880, duration = 0.3) {
  if (!AppState.audio.enabled) return;
  ensureAudioContext();
  const ctx = AppState.audio.ctx;
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.18, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function playVictoryChord() {
  if (!AppState.audio.enabled) return;
  ensureAudioContext();
  const ctx = AppState.audio.ctx;
  if (!ctx) return;

  const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
  notes.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    const start = ctx.currentTime + i * 0.04;
    g.gain.setValueAtTime(0.18, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
    osc.connect(g).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.6);
  });
}

// remove oscillator background pad; use HTMLAudio bg music instead

// Toggle button
musicToggle.addEventListener("click", () => {
  if (!bgAudio) return;
  if (bgAudio.paused) {
    bgAudio.play().catch(() => {});
    AppState.audio.enabled = true;
    localStorage.setItem("music_enabled", "on");
    musicLabel.textContent = "Nhạc: Bật";
  } else {
    bgAudio.pause();
    AppState.audio.enabled = false;
    localStorage.setItem("music_enabled", "off");
    musicLabel.textContent = "Nhạc: Tắt";
  }
});

// Unlock audio on first interaction (prepare SFX only; bg starts on Start click)
window.addEventListener("pointerdown", () => {
  ensureAudioContext();
}, { once: true });

// ==============================
// Simple fireworks
// ==============================

function triggerFireworksBurst(repeats = 3, interval = 260) {
  fireworksRunning = true;
  let count = 0;
  const id = setInterval(() => {
    addFirework();
    if (++count >= repeats) clearInterval(id);
  }, interval);
  runFireworksLoop();
}

function addFirework() {
  const w = fxCanvas.width;
  const h = fxCanvas.height;
  const cx = w * (0.25 + Math.random() * 0.5);
  const cy = h * (0.2 + Math.random() * 0.4);
  const colors = ["#ffd700", "#ff3b6b", "#ff9f1c", "#00f5d4"];

  for (let i = 0; i < 40; i++) {
    const angle = (Math.PI * 2 * i) / 40;
    const speed = 2 + Math.random() * 2.5;
    fireworks.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color: colors[(i / 10) | 0]
    });
  }
}

function runFireworksLoop() {
  if (!fireworksRunning) return;
  const ctx = fxCtx;
  const w = fxCanvas.width;
  const h = fxCanvas.height;

  ctx.clearRect(0, 0, w, h);

  for (let i = fireworks.length - 1; i >= 0; i--) {
    const p = fireworks[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.04;
    p.life -= 0.02;
    if (p.life <= 0) {
      fireworks.splice(i, 1);
      continue;
    }
    const alpha = p.life;
    ctx.beginPath();
    ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, "0");
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (fireworks.length === 0) {
    fireworksRunning = false;
    ctx.clearRect(0, 0, w, h);
    return;
  }

  requestAnimationFrame(runFireworksLoop);
}

// ==============================
// Stage 0 – Start screen
// ==============================

function renderStartScreen() {
  clearStageContainer();
  const view = createStageView("start-screen");

  const title = document.createElement("h1");
  title.className = "start-title";
  title.textContent = "Tết Lì Xì Mini Game";

  const msg = document.createElement("p");
  msg.className = "start-message";
  msg.textContent =
    "Bạn sẽ chơi 5 mini game: Câu Hỏi Ngày Tết, Lật Thẻ May Mắn, Thử Thách Toán Học, Ô Tính và Đập Niêu. Vòng thưởng Bốc Lì Xì không tính là mini game. Nhấn START để bắt đầu!";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn-primary";
  btn.textContent = "START";

  btn.addEventListener("click", () => {
    if (!bgAudio) {
      bgAudio = new Audio("assets/music.mp3");
      bgAudio.loop = true;
      bgAudio.volume = 0.35;
      bgAudio.preload = "auto";
    }
    bgAudio.play().catch(() => {});
    AppState.audio.enabled = true;
    localStorage.setItem("music_enabled", "on");
    musicLabel.textContent = "Nhạc: Bật";
    playSoftBell();

    // go to stage 1
    setStage(1);
  });

  view.append(title, msg, btn);
}

// ==============================
// Stage 1 – Trivia quiz
// ==============================

function buildQuizQuestions() {
  const base = [
    {
      q: "Món bánh truyền thống thường thấy nhất trên mâm cỗ Tết miền Bắc là gì?",
      options: ["Bánh chưng", "Bánh tét", "Bánh trôi", "Bánh gai"],
      correct: 0
    },
    {
      q: "Phong tục lì xì ngày Tết thường mang ý nghĩa gì?",
      options: [
        "Chúc may mắn, tài lộc đầu năm",
        "Trả nợ cuối năm",
        "Mua đồ chơi cho trẻ nhỏ",
        "Mời đi ăn Tết"
      ],
      correct: 0
    },
    {
      q: "Hoa nào thường được trưng trong nhà dịp Tết ở miền Nam?",
      options: ["Hoa mai vàng", "Hoa đào", "Hoa sen", "Hoa hướng dương"],
      correct: 0
    },
    {
      q: "Câu chúc “An Khang Thịnh Vượng” thường được dùng để chúc điều gì?",
      options: [
        "Học hành tiến bộ",
        "Sức khỏe và làm ăn phát đạt",
        "Đi lại bình an",
        "Thi đỗ đại học"
      ],
      correct: 1
    },
    {
      q: "Theo phong tục, ngày mùng 1 Tết nên:",
      options: ["Nói lời tốt đẹp", "Quét nhà sớm", "Cãi nhau to tiếng", "Đóng cửa cả ngày"],
      correct: 0
    }
  ];
  return shuffle(base);
}

function renderQuizStage() {
  const state = AppState.quiz;
  const q = state.questions[state.index];
  const total = state.questions.length;

  clearStageContainer();
  const view = createStageView("quiz-stage");

  const header = document.createElement("div");
  header.className = "stage-header";
  header.innerHTML = `
    <div>
      <div class="stage-title">Màn 1 · Câu Hỏi Ngày Tết</div>
      <div class="stage-sub">Trả lời đúng các câu hỏi Tết Việt để mở khóa trò chơi tiếp theo.</div>
    </div>
  `;

  const dotsWrap = document.createElement("div");
  dotsWrap.className = "quiz-dots";
  for (let i = 0; i < total; i++) {
    const dot = document.createElement("div");
    dot.className = "quiz-dot";
    if (i === state.index) dot.classList.add("current");
    if (i < state.index) {
      if (state.questions[i].wasCorrect) dot.classList.add("correct");
      else dot.classList.add("wrong");
    }
    dotsWrap.appendChild(dot);
  }
  header.appendChild(dotsWrap);

  const card = document.createElement("div");
  card.className = "quiz-card";

  const qEl = document.createElement("div");
  qEl.className = "quiz-question";
  qEl.textContent = q.q;

  const meta = document.createElement("div");
  meta.className = "quiz-meta";
  meta.textContent = `Câu ${state.index + 1}/${total} · Chọn 1 đáp án`;

  const optionsWrap = document.createElement("div");
  optionsWrap.className = "quiz-options";

  let locked = false;

  q.options.forEach((optText, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quiz-option";

    const label = document.createElement("div");
    label.className = "quiz-option-label";
    label.textContent = String.fromCharCode(65 + idx);

    const text = document.createElement("div");
    text.className = "quiz-option-text";
    text.textContent = optText;

    btn.append(label, text);

    btn.addEventListener("click", () => {
      if (locked) return;
      locked = true;

      const isCorrect = idx === q.correct;
      if (isCorrect) {
        q.wasCorrect = true;
        state.correct++;
        btn.classList.add("correct", "correct-glow");
        playSoftBell();
        // move on
        setTimeout(nextQuizQuestion, 550);
      } else {
        q.wasCorrect = false;
        state.wrong++;
        localStorage.setItem('stage_1_wrong', String(state.wrong));
        if (state.wrong >= 3) {
          localStorage.setItem('stage_1_status', 'fail');
        }
        stats.textContent = `Đúng: ${state.correct} · Sai: ${state.wrong}`;
        btn.classList.add("wrong", "wrong-shake");
        playClick(500, 0.08, 0.2);
        // allow another try for this question
        setTimeout(() => {
          locked = false;
          btn.classList.add("disabled");
        }, 400);
      }
    });

    optionsWrap.appendChild(btn);
  });

  const footer = document.createElement("div");
  footer.className = "quiz-footer";
  const stats = document.createElement("div");
  stats.textContent = `Đúng: ${state.correct} · Sai: ${state.wrong}`;
  footer.appendChild(stats);

  card.append(qEl, meta, optionsWrap, footer);
  view.append(header, card);
}

function nextQuizQuestion() {
  const s = AppState.quiz;
  if (s.index < s.questions.length - 1) {
    s.index++;
    renderQuizStage();
  } else {
    triggerFireworksBurst(3, 240);
    playVictoryChord();
    showFlash();
    localStorage.setItem('stage_1_status', 'pass');
    setStage(2);
  }
}

// ==============================
// Stage 2 – Card flip game
// ==============================

let cardLock = false;
let firstCard = null;
let secondCard = null;

function createCardItems() {
  const base = [
    { symbol: "🧧", label: "Lì xì" },
    { symbol: "💰", label: "Vàng" },
    { symbol: "🌸", label: "Hoa đào" }
  ];
  const items = [];
  base.forEach((p) => {
    items.push({ ...p }, { ...p });
  });
  return shuffle(items);
}

function renderCardStage() {
  const s = AppState.cards;

  clearStageContainer();
  const view = createStageView("cards-stage");

  const header = document.createElement("div");
  header.className = "stage-header";
  header.innerHTML = `
    <div>
      <div class="stage-title">Màn 2 · Lật Thẻ May Mắn</div>
      <div class="stage-sub">Tìm các cặp biểu tượng may mắn giống nhau để mở khóa thử thách cuối.</div>
    </div>
  `;

  const footerInfo = document.createElement("div");
  footerInfo.className = "cards-footer";
  footerInfo.textContent = `Lượt lật: ${s.flips} · Cặp đã ghép: ${s.matches}/3`;

  const gridWrapper = document.createElement("div");
  gridWrapper.className = "cards-grid-wrapper";

  const grid = document.createElement("div");
  grid.className = "cards-grid";

  s.items.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.symbol = item.symbol;
    card.dataset.index = index;

    const back = document.createElement("div");
    back.className = "card-face card-back";
    const backIcon = document.createElement("div");
    backIcon.className = "card-back-icon";
    backIcon.textContent = "🧧";
    back.appendChild(backIcon);

    const front = document.createElement("div");
    front.className = "card-face card-front";
    const art = document.createElement("div");
    art.className = "card-art";
    const sym = document.createElement("div");
    sym.className = "card-symbol";
    sym.textContent = item.symbol;
    const lab = document.createElement("div");
    lab.className = "card-label";
    lab.textContent = item.label;
    art.appendChild(sym);
    front.append(art, lab);

    card.append(back, front);
    grid.appendChild(card);
  });

  gridWrapper.appendChild(grid);
  view.append(header, gridWrapper, footerInfo);

  firstCard = null;
  secondCard = null;
  cardLock = false;

  grid.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => onCardClick(card, footerInfo));
    card.addEventListener("touchstart", (e) => {
      e.preventDefault();
      onCardClick(card, footerInfo);
    });
  });
}

function onCardClick(card, footerInfo) {
  if (cardLock) return;
  if (card.classList.contains("flipped") || card.classList.contains("matched")) return;

  playClick(1000, 0.05, 0.12);
  card.classList.add("flipped");
  AppState.cards.flips++;
  updateCardsFooter(footerInfo);

  if (!firstCard) {
    firstCard = card;
    return;
  }

  secondCard = card;
  cardLock = true;

  const match = firstCard.dataset.symbol === secondCard.dataset.symbol;

  if (match) {
    setTimeout(() => {
      firstCard.classList.add("matched");
      secondCard.classList.add("matched");
      AppState.cards.matches++;
      playSoftBell(1200, 0.25);

      firstCard = null;
      secondCard = null;
      cardLock = false;
      updateCardsFooter(footerInfo);

      if (AppState.cards.matches >= 3) {
        triggerFireworksBurst(3, 220);
        playVictoryChord();
        localStorage.setItem('stage_2_status', 'pass');
        setTimeout(() => setStage(3), 600);
      }
    }, 360);
  } else {
    setTimeout(() => {
      firstCard.classList.remove("flipped");
      secondCard.classList.remove("flipped");
      firstCard = null;
      secondCard = null;
      cardLock = false;
      updateCardsFooter(footerInfo);
    }, 520);
  }
}

function updateCardsFooter(el) {
  el.textContent = `Lượt lật: ${AppState.cards.flips} · Cặp đã ghép: ${AppState.cards.matches}/3`;
}


// ==============================
// Stage 3 – Math challenge
// ==============================

function buildMathQuestions() {
  const questions = [];
  const count = 6;

  for (let i = 0; i < count; i++) {
    let a, b, op, answer;

    if (i < 2) {
      // easy addition
      a = 1 + (Math.random() * 9) | 0;
      b = 1 + (Math.random() * 9) | 0;
      op = "+";
      answer = a + b;
    } else if (i < 4) {
      // subtraction with positive result
      a = 5 + (Math.random() * 10) | 0;
      b = 1 + (Math.random() * a) | 0;
      op = "-";
      answer = a - b;
    } else {
      // small multiplication
      a = 2 + (Math.random() * 8) | 0;
      b = 2 + (Math.random() * 8) | 0;
      op = "×";
      answer = a * b;
    }

    const correct = answer;
    const choices = new Set([correct]);
    while (choices.size < 4) {
      const delta = ((Math.random() * 5) | 0) - 2; // -2..2
      const val = Math.max(0, correct + delta + (delta === 0 ? 3 : 0));
      choices.add(val);
    }
    const optsArr = shuffle(Array.from(choices));
    const correctIndex = optsArr.indexOf(correct);

    questions.push({
      text: `${a} ${op} ${b} = ?`,
      options: optsArr,
      correctIndex
    });
  }

  return questions;
}

function renderMathStage() {
  clearStageContainer();
  const s = AppState.math;

  // Safeguard: ensure questions exist
  if (!s.questions || s.questions.length === 0) {
    s.questions = buildMathQuestions();
    s.index = 0;
  }

  // Safeguard: index bounds
  if (s.index >= s.questions.length) s.index = 0;

  const q = s.questions[s.index];
  const total = s.questions.length;
  const view = createStageView("math-stage");

  const header = document.createElement("div");
  header.className = "stage-header";
  header.innerHTML = `
    <div>
      <div class="stage-title">Màn 3 · Thử Thách Toán Học</div>
      <div class="stage-sub">Giải các phép tính đơn giản để kết thúc hành trình đầu năm.</div>
    </div>
  `;

  const card = document.createElement("div");
  card.className = "math-card";

  const qEl = document.createElement("div");
  qEl.className = "math-question";
  qEl.textContent = q.text;

  const meta = document.createElement("div");
  meta.className = "quiz-meta";
  meta.textContent = `Câu ${s.index + 1}/${total}`;

  const optionsWrap = document.createElement("div");
  optionsWrap.className = "math-options";

  let locked = false;

  q.options.forEach((val, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "math-option";
    btn.textContent = val;

    btn.addEventListener("click", () => {
      if (locked) return;
      locked = true;

      if (idx === q.correctIndex) {
        s.correct++;
        btn.classList.add("correct", "correct-glow");
        playSoftBell();
        setTimeout(nextMathQuestion, 550);
      } else {
        s.wrong++;
        localStorage.setItem('stage_3_wrong', String(s.wrong));
        if (s.wrong >= 3) {
          localStorage.setItem('stage_3_status', 'fail');
        }
        footer.textContent = `Đúng: ${s.correct} · Sai: ${s.wrong}`;
        btn.classList.add("wrong", "wrong-shake");
        playClick(450, 0.08, 0.2);
        setTimeout(() => {
          locked = false;
          btn.classList.add("disabled");
        }, 360);
      }
    });

    optionsWrap.appendChild(btn);
  });

  const footer = document.createElement("div");
  footer.className = "quiz-footer";
  footer.textContent = `Đúng: ${s.correct} · Sai: ${s.wrong}`;

  card.append(qEl, meta, optionsWrap, footer);
  view.append(header, card);
}

function nextMathQuestion() {
  const s = AppState.math;
  if (s.index < s.questions.length - 1) {
    s.index++;
    renderMathStage();
  } else {
    triggerFireworksBurst(4, 220);
    playVictoryChord();
    showFlash();
    localStorage.setItem('stage_3_status', 'pass');
    setStage(4);
  }
}

// ==============================
// Stage 4 – Ô TÍNH (external stage)
// ==============================

async function renderOTinhStage() {
  clearStageContainer();
  const view = createStageView("o-tinh-stage");
  view.style.overflowY = "auto";

  const header = document.createElement("div");
  header.className = "stage-header";
  header.innerHTML = `
    <div>
      <div class="stage-title">Màn 4 · Ô TÍNH</div>
      <div class="stage-sub">Rút que 1–3, ai rút que cuối cùng là thua. Chúc bạn may mắn!</div>
    </div>
  `;

  const holder = document.createElement("div");
  holder.style.height = "auto";
  holder.style.marginTop = "8px";
  holder.style.position = "relative";
  holder.style.overflowY = "auto";
  holder.style.borderRadius = "16px";
  holder.style.border = "1px solid rgba(255, 201, 151, 0.55)";
  holder.style.background =
    "linear-gradient(145deg, rgba(60, 0, 7, 0.82), rgba(110, 0, 20, 0.82))";

  const loading = document.createElement("div");
  loading.style.position = "absolute";
  loading.style.inset = "0";
  loading.style.display = "grid";
  loading.style.placeItems = "center";
  loading.style.color = "#ffe9c4";
  loading.style.opacity = "0.9";
  loading.textContent = "Đang tải Ô TÍNH...";

  holder.appendChild(loading);
  view.append(header, holder);

  // Listen for completion from the game
  const onComplete = () => {
    window.removeEventListener("oTinh:complete", onComplete);
    triggerFireworksBurst(4, 220);
    playVictoryChord();
    showFlash();
    setStage(5);
  };
  window.addEventListener("oTinh:complete", onComplete, { once: true });

  try {
    await injectStageHtmlInto(holder, "games/o-tinh/o-tinh.html");
    loading.remove();
  } catch (err) {
    loading.textContent = "Tải game thất bại. Vui lòng F5 để thử lại.";
    console.error(err);
  }
}

// ==============================
// Stage 5 – Đập Niêu (external stage)
// ==============================

async function renderDapNieuStage() {
  clearStageContainer();
  const view = createStageView("dap-nieu-stage");
  view.style.overflowY = "auto";

  const header = document.createElement("div");
  header.className = "stage-header";
  header.innerHTML = `
    <div>
      <div class="stage-title">Màn 5 · Đập Niêu</div>
      <div class="stage-sub">Canh đúng lúc để đập trúng niêu. Trúng là thắng!</div>
    </div>
  `;

  const holder = document.createElement("div");
  holder.style.height = "auto";
  holder.style.marginTop = "8px";
  holder.style.position = "relative";
  holder.style.overflowY = "auto";
  holder.style.borderRadius = "16px";
  holder.style.border = "1px solid rgba(255, 201, 151, 0.55)";
  holder.style.background =
    "linear-gradient(145deg, rgba(60, 0, 7, 0.82), rgba(110, 0, 20, 0.82))";

  const loading = document.createElement("div");
  loading.style.position = "absolute";
  loading.style.inset = "0";
  loading.style.display = "grid";
  loading.style.placeItems = "center";
  loading.style.color = "#ffe9c4";
  loading.style.opacity = "0.9";
  loading.textContent = "Đang tải Đập Niêu...";

  holder.appendChild(loading);
  view.append(header, holder);

  const onComplete = () => {
    window.removeEventListener("dapNieu:complete", onComplete);
    triggerFireworksBurst(4, 220);
    playVictoryChord();
    showFlash();
    setStage(6);
  };
  window.addEventListener("dapNieu:complete", onComplete, { once: true });

  try {
    await injectStageHtmlInto(holder, "games/dap-nieu/dap-nieu.html");
    loading.remove();
  } catch (err) {
    loading.textContent = "Tải game thất bại. Vui lòng F5 để thử lại.";
    console.error(err);
  }
}

// ==============================
// Stage 6 – Bốc Lì Xì (external stage)
// ==============================

async function renderBocLiXiStage() {
  clearStageContainer();
  const view = createStageView("boc-li-xi-stage");

  const header = document.createElement("div");
  header.className = "stage-header";
  header.innerHTML = `
    <div>
      <div class="stage-title">Màn 6 · Bốc Lì Xì</div>
      <div class="stage-sub">Bốc 5 bao lì xì. Không thua vòng nào thì tổng tiền ×2!</div>
    </div>
  `;

  const holder = document.createElement("div");
  holder.style.height = "calc(100% - 38px)";
  holder.style.marginTop = "8px";
  holder.style.position = "relative";
  holder.style.overflow = "hidden";
  holder.style.borderRadius = "16px";
  holder.style.border = "1px solid rgba(255, 201, 151, 0.55)";
  holder.style.background =
    "linear-gradient(145deg, rgba(60, 0, 7, 0.82), rgba(110, 0, 20, 0.82))";

  const loading = document.createElement("div");
  loading.style.position = "absolute";
  loading.style.inset = "0";
  loading.style.display = "grid";
  loading.style.placeItems = "center";
  loading.style.color = "#ffe9c4";
  loading.style.opacity = "0.9";
  loading.textContent = "Đang tải Bốc Lì Xì...";

  holder.appendChild(loading);
  view.append(header, holder);

  // Listen for completion from the game
  const onComplete = () => {
    window.removeEventListener("bocLiXi:complete", onComplete);
    triggerFireworksBurst(4, 220);
    playVictoryChord();
    showFlash();
    setStage("final");
  };
  window.addEventListener("bocLiXi:complete", onComplete, { once: true });

  try {
    await injectStageHtmlInto(holder, "games/boc-li-xi/boc-li-xi.html");
    loading.remove();
  } catch (err) {
    loading.textContent = "Tải game thất bại. Vui lòng F5 để thử lại.";
    console.error(err);
  }
}

// ==============================
// Final screen
// ==============================

function renderFinalStage() {
  clearStageContainer();
  const view = createStageView("final-stage");

  const title = document.createElement("h2");
  title.className = "final-title";
  title.textContent = "Chúc Mừng Năm Mới!";

  const summary = document.createElement("p");
  summary.className = "final-summary";
  summary.innerHTML = `
    Bạn đã hoàn thành cả 5 mini game:
    <br/>· Câu Hỏi Ngày Tết: ${AppState.quiz.correct} đúng, ${AppState.quiz.wrong} sai
    <br/>· Lật Thẻ May Mắn: ${AppState.cards.matches} cặp, ${AppState.cards.flips} lượt lật
    <br/>· Thử Thách Toán Học: ${AppState.math.correct} đúng, ${AppState.math.wrong} sai
    <br/>· Ô TÍNH: ${localStorage.getItem('stage_4_result') === 'pass' ? 'Thắng' : 'Thua'}
    <br/>· Đập Niêu: ${localStorage.getItem('stage_5_result') === 'pass' ? 'Thắng' : 'Thua'}
    <br/><br/>Chúc bạn và gia đình một năm mới an khang, thịnh vượng, vạn sự như ý!
  `;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn-primary";
  btn.textContent = "Chơi Lại Từ Đầu";

  btn.addEventListener("click", () => resetGame());

  view.append(title, summary, btn);
}

// ==============================
// Render dispatcher
// ==============================

function renderStage() {
  if (AppState.stage === "start") {
    renderStartScreen();
  } else if (AppState.stage === 1) {
    renderQuizStage();
  } else if (AppState.stage === 2) {
    renderCardStage();
  } else if (AppState.stage === 3) {
    renderMathStage();
  } else if (AppState.stage === 4) {
    renderOTinhStage();
  } else if (AppState.stage === 5) {
    renderDapNieuStage();
  } else if (AppState.stage === 6) {
    renderBocLiXiStage();
  } else if (AppState.stage === "final") {
    renderFinalStage();
  }
}

// ==============================
// Reset & init
// ==============================

function resetGame() {
  // Clear stage history
  ['stage_1_status', 'stage_2_status', 'stage_3_status', 'stage_4_status', 'stage_5_status', 
   'stage_4_result', 'stage_5_result', 'li_xi_total_money'].forEach(k => localStorage.removeItem(k));

  AppState.stage = "start";

  AppState.quiz = {
    questions: buildQuizQuestions(),
    index: 0,
    correct: 0,
    wrong: 0
  };

  AppState.cards = {
    items: createCardItems(),
    flips: 0,
    matches: 0
  };

  AppState.math = {
    questions: buildMathQuestions(),
    index: 0,
    correct: 0,
    wrong: 0
  };

  updateStagePills();
  renderStage();
}

// Initialize music toggle state from localStorage
(() => {
  const saved = localStorage.getItem("music_enabled");
  AppState.audio.enabled = saved === "on";
  musicLabel.textContent = AppState.audio.enabled ? "Nhạc: Bật" : "Nhạc: Tắt";
})();
// Intro overlay (first-time)
function showIntroOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'intro-overlay';
  const card = document.createElement('div');
  card.className = 'intro-card';
  card.innerHTML = `
    <div class="intro-title">Giới Thiệu Trò Chơi</div>
    <div class="intro-sub">Bạn sẽ trải qua 5 mini game theo thứ tự, kết quả ảnh hưởng tới vòng thưởng Bốc Lì Xì.</div>
    <div class="intro-list">
      <div class="intro-item">
        <div class="intro-item-title">Màn 1 · Câu Hỏi Ngày Tết</div>
        <div class="intro-item-desc">Trả lời đúng các câu hỏi về Tết Việt. Sai từ <strong>3 câu</strong> trở lên là thua màn.</div>
      </div>
      <div class="intro-item">
        <div class="intro-item-title">Màn 2 · Lật Thẻ May Mắn</div>
        <div class="intro-item-desc">Lật và ghép đủ 3 cặp biểu tượng may mắn để qua màn.</div>
      </div>
      <div class="intro-item">
        <div class="intro-item-title">Màn 3 · Thử Thách Toán Học</div>
        <div class="intro-item-desc">Giải phép tính cơ bản. Sai từ <strong>3 câu</strong> trở lên là thua màn.</div>
      </div>
      <div class="intro-item">
        <div class="intro-item-title">Màn 4 · Ô TÍNH</div>
        <div class="intro-item-desc">Rút 1–3 que, ai rút que cuối cùng là thua. Cố gắng không thua màn!</div>
      </div>
      <div class="intro-item">
        <div class="intro-item-title">Màn 5 · Đập Niêu</div>
        <div class="intro-item-desc">Canh thời điểm để đập trúng niêu. Trúng là thắng màn.</div>
      </div>
    </div>
    <div class="intro-item">
      <div class="intro-item-title">Vòng Thưởng · Bốc Lì Xì</div>
      <div class="intro-item-desc">Nếu <strong>thắng tất cả 5 màn</strong> trước đó → được bốc <strong>2 lần</strong>. Nếu <strong>thua bất kỳ màn nào</strong> → chỉ được bốc <strong>1 lần</strong>. Tiền nhận được hiển thị rõ trong kết quả cuối.</div>
    </div>
    <div class="intro-footer">
      <button type="button" class="btn-primary" id="introStartBtn">Tôi đã hiểu · Bắt đầu chơi</button>
    </div>
  `;
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  const btn = card.querySelector('#introStartBtn');
  btn.addEventListener('click', () => {
    if (!bgAudio) {
      bgAudio = new Audio("assets/music.mp3");
      bgAudio.loop = true;
      bgAudio.volume = 0.35;
      bgAudio.preload = "auto";
    }
    bgAudio.play().catch(() => {});
    AppState.audio.enabled = true;
    localStorage.setItem("music_enabled", "on");
    musicLabel.textContent = "Nhạc: Bật";
    overlay.remove();
    resetGame();
  });
}

// Initial setup: show intro if not seen
(function() {
  showIntroOverlay();
})();
