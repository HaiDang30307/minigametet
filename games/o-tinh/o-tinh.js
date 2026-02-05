/* ==============================
   Stage 4: Ô TÍNH (misère stick game)
   Vanilla JS, self-contained (no dependency on global vars).
   It finds #oTinhRoot inside the injected HTML and runs the game.
   ============================== */

(() => {
  "use strict";

  /**
   * Audio: lightweight WebAudio synth.
   * - Respect autoplay policy: only start after a user gesture.
   * - Independent from the site's global music toggle.
   */
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
      // Resume if suspended
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      this.unlocked = true;
    }

    setEnabled(on) {
      this.enabled = !!on;
      if (!this.enabled) this.stopBg();
      if (this.enabled && this.unlocked) this.startBg();
    }

    // Simple pluck-like sound
    sfxTake() {
      if (!this.enabled) return;
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const f = 700 + Math.random() * 250;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.6, now + 0.08);

      g.gain.setValueAtTime(0.001, now);
      g.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(g).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    }

    sfxTurn() {
      if (!this.enabled) return;
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.setValueAtTime(760, now + 0.06);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.14, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      osc.connect(g).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    }

    sfxWin() {
      if (!this.enabled) return;
      const ctx = this.ensureCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const start = now + i * 0.05;
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, start);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.16, start + 0.01);
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
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(130, now + 0.35);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      osc.connect(g).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.42);
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

        // A tiny pentatonic-ish pad (folk-ish) as background.
        // Not a real song; just a festive loop.
        const now = ctx.currentTime;
        const base = 196; // G3
        const seq = [
          base,
          base * (9 / 8),
          base * (5 / 4),
          base * (3 / 2),
          base * (5 / 4),
          base * (9 / 8)
        ];

        seq.forEach((f, i) => {
          const start = now + i * 0.38;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(f, start);
          g.gain.setValueAtTime(0.0001, start);
          g.gain.exponentialRampToValueAtTime(0.06, start + 0.05);
          g.gain.exponentialRampToValueAtTime(0.0001, start + 0.36);
          osc.connect(g).connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.38);
        });

        // Schedule next
        this._bgTimer = window.setTimeout(loop, 2300);
      };

      loop();
    }

    stopBg() {
      if (this._bgTimer) window.clearTimeout(this._bgTimer);
      this._bgTimer = 0;
      this._bgRunning = false;
    }
  }

  /**
   * Game: misère take-away on multiple piles.
   * Rule: take 1-3 from one pile. Player who takes last stick LOSES.
   */
  class OTinhGame {
    /**
     * @param {HTMLElement} root
     */
    constructor(root) {
      this.root = root;

      // UI refs
      this.boardEl = root.querySelector('[data-role="board"]');
      this.toastEl = root.querySelector('[data-role="toast"]');
      this.confettiEl = root.querySelector('[data-role="confetti"]');
      this.modalEl = root.querySelector('[data-role="modal"]');
      this.modalTitleEl = root.querySelector('[data-role="modalTitle"]');
      this.modalMsgEl = root.querySelector('[data-role="modalMsg"]');
      this.turnBadgeEl = root.querySelector('[data-role="turnBadge"]');
      this.hintEl = root.querySelector('[data-role="hint"]');
      this.totalEl = root.querySelector('[data-role="total"]');
      this.pilesEl = root.querySelector('[data-role="piles"]');
      this.musicBtn = root.querySelector('[data-action="toggleMusic"]');
      this.musicLabel = root.querySelector(".o-tinh__musicLabel");

      /** @type {TinyAudio} */
      this.audio = new TinyAudio();

      // state
      this.piles = [];
      this.turn = "player"; // "player" | "cpu"
      this.selectedPile = -1;
      this.selectedTake = 1;
      this.locked = false;
      this.over = false;
      this._toastTimer = 0;

      // bind handlers
      this._onRootClick = (e) => this.onRootClick(e);
      this._onPointerDown = () => this.audio.unlock();

      // attach
      this.root.addEventListener("click", this._onRootClick);
      this.root.addEventListener("pointerdown", this._onPointerDown, { once: true });

      this.restart();
    }

    destroy() {
      this.root.removeEventListener("click", this._onRootClick);
      // pointerdown was once-only; no need to remove
      this.audio.stopBg();
      if (this._toastTimer) window.clearTimeout(this._toastTimer);
      this._toastTimer = 0;
    }

    randInt(min, max) {
      return (Math.random() * (max - min + 1) + min) | 0;
    }

    setupRandomPiles() {
      // 5–7 piles, each 4–9 sticks
      const pileCount = this.randInt(5, 7);
      const piles = [];
      for (let i = 0; i < pileCount; i++) {
        piles.push(this.randInt(4, 9));
      }
      // Ensure not trivially small
      if (piles.reduce((a, b) => a + b, 0) < pileCount * 5) {
        piles[0] += 3;
      }
      return piles;
    }

    restart() {
      this.piles = this.setupRandomPiles();
      this.turn = "player";
      this.selectedPile = -1;
      this.selectedTake = 1;
      this.locked = false;
      this.over = false;
      this.setModalOpen(false);
      this.updateTakeChips();
      this.render();
      this.setToast("Tới lượt bạn. Chọn một ô, rồi rút 1–3 que.", 1600);
      this.syncTurnUI();
    }

    totalSticks() {
      return this.piles.reduce((a, b) => a + b, 0);
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

    syncTurnUI() {
      const isPlayer = this.turn === "player";
      if (this.turnBadgeEl) {
        this.turnBadgeEl.textContent = `Lượt: ${isPlayer ? "Bạn" : "Máy"}`;
        this.turnBadgeEl.classList.toggle("o-tinh__badge--cpu", !isPlayer);
      }
      if (this.hintEl) {
        if (this.over) this.hintEl.textContent = "Ván đã kết thúc.";
        else if (isPlayer) this.hintEl.textContent = "Chọn một ô và số que (1–3) để rút.";
        else this.hintEl.textContent = "Máy đang suy nghĩ...";
      }
    }

    updateStats() {
      if (this.totalEl) this.totalEl.textContent = String(this.totalSticks());
      if (this.pilesEl) this.pilesEl.textContent = String(this.piles.length);
    }

    updateTakeChips() {
      const chips = this.root.querySelectorAll(".o-tinh__chip");
      chips.forEach((btn) => {
        const take = parseInt(btn.getAttribute("data-take") || "1", 10);
        const pressed = take === this.selectedTake;
        btn.setAttribute("aria-pressed", pressed ? "true" : "false");
      });
      this.updateTakeDisabled();
    }

    updateTakeDisabled() {
      const chips = this.root.querySelectorAll(".o-tinh__chip");
      const pile = this.selectedPile >= 0 ? this.piles[this.selectedPile] : 0;
      chips.forEach((btn) => {
        const take = parseInt(btn.getAttribute("data-take") || "1", 10);
        const disabled =
          this.over ||
          this.locked ||
          this.turn !== "player" ||
          this.selectedPile < 0 ||
          pile <= 0 ||
          take > 3 ||
          take > pile;
        btn.disabled = disabled;
      });
    }

    render() {
      if (!this.boardEl) return;
      this.boardEl.innerHTML = "";

      this.piles.forEach((count, idx) => {
        const pileBtn = document.createElement("button");
        pileBtn.type = "button";
        pileBtn.className = "o-tinh__pile";
        pileBtn.setAttribute("data-pile", String(idx));
        pileBtn.setAttribute("aria-disabled", count <= 0 ? "true" : "false");
        pileBtn.disabled = this.over || this.locked || count <= 0;
        pileBtn.classList.toggle("is-selected", idx === this.selectedPile);

        const top = document.createElement("div");
        top.className = "o-tinh__pileTop";
        top.innerHTML = `
          <div class="o-tinh__pileName">Ô ${idx + 1}</div>
          <div class="o-tinh__pileCount">${count}</div>
        `;

        const sticks = document.createElement("div");
        sticks.className = "o-tinh__sticks";

        // Draw up to 18 "visual sticks" (compact); represent more via tag
        const show = Math.min(count, 18);
        for (let i = 0; i < show; i++) {
          const s = document.createElement("div");
          s.className = "o-tinh__stick";
          sticks.appendChild(s);
        }

        const bottom = document.createElement("div");
        bottom.className = "o-tinh__pileBottom";

        const tag = document.createElement("div");
        tag.className = "o-tinh__pileTag";
        tag.textContent = count <= 0 ? "Hết que" : "Còn que";

        const sub = document.createElement("div");
        sub.style.opacity = "0.85";
        sub.textContent = count > 18 ? `+${count - 18} que` : " ";

        bottom.append(tag, sub);
        pileBtn.append(top, sticks, bottom);
        this.boardEl.appendChild(pileBtn);
      });

      this.updateStats();
      this.updateTakeDisabled();
    }

    // Determine winner given a move that makes total==0:
    // Rule: player who takes last stick loses.
    endGame(lastTaker) {
      this.over = true;
      this.locked = false;
      this.selectedPile = -1;
      this.render();
      this.syncTurnUI();

      const playerWon = lastTaker === "cpu"; // if CPU took last => CPU loses => player wins
      
      // Save status for Stage 6
      const result = playerWon ? 'pass' : 'fail';
      localStorage.setItem('stage_4_status', result);
      localStorage.setItem('stage_4_result', result);

      const title = playerWon ? "Bạn thắng!" : "Bạn thua!";
      const msg = playerWon
        ? "Máy vừa rút que cuối cùng nên máy thua. Chúc mừng bạn!"
        : "Bạn vừa rút que cuối cùng nên bạn thua. Thử lại nhé!";

      if (this.modalTitleEl) this.modalTitleEl.textContent = title;
      if (this.modalMsgEl) this.modalMsgEl.textContent = msg;
      this.setModalOpen(true);

      if (playerWon) {
        this.audio.sfxWin();
        this.spawnConfetti(120);
      } else {
        this.audio.sfxLose();
      }
    }

    spawnConfetti(n = 90) {
      if (!this.confettiEl) return;
      this.confettiEl.innerHTML = "";
      const colors = ["#ffd36a", "#ffb000", "#fff2d2", "#ff4b6e", "#ff7b00"];

      const w = this.root.clientWidth || 600;
      for (let i = 0; i < n; i++) {
        const p = document.createElement("div");
        p.className = "o-tinh__confettiPiece";
        const left = (Math.random() * 100).toFixed(2) + "%";
        const dx = ((Math.random() * 2 - 1) * (w * 0.18)).toFixed(0) + "px";
        const dur = (900 + Math.random() * 900).toFixed(0) + "ms";
        const color = colors[(Math.random() * colors.length) | 0];
        p.style.left = left;
        p.style.background = color;
        p.style.setProperty("--ot-dx", dx);
        p.style.setProperty("--ot-fall", dur);
        p.style.transform = `translateY(-20px) rotate(${(Math.random() * 180) | 0}deg)`;
        this.confettiEl.appendChild(p);
      }

      // clear after animation
      window.setTimeout(() => {
        if (this.confettiEl) this.confettiEl.innerHTML = "";
      }, 2100);
    }

    // CPU strategy (good play, misère-aware for endgame)
    cpuChooseMove() {
      const piles = this.piles;
      const nonEmpty = [];
      for (let i = 0; i < piles.length; i++) {
        if (piles[i] > 0) nonEmpty.push(i);
      }

      // Endgame special: if all piles are size 1
      const allOnes = nonEmpty.every((i) => piles[i] === 1);
      if (allOnes) {
        // In misère with only 1s: you want to leave odd number of 1s to opponent.
        // Here each move can only remove 1 from a single pile (since size==1).
        // So best is: if count of ones is even, take 1 (leave odd); else forced take 1 (leave even).
        return { pile: nonEmpty[0], take: 1 };
      }

      // If there is exactly one pile with >1, treat as misère variant:
      const big = nonEmpty.filter((i) => piles[i] > 1);
      if (big.length === 1) {
        const bigIdx = big[0];
        const onesCount = nonEmpty.length - 1;
        // We want to leave opponent with an odd number of 1-piles (so they are forced to take last).
        // If big pile is size k, we can reduce it to 1 by taking k-1 (cap 3) not always possible.
        // We'll do a local greedy: try to make big pile become 1 if possible; else normal move.
        const k = piles[bigIdx];
        const canMake1 = k - 1 >= 1 && k - 1 <= 3;
        if (canMake1) {
          // After making it 1, total ones become onesCount + 1
          // We want (onesCount + 1) to be odd for opponent.
          // If it's odd already, do it. If even, instead take all k (if <=3) to end? But ending makes you lose, so avoid.
          if ((onesCount + 1) % 2 === 1) {
            return { pile: bigIdx, take: k - 1 };
          }
          // Otherwise, try to take 1 (or 2/3) to leave k-1 not equal 1 to keep flexibility.
          return { pile: bigIdx, take: Math.min(1, k) };
        }
      }

      // Otherwise use nim-sum but with move cap 3:
      // Compute nim-sum
      let x = 0;
      for (let i = 0; i < piles.length; i++) x ^= piles[i];

      // If losing position (x==0), pick a random valid move (avoid taking last if possible)
      if (x === 0) {
        // prefer move that doesn't end game on itself
        for (let tries = 0; tries < 20; tries++) {
          const p = nonEmpty[(Math.random() * nonEmpty.length) | 0];
          const maxTake = Math.min(3, piles[p]);
          const take = 1 + ((Math.random() * maxTake) | 0);
          if (this.totalSticks() === take && piles[p] === take) continue; // would take last -> lose
          return { pile: p, take };
        }
        // fallback
        const p = nonEmpty[0];
        return { pile: p, take: Math.min(1, piles[p]) };
      }

      // Try to find a move that makes nim-sum 0 within take limit 1..3
      for (const p of nonEmpty) {
        const cur = piles[p];
        const target = cur ^ x; // desired new size
        if (target < cur) {
          const need = cur - target;
          if (need >= 1 && need <= 3) {
            // Avoid taking the last stick (instant loss)
            if (this.totalSticks() === need && cur === need) continue;
            return { pile: p, take: need };
          }
        }
      }

      // If can't do perfect due to cap 3, do a safe-ish heuristic:
      // - Prefer taking 1 from a larger pile
      // - Avoid ending game
      const candidates = nonEmpty
        .map((i) => ({ i, c: piles[i] }))
        .sort((a, b) => b.c - a.c);
      for (const { i, c } of candidates) {
        const take = Math.min(1, c);
        if (this.totalSticks() === take && c === take) continue;
        return { pile: i, take };
      }
      // last resort
      return { pile: nonEmpty[0], take: 1 };
    }

    animateTake(pileIdx, take) {
      // Add pop animation to the last few visible sticks
      if (!this.boardEl) return;
      const pileEl = this.boardEl.querySelector(`.o-tinh__pile[data-pile="${pileIdx}"]`);
      if (!pileEl) return;
      const sticks = Array.from(pileEl.querySelectorAll(".o-tinh__stick"));
      const popCount = Math.min(take, sticks.length);
      for (let i = 0; i < popCount; i++) {
        const s = sticks[sticks.length - 1 - i];
        if (!s) continue;
        s.classList.remove("is-pop");
        // force reflow
        void s.offsetWidth;
        s.classList.add("is-pop");
      }
    }

    applyMove(who, pileIdx, take) {
      if (this.over) return;
      if (pileIdx < 0 || pileIdx >= this.piles.length) return;
      if (take < 1 || take > 3) return;
      if (this.piles[pileIdx] <= 0) return;
      if (take > this.piles[pileIdx]) take = this.piles[pileIdx];

      this.animateTake(pileIdx, take);
      this.piles[pileIdx] -= take;
      this.audio.sfxTake();
      this.render();

      const afterTotal = this.totalSticks();
      if (afterTotal === 0) {
        // whoever made the move took the last -> loses
        this.endGame(who);
        return;
      }

      // switch turns
      this.turn = who === "player" ? "cpu" : "player";
      this.selectedPile = -1;
      this.syncTurnUI();
      this.audio.sfxTurn();
      this.updateTakeDisabled();

      if (this.turn === "cpu") {
        this.locked = true;
        this.syncTurnUI();
        window.setTimeout(() => this.cpuPlay(), 520);
      } else {
        this.locked = false;
        this.setToast("Tới lượt bạn.", 900);
      }
    }

    cpuPlay() {
      if (this.over) return;
      const move = this.cpuChooseMove();
      const pile = move.pile;
      const take = move.take;
      this.setToast(`Máy rút ${take} que ở ô ${pile + 1}.`, 1200);
      this.locked = false;
      this.applyMove("cpu", pile, take);
    }

    onPileClick(pileIdx) {
      if (this.over) return;
      if (this.locked) return;
      if (this.turn !== "player") return;
      if (this.piles[pileIdx] <= 0) return;
      this.selectedPile = pileIdx;
      this.render();
      this.updateTakeChips();
      this.setToast(`Đã chọn ô ${pileIdx + 1}. Chọn rút 1–3 que.`, 900);
    }

    onTakeChipClick(take) {
      if (this.over) return;
      if (this.locked) return;
      if (this.turn !== "player") return;
      this.selectedTake = take;
      this.updateTakeChips();

      if (this.selectedPile < 0) {
        this.setToast("Bạn hãy chọn một ô trước.", 1100);
        return;
      }
      const pileCount = this.piles[this.selectedPile];
      if (pileCount <= 0) {
        this.setToast("Ô này đã hết que. Chọn ô khác.", 1100);
        return;
      }
      if (take > pileCount) {
        this.setToast(`Ô này chỉ còn ${pileCount} que.`, 1100);
        return;
      }
      // Apply move immediately for smoother UX
      this.applyMove("player", this.selectedPile, take);
    }

    onToggleMusic() {
      // If user clicks toggle, that's a user gesture => unlock audio and start/stop bg.
      this.audio.unlock();
      const next = !this.audio.enabled;
      this.audio.setEnabled(next);
      if (this.musicBtn) this.musicBtn.setAttribute("aria-pressed", next ? "true" : "false");
      if (this.musicLabel) this.musicLabel.textContent = next ? "Nhạc: Bật" : "Nhạc: Tắt";
      this.setToast(next ? "Nhạc nền: Bật" : "Nhạc nền: Tắt", 900);
    }

    requestComplete() {
      // Notify host SPA
      this.root.dispatchEvent(
        new CustomEvent("oTinh:complete", { bubbles: true })
      );
    }

    onRootClick(e) {
      const target = /** @type {HTMLElement} */ (e.target);
      if (!target) return;

      // Music button
      const musicBtn = target.closest('[data-action="toggleMusic"]');
      if (musicBtn) {
        this.onToggleMusic();
        return;
      }

      // Control buttons
      const actionBtn = target.closest("[data-action]");
      if (actionBtn) {
        const act = actionBtn.getAttribute("data-action");
        if (act === "restart" || act === "restartFromModal") {
          this.audio.unlock();
          this.audio.sfxTurn();
          this.restart();
          return;
        }
        if (act === "complete" || act === "completeFromModal") {
          this.requestComplete();
          return;
        }
      }

      // Take chips
      const chip = target.closest(".o-tinh__chip");
      if (chip) {
        this.audio.unlock();
        const take = parseInt(chip.getAttribute("data-take") || "1", 10);
        this.onTakeChipClick(take);
        return;
      }

      // Pile click
      const pileBtn = target.closest(".o-tinh__pile");
      if (pileBtn && pileBtn.hasAttribute("data-pile")) {
        this.audio.unlock();
        const idx = parseInt(pileBtn.getAttribute("data-pile") || "-1", 10);
        this.onPileClick(idx);
      }
    }
  }

  // Boot
  function boot(attempts = 0) {
    const root = document.getElementById("oTinhRoot");
    if (!root) {
      // Retry if DOM not ready yet (dynamic loading fix)
      if (attempts < 20) {
        setTimeout(() => boot(attempts + 1), 50);
      }
      return;
    }

    // Prevent double init if stage re-injected
    if (root.__oTinhInstance) {
      try {
        root.__oTinhInstance.destroy();
      } catch (_) {}
      root.__oTinhInstance = null;
    }

    const game = new OTinhGame(root);
    root.__oTinhInstance = game;

    // If host removes the root (stage changes), cleanup via MutationObserver
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
    document.addEventListener("DOMContentLoaded", () => boot(), { once: true });
  } else {
    boot();
  }
})();

