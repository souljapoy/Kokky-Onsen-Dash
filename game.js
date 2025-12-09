// =======================
// Kokky’s Onsen Dash 🍶🐰
// Updated: Player sprite version
// =======================

// ---- Canvas Setup ----
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 360;
canvas.height = 640;

// ---- Game Settings ----
let gravity = 0.5;
let jumpPower = -8;
let speed = 2;
let score = 0;
let bestScore = Number(localStorage.getItem("bestScore")) || 0;
let gameOver = false;

let obstacleGap = 150;
let obstacleWidth = 50;
let obstacleFreq = 120;
let frameCount = 0;

// ---- Carrot Waves ----
let carrotWaveCounter = 0;
let carrots = [];
function spawnCarrotWave() {
    carrotWaveCounter++;
    let hasGolden = Math.random() < 0.33; // 1 in 3 waves
    for (let i = 0; i < 5; i++) {
        carrots.push({
            x: canvas.width + i * 30,
            y: Math.random() * (canvas.height - 200) + 50,
            w: 20,
            h: 20,
            golden: hasGolden && i === Math.floor(Math.random() * 5)
        });
    }
}

// ---- Player & Sprite ----
let player = {
    x: 80,
    y: canvas.height / 2,
    vy: 0,
    width: 50,
    height: 50
};

// Load Kokky Sprite (your uploaded file)
const kokkyImg = new Image();
kokkyImg.src = "kokky.png";

// ---- Obstacles ----
let obstacles = [];
function spawnObstacle() {
    let topHeight = Math.random() * (canvas.height - obstacleGap - 100) + 50;
    obstacles.push({
        x: canvas.width,
        top: topHeight,
        bottom: topHeight + obstacleGap
    });
}

// ---- Controls ----
document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
        if (gameOver) resetGame();
        else playerJump();
    }
});
canvas.addEventListener("mousedown", () => {
    if (gameOver) resetGame();
    else playerJump();
});

// ---- Player Actions ----
function playerJump() {
    player.vy = jumpPower;
}

function resetGame() {
    score = 0;
    speed = 2;
    obstacles = [];
    carrots = [];
    frameCount = 0;
    player.y = canvas.height / 2;
    player.vy = 0;
    gameOver = false;
}

// ---- Collision Check ----
function checkCollision(obs) {
    if (
        player.x + player.width / 2 > obs.x &&
        player.x - player.width / 2 < obs.x + obstacleWidth &&
        (player.y - player.height / 2 < obs.top ||
         player.y + player.height / 2 > obs.bottom)
    ) {
        return true;
    }
    return false;
}

// ---- Drawing Functions ----
function drawPlayer() {
    ctx.drawImage(kokkyImg, player.x - 25, player.y - 25, 50, 50);
}

function drawObstacles() {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    obstacles.forEach((obs) => {
        ctx.fillRect(obs.x, 0, obstacleWidth, obs.top);
        ctx.fillRect(obs.x, obs.bottom, obstacleWidth, canvas.height - obs.bottom);
    });
}

function drawCarrots() {
    carrots.forEach(c => {
        ctx.fillStyle = c.golden ? "yellow" : "orange";
        ctx.fillRect(c.x, c.y, c.w, c.h);
    });
}

function drawScoreboard() {
    ctx.fillStyle = "white";
    ctx.font = "24px PixFont";
    ctx.fillText(`Score: ${score}`, 20, 40);
    ctx.fillText(`Best: ${bestScore}`, 240, 40);
}

// ---- Update Loop ----
function update() {
    if (!gameOver) {
        frameCount++;

        // Difficulty scaling after 20 points
        if (score >= 20) {
            speed = 2 + (score * 0.02);
        }

        player.vy += gravity;
        player.y += player.vy;

        if (frameCount % obstacleFreq === 0) spawnObstacle();
        if (frameCount % 300 === 0) spawnCarrotWave();

        // Move & check obstacles
        obstacles.forEach((obs, i) => {
            obs.x -= speed;
            if (obs.x + obstacleWidth < 0) {
                obstacles.splice(i, 1);
                score++;
            }
            if (checkCollision(obs)) triggerGameOver();
        });

        // Carrot movement & collection
        carrots.forEach((c, i) => {
            c.x -= speed;
            if (c.x + c.w < 0) carrots.splice(i, 1);

            if (
                player.x < c.x + c.w &&
                player.x + player.width > c.x &&
                player.y < c.y + c.h &&
                player.y + player.height > c.y
            ) {
                score += c.golden ? 5 : 2;
                carrots.splice(i, 1);
            }
        });

        // Ground and ceiling bounds
        if (player.y < 0 || player.y > canvas.height) {
            triggerGameOver();
        }
    }

    // Draw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawObstacles();
    drawCarrots();
    drawPlayer();
    drawScoreboard();

    requestAnimationFrame(update);
}

function triggerGameOver() {
    gameOver = true;
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem("bestScore", bestScore);
    }
}

// ---- Start Game ----
kokkyImg.onload = () => update();
