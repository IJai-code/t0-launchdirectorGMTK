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
  while (tickAccumulator >= 1) {
    tickAccumulator -= 1;
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
