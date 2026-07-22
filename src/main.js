// main.js
// boots the console, owns the single state object, runs the loop.
// countdown ticks are locked to real seconds via an accumulator so
// rendering can still run smooth even while the clock is paused (HOLD).

var state = {
  t: 120,
  phase: 'COUNTDOWN',   // COUNTDOWN | HOLD | MANUAL_HOLD | POLL | LAUNCH | FAILURE | ABORTED
  engineStatus: 'NOMINAL',
  failureTriggered: false,
  pollTriggered: false,
  pollNoGo: false,
  // unresolved risks the player chose to carry. read by the poll (which
  // stations call NO-GO) and by the T-0 outcome tier. deterministic.
  risk: { weather: false, guidance: false, fuel: false, engine: false },
  decisionsFired: {},
  launchOutcome: '',   // 'PERFECT' | 'ROUGH' -- set at T-0 for the end screen
  repairing: false,
  repairClock: 0,
  launchClock: 0,
  failClock: 0,
  abortClock: 0,
  fuelAtAbort: 0,
  commsQueue: [],
  commsTimer: 0,
  ambientFired: {},
  liftoffLogged: false,
  ended: false
};

var ctx;
var lastFrame = 0;
var tickAccumulator = 0;

// how many real seconds one countdown-second should take right now.
// quiet stretches run fast so the player never watches dead air; the count
// snaps back to real-time for the dramatic finale, the poll, and any moment
// a decision is on the table. the clock only advances in COUNTDOWN anyway,
// so this purely controls the *speed* of that advance, never the triggers.
var REALTIME_INTERVAL = 1.0;
var FAST_INTERVAL = 0.28; // ~3.5 countdown-seconds per real second

function countdownInterval(state) {
  if (state.t <= 20) return REALTIME_INTERVAL;          // dramatic final stretch
  if (state.phase !== 'COUNTDOWN') return REALTIME_INTERVAL; // decision/hold/poll pending
  if (state.commsQueue.length > 0) return REALTIME_INTERVAL;  // roll call in progress
  return FAST_INTERVAL;                                  // open stretch -> speed up
}

function boot() {
  var canvas = document.getElementById('padCanvas');
  ctx = canvas.getContext('2d');

  initUI();
  initInput(state);

  // T-120 is never landed on by a tick (first tick moves to 119), so fire
  // its ambient line here at boot from the same table.
  fireAmbient(state);
  renderClock(state);
  renderStatus(state);

  lastFrame = performance.now();
  requestAnimationFrame(loop);
}

function loop(now) {
  var dt = (now - lastFrame) / 1000;
  lastFrame = now;
  if (dt > 0.25) dt = 0.25; // tab was backgrounded, don't eat the clock

  tickAccumulator += dt;
  while (tickAccumulator >= countdownInterval(state)) {
    tickAccumulator -= countdownInterval(state);
    tickCountdown(state);
    checkEvents(state);
    renderClock(state);
  }

  if (state.repairing) tickRepair(state, dt);
  tickComms(state, dt);
  renderControls(state);
  renderStatus(state);

  if (state.phase === 'LAUNCH') {
    state.launchClock += dt;
    // the vehicle physically clears the pad at ~0.8s (see rocket.js liftY)
    if (state.launchClock > 0.8 && !state.liftoffLogged) {
      state.liftoffLogged = true;
      pushLog(state, 'FLIGHT: LIFTOFF. THE VEHICLE IS AIRBORNE.', 'good');
    }
    if (state.launchClock > 3.2 && !state.ended) {
      state.ended = true;
      state.phase = 'SUCCESS';
      showEndScreen(state);
    }
  }

  if (state.phase === 'FAILURE') {
    state.failClock += dt;
    if (state.failClock > 2.2 && !state.ended) {
      state.ended = true;
      showEndScreen(state);
    }
  }

  if (state.phase === 'ABORTED') {
    state.abortClock += dt;
    if (state.abortClock > 1.2 && !state.ended) {
      state.ended = true;
      showEndScreen(state);
    }
  }

  drawRocket(ctx, state, now / 1000);

  requestAnimationFrame(loop);
}

boot();
