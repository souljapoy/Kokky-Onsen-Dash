// Kokky's Hot Spring Hop – polished visual + physics build
// No carrots, no sound. Lanterns + snow + moon + stars + steam.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl  = document.getElementById("best");
const msgEl   = document.getElementById("msg");

const playerOverlay = document.getElementById("playerOverlay");
const playerIdLabel = document.getElementById("playerIdLabel");
const changePlayerBtn = document.getElementById("changePlayerBtn");

const teamButtonsContainer = document.getElementById("teamButtons");
const numberList = document.getElementById("numberList");
const selectedPreview = document.getElementById("selectedPreview");
const confirmPlayerBtn = document.getElementById("confirmPlayerBtn");
const cancelPlayerBtn = document.getElementById("cancelPlayerBtn");

const W = canvas.width;
const H = canvas.height;

// ---- Teams / players ----

const TEAM_CONFIG = {
  W: { label: "White", numbers: [5,8,9,18,19,22,28,29,30,34], alts: ["A","B"] },
  R: { label: "Red",   numbers: [1,4,6,7,11,13,20,21,27,31,40], alts: ["A","B"] },
  B: { label: "Blue",  numbers: [2,3,15,16,17,25,32,33,38,41], alts: ["A","B"] },
  G: { label: "Green", numbers: [10,12,14,23,24,26,35,36,37,39], alts: ["A","B"] },
  Guest: { label: "Guest", numbers: [0], alts: [] }
};

const RANKS = [
  { threshold: 25,  title: "Steam Hopper" },
  { threshold: 50,  title: "Onsen Ace" },
  { threshold: 75,  title: "Steam Master" },
  { threshold: 100, title: "Onsen Overlord" },
  { threshold: 250, title: "King of the Onsen" },
  { threshold: 500, title: "Onsen Legend" },
  { threshold: 1000, title: "Onsen God" }
];

// ---- Assets ----

const kokkyImg = new Image();
kokkyImg.src = "kokky.png";
let kokkyLoaded = false;
kokkyImg.onload = () => { kokkyLoaded = true; };

const mountainsImg = new Image();
mountainsImg.src = "mountains.png";
let mountainsLoaded = false;
mountainsImg.onload = () => { mountainsLoaded = true; };

const woodImg = new Image();
woodImg.src = "wood.png";
let woodLoaded = false;
woodImg.onload = () => { woodLoaded = true; };

const steamImg = new Image();
steamImg.src = "steam.png";
let steamLoaded = false;
steamImg.onload = () => { steamLoaded = true; };

// ---- Game state ----

let currentPlayerId = localStorage.getItem("onsen_player_id") || null;

// Player
let player = { x: 120, y: H/2, vy: 0, r: 21 }; // slightly smaller radius
const gravity = 0.45;
const hopPower = -8.8;

// Core state
let running = false;
let obstacles = [];
let score = 0;
let obstaclesPassed = 0;
let spawnTimer = 0;
let lastGapCenter = H / 2;

// Parallax
let mountainsOffset = 0;
let steamOffset = 0;
let steamPhase = 0;

// Effects
let hopPuffs = [];
let stars = [];
let snowflakes = [];
let lanterns = [];

// Rank popup
let nextRankIndex = 0;
let rankPopupTimer = 0;
let rankPopupTitle = "";

// Screen shake
let shakeTimer = 0;

// Gap / speed
const gapSize = 150;
const baseSpeed = 3;
const boostedSpeed = 3.8;

// ---- Init ----

initStars();
initSnow();
initLanterns();
updatePlayerLabel();
updateBestFromLeaderboard();
initControls();

// ---- Player overlay ----

let selectedTeamKey = null;
let selectedNumberCode = null;

function openPlayerOverlay() {
  selectedTeamKey = null;
  selectedNumberCode = null;
  confirmPlayerBtn.disabled = true;
  selectedPreview.textContent = "Player: -";
  numberList.innerHTML = '<p class="hint">Select a team first.</p>';

  Array.from(document.querySelectorAll(".teamBtn")).forEach(btn => {
    btn.classList.remove("selected");
  });

  playerOverlay.classList.remove("hidden");
}

function closePlayerOverlay(committed) {
  playerOverlay.classList.add("hidden");
  if (!committed && !currentPlayerId) {
    setTimeout(openPlayerOverlay, 10);
  }
}

teamButtonsContainer.addEventListener("click", e => {
  const btn = e.target.closest(".teamBtn");
  if (!btn) return;
  const teamKey = btn.dataset.team;
  selectedTeamKey = teamKey;
  selectedNumberCode = null;
  confirmPlayerBtn.disabled = true;
  selectedPreview.textContent = "Player: -";

  Array.from(teamButtonsContainer.querySelectorAll(".teamBtn")).forEach(b => {
    b.classList.toggle("selected", b === btn);
  });

  buildNumberList(teamKey);
});

function buildNumberList(teamKey) {
  const cfg = TEAM_CONFIG[teamKey];
  numberList.innerHTML = "";
  if (!cfg) {
    numberList.innerHTML = '<p class="hint">Unknown team.</p>';
    return;
  }

  if (teamKey === "Guest") {
    const btn = document.createElement("button");
    btn.textContent = "0 – Guest";
    btn.dataset.code = "0";
    btn.addEventListener("click", () => selectNumberCode("0", btn));
    numberList.appendChild(btn);
    return;
  }

  const allCodes = [...cfg.numbers.map(n => String(n)), ...cfg.alts];
  allCodes.forEach(code => {
    const btn = document.createElement("button");
    btn.textContent = (code === "A" || code === "B") ? `${code} (ALT)` : code;
    btn.dataset.code = code;
    btn.addEventListener("click", () => selectNumberCode(code, btn));
    numberList.appendChild(btn);
  });
}

function selectNumberCode(code, btn) {
  selectedNumberCode = code;
  Array.from(numberList.querySelectorAll("button")).forEach(b => {
    b.classList.remove("selected");
  });
  btn.classList.add("selected");
  updatePreviewAndButton();
}

function updatePreviewAndButton() {
  if (!selectedTeamKey || !selectedNumberCode) {
    confirmPlayerBtn.disabled = true;
    selectedPreview.textContent = "Player: -";
    return;
  }
  let idStr;
  if (selectedTeamKey === "Guest") idStr = "0";
  else idStr = `${selectedTeamKey}-${selectedNumberCode}`;
  selectedPreview.textContent = `Player: ${idStr}`;
  confirmPlayerBtn.disabled = false;
}

confirmPlayerBtn.addEventListener("click", () => {
  if (!selectedTeamKey || !selectedNumberCode) return;
  let idStr;
  if (selectedTeamKey === "Guest") idStr = "0";
  else idStr = `${selectedTeamKey}-${selectedNumberCode}`;
  currentPlayerId = idStr;
  localStorage.setItem("onsen_player_id", currentPlayerId);
  updatePlayerLabel();
  updateBestFromLeaderboard();
  closePlayerOverlay(true);
});

cancelPlayerBtn.addEventListener("click", () => {
  closePlayerOverlay(false);
});

changePlayerBtn.addEventListener("click", () => {
  openPlayerOverlay();
});

// ---- Controls ----

function initControls() {
  window.addEventListener("keydown", e => {
    if (e.code === "Space") {
      if (!running) startGame();
      else hop();
      e.preventDefault();
    }
  });
  canvas.addEventListener("pointerdown", () => {
    if (!running) startGame();
    else hop();
  });
}

// ---- Helpers ----

function updatePlayerLabel() {
  playerIdLabel.textContent = currentPlayerId ? currentPlayerId : "Not set";
}

function loadBoard() {
  try {
    const raw = localStorage.getItem("onsen_lb");
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveBoard(list) {
  localStorage.setItem("onsen_lb", JSON.stringify(list));
}

function updateBestFromLeaderboard() {
  if (!currentPlayerId) {
    bestEl.textContent = "0";
    return;
  }
  const list = loadBoard();
  const entry = list.find(e => e.id === currentPlayerId);
  bestEl.textContent = entry ? entry.score : 0;
}

function getRankIndexForObstacles(count) {
  let idx = -1;
  for (let i = 0; i < RANKS.length; i++) {
    if (count >= RANKS[i].threshold) idx = i;
  }
  return idx;
}

function initStars() {
  stars = [];
  for (let i = 0; i < 60; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.5,
      phase: Math.random() * Math.PI * 2,
      warm: Math.random() < 0.3
    });
  }
}

function initSnow() {
  snowflakes = [];
  for (let i = 0; i < 40; i++) {
    snowflakes.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vy: 0.4 + Math.random() * 0.6,
      size: 1 + Math.random() * 2,
      alpha: 0.3 + Math.random() * 0.3
    });
  }
}

function initLanterns() {
  lanterns = [];
  const count = 8;
  for (let i = 0; i < count; i++) {
    lanterns.push({
      x: i * 120 + 60,
      y: H * 0.55 + Math.random() * 80,
      phase: Math.random() * Math.PI * 2
    });
  }
}

// ---- Game control ----

function startGame() {
  if (!currentPlayerId) {
    openPlayerOverlay();
    return;
  }
  running = true;
  score = 0;
  obstaclesPassed = 0;
  scoreEl.textContent = score;
  msgEl.textContent = "";
  obstacles = [];
  hopPuffs = [];
  player.y = H / 2;
  player.vy = 0;
  spawnTimer = 0;
  lastGapCenter = H / 2;
  nextRankIndex = 0;
  rankPopupTimer = 0;
  rankPopupTitle = "";
}

function hop() {
  if (!running) return;
  player.vy = hopPower;

  // flat hop steam puff (more visible)
  hopPuffs.push({
    x: player.x,
    y: player.y + player.r * 0.7,
    rx: 10,
    ry: 5,
    alpha: 0.7
  });
}

function endGame() {
  running = false;
  shakeTimer = 10;

  if (!currentPlayerId || score <= 0) {
    msgEl.textContent = `Score: ${score}`;
    return;
  }

  const runRankIndex = getRankIndexForObstacles(obstaclesPassed);
  let list = loadBoard();
  let entry = list.find(e => e.id === currentPlayerId);
  const prevScore = entry ? entry.score : 0;
  const prevRankIndex = entry && typeof entry.bestRankIndex === "number"
    ? entry.bestRankIndex
    : -1;

  const isBetterScore = score > prevScore;
  const isBetterRank = runRankIndex > prevRankIndex;

  if (!entry) {
    entry = {
      id: currentPlayerId,
      score: score,
      ts: Date.now(),
      bestRankIndex: runRankIndex
    };
    list.push(entry);
  } else {
    if (isBetterScore) {
      entry.score = score;
      entry.ts = Date.now();
    }
    if (isBetterRank) {
      entry.bestRankIndex = runRankIndex;
      if (!isBetterScore) entry.ts = Date.now();
    }
  }

  list.sort((a, b) => b.score - a.score || a.ts - b.ts);
  if (list.length > 50) list = list.slice(0, 50);
  saveBoard(list);

  msgEl.textContent = isBetterScore
    ? `New Best! ${score}`
    : `Score: ${score} (Best: ${prevScore})`;

  updateBestFromLeaderboard();
}

function checkRankUp() {
  if (nextRankIndex >= RANKS.length) return;
  const nextRank = RANKS[nextRankIndex];
  if (obstaclesPassed >= nextRank.threshold) {
    rankPopupTitle = nextRank.title;
    rankPopupTimer = 150;
    nextRankIndex++;
  }
}

// ---- Obstacles ----

function addObstacle() {
  const minCenter = 140;
  const maxCenter = H - 200;
  const maxDelta = 120;

  let center = lastGapCenter + (Math.random() * 2 - 1) * maxDelta;

  // Occasionally force extremes to create real challenge
  if (Math.random() < 0.15) {
    center = Math.random() < 0.5 ? minCenter : maxCenter;
  }

  center = Math.max(minCenter, Math.min(maxCenter, center));
  lastGapCenter = center;

  const top = center - gapSize / 2;
  obstacles.push({
    x: W + 40,
    top,
    gap: gapSize,
    passed: false
  });
}

// collision using slightly lower center (ears forgiven a bit)
function collideObstacle(o) {
  const colY = player.y + 4;
  const r = player.r;

  if (player.x + r > o.x && player.x - r < o.x + 40) {
    if (colY - r < o.top || colY + r > o.top + o.gap) {
      return true;
    }
  }
  return false;
}

// ---- Bamboo draw (tiled, not stretched) ----

function drawBambooPillar(x, y, height) {
  if (!woodLoaded || height <= 0) return;

  const targetW = 40;
  const scale = targetW / woodImg.width;
  const segH = woodImg.height * scale;

  let remaining = height;
  let drawY = y;

  while (remaining > 0) {
    const h = Math.min(segH, remaining);
    const srcH = (h / segH) * woodImg.height;

    ctx.drawImage(
      woodImg,
      0, 0, woodImg.width, srcH,
      x, drawY, targetW, h
    );

    drawY += h;
    remaining -= h;
  }
}

// ---- Update ----

function updateGame() {
  if (!running) return;

  player.vy += gravity;
  player.y += player.vy;

  if (player.y + player.r > H || player.y - player.r < 0) {
    endGame();
    return;
  }

  const speed = obstaclesPassed >= 60 ? boostedSpeed : baseSpeed;

  mountainsOffset -= speed * 0.25;
  if (mountainsOffset <= -W) mountainsOffset += W;

  steamOffset -= speed * 0.5;
  if (steamOffset <= -W) steamOffset += W;

  steamPhase += 0.02;

  // snow fall
  snowflakes.forEach(s => {
    s.y += s.vy;
    if (s.y > H * 0.85) s.alpha -= 0.02;
    if (s.y > H || s.alpha <= 0) {
      s.x = Math.random() * W;
      s.y = -10;
      s.vy = 0.4 + Math.random() * 0.6;
      s.size = 1 + Math.random() * 2;
      s.alpha = 0.3 + Math.random() * 0.3;
    }
  });

  // lanterns scroll (behind obstacles)
  lanterns.forEach(l => {
    l.x -= speed * 0.6;
    if (l.x < -40) {
      l.x += W + 160;
      l.y = H * 0.55 + Math.random() * 80;
    }
  });

  // obstacle spawn
  spawnTimer++;
  if (spawnTimer > 80) {
    spawnTimer = 0;
    addObstacle();
  }

  // obstacles move / scoring
  obstacles.forEach(o => {
    o.x -= speed;
    if (!o.passed && o.x + 40 < player.x) {
      o.passed = true;
      obstaclesPassed++;
      score++;
      scoreEl.textContent = score;
      checkRankUp();
    }
  });

  for (const o of obstacles) {
    if (collideObstacle(o)) {
      endGame();
      return; // keep obstacles; don't remove on hit
    }
  }

  obstacles = obstacles.filter(o => o.x > -60);

  // hop puffs
  hopPuffs.forEach(p => {
    p.y += 0.4;
    p.alpha -= 0.03;
    p.rx += 0.1;
    p.ry += 0.05;
  });
  hopPuffs = hopPuffs.filter(p => p.alpha > 0);

  if (rankPopupTimer > 0) rankPopupTimer--;
}

// ---- Draw ----

function draw() {
  ctx.save();

  if (shakeTimer > 0) {
    const dx = (Math.random() * 4 - 2);
    const dy = (Math.random() * 4 - 2);
    ctx.translate(dx, dy);
    shakeTimer--;
  }

  // smoother single-night sky (no obvious band)
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#0a1633");
  grad.addColorStop(0.6, "#050818");
  grad.addColorStop(1, "#02040b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // stars
  ctx.save();
  const t = performance.now() / 400;
  stars.forEach(s => {
    const tw = 0.5 + 0.5 * Math.sin(t + s.phase);
    ctx.globalAlpha = 0.25 + 0.5 * tw;
    ctx.fillStyle = s.warm ? "#f6e69c" : "#e8f0ff";
    ctx.fillRect(s.x, s.y, 2, 2);
  });
  ctx.restore();

  // moon
  ctx.save();
  const moonX = W - 80;
  const moonY = 80;
  const moonR = 26;
  const moonGrad = ctx.createRadialGradient(
    moonX - 8, moonY - 8, 4,
    moonX, moonY, moonR + 6
  );
  moonGrad.addColorStop(0, "#fff9d9");
  moonGrad.addColorStop(1, "#bba86a");
  ctx.fillStyle = moonGrad;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#d8c78a";
  ctx.beginPath();
  ctx.arc(moonX - 8, moonY - 6, 6, 0, Math.PI * 2);
  ctx.arc(moonX + 5, moonY + 4, 4, 0, Math.PI * 2);
  ctx.arc(moonX + 10, moonY - 10, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // mountains (higher, darker, blended)
  if (mountainsLoaded) {
    const mh = 180;
    const my = H * 0.5;
    const scale = mh / mountainsImg.height;
    const mw = mountainsImg.width * scale;

    let x = mountainsOffset % mw;
    if (x > 0) x -= mw;

    ctx.save();
    ctx.globalAlpha = 0.9;
    for (; x < W; x += mw) {
      ctx.drawImage(mountainsImg, x, my, mw, mh);
    }
    ctx.restore();

    ctx.save();
    const mg = ctx.createLinearGradient(0, my, 0, my + mh);
    mg.addColorStop(0, "rgba(0,0,0,0.08)");
    mg.addColorStop(1, "rgba(0,0,0,0.3)");
    ctx.fillStyle = mg;
    ctx.fillRect(0, my, W, mh);
    ctx.restore();
  }

  // snow behind everything
  ctx.save();
  snowflakes.forEach(s => {
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle = "#e6f0ff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
  ctx.globalAlpha = 1;

  // lanterns (behind obstacles)
  ctx.save();
  lanterns.forEach(l => {
    const glowR = 16;
    const glowGrad = ctx.createRadialGradient(
      l.x, l.y, 0,
      l.x, l.y, glowR
    );
    glowGrad.addColorStop(0, "rgba(255,200,130,0.7)");
    glowGrad.addColorStop(1, "rgba(255,200,130,0)");
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(l.x, l.y, glowR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // simple lantern body
    ctx.fillStyle = "#ffb86c";
    ctx.fillRect(l.x - 6, l.y - 10, 12, 14);
    ctx.fillStyle = "#c45a32";
    ctx.fillRect(l.x - 7, l.y + 4, 14, 3);
  });
  ctx.restore();

  // bottom steam – image + gentle vertical motion
  if (steamLoaded) {
    const sh = 150;
    const baseSy = H - sh;
    const wobble = Math.sin(steamPhase) * 4;
    const sy = baseSy + wobble;

    const scale = sh / steamImg.height;
    const sw = steamImg.width * scale;

    let x = steamOffset % sw;
    if (x > 0) x -= sw;

    ctx.save();
    ctx.globalAlpha = 0.96;
    for (; x < W; x += sw) {
      ctx.drawImage(steamImg, x, sy, sw, sh);
    }
    ctx.restore();

    // fade top of steam into mountains/sky
    ctx.save();
    const sg = ctx.createLinearGradient(0, sy, 0, sy - 60);
    sg.addColorStop(0, "rgba(255,255,255,0.7)");
    sg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(0, sy - 60, W, 60);
    ctx.restore();
  }

  // hop puffs (flat steam)
  ctx.save();
  hopPuffs.forEach(p => {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = "#f7f7ff";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
  ctx.globalAlpha = 1;

  // obstacles – tiled bamboo
  obstacles.forEach(o => {
    if (woodLoaded) {
      drawBambooPillar(o.x, 0, o.top);
      drawBambooPillar(o.x, o.top + o.gap, H - (o.top + o.gap));
    } else {
      ctx.fillStyle = "#5c3b1e";
      ctx.fillRect(o.x, 0, 40, o.top);
      ctx.fillRect(o.x, o.top + o.gap, 40, H - (o.top + o.gap));
    }
  });

  // player
  if (kokkyLoaded) {
    const size = 56;
    ctx.drawImage(kokkyImg, player.x - size / 2, player.y - size / 2, size, size);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // rank popup
  if (rankPopupTimer > 0) {
    const alpha = rankPopupTimer > 30 ? 1 : rankPopupTimer / 30;
    ctx.globalAlpha = alpha;
    const boxW = 280;
    const boxH = 70;
    const bx = (W - boxW) / 2;
    const by = 100;

    const rgrad = ctx.createLinearGradient(bx, by, bx + boxW, by + boxH);
    rgrad.addColorStop(0, "#ffeb9c");
    rgrad.addColorStop(1, "#f6c14d");
    ctx.fillStyle = rgrad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, boxW, boxH, 12);
    else ctx.rect(bx, by, boxW, boxH);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#7a4b00";
    ctx.font = "18px 'Handjet'";
    ctx.textAlign = "center";
    ctx.fillText("Rank Up!", W / 2, by + 30);

    ctx.font = "16px 'Handjet'";
    ctx.fillText(rankPopupTitle, W / 2, by + 50);

    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

// ---- Main loop ----

function loop() {
  updateGame();
  draw();
  requestAnimationFrame(loop);
}
loop();

if (!currentPlayerId) {
  openPlayerOverlay();
}
