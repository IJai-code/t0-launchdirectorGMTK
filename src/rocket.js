// rocket.js
// hand-drawn-ish procedural rocket + launch pad. everything is rects and
// triangles on a 320x200 canvas, no image assets. deliberately imperfect:
// off-register stripes, uneven rivets, mismatched fins -- the look of a
// spacecraft someone pixelled on an old machine, not a clean vector render.
//
// cheap "shading" is done with a few flat tones per surface (a light left
// band, a darker right band) to fake a cylinder without gradients.

var PAD = {
  groundY: 172,
  rocketX: 160,   // center x of the rocket
  rocketW: 24,
  rocketH: 66,
  baseY: 172,      // rocket base sits on ground
  nozzleH: 9
};

// body tones -- limited palette, flat fills only
var COL = {
  hull:     '#cfc9b8',
  hullHi:   '#ddd7c6',
  hullSh:   '#a8a290',
  seam:     '#8f8a76',
  rivet:    '#787260',
  nose:     '#e2decd',
  noseSh:   '#b8b39f',
  band:     '#a83030',
  bandSh:   '#7e2020',
  metal:    '#8a8470',
  metalSh:  '#5f5a48',
  nozzle:   '#6a6656',
  nozzleSh: '#403d31',
  markDark: '#2a2820'
};

function drawRocket(ctx, state, now) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 320, 200);

  // sky
  ctx.fillStyle = '#050a12';
  ctx.fillRect(0, 0, 320, 200);

  // a few fixed dim stars, not twinkling, just there
  ctx.fillStyle = '#2a3a4a';
  var stars = [[20,20],[60,10],[100,30],[200,15],[260,25],[280,45],[40,55],[300,70],[150,18],[240,60]];
  for (var i = 0; i < stars.length; i++) {
    ctx.fillRect(stars[i][0], stars[i][1], 1, 1);
  }

  // screen shake: a hard jolt at ignition, easing into a steady rumble as
  // the vehicle climbs -- makes the launch feel heavy.
  var shakeX = 0, shakeY = 0;
  if (state.phase === 'LAUNCH') {
    var lc0 = state.launchClock;
    var intensity = lc0 < 1.2 ? (1 - lc0 / 1.2) * 4 + 1.2 : 1.2;
    shakeX = (Math.random() - 0.5) * intensity * 2;
    shakeY = (Math.random() - 0.5) * intensity * 1.5;
  } else if (state.phase === 'FAILURE' && state.failClock < 0.8) {
    shakeX = (Math.random() - 0.5) * 6;
    shakeY = (Math.random() - 0.5) * 5;
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
      liftY = -(climb * climb) * 40; // accelerating rise, not linear -- feels like thrust
    }
  }

  // ground equipment + fuel lines only while the vehicle is on the pad;
  // they "disconnect" the instant it lifts (liftY becomes negative).
  drawGroundEquipment(ctx, now);
  if (liftY === 0) drawFuelLines(ctx, state, now);

  drawSmoke(ctx, state, now, liftY);

  if (state.phase === 'FAILURE' && state.failClock > 0.4) {
    drawExplosion(ctx, now, state.failClock);
  } else {
    drawRocketBody(ctx, liftY, state, now);
  }

  if (state.phase === 'LAUNCH' || (state.phase === 'FAILURE' && state.failClock < 0.6)) {
    drawFlame(ctx, liftY, state, now);
  }

  ctx.restore();
}

// -- pad ------------------------------------------------------------------

function drawGround(ctx) {
  ctx.fillStyle = '#1a1a14';
  ctx.fillRect(0, PAD.groundY, 320, 200 - PAD.groundY);
  ctx.fillStyle = '#26261c';
  ctx.fillRect(0, PAD.groundY, 320, 2);

  // concrete pad deck under the vehicle
  ctx.fillStyle = '#33332a';
  ctx.fillRect(PAD.rocketX - 34, PAD.groundY, 68, 4);
  ctx.fillStyle = '#3d3d31';
  ctx.fillRect(PAD.rocketX - 34, PAD.groundY, 68, 1);

  // exhaust trench: a dark notch the flame pours into
  ctx.fillStyle = '#0a0a08';
  ctx.fillRect(PAD.rocketX - 9, PAD.groundY, 18, 10);
  ctx.fillStyle = '#151510';
  ctx.fillRect(PAD.rocketX - 9, PAD.groundY, 2, 9);
  ctx.fillRect(PAD.rocketX + 7, PAD.groundY, 2, 9);
}

function drawTower(ctx, now) {
  var x = PAD.rocketX - 48;
  var topY = 34;

  // two vertical legs of the service structure
  ctx.strokeStyle = COL.metal;
  ctx.lineWidth = 2;
  strokeLine(ctx, x, PAD.groundY, x, topY);
  strokeLine(ctx, x - 10, PAD.groundY, x - 10, topY + 6);

  // cross-bracing, intentionally a little uneven
  ctx.lineWidth = 1;
  ctx.strokeStyle = COL.metalSh;
  for (var y = topY + 8; y < PAD.groundY; y += 16) {
    strokeLine(ctx, x - 10, y, x, y - 2 + (y % 32 === 0 ? 2 : 0));
    strokeLine(ctx, x - 10, y - 8, x, y);           // diagonal truss
    strokeLine(ctx, x - 10, y, x, y - 8);           // opposing diagonal
  }

  // a swing/service arm reaching toward the rocket near the top
  ctx.strokeStyle = COL.metal;
  ctx.lineWidth = 2;
  strokeLine(ctx, x, topY + 14, PAD.rocketX - 12, topY + 14);
  ctx.fillStyle = COL.metalSh;
  ctx.fillRect(PAD.rocketX - 14, topY + 12, 3, 5); // arm coupling

  // tower cap + blinking hazard beacon
  ctx.fillStyle = COL.metalSh;
  ctx.fillRect(x - 11, topY, 12, 3);
  var on = Math.floor(now * 1.6) % 2 === 0;
  ctx.fillStyle = on ? '#ff3020' : '#3a1510';
  ctx.fillRect(x - 5, topY - 4, 3, 3);
}

function drawGroundEquipment(ctx, now) {
  var gy = PAD.groundY;

  // squat propellant tank to the right, with a highlight and a couple bands
  var tx = PAD.rocketX + 40;
  ctx.fillStyle = COL.metalSh;
  ctx.fillRect(tx, gy - 14, 16, 14);
  ctx.fillStyle = COL.metal;
  ctx.fillRect(tx, gy - 14, 4, 14);          // left highlight band
  ctx.fillStyle = '#2f2c24';
  ctx.fillRect(tx, gy - 11, 16, 1);
  ctx.fillRect(tx, gy - 5, 16, 1);
  // little pipe from the tank toward the pad
  ctx.fillStyle = COL.metalSh;
  ctx.fillRect(PAD.rocketX + 20, gy - 3, tx - (PAD.rocketX + 20), 2);

  // small equipment boxes to the left of the trench
  ctx.fillStyle = '#3a382c';
  ctx.fillRect(PAD.rocketX - 30, gy - 6, 8, 6);
  ctx.fillRect(PAD.rocketX - 20, gy - 4, 6, 4);
  ctx.fillStyle = '#4a4838';
  ctx.fillRect(PAD.rocketX - 30, gy - 6, 8, 1);

  // a slack cable draped on the deck
  ctx.strokeStyle = '#2a2820';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.rocketX - 22, gy - 1);
  ctx.quadraticCurveTo(PAD.rocketX - 16, gy + 3, PAD.rocketX - 12, gy - 1);
  ctx.stroke();
}

function drawFuelLines(ctx, state, now) {
  var x = PAD.rocketX;
  var gy = PAD.groundY;

  // two umbilical lines from the tower side into the rocket's flank,
  // with clamp blocks where they meet the hull
  ctx.strokeStyle = '#6f6a54';
  ctx.lineWidth = 2;
  strokeLine(ctx, x - PAD.rocketW / 2 - 1, gy - 26, x - PAD.rocketW / 2 - 8, gy - 12);
  strokeLine(ctx, x - PAD.rocketW / 2 - 8, gy - 12, x - PAD.rocketW / 2 - 8, gy);
  ctx.strokeStyle = '#5a5644';
  strokeLine(ctx, x - PAD.rocketW / 2 - 1, gy - 40, x - PAD.rocketW / 2 - 8, gy - 30);

  // hold-down clamps gripping the base
  ctx.fillStyle = COL.metalSh;
  ctx.fillRect(x - PAD.rocketW / 2 - 4, gy - 8, 4, 6);
  ctx.fillStyle = COL.metal;
  ctx.fillRect(x - PAD.rocketW / 2 - 4, gy - 8, 4, 1);

  // umbilical coupling plates on the hull
  ctx.fillStyle = COL.rivet;
  ctx.fillRect(x - PAD.rocketW / 2 - 1, gy - 27, 2, 3);
  ctx.fillRect(x - PAD.rocketW / 2 - 1, gy - 41, 2, 3);
}

// -- rocket ---------------------------------------------------------------

function drawRocketBody(ctx, liftY, state, now) {
  var x = PAD.rocketX;
  var w = PAD.rocketW;
  var h = PAD.rocketH;
  var baseY = PAD.baseY + liftY;
  var topY = baseY - h;
  var left = x - w / 2;
  var right = x + w / 2;
  var bodyTop = topY + 15;               // where the cylinder starts (below nose)
  var engineTop = baseY - PAD.nozzleH;   // where the engine skirt starts

  // --- engine skirt + nozzle (drawn first, sits behind fins) ---
  ctx.fillStyle = COL.nozzleSh;
  ctx.fillRect(x - 8, engineTop, 16, PAD.nozzleH);
  ctx.fillStyle = COL.nozzle;
  ctx.fillRect(x - 8, engineTop, 5, PAD.nozzleH); // lit side
  // flared nozzle lip
  ctx.fillStyle = COL.nozzleSh;
  ctx.beginPath();
  ctx.moveTo(x - 8, baseY - 2);
  ctx.lineTo(x - 11, baseY);
  ctx.lineTo(x + 11, baseY);
  ctx.lineTo(x + 8, baseY - 2);
  ctx.closePath();
  ctx.fill();

  // --- fins (behind the hull edges), deliberately mismatched ---
  ctx.fillStyle = COL.metalSh;
  ctx.beginPath();               // left fin, larger
  ctx.moveTo(left, engineTop - 6);
  ctx.lineTo(left - 10, baseY + 1);
  ctx.lineTo(left, baseY - 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COL.metal;     // left fin front edge highlight
  ctx.fillRect(left - 2, engineTop - 2, 2, 10);
  ctx.fillStyle = COL.metalSh;
  ctx.beginPath();               // right fin, smaller/asymmetric
  ctx.moveTo(right, engineTop - 4);
  ctx.lineTo(right + 8, baseY);
  ctx.lineTo(right, baseY - 1);
  ctx.closePath();
  ctx.fill();

  // --- main hull with faked cylinder shading (flat bands) ---
  ctx.fillStyle = COL.hull;
  ctx.fillRect(left, bodyTop, w, engineTop - bodyTop);
  ctx.fillStyle = COL.hullHi;                       // left highlight band
  ctx.fillRect(left, bodyTop, 4, engineTop - bodyTop);
  ctx.fillStyle = COL.hullSh;                        // right shadow band
  ctx.fillRect(right - 5, bodyTop, 5, engineTop - bodyTop);

  // --- horizontal panel bands with rivet rows ---
  var bandYs = [bodyTop + 8, bodyTop + 24, engineTop - 6];
  for (var b = 0; b < bandYs.length; b++) {
    var by = bandYs[b];
    ctx.fillStyle = COL.seam;
    ctx.fillRect(left, by, w, 1);
    ctx.fillStyle = COL.rivet;
    for (var rx = left + 2; rx < right - 1; rx += 5) {
      ctx.fillRect(rx, by - 1, 1, 1);              // rivet dots along the seam
    }
  }

  // --- vertical panel seams (slightly off-center = imperfect) ---
  ctx.fillStyle = COL.seam;
  ctx.fillRect(x - 5, bodyTop, 1, engineTop - bodyTop);
  ctx.fillRect(x + 4, bodyTop, 1, engineTop - bodyTop);

  // --- the red band, printed a touch off-register ---
  ctx.fillStyle = COL.band;
  ctx.fillRect(left + 1, bodyTop + 13, w - 2, 5);
  ctx.fillStyle = COL.bandSh;
  ctx.fillRect(left + 1, bodyTop + 17, w - 2, 1);   // shaded lower edge
  ctx.fillStyle = COL.hull;                          // a scuff in the paint
  ctx.fillRect(left + 6, bodyTop + 14, 1, 3);

  // --- warning marking: little black hazard triangle ---
  ctx.fillStyle = COL.markDark;
  ctx.beginPath();
  ctx.moveTo(x + 2, engineTop - 20);
  ctx.lineTo(x - 1, engineTop - 14);
  ctx.lineTo(x + 5, engineTop - 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COL.hullHi;
  ctx.fillRect(x + 1, engineTop - 18, 1, 2);        // the "!" mark
  ctx.fillRect(x + 1, engineTop - 15, 1, 1);

  // --- nose cone with shaded right side + tip antenna ---
  ctx.fillStyle = COL.nose;
  ctx.beginPath();
  ctx.moveTo(left, bodyTop);
  ctx.lineTo(x, topY);
  ctx.lineTo(right, bodyTop);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COL.noseSh;                        // shadow half of the cone
  ctx.beginPath();
  ctx.moveTo(x, topY);
  ctx.lineTo(right, bodyTop);
  ctx.lineTo(x, bodyTop);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COL.seam;
  ctx.fillRect(x - 3, bodyTop - 1, 6, 1);           // collar under the cone
  ctx.fillStyle = COL.metal;
  ctx.fillRect(x, topY - 4, 1, 4);                  // tip antenna

  // --- capsule window + engine status light ---
  ctx.fillStyle = '#2c3a44';
  ctx.fillRect(x - 2, bodyTop + 3, 4, 3);           // window
  ctx.fillStyle = '#4a6a7a';
  ctx.fillRect(x - 2, bodyTop + 3, 1, 1);           // window glint

  var bad = state.engineStatus === 'DEGRADED';
  var blink = Math.floor(now * (bad ? 4 : 1)) % 2 === 0;
  ctx.fillStyle = bad ? (blink ? '#ff5030' : '#4a1810') : '#3aa050';
  ctx.fillRect(x - 6, bodyTop + 22, 2, 2);          // status lamp on the hull
}

// -- flame / exhaust ------------------------------------------------------

function drawFlame(ctx, liftY, state, now) {
  var x = PAD.rocketX;
  var baseY = PAD.baseY + liftY;
  var lc = state.launchClock || 0;
  var grow = Math.min(1, lc / 0.6);
  var flick = Math.sin(now * 30) + Math.sin(now * 53) * 0.5;
  var len = 8 + grow * 34 + flick * 3;
  var wob = Math.sin(now * 41) * 2;

  // outer plume
  ctx.fillStyle = '#ff7a2a';
  flameTri(ctx, x, baseY, 9, len);
  // mid body
  ctx.fillStyle = '#ffcf4d';
  flameTri(ctx, x + wob * 0.5, baseY, 6, len * 0.78);
  // white-hot core
  ctx.fillStyle = '#fff4c8';
  flameTri(ctx, x + wob * 0.3, baseY, 3, len * 0.5);

  // shock diamonds: a couple of bright pips down the core
  ctx.fillStyle = '#fffbe6';
  ctx.fillRect(x - 1, baseY + len * 0.28, 2, 2);
  ctx.fillRect(x - 1, baseY + len * 0.46, 2, 1);

  // ground splash: flame flares sideways when close to the deck
  if (liftY > -18) {
    var splash = PAD.groundY;
    ctx.fillStyle = 'rgba(255,150,60,0.7)';
    ctx.fillRect(x - 20, splash - 2, 40, 3);
    ctx.fillStyle = 'rgba(255,200,90,0.6)';
    ctx.fillRect(x - 12, splash - 3, 24, 2);
  }
}

function flameTri(ctx, x, baseY, halfW, len) {
  ctx.beginPath();
  ctx.moveTo(x - halfW, baseY);
  ctx.lineTo(x, baseY + len);
  ctx.lineTo(x + halfW, baseY);
  ctx.closePath();
  ctx.fill();
}

function drawSmoke(ctx, state, now, liftY) {
  var smokePhases = ['COUNTDOWN', 'HOLD', 'MANUAL_HOLD', 'POLL', 'LAUNCH'];
  if (smokePhases.indexOf(state.phase) === -1) return;
  var x = PAD.rocketX;

  if (state.phase === 'LAUNCH') {
    // ignition: a big exhaust cloud billowing out along the deck + a rising
    // column the vehicle climbs out of. this is the payoff moment.
    var lc = state.launchClock;
    var spread = Math.min(1, lc / 1.5);
    for (var i = 0; i < 16; i++) {
      var ang = (i / 16) * Math.PI * 2 + i * 1.3;
      var dist = (10 + (i % 4) * 9) * spread + Math.sin(now * 2 + i) * 3;
      var sx = x + Math.cos(ang) * dist;
      var sy = PAD.groundY - 2 - Math.abs(Math.sin(ang)) * dist * 0.35;
      var size = 5 + (i % 3) * 3;
      var shade = i % 2 === 0 ? 'rgba(150,146,138,0.5)' : 'rgba(120,116,110,0.45)';
      ctx.fillStyle = shade;
      ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
    }
    // vertical smoke column trailing the rocket
    if (liftY < -4) {
      for (var c = 0; c < 6; c++) {
        var cy = PAD.groundY + liftY + c * 8 + (now * 20 % 8);
        if (cy > PAD.groundY) continue;
        var cw = 10 + c + Math.sin(now * 3 + c) * 2;
        ctx.fillStyle = 'rgba(140,136,128,0.35)';
        ctx.fillRect(x - cw / 2 + Math.sin(now + c) * 3, cy, cw, 6);
      }
    }
    return;
  }

  // idle: soft venting drifting off the pad
  ctx.fillStyle = 'rgba(180,180,170,0.32)';
  for (var j = 0; j < 4; j++) {
    var t = (now * 0.5 + j * 1.7) % 3.2;
    var vx = x - 26 + Math.sin(now + j) * 6 + j * 16;
    var vy = PAD.groundY - t * 7;
    var vsize = 3 + t * 3;
    ctx.fillRect(vx, vy, vsize, vsize);
  }
}

function drawExplosion(ctx, now, failClock) {
  var x = PAD.rocketX;
  var y = PAD.baseY - 22;
  var age = failClock - 0.4;
  var r = Math.min(46, age * 62);
  var colors = ['#fff0c0', '#ff5030', '#ff9020', '#4a1810'];
  for (var i = 0; i < 16; i++) {
    var ang = (i / 16) * Math.PI * 2 + i;
    var dist = r * (0.35 + (i % 4) * 0.18);
    var px = x + Math.cos(ang) * dist;
    var py = y + Math.sin(ang) * dist * 0.65;
    ctx.fillStyle = colors[i % colors.length];
    var s = 5 - age;
    if (s < 1) s = 1;
    ctx.fillRect(px - s / 2, py - s / 2, s, s);
  }
  // lingering dark smoke rising after the fireball
  if (age > 0.4) {
    ctx.fillStyle = 'rgba(60,56,50,0.5)';
    for (var k = 0; k < 6; k++) {
      var sx = x + Math.sin(k * 2 + now) * 10;
      var sy = y - (age - 0.4) * 30 - k * 6;
      ctx.fillRect(sx - 4, sy, 8, 7);
    }
  }
}

function strokeLine(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
