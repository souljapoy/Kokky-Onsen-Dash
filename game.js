/* =====================================================
   KOKKY'S HOT SPRING HOP — GAME ENGINE (FULL FILE)
   ===================================================== */

/* ------------------ CANVAS SETUP ------------------ */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

/* ------------------ LOAD IMAGES ------------------ */
const kokkyImg = new Image();
kokkyImg.src = "kokky.png";

const mountainImg = new Image();
mountainImg.src = "mountains.png";

const steamImg = new Image();
steamImg.src = "steam.png";

const woodImg = new Image();
woodImg.src = "wood.png";

const moonImg = new Image();
moonImg.src = "moon.png"; // restored crater texture

/* ------------------ GAME STATE ------------------ */
let player = { x: 120, y: 300, vy: 0, w: 48, h: 48 };
let gravity = 0.55;
let jumpForce = -8.2;

let obstacles = [];
let gapSize = 170; // playable gap
let pipeDist = 200;

let score = 0;
let bestScore = 0;

let gameRunning = false;
let gameOver = false;

/* Background scrolling */
let bgOffset = 0;
let steamOffset = 0;

/* Stars and snow */
const stars = [];
for (let i = 0; i < 60; i++) {
  stars.push({
    x: Math.random() * W,
    y: Math.random() * H * 0.6,
    size: Math.random() < 0.8 ? 2 : 3,
    color: Math.random() < 0.8 ? "#ffe599" : "#ffffff"
  });
}

const snow = [];
for (let i = 0; i < 80; i++) {
  snow.push({
    x: Math.random() * W,
    y: Math.random() * H,
    speed: 0.4 + Math.random() * 0.6,
    size: 2 + Math.random() * 2
  });
}

/* ------------------ PLAYER SELECTION ------------------ */
let currentPlayerId = localStorage.getItem("currentPlayerId") || null;

const playerIdLabel = document.getElementById("playerIdLabel");
const changePlayerBtn = document.getElementById("changePlayerBtn");
const overlay = document.getElementById("playerOverlay");
const numberList = document.getElementById("numberList");
const selectedPreview = document.getElementById("selectedPreview");

function updatePlayerLabel() {
  playerIdLabel.textContent = currentPlayerId ? `Player: ${currentPlayerId}` : "Player: Not set";
}

updatePlayerLabel();

changePlayerBtn.onclick = () => overlay.classList.remove("hidden");

const teamButtons = document.querySelectorAll(".teamBtn");
let selectedTeam = null;
let selectedNumber = null;

teamButtons.forEach(btn => {
  btn.onclick = () => {
    teamButtons.forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedTeam = btn.dataset.team;
    loadNumbers(selectedTeam);
  };
});

function loadNumbers(team) {
  numberList.innerHTML = "";

  let numbers = [];

  if (["W","R","G","B"].includes(team)) {
    numbers = {
      W: [5,8,9,18,19,22,28,29,30,34],
      R: [1,4,6,7,11,13,20,21,27,31,40],
      G: [10,12,14,23,24,26,35,36,37,39],
      B: [2,3,15,16,17,25,32,33,38,41]
    }[team];
  } else {
    numbers = ["A","B"];
  }

  numbers.forEach(n => {
    const b = document.createElement("button");
    b.textContent = n;
    b.onclick = () => {
      [...numberList.children].forEach(x => x.classList.remove("selected"));
      b.classList.add("selected");
      selectedNumber = n;
      selectedPreview.textContent = `Selected: ${team}-${n}`;
    };
    numberList.appendChild(b);
  });
}

document.getElementById("confirmPlayerBtn").onclick = () => {
  if (!selectedTeam || !selectedNumber) return;
  currentPlayerId = `${selectedTeam}-${selectedNumber}`;
  localStorage.setItem("currentPlayerId", currentPlayerId);
  updatePlayerLabel();
  overlay.classList.add("hidden");
};

/* ------------------ SCOREBOARD SAVE ------------------ */
function saveScore() {
  if (!currentPlayerId) return;

  let board = JSON.parse(localStorage.getItem("scoreboard") || "[]");
  let entry = board.find(e => e.id === currentPlayerId);

  let bestRank = getRankTitle(score);

  if (!entry) {
    board.push({ id: currentPlayerId, score: score, rank: bestRank });
  } else {
    if (score > entry.score) entry.score = score;
    entry.rank = bestRank;
  }

  localStorage.setItem("scoreboard", JSON.stringify(board));
}

/* ------------------ RANKS ------------------ */
function getRankTitle(s) {
  if (s >= 1000) return "Onsen God";
  if (s >= 500) return "Onsen Legend";
  if (s >= 250) return "King of the Onsen";
  if (s >= 100) return "Onsen Overlord";
  if (s >= 75) return "Steam Master";
  if (s >= 50) return "Onsen Ace";
  if (s >= 25) return "Steam Hopper";
  return "-";
}

/* ------------------ GAME FUNCTIONS ------------------ */
function resetGame() {
  if (!currentPlayerId) {
    overlay.classList.remove("hidden");
    return;
  }

  player.y = 300;
  player.vy = 0;

  score = 0;
  obstacles = [];
  gameRunning = true;
  gameOver = false;

  spawnObstacle();

  document.getElementById("score").textContent = "Score: 0";
}

function spawnObstacle() {
  const mid = 200 + Math.random() * 240;
  const topH = mid - gapSize / 2;
  const botH = H - (mid + gapSize / 2) - 160;

  obstacles.push({
    x: W + 20,
    top: topH,
    bottom: botH
  });
}

function flap() {
  if (!gameRunning || gameOver) return;
  player.vy = jumpForce;
}

/* ------------------ INPUT ------------------ */
document.addEventListener("keydown", e => {
  if (e.code === "Space") {
    if (!gameRunning || gameOver) resetGame();
    else flap();
  }
});

canvas.addEventListener("pointerdown", () => {
  if (!gameRunning || gameOver) resetGame();
  else flap();
});

/* ------------------ DRAWING FUNCTIONS ------------------ */
function drawBackground() {
  ctx.fillStyle = "#02061a";
  ctx.fillRect(0, 0, W, H);

  stars.forEach(s => {
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  });

  snow.forEach(n => {
    ctx.fillStyle = "white";
    ctx.fillRect(n.x, n.y, n.size, n.size);

    n.y += n.speed;
    if (n.y > H) {
      n.y = -10;
      n.x = Math.random() * W;
    }
  });

  ctx.drawImage(moonImg, W - 140, 80, 90, 90); // stable no-jitter moon

  ctx.drawImage(mountainImg, bgOffset, H - 220, W, 220);
  ctx.drawImage(mountainImg, bgOffset + W, H - 220, W, 220);

  bgOffset -= 0.4;
  if (bgOffset <= -W) bgOffset = 0;

  ctx.drawImage(steamImg, steamOffset, H - 120, W, 120);
  ctx.drawImage(steamImg, steamOffset + W, H - 120, W, 120);

  steamOffset -= 1.2;
  if (steamOffset <= -W) steamOffset = 0;
}

function drawPlayer() {
  ctx.drawImage(kokkyImg, player.x - player.w / 2, player.y - player.h / 2, player.w, player.h);
}

function drawObstacles() {
  obstacles.forEach(o => {
    ctx.drawImage(woodImg, o.x, 0, 60, o.top);
    ctx.drawImage(woodImg, o.x, H - o.bottom, 60, o.bottom);
  });
}

/* ------------------ MAIN LOOP ------------------ */
function loop() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();

  if (gameRunning) {
    player.vy += gravity;
    player.y += player.vy;

    if (player.y + player.h / 2 > H - 130) {
      player.y = H - 130 - player.h / 2;
      endGame();
    }

    obstacles.forEach(o => {
      o.x -= 2.6;

      if (o.x + 60 < -10) {
        obstacles.shift();
        spawnObstacle();
        score++;
        document.getElementById("score").textContent = "Score: " + score;
      }

      let px = player.x, py = player.y;

      if (
        px + player.w / 2 > o.x &&
        px - player.w / 2 < o.x + 60
      ) {
        if (py - player.h / 2 < o.top || py + player.h / 2 > H - o.bottom) {
          endGame();
        }
      }
    });
  }

  drawObstacles();
  drawPlayer();
  requestAnimationFrame(loop);
}

function endGame() {
  if (!gameRunning || gameOver) return;
  gameOver = true;
  gameRunning = false;

  bestScore = Math.max(bestScore, score);
  document.getElementById("best").textContent = "Best: " + bestScore;

  saveScore();
}

/* ------------------ START ------------------ */
loop();
