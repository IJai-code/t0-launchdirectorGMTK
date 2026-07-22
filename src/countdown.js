// countdown.js
// just the clock. ticks state.t down by 1 once per real second,
// but only while state.phase === 'COUNTDOWN'. everything else pauses it.

function tickCountdown(state) {
  if (state.phase !== 'COUNTDOWN') return;

  state.t -= 1;

  if (state.t <= 0) {
    state.t = 0;
    // deterministic tiered outcome, driven purely by the player's choices:
    //   0 risks -> perfect launch
    //   1 risk  -> rough launch, vehicle survives
    //   2+ risks -> loss of vehicle
    var risks = riskCount(state);

    if (risks >= 2) {
      state.phase = 'FAILURE';
      state.failClock = 0;
      pushLog(state, 'LAUNCH CONTROL: MULTIPLE SYSTEMS OUT OF LIMITS AT IGNITION. LOSS OF VEHICLE.', 'bad');
    } else {
      state.phase = 'LAUNCH';
      state.launchClock = 0;
      state.launchOutcome = (risks === 0) ? 'PERFECT' : 'ROUGH';
      pushLog(state, 'FLIGHT: WE HAVE MAIN ENGINE START.', 'good');
      if (risks === 1) {
        pushLog(state, 'FLIGHT: WE HAVE LIFTOFF -- BUT WE ARE SEEING ANOMALIES.', 'warn');
      }
    }
  }
}
