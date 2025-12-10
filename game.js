// Kokky's Hot Spring Hop – polished: bamboo obstacles, bottom steam only, snow, carrots, ranks, player IDs, scoreboard hook

// Canvas and context
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Canvas logical size (kept constant; CSS scales it)
const LOGICAL_WIDTH = 540;
const LOGICAL_HEIGHT = 960;
canvas.width = LOGICAL_WIDTH;
canvas.height = LOGICAL_HEIGHT;

let W = canvas.width;
let H = canvas.height;

// UI elements
const scoreSpan = document.getElementById("score");
const bestSpan = document.getElementById("best");
const playerIdSpan = document.getElementById("playerIdDisplay");
const changePlayerBtn = document.getElementById("changePlayerBtn");

const playerOverlay = document.getElementById("playerOverlay");
const selectedPreview = document.getElementById("selectedPreview");
const teamButtons = document.querySelectorAll(".teamBtn");
const numberList = document.getElementById("numberList");
const cancelPlayerBtn = document.getElementById("cancelPlayerBtn");
const confirmPlayerBtn = document.getElementById("confirmPlayerBtn");

const rankSpan = document.getElementById("rank");

// Colors for teams
const TEAM_LABELS = {
  W: "White",
  P: "Pink",
  Y: "Yellow",
  B: "Blue",
  R: "Red"
};

const TEAM_KEYS = ["W","P","Y","B","R"];

// Player ID from localStorage
let currentPlayerId = localStorage.getItem("onsen_playerId") || "0";
let currentTeamKey = localStorage.getItem("onsen_teamKey") || null;
updatePlayerLabel();

// =========================
// Game state
// =========================

let running = false;
let frame = 0;

// Player object
const player = {
  x: 110,
  y: H * 0.5,
  vy: 0,
  r: 34 // radius for collision
};

// Physics
const gravity = 0.32;
const hopPower = -7.4;

// Obstacles
const obstacles = [];

// Carrots (score bonus objects)
const carrots = [];

// Hop puffs
const hopPuffs = [];

// Snow
const snowflakes = [];

// Sky stars
const stars = [];

// Scores
let score = 0;
let bestScore = parseInt(localStorage.getItem("onsen_bestScore") || "0", 10);
bestSpan.textContent = bestScore;

// Rank thresholds
const RANKS = [
  {score: 1000, label: "Onsen Legend"},
  {score: 500,  label: "Steam Master"},
  {score: 250,  label: "Carrot Hunter"},
  {score: 100,  label: "Snow Expert"},
  {score: 50,   label: "Warm-Up Pro"},
  {score: 25,   label: "Beginner+"}
];
let currentRankLabel = "Beginner";

// Kokky sprite
const kokkyImg = new Image();
kokkyImg.src = "kokky.png";
let kokkyLoaded = false;
kokkyImg.onload = () => { kokkyLoaded = true; };

// Hop sound (soft steam puff, single file hop1.mp3)
const hopSoundFiles = ["hop1.mp3"];
const hopSounds = [];
hopSoundFiles.forEach(src => {
  const audio = new Audio(src);
  audio.volume = 0.28; // soft, calm
  hopSounds.push(audio);
});

function playHopSound(){
  if(!hopSounds.length) return;
  const a = hopSounds[0];
  try {
    // restart from beginning so the hop is audible each time
    a.currentTime = 0;
  } catch(e) {}
  a.play().catch(()=>{});
}

// Init UI
updatePlayerLabel();
updateBestFromLeaderboard();
initStars();
initSnow();

// Controls
window.addEventListener("keydown", e=>{
  if(e.code === "Space"){
    if(!running){
      startGame();
    }else{
      hop();
    }
    e.preventDefault();
  }
});

canvas.addEventListener("pointerdown", () => {
  if(!running){
    startGame();
  }else{
    hop();
  }
});

changePlayerBtn.addEventListener("click", () => {
  openPlayerOverlay();
});

cancelPlayerBtn.addEventListener("click", () => {
  closePlayerOverlay(false);
});

// Player overlay logic
let selectedTeamKey = null;
let selectedNumberCode = null;

// Team selection
teamButtons.forEach(btn=>{
  btn.addEventListener("click",()=>{
    const key = btn.dataset.teamKey;
    selectedTeamKey = key;
    TEAM_KEYS.forEach(k=>{
      const b2 = document.querySelector(`.teamBtn[data-team-key="${k}"]`);
      if(!b2) return;
      b2.classList.toggle("selected", k === key);
    });
    fillNumberList(key);
    updatePreviewLabel();
  });
});

// Confirm selection: build ID like W-18, R-A, etc.
confirmPlayerBtn.addEventListener("click", ()=>{
  if(!selectedTeamKey || !selectedNumberCode) {
    closePlayerOverlay(false);
    return;
  }
  const idStr = `${selectedTeamKey}-${selectedNumberCode}`;
  currentPlayerId = idStr;
  currentTeamKey = selectedTeamKey;

  localStorage.setItem("onsen_playerId", currentPlayerId);
  localStorage.setItem("onsen_teamKey", currentTeamKey);

  updatePlayerLabel();
  closePlayerOverlay(true);
});

function updatePlayerLabel(){
  playerIdSpan.textContent = currentPlayerId || "0";
}

function openPlayerOverlay(){
  selectedTeamKey = currentTeamKey;
  selectedNumberCode = null;
  if(selectedTeamKey){
    TEAM_KEYS.forEach(k=>{
      const b2 = document.querySelector(`.teamBtn[data-team-key="${k}"]`);
      if(!b2) return;
      b2.classList.toggle("selected", k === selectedTeamKey);
    });
    fillNumberList(selectedTeamKey);
  } else {
    TEAM_KEYS.forEach(k=>{
      const b2 = document.querySelector(`.teamBtn[data-team-key="${k}"]`);
      if(!b2) return;
      b2.classList.remove("selected");
    });
    numberList.innerHTML = '<p class="hint">Choose your team color first.</p>';
  }
  updatePreviewLabel();
  playerOverlay.classList.remove("hidden");
}

function closePlayerOverlay(confirmed){
  playerOverlay.classList.add("hidden");
  if(!confirmed){
    selectedTeamKey = null;
    selectedNumberCode = null;
  }
}

function updatePreviewLabel(){
  if(selectedTeamKey && selectedNumberCode){
    selectedPreview.textContent = `Player: ${selectedTeamKey}-${selectedNumberCode}`;
  } else {
    selectedPreview.textContent = "Choose your team and number";
  }
}

function fillNumberList(teamKey){
  numberList.innerHTML = "";
  const fragment = document.createDocumentFragment();

  const letters = ["A","B","C","D","E"];
  const nums = [];
  for(let i=1;i<=20;i++){
    nums.push(i);
  }

  letters.forEach(letter=>{
    const btn = document.createElement("button");
    btn.textContent = letter;
    btn.addEventListener("click",()=>{
      selectedNumberCode = letter;
      highlightSelectedNumber(letter);
      updatePreviewLabel();
    });
    fragment.appendChild(btn);
  });

  nums.forEach(n=>{
    const btn = document.createElement("button");
    btn.textContent = n.toString();
    btn.addEventListener("click",()=>{
      selectedNumberCode = n.toString();
      highlightSelectedNumber(n.toString());
      updatePreviewLabel();
    });
    fragment.appendChild(btn);
  });

  numberList.appendChild(fragment);
}

function highlightSelectedNumber(code){
  const buttons = numberList.querySelectorAll("button");
  buttons.forEach(b=>{
    b.classList.toggle("selected", b.textContent === code);
  });
}

// =========================
// Stars and snow
// =========================
function initStars(){
  stars.length = 0;
  for(let i=0;i<90;i++){
    stars.push({
      x: Math.random()*W,
      y: Math.random()*H*0.5,
      r: Math.random()*1.6+0.4,
      alpha: 0.3+Math.random()*0.6
    });
  }
}

function initSnow(){
  snowflakes.length = 0;
  for(let i=0;i<70;i++){
    snowflakes.push({
      x: Math.random()*W,
      y: Math.random()*H,
      r: Math.random()*2.6+0.6,
      vy: 0.4+Math.random()*0.8
    });
  }
}

// =========================
// Obstacles & carrots data
// =========================
let scrollSpeed = 3.2;
let obstacleSpacingMin = 180;
let obstacleSpacingMax = 230;

const OBSTACLE_THEMES = [
  {name:"steam-columns", color:"#24313f"},
  {name:"bamboo", color:"#47693d"},
  {name:"fence", color:"#6f4c3e"},
  {name:"shoji", color:"#f5e3c0"},
  {name:"lanternPosts", color:"#d47e3e"}
];

let currentThemeIndex = 1;

// Carrot wave pattern
const CARROT_WAVE_SIZE = 10;
const CARROT_WAVE_GAP_AFTER = 0.5;

// =========================
// Helper: random in range
// =========================
function randRange(min,max){
  return min + Math.random()*(max-min);
}

// =========================
// Start / reset
// =========================
function softReset(){
  score = 0;
  scoreSpan.textContent = "0";
  player.y = H*0.5;
  player.vy = 0;
  obstacles.length = 0;
  carrots.length = 0;
  hopPuffs.length = 0;
  frame = 0;
  scrollSpeed = 3.2;
  obstacleSpacingMin = 180;
  obstacleSpacingMax = 230;
  currentThemeIndex = 1;
  currentRankLabel = "Beginner";
  rankSpan.textContent = currentRankLabel;
}

function startGame(){
  softReset();
  running = true;
}

// =========================
// Hop
// =========================
function hop() {
  if(!running) return;
  player.vy = hopPower;
  playHopSound();

  // small, subtle hop steam
  hopPuffs.push({
    x: player.x,
    y: player.y + player.r,
    radius: 6,
    alpha: 0.35
  });
}

// Spawning
function addObstacle(){
  const minCenter = 120;
  const maxCenter = H - 180;
  const gapSize = 150;

  const center = randRange(minCenter, maxCenter);
  const top = center - gapSize*0.5;
  const bottom = center + gapSize*0.5;

  let lastX = obstacles.length ? obstacles[obstacles.length-1].x : (W+100);
  const spacing = randRange(obstacleSpacingMin, obstacleSpacingMax);

  obstacles.push({
    x: lastX + spacing,
    width: 66,
    top: top,
    bottom: bottom,
    passed: false
  });
}

function addCarrotWave(obstacleX){
  const waveStartX = obstacleX + 0.5 * 66;
  const step = 26;
  const carrotY = player.y;

  for(let i=0;i<CARROT_WAVE_SIZE;i++){
    carrots.push({
      x: waveStartX + i*step,
      y: carrotY - 40,
      collected:false,
      golden: (i===Math.floor(CARROT_WAVE_SIZE/2))
    });
  }
}

// =========================
// Drawing helpers
// =========================
function drawBackground(){
  ctx.save();
  const topColor = "#05091a";
  const midColor = "#09102b";
  const skyGrad = ctx.createLinearGradient(0,0,0,H*0.7);
  skyGrad.addColorStop(0, topColor);
  skyGrad.addColorStop(1, midColor);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0,0,W,H);

  // stars
  stars.forEach(s=>{
    ctx.globalAlpha = s.alpha;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
    ctx.fillStyle = "#f5f7ff";
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // moon
  ctx.save();
  const moonX = W * 0.78;
  const moonY = H * 0.16;
  const moonR = 42;
  const moonGrad = ctx.createRadialGradient(
    moonX - 10, moonY - 6, 10,
    moonX, moonY, moonR
  );
  moonGrad.addColorStop(0, "#fff7d2");
  moonGrad.addColorStop(1, "#f2d27a");
  ctx.fillStyle = moonGrad;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // smooth snowy Nagano mountains (M1)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, H*0.58);
  ctx.quadraticCurveTo(W*0.15, H*0.42, W*0.3, H*0.58);
  ctx.quadraticCurveTo(W*0.5, H*0.38, W*0.7, H*0.58);
  ctx.quadraticCurveTo(W*0.85, H*0.45, W, H*0.58);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fillStyle = "#090f24";
  ctx.fill();
  ctx.restore();
}

// snowfall behind obstacles & carrots
function drawSnowBehind(){
  ctx.save();
  const steamStartY = H*0.92;
  snowflakes.forEach(f=>{
    let alpha = 0.6;
    if(f.y > steamStartY){
      const t = Math.min(1, (f.y - steamStartY)/(H - steamStartY));
      alpha *= (1 - t);
    }
    if(alpha <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#f5f7ff";
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawBambooObstacle(o, color){
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(o.x, 0, o.width, o.top);
  ctx.fillRect(o.x, o.bottom, o.width, H - o.bottom);
  ctx.restore();
}

function drawCarrots(){
  carrots.forEach(c=>{
    if(c.collected) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(c.x, c.y, 7, 0, Math.PI*2);
    ctx.fillStyle = c.golden ? "#ffd85a" : "#ffb347";
    ctx.fill();
    ctx.restore();
  });
}

// draw player + hop puffs
function drawPlayer(){
  if(kokkyLoaded){
    ctx.drawImage(kokkyImg, player.x-32, player.y-30, 64, 54);
  }else{
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r*0.6, 0, Math.PI*2);
    ctx.fill();
  }
}

function drawHopPuffs(){
  ctx.save();
  hopPuffs.forEach(p=>{
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
    ctx.fillStyle = "rgba(240,245,255,0.95)";
    ctx.fill();
  });
  ctx.restore();
  ctx.globalAlpha = 1;
}

// Onsen steam floor only at bottom
function drawOnsenFloor(){
  ctx.save();
  const floorGrad = ctx.createLinearGradient(0, H*0.88, 0, H);
  floorGrad.addColorStop(0, "rgba(180,190,210,0)");
  floorGrad.addColorStop(1, "rgba(210,220,236,0.75)");
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, H*0.88, W, H*0.12);
  ctx.restore();
}

// =========================
// Collision & score
// =========================
function checkPlayerHitsObstacle(){
  for(const o of obstacles){
    if(player.x + player.r > o.x && player.x - player.r < o.x + o.width){
      if(player.y - player.r < o.top || player.y + player.r > o.bottom){
        return true;
      }
    }
  }
  return false;
}

function checkCarrotCollect(){
  carrots.forEach(c=>{
    if(c.collected) return;
    const dx = player.x - c.x;
    const dy = player.y - c.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if(dist < player.r*0.8){
      c.collected = true;
      score += c.golden ? 5 : 2;
      scoreSpan.textContent = score.toString();
      updateRank();
    }
  });
}

function updateRank(){
  let label = "Beginner";
  for(const r of RANKS){
    if(score >= r.score){
      label = r.label;
      break;
    }
  }
  currentRankLabel = label;
  rankSpan.textContent = currentRankLabel;
}

// =========================
// Main loop
// =========================
function loop(){
  requestAnimationFrame(loop);

  ctx.clearRect(0,0,W,H);
  drawBackground();
  drawSnowBehind();

  if(!running){
    drawObstaclesAndCarrots();
    drawPlayer();
    drawHopPuffs();
    drawOnsenFloor();
    return;
  }

  frame++;

  snowflakes.forEach(f=>{
    f.y += f.vy;
    if(f.y > H+10){
      f.y = -10;
      f.x = Math.random()*W;
    }
  });

  player.vy += gravity;
  player.y += player.vy;

  if(player.y - player.r < 0) player.y = player.r;
  if(player.y + player.r > H) {
    player.y = H - player.r;
    player.vy = 0;
    running = false;
  }

  if(frame % 80 === 0){
    addObstacle();
  }

  obstacles.forEach(o=>{
    o.x -= scrollSpeed;
    if(!o.passed && o.x + o.width < player.x){
      o.passed = true;
      score++;
      scoreSpan.textContent = score.toString();
      updateRank();
      if(score === 60){
        scrollSpeed = 3.7;
      }
      addCarrotWave(o.x + o.width + CARROT_WAVE_GAP_AFTER*o.width);
    }
  });

  checkCarrotCollect();
  carrots.forEach(c=>{ c.x -= scrollSpeed; });

  hopPuffs.forEach(p=>{
    p.y -= 0.3;
    p.alpha -= 0.015;
  });

  while(obstacles.length && obstacles[0].x + obstacles[0].width < -120){
    obstacles.shift();
  }
  while(carrots.length && (carrots[0].x < -40 || carrots[0].collected && carrots[0].x < -10)){
    carrots.shift();
  }
  while(hopPuffs.length && hopPuffs[0].alpha <= 0){
    hopPuffs.shift();
  }

  if(checkPlayerHitsObstacle()){
    running = false;
  }

  drawObstaclesAndCarrots();
  drawPlayer();
  drawHopPuffs();
  drawOnsenFloor();

  if(!running){
    if(score > bestScore){
      bestScore = score;
      bestSpan.textContent = bestScore.toString();
      localStorage.setItem("onsen_bestScore", bestScore.toString());
    }
  }
}

function drawObstaclesAndCarrots(){
  const theme = OBSTACLE_THEMES[currentThemeIndex % OBSTACLE_THEMES.length];
  const color = theme.color || "#47693d";

  obstacles.forEach(o=>{
    drawBambooObstacle(o, color);
  });

  drawCarrots();
}

// =========================
// Leaderboard placeholder
// =========================
function updateBestFromLeaderboard(){
  bestSpan.textContent = bestScore.toString();
}

// Run loop
loop();
