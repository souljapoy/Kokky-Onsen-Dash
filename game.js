// Kokky's Onsen Dash – Flappy-style with ranks, carrot waves, Kokky sprite, team IDs, best rank in scoreboard

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

// Team config
const TEAM_CONFIG = {
  W: { label: "White", numbers: [5,8,9,18,19,22,28,29,30,34], alts: ["A","B"] },
  R: { label: "Red",   numbers: [1,4,6,7,11,13,20,21,27,31,40], alts: ["A","B"] },
  B: { label: "Blue",  numbers: [2,3,15,16,17,25,32,33,38,41], alts: ["A","B"] },
  G: { label: "Green", numbers: [10,12,14,23,24,26,35,36,37,39], alts: ["A","B"] },
  Guest: { label: "Guest", numbers: [0], alts: [] }
};

// Rank thresholds (by obstacles passed)
const RANKS = [
  { threshold: 25,  title: "Steam Hopper" },
  { threshold: 50,  title: "Onsen Ace" },
  { threshold: 75,  title: "Steam Master" },
  { threshold: 100, title: "Onsen Overlord" },
  { threshold: 250, title: "King of the Onsen" },
  { threshold: 500, title: "Onsen Legend" },
  { threshold: 1000, title: "Onsen God" }
];

// Game state
let running = false;
let obstacles = [];
let carrots = [];
let score = 0;
let obstaclesPassed = 0;
let carrotWaveCount = 0;
let lastCarrotWaveObstacleCount = 0;
let carrotPatternIndex = 0;

let currentPlayerId = localStorage.getItem("onsen_player_id") || null;

// Player physics
let player = { x: 120, y: H/2, vy: 0, r: 24 };
const gravity = 0.45;
const hopPower = -8.8;
const gapSize = 180;
let spawnTimer = 0;

const baseSpeed = 3;
const boostedSpeed = 3.8; // after 60 obstacles

// Rank popup
let nextRankIndex = 0;
let rankPopupTimer = 0;
let rankPopupTitle = "";

// Screen shake
let shakeTimer = 0;

// Hop steam particles
let hopPuffs = [];

// Background elements
let stars = [];
let lanternPhase = 0;
let steamWisps = [];

// Kokky sprite
const kokkyImg = new Image();
kokkyImg.src = "kokky.png";
let kokkyLoaded = false;
kokkyImg.onload = () => { kokkyLoaded = true; };

// Init UI
updatePlayerLabel();
updateBestFromLeaderboard();
initStars();
initSteamWisps();

// Controls – start on first tap / space
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

function openPlayerOverlay() {
  selectedTeamKey = null;
  selectedNumberCode = null;
  confirmPlayerBtn.disabled = true;
  selectedPreview.textContent = "Player: -";
  numberList.innerHTML = '<p class="hint">Select a team first.</p>';
  Array.from(document.querySelectorAll(".teamBtn")).forEach(btn=>{
    btn.classList.remove("selected");
  });
  playerOverlay.classList.remove("hidden");
}

function closePlayerOverlay(committed) {
  playerOverlay.classList.add("hidden");
  if(!committed && !currentPlayerId){
    setTimeout(openPlayerOverlay, 10);
  }
}

teamButtonsContainer.addEventListener("click", e=>{
  const btn = e.target.closest(".teamBtn");
  if(!btn) return;
  const teamKey = btn.dataset.team;
  selectedTeamKey = teamKey;
  selectedNumberCode = null;
  confirmPlayerBtn.disabled = true;
  selectedPreview.textContent = "Player: -";

  Array.from(teamButtonsContainer.querySelectorAll(".teamBtn")).forEach(b=>{
    b.classList.toggle("selected", b === btn);
  });

  buildNumberList(teamKey);
});

function buildNumberList(teamKey) {
  const cfg = TEAM_CONFIG[teamKey];
  numberList.innerHTML = "";
  if(!cfg){
    numberList.innerHTML = '<p class="hint">Unknown team.</p>';
    return;
  }

  if(teamKey === "Guest") {
    const btn = document.createElement("button");
    btn.textContent = "0 – Guest";
    btn.dataset.code = "0";
    btn.addEventListener("click", ()=>selectNumberCode("0", btn));
    numberList.appendChild(btn);
    return;
  }

  const allCodes = [...cfg.numbers.map(n=>String(n)), ...cfg.alts];

  allCodes.forEach(code => {
    const btn = document.createElement("button");
    if(code === "A" || code === "B"){
      btn.textContent = `${code} (ALT)`;
    }else{
      btn.textContent = code;
    }
    btn.dataset.code = code;
    btn.addEventListener("click", ()=>selectNumberCode(code, btn));
    numberList.appendChild(btn);
  });
}

function selectNumberCode(code, btn) {
  selectedNumberCode = code;
  Array.from(numberList.querySelectorAll("button")).forEach(b=>{
    b.classList.remove("selected");
  });
  btn.classList.add("selected");
  updatePreviewAndButton();
}

function updatePreviewAndButton() {
  if(!selectedTeamKey || !selectedNumberCode){
    confirmPlayerBtn.disabled = true;
    selectedPreview.textContent = "Player: -";
    return;
  }

  let idStr;
  if(selectedTeamKey === "Guest"){
    idStr = "0";
  }else{
    idStr = `${selectedTeamKey}-${selectedNumberCode}`;
  }
  selectedPreview.textContent = `Player: ${idStr}`;
  confirmPlayerBtn.disabled = false;
}

confirmPlayerBtn.addEventListener("click", () => {
  if(!selectedTeamKey || !selectedNumberCode){
    return;
  }
  let idStr;
  if(selectedTeamKey === "Guest"){
    idStr = "0";
  }else{
    idStr = `${selectedTeamKey}-${selectedNumberCode}`;
  }
  currentPlayerId = idStr;
  localStorage.setItem("onsen_player_id", currentPlayerId);
  updatePlayerLabel();
  updateBestFromLeaderboard();
  closePlayerOverlay(true);
});

// Helpers
function updatePlayerLabel() {
  if(!currentPlayerId){
    playerIdLabel.textContent = "Not set";
  }else{
    playerIdLabel.textContent = currentPlayerId;
  }
}

function loadBoard(){
  try{
    const raw = localStorage.getItem("onsen_lb");
    if(!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  }catch(e){
    return [];
  }
}

function saveBoard(list){
  localStorage.setItem("onsen_lb", JSON.stringify(list));
}

function updateBestFromLeaderboard(){
  if(!currentPlayerId){
    bestEl.textContent = "0";
    return;
  }
  const list = loadBoard();
  const entry = list.find(e=>e.id === currentPlayerId);
  const best = entry ? entry.score : 0;
  bestEl.textContent = best;
}

function getRankIndexForObstacles(count){
  let idx = -1;
  for(let i=0; i<RANKS.length; i++){
    if(count >= RANKS[i].threshold) idx = i;
  }
  return idx;
}

// Background init
function initStars(){
  stars = [];
  for(let i=0;i<60;i++){
    stars.push({
      x: Math.random()*W,
      y: Math.random()*H*0.5,
      phase: Math.random()*Math.PI*2
    });
  }
}

function initSteamWisps(){
  steamWisps = [];
  for(let i=0;i<15;i++){
    steamWisps.push({
      x: Math.random()*W,
      y: H - 40 - Math.random()*80,
      speedY: 0.3 + Math.random()*0.3,
      alpha: 0.3 + Math.random()*0.2
    });
  }
}

// Game control
function startGame() {
  if(!currentPlayerId){
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
  player.y = H/2;
  player.vy = 0;
  spawnTimer = 0;
}

function hop() {
  if(!running) return;
  player.vy = hopPower;

  // add hop steam puff
  hopPuffs.push({
    x: player.x,
    y: player.y + player.r,
    radius: 10,
    alpha: 0.7
  });
}

// Spawning
function addObstacle(){
  const minCenter = 120;
  const maxCenter = H - 120;
  const baseCenter = minCenter + Math.random()*(maxCenter - minCenter);
  const mix = 0.7 * baseCenter + 0.3 * player.y;
  const center = Math.max(minCenter, Math.min(maxCenter, mix));
  const top = center - gapSize/2;

  obstacles.push({
    x: W + 40,
    top,
    gap: gapSize,
    passed: false
  });
}

// Carrot patterns: 0=U,1=rise,2=fall,3=flat,4=wavy
function spawnCarrotWave() {
  carrotWaveCount++;
  const hasGolden = (carrotWaveCount % 3 === 0);
  const goldenIndex = hasGolden ? Math.floor(Math.random()*5) : -1;

  const pattern = carrotPatternIndex % 5;
  carrotPatternIndex++;

  const baseX = W + 80;
  const stepX = 32;
  const baseY = H/2;

  for(let i=0;i<5;i++){
    let offsetY = 0;
    if(pattern === 0){
      // U-shape
      const center = 2;
      const d = i - center;
      offsetY = d*d * 8; // 0,8,32,8,0
    }else if(pattern === 1){
      // rising diagonal ↗
      offsetY = -20 + i*12;
    }else if(pattern === 2){
      // falling diagonal ↘
      offsetY = 20 - i*12;
    }else if(pattern === 3){
      // flat line
      offsetY = -10;
    }else if(pattern === 4){
      // wavy
      offsetY = Math.sin(i * 1.2) * 30;
    }

    carrots.push({
      x: baseX + i*stepX,
      y: baseY + offsetY,
      r: 10,
      golden: (i === goldenIndex)
    });
  }
}

// Collision
function collideObstacle(o){
  if(player.x + player.r > o.x && player.x - player.r < o.x + 40){
    if(player.y - player.r < o.top || player.y + player.r > o.top + o.gap){
      return true;
    }
  }
  return false;
}

function collideCarrot(c){
  const dx = player.x - c.x;
  const dy = player.y - c.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  return dist < (player.r + c.r);
}

// Game over
function endGame(){
  running = false;
  shakeTimer = 12;

  if(!currentPlayerId || score <= 0){
    msgEl.textContent = `Score: ${score}`;
    return;
  }

  const runRankIndex = getRankIndexForObstacles(obstaclesPassed);

  let list = loadBoard();
  let entry = list.find(e=>e.id === currentPlayerId);
  const prevScore = entry ? entry.score : 0;
  const prevRankIndex = entry && typeof entry.bestRankIndex === "number" ? entry.bestRankIndex : -1;

  const isBetterScore = score > prevScore;
  const isBetterRank  = runRankIndex > prevRankIndex;

  if(!entry){
    entry = {
      id: currentPlayerId,
      score: score,
      ts: Date.now(),
      bestRankIndex: runRankIndex
    };
    list.push(entry);
  }else{
    if(isBetterScore){
      entry.score = score;
      entry.ts = Date.now();
    }
    if(isBetterRank){
      entry.bestRankIndex = runRankIndex;
      if(!isBetterScore){
        entry.ts = Date.now();
      }
    }
  }

  list.sort((a,b)=> b.score - a.score || a.ts - b.ts);
  if(list.length > 50) list = list.slice(0,50);
  saveBoard(list);

  if(isBetterScore){
    msgEl.textContent = `New Best! ${score}`;
  }else{
    msgEl.textContent = `Score: ${score} (Best: ${prevScore})`;
  }

  updateBestFromLeaderboard();
}

// Rank check
function checkRankUp() {
  if(nextRankIndex >= RANKS.length) return;
  const nextRank = RANKS[nextRankIndex];
  if(obstaclesPassed >= nextRank.threshold){
    rankPopupTitle = nextRank.title;
    rankPopupTimer = 150; // longer popup
    nextRankIndex++;
  }
}

// Update loop
function updateGame(){
  if(!running) return;

  // physics
  player.vy += gravity;
  player.y += player.vy;

  if(player.y + player.r > H || player.y - player.r < 0){
    endGame();
    return;
  }

  const speed = obstaclesPassed >= 60 ? boostedSpeed : baseSpeed;

  // Obstacle spawn – allow spawn unless carrots mostly on right
  let canSpawnObstacle = true;
  if(carrots.length > 0){
    let maxCarrotX = -Infinity;
    for(const c of carrots){
      if(c.x > maxCarrotX) maxCarrotX = c.x;
    }
    if(maxCarrotX > W*0.7){ // smaller gap vs before (0.7 "distance")
      canSpawnObstacle = false;
    }
  }

  if(canSpawnObstacle){
    spawnTimer++;
    if(spawnTimer > 85){
      spawnTimer = 0;
      addObstacle();
    }
  }

  // Obstacles movement / scoring
  obstacles.forEach(o=>{
    o.x -= speed;
    if(!o.passed && o.x + 40 < player.x){
      o.passed = true;
      obstaclesPassed++;
      score++;
      scoreEl.textContent = score;

      checkRankUp();

      // carrot wave every 10 obstacles
      if(obstaclesPassed % 10 === 0 && obstaclesPassed !== lastCarrotWaveObstacleCount){
        lastCarrotWaveObstacleCount = obstaclesPassed;
        spawnCarrotWave();
      }
    }
  });

  obstacles = obstacles.filter(o=>o.x > -60);

  for(const o of obstacles){
    if(collideObstacle(o)){
      endGame();
      return;
    }
  }

  // carrots movement / collecting
  carrots.forEach(c=>{
    c.x -= speed;
  });
  carrots = carrots.filter(c=>{
    if(collideCarrot(c)){
      score += c.golden ? 5 : 2;
      scoreEl.textContent = score;
      return false;
    }
    return c.x > -30;
  });

  // hop steam puffs update
  hopPuffs.forEach(p=>{
    p.y -= 0.8;
    p.radius += 0.5;
    p.alpha -= 0.03;
  });
  hopPuffs = hopPuffs.filter(p=>p.alpha > 0);

  // background animation phases
  lanternPhase += 0.02;
  steamWisps.forEach(w=>{
    w.y -= w.speedY;
    if(w.y < H - 140) {
      w.y = H - 40 - Math.random()*40;
      w.x = Math.random()*W;
    }
  });
}

// Draw
function draw(){
  ctx.save();

  if(shakeTimer > 0){
    const dx = (Math.random()*4 - 2);
    const dy = (Math.random()*4 - 2);
    ctx.translate(dx, dy);
    shakeTimer--;
  }

  // sky
  ctx.fillStyle = "#050716";
  ctx.fillRect(0,0,W,H);

  const grad = ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0, "#050922");
  grad.addColorStop(1, "#080c24");
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,W,H);

  // stars twinkle
  ctx.save();
  stars.forEach(s=>{
    const tw = 0.5 + 0.5*Math.sin(performance.now()/400 + s.phase);
    ctx.globalAlpha = 0.3 + 0.5*tw;
    ctx.fillStyle = "#e8f0ff";
    ctx.fillRect(s.x, s.y, 2, 2);
  });
  ctx.restore();

  // moon with warm color + slight texture
  ctx.save();
  const moonX = W - 80;
  const moonY = 80;
  const moonR = 26;
  const moonGrad = ctx.createRadialGradient(
    moonX-8, moonY-8, 4,
    moonX, moonY, moonR+6
  );
  moonGrad.addColorStop(0, "#fff9d9");
  moonGrad.addColorStop(1, "#bba86a");
  ctx.fillStyle = moonGrad;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, Math.PI*2);
  ctx.fill();

  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#d8c78a";
  ctx.beginPath();
  ctx.arc(moonX-8, moonY-6, 6, 0, Math.PI*2);
  ctx.arc(moonX+5, moonY+4, 4, 0, Math.PI*2);
  ctx.arc(moonX+10, moonY-10, 3, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // snowy Nagano mountains
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, H*0.55);
  ctx.lineTo(W*0.15, H*0.4);
  ctx.lineTo(W*0.3, H*0.55);
  ctx.lineTo(W*0.5, H*0.35);
  ctx.lineTo(W*0.7, H*0.55);
  ctx.lineTo(W*0.85, H*0.42);
  ctx.lineTo(W, H*0.55);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fillStyle = "#0b1022";
  ctx.fill();

  // snow caps
  ctx.beginPath();
  ctx.moveTo(W*0.15, H*0.4);
  ctx.lineTo(W*0.14, H*0.43);
  ctx.lineTo(W*0.16, H*0.43);
  ctx.closePath();
  ctx.moveTo(W*0.5, H*0.35);
  ctx.lineTo(W*0.49, H*0.38);
  ctx.lineTo(W*0.51, H*0.38);
  ctx.closePath();
  ctx.moveTo(W*0.85, H*0.42);
  ctx.lineTo(W*0.84, H*0.45);
  ctx.lineTo(W*0.86, H*0.45);
  ctx.closePath();
  ctx.fillStyle = "#e5ecff";
  ctx.fill();
  ctx.restore();

  // runway-style lanterns
  ctx.save();
  const lanternY = H*0.7;
  for(let x = -20; x < W+40; x += 50){
    const phase = lanternPhase + x*0.05;
    const glow = 0.7 + 0.3*Math.sin(phase);
    ctx.globalAlpha = 0.6 + 0.2*glow;
    ctx.fillStyle = "#ffcf6b";
    ctx.beginPath();
    ctx.arc(x, lanternY, 4, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.restore();

  // bottom onsen steam blanket
  ctx.save();
  const steamGrad = ctx.createLinearGradient(0, H*0.8, 0, H);
  steamGrad.addColorStop(0, "rgba(255,255,255,0)");
  steamGrad.addColorStop(1, "rgba(255,255,255,0.32)");
  ctx.fillStyle = steamGrad;
  ctx.fillRect(0, H*0.75, W, H*0.25);
  ctx.restore();

  // drifting steam wisps (foreground)
  ctx.save();
  steamWisps.forEach(w=>{
    ctx.globalAlpha = w.alpha;
    ctx.fillStyle = "#f7f9ff";
    ctx.beginPath();
    ctx.ellipse(w.x, w.y, 30, 10, 0, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.restore();

  // obstacles as steam pillars
  obstacles.forEach(o=>{
    const steamColor = "rgba(255,255,255,0.25)";

    // gentle drift factor
    const drift = Math.sin((performance.now()/800) + o.x*0.01)*2;

    ctx.save();
    ctx.translate(drift, 0);

    // top pillar
    ctx.fillStyle = steamColor;
    ctx.beginPath();
    ctx.roundRect(o.x, 0, 40, o.top, 8);
    ctx.fill();

    // bottom pillar
    const bottomHeight = H - (o.top + o.gap);
    ctx.beginPath();
    ctx.roundRect(o.x, o.top + o.gap, 40, bottomHeight, 8);
    ctx.fill();

    ctx.restore();
  });

  // carrots
  carrots.forEach(c=>{
    ctx.fillStyle = c.golden ? "#ffd94a" : "#ff9d3b";
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI*2);
    ctx.fill();
  });

  // hop puffs
  ctx.save();
  hopPuffs.forEach(p=>{
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = "#f5f7ff";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.radius*1.2, p.radius*0.6, 0, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.restore();

  // player
  if(kokkyLoaded){
    const size = 64;
    ctx.drawImage(kokkyImg, player.x - size/2, player.y - size/2, size, size);
  }else{
    ctx.fillStyle="#fff";
    ctx.beginPath();
    ctx.arc(player.x,player.y,player.r,0,Math.PI*2);
    ctx.fill();
  }

  // rank popup (gold banner)
  if(rankPopupTimer > 0){
    const alpha = rankPopupTimer > 30 ? 1 : rankPopupTimer/30;
    ctx.globalAlpha = alpha;
    const boxW = 280;
    const boxH = 70;
    const bx = (W - boxW)/2;
    const by = 100;

    const rgrad = ctx.createLinearGradient(bx, by, bx+boxW, by+boxH);
    rgrad.addColorStop(0, "#ffeb9c");
    rgrad.addColorStop(1, "#f6c14d");
    ctx.fillStyle = rgrad;
    ctx.beginPath();
    ctx.roundRect(bx,by,boxW,boxH,12);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#7a4b00";
    ctx.font = "18px 'Handjet'";
    ctx.textAlign = "center";
    ctx.fillText("Rank Up!", W/2, by+30);

    ctx.font = "16px 'Handjet'";
    ctx.fillText(rankPopupTitle, W/2, by+50);

    // simple sparkles
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(bx+25, by+18, 2, 0, Math.PI*2);
    ctx.arc(bx+boxW-25, by+22, 2, 0, Math.PI*2);
    ctx.fill();

    ctx.globalAlpha = 1;
    rankPopupTimer--;
  }

  ctx.restore();
}

// Main loop
function loop(){
  updateGame();
  draw();
  requestAnimationFrame(loop);
}

loop();

// If no player selected yet, force overlay once
if(!currentPlayerId){
  openPlayerOverlay();
}
