// ====== game.js — CHUNK 1 / 6 ======

// CANVAS SETUP
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let W = canvas.width;
let H = canvas.height;

// PLAYER DATA
let playerId = localStorage.getItem("playerId") || "-";
document.getElementById("playerIdLabel").textContent = "Player: " + playerId;

// UI ELEMENTS
const msg = document.getElementById("msg");
const scoreText = document.getElementById("scoreText");

// GAME STATE
let score = 0;
let bestScore = Number(localStorage.getItem("bestScore") || 0);

let gameRunning = false;
let obstacles = [];
let spawnTimer = 0;

let gravity = 0.45;
let jumpPower = -7.5;
let speed = 3.2;

let frame = 0;

// PLAYER (KOKKY)
let player = {
  x: 120,
  y: H / 2,
  w: 60,
  h: 60,
  vel: 0
};

// LOAD IMAGES
const bgMountains = new Image();
bgMountains.src = "mountains.png";

const steamImg = new Image();
steamImg.src = "steam.png";

const woodImg = new Image();
woodImg.src = "wood.png";

// Optional moon & snow restored
let moonColor = "#ffe28a";

function drawMoon() {
  ctx.fillStyle = moonColor;
  ctx.beginPath();
  ctx.arc(W - 90, 110, 40, 0, Math.PI * 2);
  ctx.fill();
}
// ====== game.js — CHUNK 2 / 6 ======

// Jump steam particles
let steamPuffs = [];

function addJumpSteam() {
  steamPuffs.push({
    x: player.x,
    y: player.y + player.h / 2,
    alpha: 1,
    size: 26
  });
}

function updateSteam() {
  for (let p of steamPuffs) {
    p.y += 1.2;
    p.alpha -= 0.03;
  }
  steamPuffs = steamPuffs.filter(p => p.alpha > 0);
}

function drawSteam() {
  for (let p of steamPuffs) {
    ctx.fillStyle = "rgba(255,255,255," + p.alpha + ")";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.size, p.size * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// INPUT
function jump() {
  if (!gameRunning) return startGame();
  player.vel = jumpPower;
  addJumpSteam();
}

window.addEventListener("mousedown", jump);
window.addEventListener("touchstart", jump);
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    jump();
  }
});
// ====== game.js — CHUNK 3 / 6 ======

function resetGame() {
  player.y = H / 2;
  player.vel = 0;

  score = 0;
  spawnTimer = 0;
  speed = 3.2;

  obstacles = [];

  msg.textContent = "";
  scoreText.textContent = `Score: 0 | Best: ${bestScore}`;
}

function startGame() {
  resetGame();
  gameRunning = true;
}

// Make obstacles similar to Flappy Bird
function addObstacle() {
  let gap = 165; // restored larger gap
  let offset = (Math.random() * 220) - 110;

  let center = H / 2 + offset;
  let topHeight = center - gap / 2;
  let bottomY = center + gap / 2;

  obstacles.push({
    x: W + 20,
    top: topHeight,
    bottom: bottomY,
    w: 90
  });
}

function updateObstacles() {
  spawnTimer++;
  if (spawnTimer > 90) {
    spawnTimer = 0;
    addObstacle();
  }

  for (let o of obstacles) {
    o.x -= speed;
  }

  obstacles = obstacles.filter(o => o.x + o.w > 0);
}

function drawObstacles() {
  for (let o of obstacles) {
    ctx.drawImage(woodImg, o.x, 0, o.w, o.top);
    ctx.drawImage(woodImg, o.x, o.bottom, o.w, H - o.bottom);
  }
}
// ====== game.js — CHUNK 4 / 6 ======

function checkCollision() {
  for (let o of obstacles) {
    if (player.x < o.x + o.w &&
        player.x + player.w > o.x &&
        (player.y < o.top || player.y + player.h > o.bottom)) {
      gameOver();
      return;
    }
  }
}

function drawBackground() {
  // Dark sky
  ctx.fillStyle = "#0d152b";
  ctx.fillRect(0, 0, W, H);

  // Stars
  ctx.fillStyle = "rgba(255,255,200,0.8)";
  for (let i = 0; i < 60; i++) {
    let x = (i * 83 + frame * 0.2) % W;
    let y = (i * 53) % (H * 0.4);
    ctx.fillRect(x, y, 2, 2);
  }

  drawMoon();

  // Mountains (raise higher)
  let mountainHeight = 260;
  ctx.drawImage(bgMountains, 0, H - mountainHeight - 160, W, mountainHeight);

  // Steam bottom layer
  ctx.drawImage(steamImg, 0, H - 140, W, 140);
}
// ====== game.js — CHUNK 5 / 6 ======

function gameOver() {
  gameRunning = false;

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("bestScore", bestScore);
  }

  msg.textContent = "Game Over!";
}

function updatePlayer() {
  player.vel += gravity;
  player.y += player.vel;

  if (player.y < 0) player.y = 0;
  if (player.y + player.h > H) player.y = H - player.h;
}

function drawPlayer() {
  ctx.fillStyle = "white";
  ctx.fillRect(player.x, player.y, player.w, player.h);
}

function gameLoop() {
  frame++;

  drawBackground();

  if (gameRunning) {
    updatePlayer();
    updateObstacles();
    updateSteam();
    checkCollision();

    // Score
    for (let o of obstacles) {
      if (!o.passed && o.x + o.w < player.x) {
        o.passed = true;
        score++;
        scoreText.textContent = `Score: ${score} | Best: ${bestScore}`;
      }
    }
  }

  drawObstacles();
  drawPlayer();
  drawSteam();

  requestAnimationFrame(gameLoop);
}

gameLoop();
// ====== game.js — CHUNK 6 / 6 ======

// TEAM DATA
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

document.getElementById("changePlayerBtn").onclick = () => {
  playerSelect.classList.remove("hidden");
};

document.getElementById("cancelPlayer").onclick = () => {
  playerSelect.classList.add("hidden");
};

document.getElementById("confirmPlayer").onclick = () => {
  if (!selectedTeam || !selectedNumber) return;

  playerId = selectedTeam + "-" + selectedNumber;
  localStorage.setItem("playerId", playerId);

  document.getElementById("playerIdLabel").textContent = "Player: " + playerId;

  playerSelect.classList.add("hidden");
};

// Build team buttons
for (let t of Object.keys(teams)) {
  let btn = document.createElement("button");
  btn.className = "teamBtn";
  btn.textContent = t;

  btn.onclick = () => {
    selectedTeam = t;

    [...teamButtons.children].forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");

    buildNumberList();
  };

  teamButtons.appendChild(btn);
}

function buildNumberList() {
  numberList.innerHTML = "";

  for (let num of teams[selectedTeam]) {
    let btn = document.createElement("button");
    btn.textContent = num;

    btn.onclick = () => {
      selectedNumber = num;

      [...numberList.children].forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");

      selectedPreview.textContent = `Selected: ${selectedTeam}-${num}`;
    };

    numberList.appendChild(btn);
  }
}
