// ui.js
// dumb DOM plumbing. reads/writes state, nothing clever.

var logEl, clockEl, decisionEl, decisionTitleEl, decisionBodyEl, decisionButtonsEl,
    endEl, endTitleEl, endStatsEl, holdBtnEl, abortBtnEl,
    statusEl, activeDecisionEl;

function initUI() {
  logEl = document.getElementById('log');
  clockEl = document.getElementById('clockValue');
  decisionEl = document.getElementById('decision');
  decisionTitleEl = document.getElementById('decisionTitle');
  decisionBodyEl = document.getElementById('decisionBody');
  decisionButtonsEl = document.getElementById('decisionButtons');
  endEl = document.getElementById('endScreen');
  endTitleEl = document.getElementById('endTitle');
  endStatsEl = document.getElementById('endStats');
  holdBtnEl = document.getElementById('btnHold');
  abortBtnEl = document.getElementById('btnAbort');
  statusEl = document.getElementById('statusValue');
  activeDecisionEl = document.getElementById('activeDecisionValue');
}

// short tag shown in the ACTIVE DECISION header while a choice is pending;
// set when a decision is shown, read by renderStatus.
var currentDecisionLabel = 'ACTION REQUIRED';

// the console header: what the machine reports about itself. keeps the
// player anchored in "I am the launch director" without any tutorial text.
var STATUS_TEXT = {
  COUNTDOWN:   'COUNTING',
  HOLD:        'HOLD - ACTION REQUIRED',
  MANUAL_HOLD: 'HOLD',
  POLL:        'GO / NO-GO POLL',
  LAUNCH:      'LIFTOFF',
  SUCCESS:     'VEHICLE IN FLIGHT',
  FAILURE:     'VEHICLE LOST',
  ABORTED:     'COUNT SCRUBBED'
};

// station GO/NO-GO from carried risk. this is the single source of truth
// the systems board reads; the poll in events.js uses the identical mapping
// (guidance, weather, and propulsion = engine||fuel; ground & comms always
// GO) so the board and the roll call can never disagree.
function stationNoGo(state, sys) {
  var r = state.risk;
  if (sys === 'guidance') return r.guidance;
  if (sys === 'weather') return r.weather;
  if (sys === 'propulsion') return r.engine || r.fuel;
  return false; // ground, comms
}

var sysStatEls = null;
function renderSystems(state) {
  if (!sysStatEls) sysStatEls = document.querySelectorAll('.sysStat');
  for (var i = 0; i < sysStatEls.length; i++) {
    var el = sysStatEls[i];
    var nogo = stationNoGo(state, el.getAttribute('data-sys'));
    el.textContent = nogo ? 'NO-GO' : 'GO';
    if (nogo) el.classList.add('nogo');
    else el.classList.remove('nogo');
  }
}

function renderStatus(state) {
  // while the engine team is working, the count is held but no player action
  // is pending -- reflect that instead of the generic "ACTION REQUIRED".
  if (state.repairing) {
    statusEl.textContent = 'HOLD - REPAIR UNDERWAY';
  } else {
    statusEl.textContent = STATUS_TEXT[state.phase] || 'STANDING BY';
  }
  renderSystems(state);

  // a decision is pending exactly while its panel is on screen -- derive
  // from the DOM so it clears no matter which resolver hides it.
  var pending = !decisionEl.classList.contains('hidden');
  if (pending) {
    activeDecisionEl.textContent = currentDecisionLabel;
    activeDecisionEl.classList.add('pending');
  } else {
    activeDecisionEl.textContent = 'NONE';
    activeDecisionEl.classList.remove('pending');
  }
}

function pushLog(state, text, cls) {
  var line = document.createElement('div');
  line.className = 'line' + (cls ? ' ' + cls : '');
  line.textContent = text;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

// config = {
//   title:      player-facing headline (what's wrong, in plain words)
//   body:       one-line explanation, no jargon
//   statusLabel: short tag for the ACTIVE DECISION header
//   actions:    [ { label, hint, onClick(state) } ]  -- hint is the sub-line
// }
// the authentic comms line is pushed to the log separately by the caller;
// this panel is the teaching layer, the log is the atmosphere layer.
function showDecision(state, config) {
  currentDecisionLabel = config.statusLabel || 'ACTION REQUIRED';
  decisionTitleEl.textContent = config.title;
  decisionBodyEl.textContent = config.body;
  decisionButtonsEl.innerHTML = '';
  for (var i = 0; i < config.actions.length; i++) {
    (function (action) {
      var btn = document.createElement('button');
      var lbl = document.createElement('div');
      lbl.className = 'btnLabel';
      lbl.textContent = action.label;
      btn.appendChild(lbl);
      if (action.hint) {
        var hint = document.createElement('div');
        hint.className = 'btnHint';
        hint.textContent = action.hint;
        btn.appendChild(hint);
      }
      btn.addEventListener('click', function () {
        action.onClick(state);
      });
      decisionButtonsEl.appendChild(btn);
    })(config.actions[i]);
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
  var names = activeRiskNames(state); // e.g. ['WEATHER','GUIDANCE']

  if (state.phase === 'SUCCESS') {
    if (state.launchOutcome === 'ROUGH') {
      // one unresolved risk -> vehicle survives, but not cleanly
      endTitleEl.textContent = 'LAUNCH SUCCESSFUL -- WITH ISSUES';
      endStatsEl.textContent =
        'RESULT:     ROUGH ASCENT\n' +
        'ISSUE:      ' + (names[0] || 'SYSTEM') + ' OUT OF LIMITS\n' +
        'ALTITUDE:   31 KM\n' +
        'MAX-Q:      PASSED, WITH STRESS\n' +
        'FUEL REM:   54%';
    } else {
      endTitleEl.textContent = 'PERFECT LAUNCH';
      endStatsEl.textContent =
        'RESULT:     NOMINAL\n' +
        'ALTITUDE:   31 KM\n' +
        'VELOCITY:   MACH 3.8\n' +
        'MAX-Q:      PASSED\n' +
        'FUEL REM:   61%';
    }
  } else if (state.phase === 'ABORTED') {
    endTitleEl.textContent = 'MISSION SCRUBBED';
    endStatsEl.textContent =
      'CAUSE:      MANUAL ABORT AT T-' + state.t + '\n' +
      'ALTITUDE:   0 KM\n' +
      'FUEL REM:   ' + state.fuelAtAbort + '%';
  } else {
    endTitleEl.textContent = 'LOSS OF VEHICLE';
    endStatsEl.textContent =
      'CAUSE:      ' + (names.join(' + ') || 'MULTIPLE SYSTEMS') + ' OUT OF LIMITS\n' +
      'ALTITUDE:   0 KM\n' +
      'FUEL REM:   88%';
  }
}

function hideEndScreen() {
  endEl.classList.add('hidden');
}
