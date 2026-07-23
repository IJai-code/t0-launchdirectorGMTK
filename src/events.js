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

// -- risk model -----------------------------------------------------------
// pure readers over state.risk. defined here (decision logic) but called
// from countdown.js and ui.js at runtime, after all scripts have loaded.

var RISK_NAMES = { weather: 'WEATHER', guidance: 'GUIDANCE', engine: 'ENGINE 2', fuel: 'PROPELLANT' };

function riskCount(state) {
  var r = state.risk, n = 0;
  if (r.weather) n++;
  if (r.guidance) n++;
  if (r.fuel) n++;
  if (r.engine) n++;
  return n;
}

function activeRiskNames(state) {
  var r = state.risk, out = [];
  if (r.weather) out.push(RISK_NAMES.weather);
  if (r.guidance) out.push(RISK_NAMES.guidance);
  if (r.engine) out.push(RISK_NAMES.engine);
  if (r.fuel) out.push(RISK_NAMES.fuel);
  return out;
}

// -- the three player-managed decisions -----------------------------------
// keyed by T-value. each has a teaching layer (title/body/choices) and an
// atmosphere layer (comms lines pushed to the log). the safe choice clears
// the risk, the risky choice carries it forward to the poll and the outcome.
// deliberately mixed in tone: weather/fuel are routine mission management,
// not every one is an emergency.

var DECISIONS = {
  100: {
    id: 'weather', status: 'WEATHER',
    title: 'WEATHER SYSTEM WARNING',
    body: 'High winds detected near the launch corridor.',
    comms: ['WEATHER, FLIGHT: UPPER LEVEL WINDS EXCEEDING LIMITS.', 'warn'],
    safe:  { label: 'WAIT FOR CONDITIONS', hint: 'Clear the issue. Reduce mission risk.',
             comms: ['WEATHER, FLIGHT: WINDS EASING. BACK WITHIN LIMITS.', 'good'] },
    risky: { label: 'PROCEED', hint: 'Press on. Accept added mission risk.',
             comms: ['FLIGHT: COPY. WE PRESS ON THROUGH THE WINDS.', 'bad'] }
  },
  70: {
    id: 'guidance', status: 'GUIDANCE',
    title: 'GUIDANCE COMPUTER WARNING',
    body: 'Navigation calibration is drifting.',
    comms: ['GUIDANCE, FLIGHT: PLATFORM ALIGNMENT DRIFT DETECTED.', 'warn'],
    safe:  { label: 'RECALIBRATE', hint: 'Clear the issue. Reduce mission risk.',
             comms: ['GUIDANCE, FLIGHT: PLATFORM REALIGNED. IN FAMILY.', 'good'] },
    risky: { label: 'CONTINUE', hint: 'Press on. Accept added mission risk.',
             comms: ['FLIGHT: COPY. FLYING WITH CURRENT ALIGNMENT.', 'bad'] }
  },
  40: {
    id: 'fuel', status: 'PROPELLANT',
    title: 'PROPELLANT SYSTEM WARNING',
    body: 'Fuel tank pressure is reading below target.',
    comms: ['PROPULSION, FLIGHT: TANK PRESSURE BELOW NOMINAL.', 'warn'],
    safe:  { label: 'TOP OFF PRESSURE', hint: 'Clear the issue. Reduce mission risk.',
             comms: ['PROPULSION, FLIGHT: TANK PRESSURE BACK TO TARGET.', 'good'] },
    risky: { label: 'LAUNCH AS IS', hint: 'Press on. Accept added mission risk.',
             comms: ['FLIGHT: COPY. FLYING WITH LOW TANK PRESSURE.', 'bad'] }
  }
};

function triggerDecision(state, d) {
  state.decisionsFired[d.id] = true;
  state.phase = 'HOLD';
  pushLog(state, d.comms[0], d.comms[1]);
  showDecision(state, {
    title: d.title,
    body: d.body,
    statusLabel: d.status,
    actions: [
      { label: d.safe.label,  hint: d.safe.hint,  onClick: function (s) { resolveDecision(s, d, false); } },
      { label: d.risky.label, hint: d.risky.hint, onClick: function (s) { resolveDecision(s, d, true); } }
    ]
  });
}

function resolveDecision(state, d, risky) {
  state.risk[d.id] = risky;
  hideDecision();
  state.phase = 'COUNTDOWN';
  var c = risky ? d.risky.comms : d.safe.comms;
  pushLog(state, c[0], c[1]);
}

function checkEvents(state) {
  if (state.phase !== 'COUNTDOWN') return;

  fireAmbient(state);

  var d = DECISIONS[state.t];
  if (d && !state.decisionsFired[d.id]) {
    triggerDecision(state, d);
    return;
  }

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
  pushLog(state, 'PROPULSION, FLIGHT: ENGINE 2 CHAMBER TEMPERATURE RISING.', 'warn');
  pushLog(state, 'FLIGHT: COPY, PROPULSION. STANDING BY.', null);
  showDecision(state, {
    title: 'ENGINE SYSTEM WARNING',
    body: 'Engine 2 is running hot on the pad.',
    statusLabel: 'ENGINE',
    actions: [
      { label: 'WORK THE PROBLEM', hint: 'Hold and repair. Reduce mission risk.', onClick: resolveFix },
      { label: 'PRESS ON',         hint: 'Ignore it. Accept added mission risk.', onClick: resolveIgnore }
    ]
  });
}

function resolveFix(state) {
  hideDecision();          // choice made -- close the panel so it can't be re-clicked
  pushLog(state, 'PROPULSION, FLIGHT: COPY, WORKING ENGINE 2. STAND BY.', 'warn');
  state.repairing = true;
  state.repairClock = 0;
}

function resolveIgnore(state) {
  state.risk.engine = true;
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
    state.risk.engine = false;
    state.phase = 'COUNTDOWN';
    hideDecision();
    pushLog(state, 'PROPULSION, FLIGHT: ENGINE 2 TEMPERATURE BACK WITHIN LIMITS.', 'good');
    pushLog(state, 'FLIGHT: COPY. ENGINE STATUS NOMINAL. RESUME THE COUNT.', 'good');
  }
}

// -- T-10 go/no-go poll ----------------------------------------------------

function triggerPoll(state) {
  state.pollTriggered = true;
  state.phase = 'POLL';

  var r = state.risk;
  var propNoGo = r.engine || r.fuel; // both live on the propulsion station
  function line(station, noGo) {
    return [station + ', FLIGHT: ' + (noGo ? 'NO-GO.' : 'GO.'), noGo ? 'bad' : 'good'];
  }
  var lines = [
    ['FLIGHT: BEGINNING FINAL GO/NO-GO POLL.', null],
    line('GROUND', false),
    line('GUIDANCE', r.guidance),
    line('COMMS', false),
    line('WEATHER', r.weather),
    line('PROPULSION', propNoGo)
  ];

  state.pollNoGo = riskCount(state) > 0;
  queueComms(state, lines, onPollComplete);
}

function onPollComplete(state) {
  if (state.pollNoGo) {
    pushLog(state, 'FLIGHT: WE HAVE A NO-GO. YOUR CALL, DIRECTOR.', 'bad');
    showDecision(state, {
      title: 'LAUNCH COMMIT DECISION',
      body: 'Stations are reporting NO-GO. Fly with the risk, or scrub?',
      statusLabel: 'GO / NO-GO',
      actions: [
        { label: 'PROCEED AS IS', hint: 'Launch with known risks', onClick: resolvePollContinue },
        { label: 'ABORT',         hint: 'Scrub the launch',         onClick: resolveAbort }
      ]
    });
  } else {
    pushLog(state, 'FLIGHT: WE ARE GO FOR LAUNCH.', 'good');
    state.phase = 'COUNTDOWN';
  }
}

// the gamble: fly with the unresolved risks. they stay set, so countdown.js
// grades the outcome at T-0 (1 risk = rough launch, 2+ = loss of vehicle).
function resolvePollContinue(state) {
  hideDecision();
  state.phase = 'COUNTDOWN';
  pushLog(state, 'FLIGHT: COPY. WE ARE GO FOR LAUNCH WITH KNOWN RISKS. GODSPEED.', 'bad');
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
  state.phase = 'ABORTED';
  state.abortClock = 0;
  state.fuelAtAbort = Math.round(65 + (state.t / 120) * 35);
  pushLog(state, 'FLIGHT: ABORT, ABORT, ABORT. WE ARE SCRUBBING THE COUNT.', 'bad');
}
