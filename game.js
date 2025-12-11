// =======================
// Kokky's Hot Spring Hop
// FULL GAME SCRIPT
// =======================

// Canvas
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let W = canvas.width;
let H = canvas.height;

// UI
const msg = document.getElementById("msg");
const scoreText = document.getElementById("scoreText");
const playerIdLabel = document.getElementById("playerIdLabel");

// Player ID / best score from localStorage
let playerId = localStorage.getItem("playerId") || "Not set";
playerIdLabel.textContent = "Player: " + playerId;

let bestScore = Number(localStorage.getItem("bestScore") || 0);

// Images
const kokkyImg = new Image();
kokkyImg.src = "kokky.png";

const mountainsImg = new Image();
mountainsImg.src = "mountains.png";

const steamImg = new Image();
steamImg.src = "steam.png";

const woodImg = new Image();
woodImg.src = "wood.png";

// Game state
let frame = 0;
let gameRunning = false;
let score = 0;
let speed = 3.2;
let speedBoosted = false;

let obstacles = [];
let spawnTimer = 0;

const gravity = 0.45;
const jumpPower = -7.5;

// Player (Kokky) + hitbox padding
const player = {
  x: 110,
  y: H / 2,
  w: 72,
  h: 72,
  vy: 0
};

const hitboxPadding = {
  x: 10,
  y: 8,
  w: 20,
  h: 16
};

// Stars (static) and snow
const stars = [];
const snowflakes = [];

function initStars() {
  stars.length = 0;
  const count = 80;
  for (let i = 0; i < count; i++) {
    const x = Math.random() * W;
    const y = Math.random() * (H * 0.55);
    const size = 1 + Math.random() * 2;
    const yellow = Math.random() < 0.7;
    const color = yellow
      ? "rgba(255,226,122,0.95)"
      : "rgba(247,247,255,0.95)";
    stars.push({ x, y, size, color });
  }
}

function initSnow() {
  snowflakes.length = 0;
  const count = 70;
  for (let i = 0; i < count; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 1 + Math.random() * 2.5;
    const speedY = 0.4 + Math.random() * 0.9;
    const drift = (Math.random() - 0.5) * 0.3;
    snowflakes.push({ x, y, r, speedY, drift });
  }
}

initStars();
initSnow();

// Draw a static, textured moon (no jitter)
function drawMoon() {
  // Fixed position
  const cx = W - 90;
  const cy = 110;
  const r = 40;

  // Outer glow
  ctx.save();
  ctx.globalAlpha = 0.65;
  const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.8);
  glowGrad.addColorStop(0, "rgba(255, 240, 180, 0.9)");
  glowGrad.addColorStop(1, "rgba(255, 240, 180, 0)");
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Main body (keep current warm yellow feel)
  const g = ctx.createRadialGradient(cx - 10, cy - 10, 10, cx, cy, r);
  g.addColorStop(0, "#fff8d8");
  g.addColorStop(0.45, "#ffe39a");
  g.addColorStop(1, "#d4a54b");

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Crater texture (subtle)
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = "#c6963a";
  for (let i = 0; i < 10; i++) {
    const tx = cx + (Math.random() - 0.5) * 22;
    const ty = cy + (Math.random() - 0.5) * 22;
    const tr = 3 + Math.random() * 4;
    ctx.beginPath();
    ctx.arc(tx, ty, tr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Background
function drawBackground() {
  // Deep night sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, "#050b23");
  skyGrad.addColorStop(0.6, "#07122c");
  skyGrad.addColorStop(1, "#050b23");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);

  // Stars (static)
  ctx.save();
  for (const s of stars) {
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 4;
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
  ctx.restore();

  // Moon
  drawMoon();

  // Mountains (raised so they peek above steam)
  const mh = 260;
  const mountainY = H - mh - 140;
  ctx.drawImage(mountainsImg, 0, mountainY, W, mh);

  // Steam band (onsen surface)
  ctx.drawImage(steamImg, 0, H - 140, W, 140);
}

// Snow
function updateSnow() {
  for (const f of snowflakes) {
    f.y += f.speedY;
    f.x += f.drift;

    if (f.y > H) {
      f.y = -10;
      f.x = Math.random() * W;
    }
    if (f.x < -10) f.x = W + 10;
    if (f.x > W + 10) f.x = -10;
  }
}

function drawSnow() {
  for (const f of snowflakes) {
    let alpha = 0.9;
    if (f.y > H - 150) {
      const t = (H - f.y) / 150;
      alpha = Math.max(0, t) * 0.9;
    }
    ctx.fillStyle = `rgba(240,240,255,${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Jump steam puffs (flat ovals)
const steamPuffs = [];

function addJumpSteam() {
  steamPuffs.push({
    x: player.x + player.w * 0.1,
    y: player.y + player.h * 0.8,
    alpha: 0.9,
    w: 32,
    h: 12
  });
}

function updateJumpSteam() {
  for (const p of steamPuffs) {
    p.y += 0.8;
    p.alpha -= 0.04;
  }
  for (let i = steamPuffs.length - 1; i >= 0; i--) {
    if (steamPuffs[i].alpha <= 0) steamPuffs.splice(i, 1);
  }
}

function drawJumpSteam() {
  ctx.save();
  for (const p of steamPuffs) {
    ctx.fillStyle = `rgba(255,255,255,${p.alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.w, p.h, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Obstacles (bamboo walls)
function addObstacle() {
  const gap = 170; // comfy gap
  const offset = (Math.random() * 220) - 110; // shift up/down
  const center = H / 2 + offset;

  const topHeight = center - gap / 2;
  const bottomY = center + gap / 2;
  const w = 90;

  obstacles.push({
    x: W + 40,
    top: topHeight,
    bottom: bottomY,
    w,
    passed: false
  });
}

function updateObstacles() {
  spawnTimer++;
  if (spawnTimer > 90) {
    spawnTimer = 0;
    addObstacle();
  }

  for (const o of obstacles) {
    o.x -= speed;
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    if (obstacles[i].x + obstacles[i].w < -50) {
      obstacles.splice(i, 1);
    }
  }
}

function drawObstacles() {
  for (const o of obstacles) {
    // top pillar
    ctx.drawImage(woodImg, o.x, 0, o.w, o.top);

    // bottom pillar
    const bottomHeight = H - o.bottom;
    ctx.drawImage(woodImg, o.x, o.bottom, o.w, bottomHeight);
  }
}

// Collision
function checkCollision() {
  const px = player.x + hitboxPadding.x;
  const py = player.y + hitboxPadding.y;
  const pw = player.w - hitboxPadding.w;
  const ph = player.h - hitboxPadding.h;

  for (const o of obstacles) {
    const overlapX =
      px < o.x + o.w &&
      px + pw > o.x;

    const hitTop = py < o.top;
    const hitBottom = py + ph > o.bottom;

    if (overlapX && (hitTop || hitBottom)) {
      gameOver();
      return;
    }
  }

  // Floor / ceiling
  if (py <= 0 || py + ph >= H) {
    gameOver();
  }
}

// Rank titles
function getRankTitle(score) {
  if (score >= 100) return "Onsen Overlord";
  if (score >= 75) return "Steam Master";
  if (score >= 50) return "Onsen Ace";
  if (score >= 25) return "Steam Hopper";
  return "";
}

let lastRankShown = "";

// Game reset / start / over
function resetGame() {
  score = 0;
  speed = 3.2;
  speedBoosted = false;
  frame = 0;
  spawnTimer = 0;
  obstacles = [];
  player.y = H / 2;
  player.vy = 0;
  steamPuffs.length = 0;
  msg.textContent = "";
  lastRankShown = "";
  scoreText.textContent = `Score: 0 | Best: ${bestScore}`;
}

function startGame() {
  resetGame();
  gameRunning = true;
}

function gameOver() {
  gameRunning = false;
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("bestScore", String(bestScore));
  }
  msg.textContent = "Game Over!";
  scoreText.textContent = `Score: ${score} | Best: ${bestScore}`;
}

// Input (tap / click / space)
function doJump() {
  if (!gameRunning) {
    startGame();
  }
  player.vy = jumpPower;
  addJumpSteam();
}

canvas.addEventListener("mousedown", (e) => {
  e.preventDefault();
  doJump();
});
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  doJump();
});
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    doJump();
  }
});

// Player update/draw
function updatePlayer() {
  player.vy += gravity;
  player.y += player.vy;

  if (player.y < -40) player.y = -40;
  if (player.y > H - player.h + 40) player.y = H - player.h + 40;
}

function drawPlayer() {
  if (kokkyImg.complete && kokkyImg.naturalWidth > 0) {
    ctx.drawImage(kokkyImg, player.x, player.y, player.w, player.h);
  } else {
    // fallback
    ctx.fillStyle = "white";
    ctx.fillRect(player.x, player.y, player.w, player.h);
  }
}

// Main loop
function update() {
  frame++;

  drawBackground();
  updateSnow();
  drawSnow();

  if (gameRunning) {
    updatePlayer();
    updateObstacles();
    updateJumpSteam();
    checkCollision();

    // Scoring
    for (const o of obstacles) {
      if (!o.passed && o.x + o.w < player.x) {
        o.passed = true;
        score++;

        // speed bump once at 60
        if (!speedBoosted && score >= 60) {
          speedBoosted = true;
          speed += 0.7;
        }

        // rank message
        const rank = getRankTitle(score);
        if (rank && rank !== lastRankShown) {
          lastRankShown = rank;
          msg.textContent = `Rank up: ${rank}!`;
        } else if (!rank) {
          msg.textContent = "";
        }

        scoreText.textContent = `Score: ${score} | Best: ${bestScore}`;
      }
    }
  }

  drawObstacles();
  drawPlayer();
  drawJumpSteam();

  requestAnimationFrame(update);
}

update();

// =========================
// PLAYER SELECT OVERLAY
// =========================

const teams = {
  W: ["5","8","9","18","19","22","28","29","30","34","A","B"],
  R: ["1","4","6","7","11","13","20","21","27","31","40","A","B"],
  G: ["10","12","14","23","24","26","35","36","37","39","A","B"],
  B: ["2","3","15","16","17","25","32","33","38","41","A","B"],
  Guest: ["0"]
};

let selectedTeam = null;
let selectedNumber = null;

const playerSelect = document.getElementById("playerSelect");
const teamButtons = document.getElementById("teamButtons");
const numberList = document.getElementById("numberList");
const selectedPreview = document.getElementById("selectedPreview");

document.getElementById("changePlayerBtn").addEventListener("click", () => {
  playerSelect.classList.remove("hidden");
});

document.getElementById("cancelPlayer").addEventListener("click", () => {
  playerSelect.classList.add("hidden");
});

document.getElementById("confirmPlayer").addEventListener("click", () => {
  if (!selectedTeam || !selectedNumber) return;
  playerId = `${selectedTeam}-${selectedNumber}`;
  localStorage.setItem("playerId", playerId);
  playerIdLabel.textContent = "Player: " + playerId;
  playerSelect.classList.add("hidden");
});

// Build team buttons
function buildTeams() {
  teamButtons.innerHTML = "";
  for (const t of Object.keys(teams)) {
    const btn = document.createElement("button");
    btn.className = "teamBtn";
    btn.textContent = t;

    btn.addEventListener("click", () => {
      selectedTeam = t;
      selectedNumber = null;
      selectedPreview.textContent = "";

      [...teamButtons.children].forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");

      buildNumberList();
    });

    teamButtons.appendChild(btn);
  }
}

function buildNumberList() {
  numberList.innerHTML = "";
  for (const num of teams[selectedTeam]) {
    const btn = document.createElement("button");
    btn.textContent = num;
    btn.addEventListener("click", () => {
      selectedNumber = num;
      [...numberList.children].forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedPreview.textContent = `Selected: ${selectedTeam}-${num}`;
    });
    numberList.appendChild(btn);
  }
}

buildTeams();
