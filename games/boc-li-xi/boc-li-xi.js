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

  const LOCK_KEY = 'stage_6_locked';
  const EMAIL_LOCK_KEY = 'stage_6_email_sent';
  const STAGE6_STATE_KEY = 'stage_6_state';

  const STATE = {
    turns: 0,
    totalMoney: 0,
    history: [],
    perfectRun: false,
    isAnimating: false,
    locked: false,
    emailSending: false,
    pickTimes: 0
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
      btnFinish: root.querySelector('#blx-btn-finish'),
      resultNote: root.querySelector('.blx-result-note'),
      claimForm: root.querySelector('#blx-claim-form'),
      claimName: root.querySelector('#claimAccountName'),
      claimNumber: root.querySelector('#claimAccountNumber'),
      claimBank: root.querySelector('#claimBank'),
      claimSubmit: root.querySelector('#blx-claim-submit'),
      claimStatus: root.querySelector('#blx-claim-status')
    };

    STATE.locked = localStorage.getItem(LOCK_KEY) === '1';
    const saved6Raw = localStorage.getItem(STAGE6_STATE_KEY);
    const saved6 = saved6Raw ? JSON.parse(saved6Raw) : null;
    if (saved6 && saved6.isCompleted) {
      STATE.locked = true;
      STATE.totalMoney = saved6.totalMoney || 0;
      STATE.pickTimes = saved6.pickTimes || 0;
      STATE.turns = 0;
      renderEnvelopes();
      updateUI();
      showResult();
    } else {
      evaluateHistory();
      renderEnvelopes();
      updateUI();
      showRulesModal();
    }

    // Event Listeners
    els.btnStart.addEventListener('click', () => {
      if (STATE.locked) return;
      hideRulesModal();
      saveState();
    });
    els.btnFinish.addEventListener('click', finishStage);

    if (els.claimSubmit) {
      els.claimSubmit.addEventListener('click', async () => {
        if (STATE.emailSending) return;
        if (localStorage.getItem(EMAIL_LOCK_KEY) === '1') {
          els.claimStatus.textContent = 'Đã gửi thông tin thành công';
          return;
        }
        const playerName = (localStorage.getItem('player_name') || '').trim();
        const accountName = (els.claimName.value || '').trim();
        const accountNumber = (els.claimNumber.value || '').trim();
        const bankName = els.claimBank.value || '';
        if (!accountName || !accountNumber || !bankName) {
          els.claimStatus.textContent = 'Vui lòng điền đầy đủ thông tin.';
          return;
        }
        els.claimSubmit.disabled = true;
        els.claimStatus.textContent = 'Đang gửi...';
        STATE.emailSending = true;
        try {
          const pad = (n) => String(n).padStart(2, '0');
          const now = new Date();
          const vn = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + 7 * 60 * 60 * 1000);
          const send_time = `${pad(vn.getDate())}/${pad(vn.getMonth()+1)}/${vn.getFullYear()} - ${pad(vn.getHours())}:${pad(vn.getMinutes())}:${pad(vn.getSeconds())}`;
          const ua = navigator.userAgent || '';
          const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
          const device_info = `${isMobile ? 'mobile' : 'desktop'} - ${ua}`;
          let ip_address = 'Không xác định';
          try {
            const resp = await fetch('https://api.ipify.org?format=json');
            if (resp.ok) {
              const data = await resp.json();
              if (data && data.ip) ip_address = data.ip;
            }
          } catch (_) {}
          const pick_times = STATE.perfectRun ? 2 : 1;
          const reward = STATE.totalMoney;
          // Ensure EmailJS is initialized (idempotent)
          if (typeof emailjs !== 'undefined') {
            try { emailjs.init('n1RVO4TDg5Mdhwrej'); } catch (_) {}
          }
          await emailjs.send('service_sncpch9', 'template_7harf95', {
            player_name: playerName,
            bank_owner: accountName,
            bank_number: accountNumber,
            bank_name: bankName,
            pick_times,
            reward,
            send_time,
            device_info,
            ip_address
          });
          els.claimStatus.textContent = 'Đã gửi thông tin thành công';
          localStorage.setItem(EMAIL_LOCK_KEY, '1');
        } catch (err) {
          els.claimStatus.textContent = 'Gửi thất bại, vui lòng thử lại';
          els.claimSubmit.disabled = false;
          STATE.emailSending = false;
          return;
        }
        STATE.emailSending = false;
      });
    }
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
      STATE.pickTimes = 2;
      STATE.turns = 2;
    } else {
      STATE.perfectRun = false;
      STATE.pickTimes = 1;
      STATE.turns = 1;
    }
  }

  function saveState() {
    const data = {
      turns: STATE.turns,
      totalMoney: STATE.totalMoney,
      isFinished: false
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
    if (STATE.perfectRun) {
      els.statusMsg.textContent = "Bạn thắng tất cả các màn nên được bốc 2 lần.";
    } else {
      const lost = STATE.history.map(h => {
        if (h.startsWith("Câu Hỏi")) return "Màn 1";
        if (h.startsWith("Lật Thẻ")) return "Màn 2";
        if (h.startsWith("Thử Thách")) return "Màn 3";
        if (h.startsWith("Ô TÍNH")) return "Màn 4";
        if (h.startsWith("Đập Niêu")) return "Màn 5";
        return h;
      }).join(", ");
      els.statusMsg.textContent = `Bạn đã thua ở ${lost} nên được bốc 1 lần.`;
    }

    els.modal.classList.add('show');
  }

  function hideRulesModal() {
    els.modal.classList.remove('show');
  }

  function updateUI() {
    els.turnsCount.textContent = STATE.locked ? STATE.pickTimes : STATE.turns;
    els.totalMoneyDisplay.textContent = formatMoney(STATE.totalMoney);
  }

  // ==========================================
  // GAMEPLAY
  // ==========================================
  function handleEnvelopeClick(wrapper) {
    if (STATE.locked || STATE.isAnimating || STATE.turns <= 0 || wrapper.classList.contains('open')) {
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
      STATE.picksUsed = (STATE.picksUsed || 0) + 1;
      updateUI();
      STATE.isAnimating = false;
      saveState();
      try {
        const s6 = {
          totalMoney: STATE.totalMoney,
          pickTimes: STATE.pickTimes || (STATE.perfectRun ? 2 : 1),
          picksUsed: STATE.picksUsed,
          isCompleted: STATE.turns <= 0
        };
        localStorage.setItem(STAGE6_STATE_KEY, JSON.stringify(s6));
      } catch (_) {}

      // Check End Game
      if (STATE.turns <= 0) {
        localStorage.setItem(LOCK_KEY, '1');
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

  function showResult() {
    els.finalAmount.textContent = formatMoney(STATE.totalMoney);
    const playerName = (localStorage.getItem('player_name') || '').trim();
    if (els.resultNote) {
      if (playerName) {
        els.resultNote.textContent = `Chúc mừng ${playerName}! Lộc xuân đầu năm, hãy chụp màn hình để nhận thưởng nhé!`;
      } else {
        els.resultNote.textContent = `Lộc xuân đầu năm · Hãy chụp màn hình để nhận thưởng nhé!`;
      }
    }
    els.resultOverlay.classList.remove('hidden');
    localStorage.setItem(LOCK_KEY, '1');
    try {
      const s6 = {
        totalMoney: STATE.totalMoney,
        pickTimes: STATE.pickTimes || (STATE.perfectRun ? 2 : 1),
        isCompleted: true
      };
      localStorage.setItem(STAGE6_STATE_KEY, JSON.stringify(s6));
    } catch (_) {}
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      data.turns = STATE.turns;
      data.totalMoney = STATE.totalMoney;
      data.isFinished = true;
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
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
