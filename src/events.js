// events.js
// scripted moments along the count. T-90 is the engine anomaly, T-10 is
// the final go/no-go poll. more will get bolted on here later as a small
// table, but for now just hardcode the two.

var FAILURE_T = 90; // fires when clock reads T-90
var POLL_T = 10;    // fires when clock reads T-10

// ambient one-shot callouts keyed by T-value. pure flavor, no branching --
// transcribed by hand from mission_messages.txt, standardized to
// STATION, FLIGHT: MSG. (or FLIGHT: MSG. for flight-originated calls).
var AMBIENT = {
  120: ['FLIGHT: COUNTDOWN INITIATED. ALL STATIONS STAND BY.', null],
  110: ['GROUND, FLIGHT: LAUNCH PAD SYSTEMS NOMINAL.', 'good'],
  100: ['PROPULSION, FLIGHT: FUEL LOADING COMPLETE. SYSTEMS IN FAMILY.', 'good'],
  30:  ['FLIGHT: ALL STATIONS, PREPARE FOR FINAL COUNTDOWN.', null],
  20:  ['GUIDANCE, FLIGHT: GUIDANCE SYSTEM IS IN FAMILY.', 'good'],
  15:  ['COMMS, FLIGHT: TELEMETRY LINK NOMINAL.', 'good'],
  5:   ['FLIGHT: ALL SYSTEMS COMMITTED.', null]
};

// fired once each. called at boot (for T-120, which no tick ever lands on)
// and every countdown second.
function fireAmbient(state) {
  var line = AMBIENT[state.t];
  if (!line) return;
  if (state.ambientFired[state.t]) return;
  state.ambientFired[state.t] = true;
  pushLog(state, line[0], line[1]);
}

function checkEvents(state) {
  if (state.phase !== 'COUNTDOWN') return;

  fireAmbient(state);

  if (!state.failureTriggered && state.t === FAILURE_T) {
    triggerAnomaly(state);
    return;
  }

  if (!state.pollTriggered && state.t === POLL_T) {
    triggerPoll(state);
    return;
  }
}

// -- T-90 engine anomaly --------------------------------------------------

function triggerAnomaly(state) {
  state.failureTriggered = true;
  state.phase = 'HOLD';
  state.engineStatus = 'DEGRADED';
  sfxAlarm();
  pushLog(state, 'PROPULSION, FLIGHT: ENGINE 2 CHAMBER TEMPERATURE RISING.', 'warn');
  pushLog(state, 'FLIGHT: COPY, PROPULSION. STANDING BY.', null);
  showDecision(state, 'FLIGHT: YOUR CALL -- WORK ENGINE 2, OR PRESS ON?', [
    { label: 'FIX', onClick: resolveFix },
    { label: 'IGNORE', onClick: resolveIgnore }
  ]);
}

function resolveFix(state) {
  pushLog(state, 'PROPULSION, FLIGHT: COPY, WORKING ENGINE 2. STAND BY.', 'warn');
  state.repairing = true;
  state.repairClock = 0;
}

function resolveIgnore(state) {
  state.riskFlag = true;
  state.phase = 'COUNTDOWN';
  hideDecision();
  pushLog(state, 'FLIGHT: COPY, WE ARE GO TO PRESS WITH ENGINE 2 OUT OF FAMILY.', 'bad');
}

// called every frame while state.repairing is true
function tickRepair(state, dt) {
  if (!state.repairing) return;
  state.repairClock += dt;
  if (state.repairClock >= 3) {
    state.repairing = false;
    state.engineStatus = 'NOMINAL';
    state.riskFlag = false;
    state.phase = 'COUNTDOWN';
    hideDecision();
    sfxConfirm();
    pushLog(state, 'PROPULSION, FLIGHT: ENGINE 2 TEMPERATURE BACK WITHIN LIMITS.', 'good');
    pushLog(state, 'FLIGHT: COPY. ENGINE STATUS NOMINAL. RESUME THE COUNT.', 'good');
  }
}

// -- T-10 go/no-go poll ----------------------------------------------------

function triggerPoll(state) {
  state.pollTriggered = true;
  state.phase = 'POLL';

  var noGo = state.riskFlag;
  var lines = [
    ['FLIGHT: BEGINNING FINAL GO/NO-GO POLL.', null],
    ['GROUND, FLIGHT: GO.', 'good'],
    ['GUIDANCE, FLIGHT: GO.', 'good'],
    ['COMMS, FLIGHT: GO.', 'good'],
    ['WEATHER, FLIGHT: GO.', 'good'],
    ['PROPULSION, FLIGHT: ' + (noGo ? 'NO-GO.' : 'GO.'), noGo ? 'bad' : 'good']
  ];

  state.pollNoGo = noGo;
  queueComms(state, lines, onPollComplete);
}

function onPollComplete(state) {
  if (state.pollNoGo) {
    sfxAlarm();
    pushLog(state, 'FLIGHT: WE HAVE A NO-GO. YOUR CALL.', 'bad');
    showDecision(state, 'PROPULSION NO-GO -- FIX, PROCEED AS IS, OR ABORT?', [
      { label: 'FIX', onClick: resolvePollFix },
      { label: 'PROCEED AS IS', onClick: resolvePollContinue },
      { label: 'ABORT', onClick: resolveAbort }
    ]);
  } else {
    sfxConfirm();
    pushLog(state, 'FLIGHT: WE ARE GO FOR LAUNCH.', 'good');
    state.phase = 'COUNTDOWN';
  }
}

function resolvePollFix(state) {
  pushLog(state, 'PROPULSION, FLIGHT: COPY, WORKING ENGINE 2. STAND BY.', 'warn');
  state.repairing = true;
  state.repairClock = 0;
}

// the gamble: press on with the anomaly still live. riskFlag stays set,
// so countdown.js catches it at T-0 and drives the LOSS OF VEHICLE ending.
function resolvePollContinue(state) {
  hideDecision();
  state.phase = 'COUNTDOWN';
  pushLog(state, 'FLIGHT: COPY. WE ARE PROCEEDING WITH PROPULSION NO-GO. GODSPEED.', 'bad');
}

// -- manual hold/resume, the plain console switch -------------------------

function toggleManualHold(state) {
  if (state.phase === 'COUNTDOWN') {
    state.phase = 'MANUAL_HOLD';
    pushLog(state, 'FLIGHT: HOLD, HOLD, HOLD.', 'warn');
  } else if (state.phase === 'MANUAL_HOLD') {
    state.phase = 'COUNTDOWN';
    pushLog(state, 'FLIGHT: CLEAR TO RESUME THE COUNT.', 'good');
  }
}

// -- abort, callable from the poll decision or the manual console button --

function resolveAbort(state) {
  hideDecision();
  sfxAbort();
  state.phase = 'ABORTED';
  state.abortClock = 0;
  state.fuelAtAbort = Math.round(65 + (state.t / 120) * 35);
  pushLog(state, 'FLIGHT: ABORT, ABORT, ABORT. WE ARE SCRUBBING THE COUNT.', 'bad');
}
