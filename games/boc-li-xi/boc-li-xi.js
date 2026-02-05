(function() {
  // ==========================================
  // CONFIG & STATE
  // ==========================================
  const CONFIG = {
    FAKE_MIN: 2000,
    FAKE_MAX: 500000,
    REAL_MIN: 2000,
    REAL_MAX: 3500,
    ANIMATION_DURATION: 2000, // ms
    ENVELOPE_COUNT: 6,
    STORAGE_KEY: 'blx_state'
  };

  const STATE = {
    turns: 0,
    totalMoney: 0,
    history: [],
    perfectRun: false,
    isAnimating: false
  };

  // DOM Elements
  let els = {};

  // ==========================================
  // INIT
  // ==========================================
  function init() {
    // Cache DOM elements within the scope
    const root = document.getElementById('boc-li-xi-stage');
    if (!root) return; // Safety check

    els = {
      root,
      grid: root.querySelector('#blx-grid'),
      turnsCount: root.querySelector('#blx-turns-count'),
      totalMoneyDisplay: root.querySelector('#blx-total-money'),
      modal: root.querySelector('#blx-modal'),
      modalHistoryList: root.querySelector('#blx-history-list'),
      statusMsg: root.querySelector('#blx-status-msg'),
      btnStart: root.querySelector('#blx-btn-start'),
      resultOverlay: root.querySelector('#blx-result-overlay'),
      finalAmount: root.querySelector('#blx-final-amount'),
      btnFinish: root.querySelector('#blx-btn-finish')
    };

    const saved = loadState();
    if (saved) {
      STATE.turns = saved.turns || 0;
      STATE.totalMoney = saved.totalMoney || 0;
      renderEnvelopes();
      updateUI();
      if (saved.isFinished) {
        showResult(true);
      }
    } else {
      evaluateHistory();
      renderEnvelopes();
      updateUI();
      showRulesModal();
    }

    // Event Listeners
    els.btnStart.addEventListener('click', () => {
      hideRulesModal();
      saveState(false);
    });
    els.btnFinish.addEventListener('click', finishStage);
  }

  // ==========================================
  // LOGIC: EVALUATE PREVIOUS STAGES
  // ==========================================
  function evaluateHistory() {
    STATE.history = [];
    let failures = 0;

    const s1Wrong = parseInt(localStorage.getItem('stage_1_wrong') || '0', 10);
    if (s1Wrong >= 3) {
      STATE.history.push("Câu Hỏi Ngày Tết (Sai từ 3 câu trở lên)");
      failures++;
    }

    const s2Status = localStorage.getItem('stage_2_status');
    if (s2Status !== 'pass') {
      STATE.history.push("Lật Thẻ May Mắn (Thua)");
      failures++;
    }

    const s3Wrong = parseInt(localStorage.getItem('stage_3_wrong') || '0', 10);
    if (s3Wrong >= 3) {
      STATE.history.push("Thử Thách Toán Học (Sai từ 3 câu trở lên)");
      failures++;
    }

    const s4Result = localStorage.getItem('stage_4_result');
    if (s4Result !== 'pass') {
      STATE.history.push("Ô TÍNH (Thua)");
      failures++;
    }

    const s5Result = localStorage.getItem('stage_5_result');
    if (s5Result !== 'pass') {
      STATE.history.push("Đập Niêu (Thua)");
      failures++;
    }

    // Determine Turns
    if (failures === 0) {
      STATE.perfectRun = true;
      STATE.turns = 2;
    } else {
      STATE.perfectRun = false;
      STATE.turns = 1;
    }
  }

  function saveState(isFinishedOverride) {
    const data = {
      turns: STATE.turns,
      totalMoney: STATE.totalMoney,
      isFinished: typeof isFinishedOverride === 'boolean' ? isFinishedOverride : (STATE.turns <= 0)
    };
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem('li_xi_total_money', STATE.totalMoney);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : null;
    } catch (e) {
      return null;
    }
  }


  // ==========================================
  // UI RENDER
  // ==========================================
  function renderEnvelopes() {
    els.grid.innerHTML = '';
    for (let i = 0; i < CONFIG.ENVELOPE_COUNT; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'blx-envelope-wrapper';
      wrapper.innerHTML = `
        <div class="blx-envelope"></div>
        <div class="blx-value-display">???</div>
      `;
      wrapper.addEventListener('click', () => handleEnvelopeClick(wrapper));
      els.grid.appendChild(wrapper);
    }
  }

  function showRulesModal() {
    els.modalHistoryList.innerHTML = '';
    
    if (STATE.perfectRun) {
      els.statusMsg.innerHTML = `<span style="color:#2e7d32; font-weight:bold;">Bạn đã thắng tất cả các stage trước nên được bốc 2 lần!</span>`;
      // Clear list
    } else {
      els.statusMsg.innerHTML = `<span style="color:#d32f2f; font-weight:bold;">Do bạn đã thua ở các stage dưới đây nên chỉ được bốc 1 lần:</span>`;
      
      STATE.history.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        els.modalHistoryList.appendChild(li);
      });
    }

    els.modal.classList.add('show');
  }

  function hideRulesModal() {
    els.modal.classList.remove('show');
  }

  function updateUI() {
    els.turnsCount.textContent = STATE.turns;
    els.totalMoneyDisplay.textContent = formatMoney(STATE.totalMoney);
  }

  // ==========================================
  // GAMEPLAY
  // ==========================================
  function handleEnvelopeClick(wrapper) {
    if (STATE.isAnimating || STATE.turns <= 0 || wrapper.classList.contains('open')) {
      return;
    }

    STATE.isAnimating = true;
    STATE.turns--;
    wrapper.classList.add('open'); // Shows value display
    updateUI();

    const valueDisplay = wrapper.querySelector('.blx-value-display');
    
    // Determine Real Value
    // Random integer between REAL_MIN and REAL_MAX inclusive (2000 - 3500)
    // No rounding to ensure 1500 distinct values
    const realValue = Math.floor(Math.random() * (CONFIG.REAL_MAX - CONFIG.REAL_MIN + 1)) + CONFIG.REAL_MIN;

    // Run Animation
    runNumberAnimation(valueDisplay, realValue, () => {
      STATE.totalMoney += realValue;
      updateUI();
      STATE.isAnimating = false;
      saveState();

      // Check End Game
      if (STATE.turns <= 0) {
        setTimeout(showResult, 1000);
      }
    });
  }

  function runNumberAnimation(element, targetValue, callback) {
    let startTime = null;
    
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percent = Math.min(progress / CONFIG.ANIMATION_DURATION, 1);
      
      // Easing: easeOutExpo
      const ease = percent === 1 ? 1 : 1 - Math.pow(2, -10 * percent);
      
      // Fake random flickering during animation
      if (percent < 1) {
        const fakeVal = Math.floor(Math.random() * (CONFIG.FAKE_MAX - CONFIG.FAKE_MIN)) + CONFIG.FAKE_MIN;
        element.textContent = formatMoney(fakeVal);
        element.style.transform = `scale(${1 + Math.random() * 0.1})`; // Slight shake
      } else {
        element.textContent = formatMoney(targetValue);
        element.style.transform = 'scale(1.2)';
        element.style.color = '#d32f2f';
        element.style.textShadow = '0 0 10px rgba(255, 215, 0, 0.5)';
      }

      if (progress < CONFIG.ANIMATION_DURATION) {
        requestAnimationFrame(step);
      } else {
        if (callback) callback();
      }
    }

    requestAnimationFrame(step);
  }

  function showResult(immediate = false) {
    if (!immediate) {
      saveState(true);
    }
    
    els.finalAmount.textContent = formatMoney(STATE.totalMoney);
    els.resultOverlay.classList.remove('hidden');
  }

  function finishStage() {
    // Dispatch event for main script to catch
    window.dispatchEvent(new CustomEvent('bocLiXi:complete', { bubbles: true }));
  }

  // Helper
  function formatMoney(amount) {
    return amount.toLocaleString('vi-VN') + 'đ';
  }

  // Start
  // Wait a microtask to ensure DOM is fully inserted by the loader
  setTimeout(init, 0);

})();
