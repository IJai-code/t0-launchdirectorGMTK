// ui.js
// dumb DOM plumbing. reads/writes state, nothing clever.

var logEl, clockEl, decisionEl, decisionPromptEl, decisionButtonsEl,
    endEl, endTitleEl, endStatsEl, holdBtnEl, abortBtnEl;

function initUI() {
  logEl = document.getElementById('log');
  clockEl = document.getElementById('clockValue');
  decisionEl = document.getElementById('decision');
  decisionPromptEl = document.getElementById('decisionPrompt');
  decisionButtonsEl = document.getElementById('decisionButtons');
  endEl = document.getElementById('endScreen');
  endTitleEl = document.getElementById('endTitle');
  endStatsEl = document.getElementById('endStats');
  holdBtnEl = document.getElementById('btnHold');
  abortBtnEl = document.getElementById('btnAbort');
}

function pushLog(state, text, cls) {
  var line = document.createElement('div');
  line.className = 'line' + (cls ? ' ' + cls : '');
  line.textContent = text;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

// actions is a list of { label, onClick(state) }
function showDecision(state, promptText, actions) {
  decisionPromptEl.textContent = promptText;
  decisionButtonsEl.innerHTML = '';
  for (var i = 0; i < actions.length; i++) {
    (function (action) {
      var btn = document.createElement('button');
      btn.textContent = action.label;
      btn.addEventListener('click', function () {
        action.onClick(state);
      });
      decisionButtonsEl.appendChild(btn);
    })(actions[i]);
  }
  decisionEl.classList.remove('hidden');
}

function hideDecision() {
  decisionEl.classList.add('hidden');
}

// the manual HOLD/ABORT strip -- HOLD only makes sense mid-count,
// ABORT is live any time before the vehicle has left the pad
function renderControls(state) {
  var canHold = state.phase === 'COUNTDOWN' || state.phase === 'MANUAL_HOLD';
  var canAbort = state.phase === 'COUNTDOWN' || state.phase === 'MANUAL_HOLD' ||
                 state.phase === 'HOLD' || state.phase === 'POLL';

  holdBtnEl.disabled = !canHold;
  holdBtnEl.textContent = state.phase === 'MANUAL_HOLD' ? 'RESUME' : 'HOLD';
  abortBtnEl.disabled = !canAbort;
}

function renderClock(state) {
  clockEl.textContent = state.t;
  if (state.t <= 15) {
    clockEl.classList.add('warn');
  } else {
    clockEl.classList.remove('warn');
  }
}

function showEndScreen(state) {
  endEl.classList.remove('hidden');
  if (state.phase === 'SUCCESS') {
    endTitleEl.textContent = 'LAUNCH SUCCESSFUL';
    endStatsEl.textContent =
      'ALTITUDE:   31 KM\n' +
      'VELOCITY:   MACH 3.8\n' +
      'MAX-Q:      PASSED\n' +
      'FUEL REM:   61%';
  } else if (state.phase === 'ABORTED') {
    endTitleEl.textContent = 'MISSION SCRUBBED';
    endStatsEl.textContent =
      'CAUSE:      MANUAL ABORT AT T-' + state.t + '\n' +
      'ALTITUDE:   0 KM\n' +
      'FUEL REM:   ' + state.fuelAtAbort + '%';
  } else {
    endTitleEl.textContent = 'LOSS OF VEHICLE';
    endStatsEl.textContent =
      'CAUSE:      ENGINE 2 FAILURE\n' +
      'ALTITUDE:   0 KM\n' +
      'FUEL REM:   88%';
  }
}

function hideEndScreen() {
  endEl.classList.add('hidden');
}
