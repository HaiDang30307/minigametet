/* ==============================
   Stage 5: ĐẬP NIÊU (timing game)
   Vanilla JS, self-contained (no dependency on global vars).
   - Player presses "Hit" to strike when pot is in target window
   - 3 attempts, win/lose with SFX + confetti
   - Autoplay-safe background music (after user gesture)
   ============================== */

(() => {
  "use strict";

  class TinyAudio {
    constructor() {
      /** @type {AudioContext|null} */
      this.ctx = null;
      this.enabled = false;
      this.unlocked = false;
      this._bgTimer = 0;
      this._bgRunning = false;
    }

    ensureCtx() {
      if (this.ctx) return this.ctx;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      return this.ctx;
    }

    unlock() {
      const ctx = this.ensureCtx();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      this.unlocked = true;
    }

    setEnabled(on) {
      this.enabled = !!on;
      if (!this.enabled) this.stopBg();
      if (this.enabled && this.unlocked) this.startBg();
    }

    tone(type, freq, dur, gain = 0.14) {
      if (!this.enabled) return;
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(gain, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    }

    sfxSwing() {
      if (!this.enabled) return;
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.12);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.11, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      osc.connect(g).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    }

    sfxHit() {
      // a short "clay" thunk
      this.tone("square", 140, 0.12, 0.16);
      this.tone("triangle", 220, 0.08, 0.08);
    }

    sfxMiss() {
      this.tone("sine", 220, 0.18, 0.12);
      this.tone("sine", 160, 0.22, 0.08);
    }

    sfxWin() {
      if (!this.enabled) return;
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const start = now + i * 0.05;
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, start);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.18, start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
        osc.connect(g).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.62);
      });
    }

    sfxLose() {
      if (!this.enabled) return;
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.35);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      osc.connect(g).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.44);
    }

    startBg() {
      if (!this.enabled || !this.unlocked) return;
      if (this._bgRunning) return;
      this._bgRunning = true;

      const loop = () => {
        if (!this.enabled || !this.unlocked) {
          this._bgRunning = false;
          return;
        }
        const ctx = this.ensureCtx();
        if (!ctx) {
          this._bgRunning = false;
          return;
        }

        // Festive "folk-ish" pentatonic loop (simple pad)
        const now = ctx.currentTime;
        const base = 220; // A3
        const seq = [
          base,
          base * (9 / 8),
          base * (5 / 4),
          base * (3 / 2),
          base * (5 / 4),
          base * (9 / 8)
        ];

        seq.forEach((f, i) => {
          const start = now + i * 0.34;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(f, start);
          g.gain.setValueAtTime(0.0001, start);
          g.gain.exponentialRampToValueAtTime(0.055, start + 0.05);
          g.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
          osc.connect(g).connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.34);
        });

        this._bgTimer = window.setTimeout(loop, 2100);
      };

      loop();
    }

    stopBg() {
      if (this._bgTimer) window.clearTimeout(this._bgTimer);
      this._bgTimer = 0;
      this._bgRunning = false;
    }
  }

  class DapNieuGame {
    /**
     * @param {HTMLElement} root
     */
    constructor(root) {
      this.root = root;

      // UI refs
      this.arenaEl = root.querySelector('[data-role="arena"]');
      this.targetEl = root.querySelector('[data-role="target"]');
      this.potEl = root.querySelector('[data-role="pot"]');
      this.toastEl = root.querySelector('[data-role="toast"]');
      this.hitFxEl = root.querySelector('[data-role="hitFx"]');
      this.confettiEl = root.querySelector('[data-role="confetti"]');
      this.modalEl = root.querySelector('[data-role="modal"]');
      this.modalTitleEl = root.querySelector('[data-role="modalTitle"]');
      this.modalMsgEl = root.querySelector('[data-role="modalMsg"]');
      this.attemptsEl = root.querySelector('[data-role="attempts"]');
      this.difficultyEl = root.querySelector('[data-role="difficulty"]');
      this.hintEl = root.querySelector('[data-role="hint"]');
      this.musicBtn = root.querySelector('[data-action="toggleMusic"]');
      this.musicLabel = root.querySelector(".dap-nieu__musicLabel");
      this.hitBtn = root.querySelector('[data-action="hit"]');

      this.audio = new TinyAudio();

      // state
      this.attemptsMax = 3;
      this.attemptsLeft = 3;
      this.over = false;
      this.locked = false;
      this._toastTimer = 0;

      // animation model for pot swing (JS-driven for accurate hit detection)
      this._raf = 0;
      this._t0 = performance.now();
      this.swing = {
        amplitudePx: 0,
        periodMs: 2100,
        phase: Math.random() * Math.PI * 2,
        bobPx: 10
      };
      this.target = {
        centerX: 0,
        radiusPx: 0
      };

      // bind
      this._onRootClick = (e) => this.onRootClick(e);
      this._onPointerDown = () => this.audio.unlock();
      this._onResize = () => this.recalc();

      // attach
      root.addEventListener("click", this._onRootClick);
      root.addEventListener("pointerdown", this._onPointerDown, { once: true });
      window.addEventListener("resize", this._onResize);

      this.restart();
      this.startLoop();
    }

    destroy() {
      this.root.removeEventListener("click", this._onRootClick);
      window.removeEventListener("resize", this._onResize);
      this.audio.stopBg();
      if (this._toastTimer) window.clearTimeout(this._toastTimer);
      this._toastTimer = 0;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
    }

    rand(min, max) {
      return Math.random() * (max - min) + min;
    }

    setToast(msg, ms = 1200) {
      if (!this.toastEl) return;
      if (this._toastTimer) window.clearTimeout(this._toastTimer);
      this.toastEl.textContent = msg;
      this.toastEl.classList.add("is-show");
      this._toastTimer = window.setTimeout(() => {
        this.toastEl.classList.remove("is-show");
      }, ms);
    }

    setModalOpen(open) {
      if (!this.modalEl) return;
      if (open) {
        this.modalEl.classList.add("is-open");
        this.modalEl.setAttribute("aria-hidden", "false");
      } else {
        this.modalEl.classList.remove("is-open");
        this.modalEl.setAttribute("aria-hidden", "true");
      }
    }

    updateHud() {
      if (this.attemptsEl) this.attemptsEl.textContent = `Lượt còn: ${this.attemptsLeft}`;
      if (this.difficultyEl) this.difficultyEl.textContent = "Độ khó: Vừa";
      if (this.hitBtn) this.hitBtn.disabled = this.over || this.locked || this.attemptsLeft <= 0;
    }

    recalc() {
      if (!this.arenaEl || !this.targetEl) return;
      const arenaRect = this.arenaEl.getBoundingClientRect();
      const targetRect = this.targetEl.getBoundingClientRect();

      // swing amplitude depends on arena width
      const w = arenaRect.width || 600;
      this.swing.amplitudePx = Math.max(90, Math.min(220, w * 0.24));
      this.swing.periodMs = Math.max(1700, Math.min(2600, w * 3.1));
      this.swing.bobPx = Math.max(8, Math.min(16, w * 0.02));

      // target position & radius (in arena coordinate)
      const centerX = (targetRect.left + targetRect.width / 2) - arenaRect.left;
      const radius = Math.min(targetRect.width, targetRect.height) * 0.22;
      this.target.centerX = centerX;
      this.target.radiusPx = Math.max(18, radius);
    }

    restart() {
      this.over = false;
      this.locked = false;
      this.attemptsLeft = this.attemptsMax;
      this.swing.phase = Math.random() * Math.PI * 2;
      this._t0 = performance.now();
      this.setModalOpen(false);
      this.updateHud();
      this.recalc();
      if (this.hintEl) this.hintEl.textContent = "Bấm “Đập!” khi niêu vào vòng vàng.";
      this.setToast("Canh thời điểm nhé!", 1200);
    }

    // current pot position in arena coordinates
    potXAt(timeNow) {
      const t = (timeNow - this._t0) / this.swing.periodMs;
      // smooth back-and-forth
      return Math.sin(t * Math.PI * 2 + this.swing.phase) * this.swing.amplitudePx;
    }

    potAngleAt(timeNow) {
      const t = (timeNow - this._t0) / this.swing.periodMs;
      return Math.sin(t * Math.PI * 2 + this.swing.phase) * 10; // degrees
    }

    potBobAt(timeNow) {
      const t = (timeNow - this._t0) / (this.swing.periodMs * 0.9);
      return Math.sin(t * Math.PI * 2 + this.swing.phase * 0.6) * this.swing.bobPx;
    }

    startLoop() {
      const tick = () => {
        const now = performance.now();
        this.renderPot(now);
        this._raf = requestAnimationFrame(tick);
      };
      this._raf = requestAnimationFrame(tick);
    }

    renderPot(now) {
      if (!this.potEl) return;
      const x = this.potXAt(now);
      const ang = this.potAngleAt(now);
      const bob = this.potBobAt(now);
      this.potEl.style.transform = `translate(calc(-50% + ${x.toFixed(2)}px), calc(-50% + ${bob.toFixed(
        2
      )}px)) rotate(${ang.toFixed(2)}deg)`;
    }

    spawnSpark() {
      if (!this.hitFxEl) return;
      this.hitFxEl.innerHTML = "";
      const s = document.createElement("div");
      s.className = "dap-nieu__spark";
      this.hitFxEl.appendChild(s);
      window.setTimeout(() => {
        if (this.hitFxEl) this.hitFxEl.innerHTML = "";
      }, 650);
    }

    spawnConfetti(n = 110) {
      if (!this.confettiEl) return;
      this.confettiEl.innerHTML = "";
      const colors = ["#ffd36a", "#ffb000", "#fff2d2", "#ff4b6e", "#ff7b00"];
      const w = this.root.clientWidth || 600;
      for (let i = 0; i < n; i++) {
        const p = document.createElement("div");
        p.className = "dap-nieu__confettiPiece";
        const left = (Math.random() * 100).toFixed(2) + "%";
        const dx = ((Math.random() * 2 - 1) * (w * 0.18)).toFixed(0) + "px";
        const dur = (900 + Math.random() * 900).toFixed(0) + "ms";
        const color = colors[(Math.random() * colors.length) | 0];
        p.style.left = left;
        p.style.background = color;
        p.style.setProperty("--dn-dx", dx);
        p.style.setProperty("--dn-fall", dur);
        this.confettiEl.appendChild(p);
      }
      window.setTimeout(() => {
        if (this.confettiEl) this.confettiEl.innerHTML = "";
      }, 2100);
    }

    endGame(playerWon) {
      this.over = true;
      this.locked = false;
      this.updateHud();

      // Save status for Stage 6
      const result = playerWon ? 'pass' : 'fail';
      localStorage.setItem('stage_5_status', result);
      localStorage.setItem('stage_5_result', result);

      const title = playerWon ? "Bạn thắng!" : "Bạn thua!";
      const msg = playerWon
        ? "Bạn đã đập trúng niêu. Lộc đến rồi!"
        : "Bạn đã hết lượt mà chưa trúng niêu. Thử lại nhé!";

      if (this.modalTitleEl) this.modalTitleEl.textContent = title;
      if (this.modalMsgEl) this.modalMsgEl.textContent = msg;
      this.setModalOpen(true);

      if (playerWon) {
        this.audio.sfxWin();
        this.spawnConfetti(130);
      } else {
        this.audio.sfxLose();
      }
    }

    tryHit() {
      if (this.over || this.locked) return;
      if (this.attemptsLeft <= 0) return;

      this.locked = true;
      this.updateHud();
      this.audio.sfxSwing();

      // capture position at click time for fair hit detection
      const now = performance.now();
      this.recalc();

      // Convert pot current offset to arena coordinate:
      // pot's base left is 50% of arena + x offset
      const arenaRect = this.arenaEl.getBoundingClientRect();
      const potRect = this.potEl.getBoundingClientRect();
      const potCenterX = (potRect.left + potRect.width / 2) - arenaRect.left;

      const dist = Math.abs(potCenterX - this.target.centerX);
      const hit = dist <= this.target.radiusPx;

      // small impact delay
      window.setTimeout(() => {
        this.spawnSpark();
        if (hit) {
          this.audio.sfxHit();
          this.setToast("Trúng rồi!", 1200);
          if (this.hintEl) this.hintEl.textContent = "Chúc mừng! Bạn đã đập trúng niêu.";
          this.endGame(true);
          return;
        }

        this.attemptsLeft -= 1;
        this.audio.sfxMiss();
        this.updateHud();

        if (this.attemptsLeft <= 0) {
          this.setToast("Hết lượt!", 1100);
          if (this.hintEl) this.hintEl.textContent = "Bạn đã hết lượt.";
          this.endGame(false);
          return;
        }

        this.setToast(`Trượt! Còn ${this.attemptsLeft} lượt.`, 1200);
        if (this.hintEl) this.hintEl.textContent = "Chưa trúng. Canh lại khi niêu vào vòng vàng.";
        this.locked = false;
        this.updateHud();
      }, 160);
    }

    onToggleMusic() {
      this.audio.unlock();
      const next = !this.audio.enabled;
      this.audio.setEnabled(next);
      if (this.musicBtn) this.musicBtn.setAttribute("aria-pressed", next ? "true" : "false");
      if (this.musicLabel) this.musicLabel.textContent = next ? "Nhạc: Bật" : "Nhạc: Tắt";
      this.setToast(next ? "Nhạc nền: Bật" : "Nhạc nền: Tắt", 900);
    }

    requestComplete() {
      this.root.dispatchEvent(new CustomEvent("dapNieu:complete", { bubbles: true }));
    }

    onRootClick(e) {
      const target = /** @type {HTMLElement} */ (e.target);
      if (!target) return;

      const musicBtn = target.closest('[data-action="toggleMusic"]');
      if (musicBtn) {
        this.onToggleMusic();
        return;
      }

      const actionBtn = target.closest("[data-action]");
      if (actionBtn) {
        const act = actionBtn.getAttribute("data-action");
        if (act === "hit") {
          this.audio.unlock();
          this.tryHit();
          return;
        }
        if (act === "restart" || act === "restartFromModal") {
          this.audio.unlock();
          this.restart();
          return;
        }
        if (act === "complete" || act === "completeFromModal") {
          this.requestComplete();
          return;
        }
      }
    }
  }

  function boot() {
    const root = document.getElementById("dapNieuRoot");
    if (!root) return;

    // Prevent double init
    if (root.__dapNieuInstance) {
      try {
        root.__dapNieuInstance.destroy();
      } catch (_) {}
      root.__dapNieuInstance = null;
    }

    const game = new DapNieuGame(root);
    root.__dapNieuInstance = game;

    const obs = new MutationObserver(() => {
      if (!document.body.contains(root)) {
        try {
          game.destroy();
        } catch (_) {}
        obs.disconnect();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

