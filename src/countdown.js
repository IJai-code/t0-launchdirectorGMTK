// countdown.js
// just the clock. ticks state.t down by 1 once per real second,
// but only while state.phase === 'COUNTDOWN'. everything else pauses it.

function tickCountdown(state) {
  if (state.phase !== 'COUNTDOWN') return;

  state.t -= 1;

  if (state.t <= 0) {
    state.t = 0;
    if (state.riskFlag) {
      state.phase = 'FAILURE';
      state.failClock = 0;
      sfxExplosion();
      pushLog(state, 'LAUNCH CONTROL: ENGINE 2 FAILURE AT IGNITION. ABORT, ABORT, ABORT.', 'bad');
    } else {
      state.phase = 'LAUNCH';
      state.launchClock = 0;
      sfxIgnition();
      pushLog(state, 'FLIGHT: WE HAVE MAIN ENGINE START.', 'good');
    }
  }
}
