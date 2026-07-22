// comms.js
// small queued printer for multi-line callouts (roll calls etc). lines land
// one at a time with a gap between them instead of dumping all at once --
// makes a poll sound like a radio loop rather than a log flush.

function queueComms(state, lines, onDone) {
  for (var i = 0; i < lines.length; i++) {
    state.commsQueue.push(lines[i]);
  }
  state.commsOnDone = onDone || null;
}

function tickComms(state, dt) {
  if (state.commsQueue.length === 0) {
    if (state.commsOnDone) {
      var cb = state.commsOnDone;
      state.commsOnDone = null;
      cb(state);
    }
    return;
  }

  state.commsTimer -= dt;
  if (state.commsTimer <= 0) {
    var item = state.commsQueue.shift();
    pushLog(state, item[0], item[1]);
    state.commsTimer = 0.7;
  }
}
