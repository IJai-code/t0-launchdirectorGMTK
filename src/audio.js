// audio.js
// all sound is synthesized at runtime -- no audio files, no assets.
// one shared AudioContext, unlocked on the player's first click (browsers
// block audio until a user gesture). every sfx is a fire-and-forget schedule
// of oscillators / noise through a short gain envelope.

var actx = null;
var audioReady = false;

function initAudio() {
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    actx = new AC();
  } catch (e) {
    actx = null; // no webaudio -- game stays silent, never errors
  }

  // unlock on first gesture anywhere (persistent controls OR a dynamically
  // created decision button -- a global listener catches them all)
  var unlock = function () {
    if (actx && actx.state === 'suspended') actx.resume();
    audioReady = !!actx;
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

// -- primitives -----------------------------------------------------------

function tone(freq, duration, type, gain) {
  if (!audioReady || !actx) return;
  var now = actx.currentTime;
  var osc = actx.createOscillator();
  var g = actx.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, now);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain || 0.2, now + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(g);
  g.connect(actx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
  return osc; // returned so callers can sweep frequency if they want
}

function noiseBurst(duration, gain) {
  if (!audioReady || !actx) return;
  var now = actx.currentTime;
  var frames = Math.floor(actx.sampleRate * duration);
  var buf = actx.createBuffer(1, frames, actx.sampleRate);
  var data = buf.getChannelData(0);
  for (var i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  var src = actx.createBufferSource();
  src.buffer = buf;
  var g = actx.createGain();
  g.gain.setValueAtTime(gain || 0.2, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  src.connect(g);
  g.connect(actx.destination);
  src.start(now);
  return src;
}

// -- named sfx ------------------------------------------------------------

// per-second countdown blip. strong=true for the final 10 seconds.
function sfxTick(strong) {
  if (strong) {
    tone(1200, 0.09, 'square', 0.28);
  } else {
    tone(760, 0.05, 'square', 0.16);
  }
}

// anomaly / no-go klaxon -- harsh two-tone wobble
function sfxAlarm() {
  if (!audioReady || !actx) return;
  var o = tone(440, 0.5, 'sawtooth', 0.22);
  if (o) {
    var now = actx.currentTime;
    o.frequency.setValueAtTime(440, now);
    o.frequency.setValueAtTime(330, now + 0.16);
    o.frequency.setValueAtTime(440, now + 0.32);
  }
}

// rising confirm blip -- go / repair complete
function sfxConfirm() {
  if (!audioReady || !actx) return;
  var o = tone(520, 0.22, 'square', 0.2);
  if (o) o.frequency.exponentialRampToValueAtTime(880, actx.currentTime + 0.2);
}

// descending tone -- manual abort / scrub
function sfxAbort() {
  if (!audioReady || !actx) return;
  var o = tone(600, 0.55, 'sawtooth', 0.22);
  if (o) o.frequency.exponentialRampToValueAtTime(140, actx.currentTime + 0.5);
}

// building low rumble -- ignition into liftoff
function sfxIgnition() {
  if (!audioReady || !actx) return;
  var now = actx.currentTime;
  // low oscillator swell
  var osc = actx.createOscillator();
  var g = actx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(50, now);
  osc.frequency.linearRampToValueAtTime(90, now + 2.6);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.35, now + 1.0);
  g.gain.setValueAtTime(0.35, now + 2.2);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);
  osc.connect(g);
  g.connect(actx.destination);
  osc.start(now);
  osc.stop(now + 3.05);
  // noise layer for engine roar
  noiseBurst(2.8, 0.18);
}

// noise burst + low boom -- loss of vehicle
function sfxExplosion() {
  if (!audioReady || !actx) return;
  noiseBurst(0.8, 0.4);
  var o = tone(90, 0.7, 'sawtooth', 0.35);
  if (o) o.frequency.exponentialRampToValueAtTime(30, actx.currentTime + 0.6);
}
