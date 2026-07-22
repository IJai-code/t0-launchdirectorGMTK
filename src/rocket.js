// rocket.js
// hand-drawn-ish procedural rocket. everything is rects/triangles on a
// 320x200 canvas, no image assets. deliberately a little wobbly --
// pixel jitter and uneven flame instead of a clean vector look.

var PAD = {
  groundY: 172,
  rocketX: 160,   // center x of the rocket
  rocketW: 22,
  rocketH: 64,
  baseY: 172       // rocket base sits on ground
};

function drawRocket(ctx, state, now) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 320, 200);

  // sky
  ctx.fillStyle = '#050a12';
  ctx.fillRect(0, 0, 320, 200);

  // a few fixed dim stars, not twinkling, just there
  ctx.fillStyle = '#2a3a4a';
  var stars = [[20,20],[60,10],[100,30],[200,15],[260,25],[280,45],[40,55],[300,70]];
  for (var i = 0; i < stars.length; i++) {
    ctx.fillRect(stars[i][0], stars[i][1], 1, 1);
  }

  var shakeX = 0, shakeY = 0;
  if (state.phase === 'LAUNCH' && state.launchClock < 1.2) {
    shakeX = (Math.random() - 0.5) * 4;
    shakeY = (Math.random() - 0.5) * 3;
  }
  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawGround(ctx);
  drawTower(ctx, now);

  var liftY = 0;
  if (state.phase === 'LAUNCH') {
    // sit still ~0.8s while flame builds, then climb and fade out
    var lc = state.launchClock;
    if (lc > 0.8) {
      var climb = lc - 0.8;
      liftY = -(climb * climb) * 40; // accelerating rise, not linear -- feels more like thrust
    }
  }

  if (state.phase === 'FAILURE' && state.failClock > 0.4) {
    drawExplosion(ctx, now, state.failClock);
  } else {
    drawRocketBody(ctx, liftY, state, now);
  }

  if (state.phase === 'LAUNCH' || (state.phase === 'FAILURE' && state.failClock < 0.6)) {
    drawFlame(ctx, liftY, state, now);
  }

  drawSmoke(ctx, state, now, liftY);

  ctx.restore();
}

function drawGround(ctx) {
  ctx.fillStyle = '#1a1a14';
  ctx.fillRect(0, PAD.groundY, 320, 200 - PAD.groundY);
  ctx.fillStyle = '#26261c';
  ctx.fillRect(0, PAD.groundY, 320, 2);
}

function drawTower(ctx, now) {
  var x = PAD.rocketX - 46;
  ctx.strokeStyle = '#4a4a38';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, PAD.groundY);
  ctx.lineTo(x, 40);
  ctx.stroke();
  // crossbeams, a bit uneven on purpose
  for (var y = 60; y < PAD.groundY; y += 22) {
    ctx.beginPath();
    ctx.moveTo(x - 6, y + ((y % 44 === 0) ? 2 : 0));
    ctx.lineTo(x + 6, y);
    ctx.stroke();
  }
  // blinking warning light near the top
  var on = Math.floor(now * 1.6) % 2 === 0;
  ctx.fillStyle = on ? '#ff3020' : '#3a1510';
  ctx.fillRect(x - 1, 38, 3, 3);
}

function drawRocketBody(ctx, liftY, state, now) {
  var x = PAD.rocketX;
  var w = PAD.rocketW;
  var h = PAD.rocketH;
  var baseY = PAD.baseY + liftY;
  var topY = baseY - h;

  // body
  ctx.fillStyle = '#cfc9b8';
  ctx.fillRect(x - w / 2, topY + 14, w, h - 14);

  // a stripe, slightly off-register like screen printing that didn't line up
  ctx.fillStyle = '#a83030';
  ctx.fillRect(x - w / 2 + 1, topY + 30, w - 2, 5);

  // nose cone
  ctx.fillStyle = '#e0dccb';
  ctx.beginPath();
  ctx.moveTo(x - w / 2, topY + 14);
  ctx.lineTo(x, topY);
  ctx.lineTo(x + w / 2, topY + 14);
  ctx.closePath();
  ctx.fill();

  // fins, deliberately not perfectly symmetric
  ctx.fillStyle = '#8a8470';
  ctx.beginPath();
  ctx.moveTo(x - w / 2, baseY - 14);
  ctx.lineTo(x - w / 2 - 9, baseY + 1);
  ctx.lineTo(x - w / 2, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w / 2, baseY - 12);
  ctx.lineTo(x + w / 2 + 8, baseY);
  ctx.lineTo(x + w / 2, baseY);
  ctx.closePath();
  ctx.fill();

  // engine status light on the body, reflects systems.engineStatus
  var bad = state.engineStatus === 'DEGRADED';
  var blink = Math.floor(now * (bad ? 4 : 1)) % 2 === 0;
  ctx.fillStyle = bad ? (blink ? '#ff5030' : '#4a1810') : '#3aa050';
  ctx.fillRect(x - 2, topY + 20, 3, 3);
}

function drawFlame(ctx, liftY, state, now) {
  var x = PAD.rocketX;
  var baseY = PAD.baseY + liftY;
  var lc = state.launchClock || 0;
  var grow = Math.min(1, lc / 0.6);
  var len = 6 + grow * 26 + Math.sin(now * 30) * 2;
  var wob = Math.sin(now * 40) * 2;

  ctx.fillStyle = '#ffcf4d';
  ctx.beginPath();
  ctx.moveTo(x - 6, baseY);
  ctx.lineTo(x + wob, baseY + len);
  ctx.lineTo(x + 6, baseY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ff7a2a';
  ctx.beginPath();
  ctx.moveTo(x - 4, baseY);
  ctx.lineTo(x + wob * 0.6, baseY + len * 0.6);
  ctx.lineTo(x + 4, baseY);
  ctx.closePath();
  ctx.fill();
}

function drawSmoke(ctx, state, now, liftY) {
  var smokePhases = ['COUNTDOWN', 'HOLD', 'MANUAL_HOLD', 'POLL', 'LAUNCH'];
  if (smokePhases.indexOf(state.phase) === -1) return;
  var x = PAD.rocketX;
  ctx.fillStyle = 'rgba(180,180,170,0.35)';
  for (var i = 0; i < 3; i++) {
    var t = (now * 0.5 + i * 1.7) % 3;
    var sx = x - 30 + Math.sin(now + i) * 6 + i * 20;
    var sy = PAD.groundY - t * 8;
    var size = 4 + t * 3;
    ctx.fillRect(sx, sy, size, size);
  }
}

function drawExplosion(ctx, now, failClock) {
  var x = PAD.rocketX;
  var y = PAD.baseY - 20;
  var age = failClock - 0.4;
  var r = Math.min(40, age * 60);
  var colors = ['#ff5030', '#ff9020', '#4a1810'];
  for (var i = 0; i < 10; i++) {
    var ang = (i / 10) * Math.PI * 2 + i;
    var dist = r * (0.4 + (i % 3) * 0.2);
    var px = x + Math.cos(ang) * dist;
    var py = y + Math.sin(ang) * dist * 0.6;
    ctx.fillStyle = colors[i % colors.length];
    var s = 4 - age;
    if (s < 1) s = 1;
    ctx.fillRect(px, py, s, s);
  }
}
