// input.js
// wires up the console controls. the FIX/IGNORE/ABORT decision buttons
// are rendered dynamically by ui.js's showDecision, so only the
// always-present controls get bound here.

function initInput(state) {
  document.getElementById('btnHold').addEventListener('click', function () {
    toggleManualHold(state);
  });

  document.getElementById('btnAbort').addEventListener('click', function () {
    if (document.getElementById('btnAbort').disabled) return;
    resolveAbort(state);
  });

  document.getElementById('btnRestart').addEventListener('click', function () {
    window.location.reload();
  });
}
