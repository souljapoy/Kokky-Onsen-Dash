// Kokky's Hot Spring Hop – current polished build
// Uses:
//  - kokky.png        (player)
//  - mountains.png    (background parallax)
//  - wood.png         (bamboo obstacles)
//  - steam.png        (bottom steam strip)
//  - hop1.mp3         (jump sfx)

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

// ------------ Player / team setup ------------

const TEAM_CONFIG = {
  W: { label: "White", numbers: [5,8,9,18,19,22,28,29,30,34], alts: ["A","B"] },
  R: { label: "Red",   numbers: [1,4,6,7,11,13,20,21,27,31,40], alts: ["A","B"] },
  B: { label: "Blue",  numbers: [2,3,15,16,17,25,32,33,38,41], alts: ["A","B"] },
  G: { label: "Green", numbers: [10,12,14,23,24,26,35,36,37,39], alts: ["A","B"] },
  Guest: { label: "Guest", numbers: [0], alts: [] }
};

// Rank thresholds (obstacles passed)
const RANKS = [
  { threshold: 25,  title: "Steam Hopper" },
  { threshold: 50,  title: "Onsen Ace" },
  { threshold: 75,  title: "Steam Master" },
  { threshold: 100, title: "Onsen Overlord" },
  { threshold: 250, title: "King of the Onsen" },
  { threshold: 500, title: "Onsen Legend" },
  { threshold: 1000, title: "Onsen God" }
];

// ------------ Assets ------------

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

// Hop sound pool (to reduce lag on mobile)
let hopSounds = [];
let hopSoundIndex = 0;
for (let i = 0; i < 3; i++) {
  try {
    const a = new Audio("hop1.mp3");
    a.volume = 0.45;
    hopSounds.push(a);
  } catch (e) {}
}

function playHopSound() {
  if (!hopSounds.length) return;
  const a = hopSounds[hopSoundIndex];
  hopSoundIndex = (hopSoundIndex + 1) % hopSounds.length;
  try {
    a.currentTime = 0;
    a.play();
  } catch (e) {
    // ignore autoplay errors
  }
}

// ------------ Game state ------------

let running = false;
let obstacles = [];
let carrots = [];
let score = 0;
let obstaclesPassed = 0;
let carrotWaveCount = 0;
let lastCarrotWaveObstacleCount = 0;
let carrotPatternIndex = 0;

let currentPlayerId = localStorage.getItem("onsen_player_id") || null;

let player = { x: 120, y: H/2, vy: 0, r: 24 };
const gravity = 0.45;
const hopPower = -8.8;
const gapSize = 180;
let spawnTimer = 0;

// game speed (single bump after level 60)
const baseSpeed = 3;
const boostedSpeed = 3.8;

// Rank popup
let nextRankIndex = 0;
let rankPopupTimer = 0;
let rankPopupTitle = "";

// Screen shake
let shakeTimer = 0;

// Hop steam puffs
let hopPuffs = [];

// Stars + snow
let stars = [];
let snowflakes = [];

// Mountains & steam parallax
let mountainsOffset = 0;
let steamOffset = 0;

// Carrot wave–linked obstacle spawn
let needObstacleAfterWave = false;
let obstacleAfterWaveX = 0;

// ------------ Init UI / world ------------

updatePlayerLabel();
updateBestFromLeaderboard();
initStars();
initSnow();

// ------------ Controls ------------

window.addEventListener("keydown", e => {
  if (e.code === "Space") {
    if (!running) {
      startGame();
    } else {
      hop();
    }
    e.preventDefault();
  }
});

canvas.addEventListener("pointerdown", () => {
  if (!running) {
    startGame();
  } else {
    hop();
  }
});

changePlayerBtn.addEventListener("click", () => {
  openPlayerOverlay();
});

cancelPlayerBtn.addEventListener("click", () => {
  closePlayerOverlay(false);
});

// ------------ Player overlay logic ------------

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
  if (selectedTeamKey === "Guest") {
    idStr = "0";
  } else {
    idStr = `${selectedTeamKey}-${selectedNumberCode}`;
  }
  selectedPreview.textContent = `Player: ${idStr}`;
  confirmPlayerBtn.disabled = false;
}

confirmPlayerBtn.addEventListener("click", () => {
  if (!selectedTeamKey || !selectedNumberCode) return;

  let idStr;
  if (selectedTeamKey === "Guest") {
    idStr = "0";
  } else {
    idStr = `${selectedTeamKey}-${selectedNumberCode}`;
  }
  currentPlayerId = idStr;
  localStorage.setItem("onsen_player_id", currentPlayerId);
  updatePlayerLabel();
  updateBestFromLeaderboard();
  closePlayerOverlay(true);
});

// ------------ Helpers ------------

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

// ------------ Game control ------------

function startGame() {
  if (!currentPlayerId) {
    openPlayerOverlay();
    return;
  }
  running = true;
  score = 0;
  obstaclesPassed = 0;
  carrotWaveCount = 0;
  lastCarrotWaveObstacleCount = 0;
  carrotPatternIndex = 0;
  nextRankIndex = 0;
  rankPopupTimer = 0;
  rankPopupTitle = "";
  scoreEl.textContent = score;
  msgEl.textContent = "";
  obstacles = [];
  carrots = [];
  hopPuffs = [];
  player.y = H / 2;
  player.vy = 0;
  spawnTimer = 0;
  needObstacleAfterWave = false;
}

function hop() {
  if (!running) return;
  player.vy = hopPower;

  // hop steam puff (small & subtle)
  hopPuffs.push({
    x: player.x,
    y: player.y + player.r * 0.6,
    radius: 6,
    alpha: 0.35
  });

  playHopSound();
}

// ------------ Spawning ------------

function addObstacle(xOverride) {
  const minCenter = 120;
  const maxCenter = H - 140;
  const baseCenter = minCenter + Math.random() * (maxCenter - minCenter);
  const mix = 0.7 * baseCenter + 0.3 * player.y;
  const center = Math.max(minCenter, Math.min(maxCenter, mix));
  const top = center - gapSize / 2;

  obstacles.push({
    x: (typeof xOverride === "number") ? xOverride : (W + 40),
    top,
    gap: gapSize,
    passed: false
  });
}

// carrot wave: 10 carrots, 1 golden, random pattern
function spawnCarrotWave() {
  carrotWaveCount++;
  const goldenIndex = Math.floor(Math.random() * 10);
  const pattern = carrotPatternIndex % 5;
  carrotPatternIndex++;

  const baseX = W + 60;
  const stepX = 24;
  const baseY = H / 2;

  let lastX = baseX;

  for (let i = 0; i < 10; i++) {
    let offsetY = 0;
    if (pattern === 0) {
      const center = 4.5;
      const d = i - center;
      offsetY = d * d * 3;
    } else if (pattern === 1) {
      offsetY = -30 + i * 6;
    } else if (pattern === 2) {
      offsetY = 30 - i * 6;
    } else if (pattern === 3) {
      offsetY = -10;
    } else if (pattern === 4) {
      offsetY = Math.sin(i * 0.8) * 25;
    }

    const cx = baseX + i * stepX;
    carrots.push({
      x: cx,
      y: baseY + offsetY,
      r: 14,
      golden: (i === goldenIndex)
    });
    lastX = cx;
  }

  // Force next obstacle to appear soon after wave
  needObstacleAfterWave = true;
  obstacleAfterWaveX = lastX + 40; // tighter spacing after wave
}

// ------------ Collision helpers ------------

function collideObstacle(o) {
  if (player.x + player.r > o.x && player.x - player.r < o.x + 40) {
    if (player.y - player.r < o.top || player.y + player.r > o.top + o.gap) {
      return true;
    }
  }
  return false;
}

function collideCarrot(c) {
  const dx = player.x - c.x;
  const dy = player.y - c.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < (player.r + c.r);
}

// ------------ Game over ------------

function endGame() {
  running = false;
  shakeTimer = 12;

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
      if (!isBetterScore) {
        entry.ts = Date.now();
      }
    }
  }

  list.sort((a, b) => b.score - a.score || a.ts - b.ts);
  if (list.length > 50) list = list.slice(0, 50);
  saveBoard(list);

  if (isBetterScore) {
    msgEl.textContent = `New Best! ${score}`;
  } else {
    msgEl.textContent = `Score: ${score} (Best: ${prevScore})`;
  }

  updateBestFromLeaderboard();
}

// ------------ Rank up ------------

function checkRankUp() {
  if (nextRankIndex >= RANKS.length) return;
  const nextRank = RANKS[nextRankIndex];
  if (obstaclesPassed >= nextRank.threshold) {
    rankPopupTitle = nextRank.title;
    rankPopupTimer = 150;
    nextRankIndex++;
  }
}

// ------------ Update loop ------------

function updateGame() {
  if (!running) return;

  // physics
  player.vy += gravity;
  player.y += player.vy;

  if (player.y + player.r > H || player.y - player.r < 0) {
    endGame();
    return;
  }

  const speed = obstaclesPassed >= 60 ? boostedSpeed : baseSpeed;

  // parallax mountains & steam scroll
  mountainsOffset -= speed * 0.25;
  if (mountainsOffset <= -W) mountainsOffset += W;

  steamOffset -= speed * 0.5;
  if (steamOffset <= -W) steamOffset += W;

  // gentle snow
  snowflakes.forEach(s => {
    s.y += s.vy;
    if (s.y > H * 0.85) {
      s.alpha -= 0.02; // melt near steam
    }
    if (s.y > H || s.alpha <= 0) {
      s.x = Math.random() * W;
      s.y = -10;
      s.vy = 0.4 + Math.random() * 0.6;
      s.size = 1 + Math.random() * 2;
      s.alpha = 0.3 + Math.random() * 0.3;
    }
  });

  // obstacle spawn
  const maxSpacing = 80; // slightly tighter than before

  if (needObstacleAfterWave) {
    addObstacle(obstacleAfterWaveX);
    needObstacleAfterWave = false;
    spawnTimer = 0;
  } else {
    spawnTimer++;
    if (spawnTimer > maxSpacing) {
      spawnTimer = 0;
      addObstacle();
    }
  }

  // obstacle motion & scoring
  obstacles.forEach(o => {
    o.x -= speed;
    if (!o.passed && o.x + 40 < player.x) {
      o.passed = true;
      obstaclesPassed++;
      score++;
      scoreEl.textContent = score;

      checkRankUp();

      if (obstaclesPassed % 10 === 0 &&
          obstaclesPassed !== lastCarrotWaveObstacleCount) {
        lastCarrotWaveObstacleCount = obstaclesPassed;
        spawnCarrotWave();
      }
    }
  });

  obstacles = obstacles.filter(o => o.x > -60);

  for (const o of obstacles) {
    if (collideObstacle(o)) {
      endGame();
      return;
    }
  }

  // carrots
  carrots.forEach(c => {
    c.x -= speed;
  });
  carrots = carrots.filter(c => {
    if (collideCarrot(c)) {
      score += c.golden ? 5 : 1;
      scoreEl.textContent = score;
      return false;
    }
    return c.x > -30;
  });

  // hop puffs
  hopPuffs.forEach(p => {
    p.y -= 0.6;
    p.radius += 0.3;
    p.alpha -= 0.03;
  });
  hopPuffs = hopPuffs.filter(p => p.alpha > 0);

  // rank popup timer
  if (rankPopupTimer > 0) {
    rankPopupTimer--;
  }
}

// ------------ Draw ------------

function draw() {
  ctx.save();

  if (shakeTimer > 0) {
    const dx = (Math.random() * 4 - 2);
    const dy = (Math.random() * 4 - 2);
    ctx.translate(dx, dy);
    shakeTimer--;
  }

  // deep midnight sky
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#0a1633");
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

  // mountains layer (parallax)
  if (mountainsLoaded) {
    const mh = 220;
    const my = H * 0.45;
    const scale = mh / mountainsImg.height;
    const mw = mountainsImg.width * scale;

    // loop; slight dark overlay later hides seam
    let x = mountainsOffset % mw;
    if (x > 0) x -= mw;

    ctx.save();
    ctx.globalAlpha = 0.96;
    for (; x < W; x += mw) {
      ctx.drawImage(mountainsImg, x, my, mw, mh);
    }
    ctx.restore();

    // subtle dark overlay to hide any edge seams
    ctx.save();
    const g = ctx.createLinearGradient(0, my, 0, my + mh);
    g.addColorStop(0, "rgba(0,0,0,0.15)");
    g.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(0, my, W, mh);
    ctx.restore();
  }

  // snow (behind obstacles)
  ctx.save();
  snowflakes.forEach(s => {
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle = "#e6f0ff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  // bottom onsen steam – image-based + gradient
  if (steamLoaded) {
    ctx.save();
    const sh = 170;
    const sy = H - sh;
    const scaleY = sh / steamImg.height;
    const sw = steamImg.width * scaleY;

    let x = steamOffset % sw;
    if (x > 0) x -= sw;

    ctx.globalAlpha = 0.96;
    for (; x < W; x += sw) {
      ctx.drawImage(steamImg, x, sy, sw, sh);
    }
    ctx.restore();
  }

  // soft fade up so it blends
  ctx.save();
  const steamGrad = ctx.createLinearGradient(0, H * 0.78, 0, H);
  steamGrad.addColorStop(0, "rgba(20,20,40,0)");
  steamGrad.addColorStop(1, "rgba(255,255,255,0.45)");
  ctx.fillStyle = steamGrad;
  ctx.fillRect(0, H * 0.75, W, H * 0.25);
  ctx.restore();

  // obstacles: bamboo (woodImg)
  obstacles.forEach(o => {
    if (woodLoaded) {
      const bottomHeight = H - (o.top + o.gap);
      // top
      ctx.drawImage(woodImg, o.x, 0, 40, o.top);
      // bottom
      ctx.drawImage(woodImg, o.x, o.top + o.gap, 40, bottomHeight);
    } else {
      // fallback rectangles
      ctx.fillStyle = "#3A2A1A";
      ctx.fillRect(o.x, 0, 40, o.top);
      ctx.fillRect(o.x, o.top + o.gap, 40, H - (o.top + o.gap));
    }
  });

  // carrots with lantern glow
  carrots.forEach(c => {
    ctx.save();
    ctx.translate(c.x, c.y);

    // glow
    const glowRadius = c.golden ? 32 : 26;
    const glowGrad = ctx.createRadialGradient(
      0, 0, 0,
      0, 0, glowRadius
    );
    if (c.golden) {
      glowGrad.addColorStop(0, "rgba(255,230,140,0.7)");
      glowGrad.addColorStop(1, "rgba(255,230,140,0)");
    } else {
      glowGrad.addColorStop(0, "rgba(255,180,120,0.4)");
      glowGrad.addColorStop(1, "rgba(255,180,120,0)");
    }
    ctx.fillStyle = glowGrad;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // leaf
    ctx.fillStyle = "#70c96a";
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(-4, -6);
    ctx.lineTo(4, -6);
    ctx.closePath();
    ctx.fill();

    // body – single inverted triangle
    ctx.fillStyle = c.golden ? "#ffd94a" : "#ff9d3b";
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-7, 12);
    ctx.lineTo(7, 12);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  });

  // hop puffs
  ctx.save();
  hopPuffs.forEach(p => {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = "#f5f7ff";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.radius * 1.2, p.radius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  // player
  if (kokkyLoaded) {
    const size = 64;
    ctx.drawImage(kokkyImg, player.x - size / 2, player.y - size / 2, size, size);
  } else {
    ctx.fillStyle = "#fff";
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
    if (ctx.roundRect) {
      ctx.roundRect(bx, by, boxW, boxH, 12);
    } else {
      ctx.rect(bx, by, boxW, boxH);
    }
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

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(bx + 25, by + 18, 2, 0, Math.PI * 2);
    ctx.arc(bx + boxW - 25, by + 22, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

// ------------ Main loop ------------

function loop() {
  updateGame();
  draw();
  requestAnimationFrame(loop);
}

loop();

if (!currentPlayerId) {
  openPlayerOverlay();
}
