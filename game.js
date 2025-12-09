// Kokky's Onsen Dash – polished version: night onsen, wooden pillars, fog steam, carrot waves, scoreboard ranks

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
      phase: Math.random()*Math.PI*2,
      warm: Math.random() < 0.3 // 30% yellowish
    });
  }
}

function initSteamWisps(){
  steamWisps = [];
  for(let i=0;i<18;i++){
    steamWisps.push({
      x: Math.random()*W,
      y: H - 40 - Math.random()*80,
      speedY: 0.25 + Math.random()*0.25,
      alpha: 0.25 + Math.random()*0.2
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

  // add hop steam puff (no more circles, soft ellipse fog)
  hopPuffs.push({
    x: player.x,
    y: player.y + player.r,
    radius: 10,
    alpha: 0.5
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

// Carrot wave: 10 carrots, patterns rotate; normal = 1pt, golden = 5pts
function spawnCarrotWave() {
  carrotWaveCount++;
  const hasGolden = true; // always one golden
  const goldenIndex = Math.floor(Math.random()*10);

  const pattern = carrotPatternIndex % 5;
  carrotPatternIndex++;

  const baseX = W + 60;
  const stepX = 24; // tighter spacing
  const baseY = H/2;

  for(let i=0;i<10;i++){
    let offsetY = 0;
    if(pattern === 0){
      // U-shape (wider)
      const center = 4.5;
      const d = i - center;
      offsetY = d*d * 3; 
    }else if(pattern === 1){
      // rising diagonal ↗
      offsetY = -30 + i*6;
    }else if(pattern === 2){
      // falling diagonal ↘
      offsetY = 30 - i*6;
    }else if(pattern === 3){
      // flat mid-line
      offsetY = -10;
    }else if(pattern === 4){
      // sine wave
      offsetY = Math.sin(i * 0.8) * 25;
    }

    carrots.push({
      x: baseX + i*stepX,
      y: baseY + offsetY,
      r: 9,
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
    rankPopupTimer = 150; // longer
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

  // Spawn obstacles – allow spawn unless carrots still too far right
  let canSpawnObstacle = true;
  if(carrots.length > 0){
    let maxCarrotX = -Infinity;
    for(const c of carrots){
      if(c.x > maxCarrotX) maxCarrotX = c.x;
    }
    // 0.7-ish spacing: allow spawn once carrots largely in left 70%
    if(maxCarrotX > W*0.7){
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
      score += c.golden ? 5 : 1;
      scoreEl.textContent = score;
      return false;
    }
    return c.x > -30;
  });

  // hop steam puffs update
  hopPuffs.forEach(p=>{
    p.y -= 0.8;
    p.radius += 0.5;
    p.alpha -= 0.025;
  });
  hopPuffs = hopPuffs.filter(p=>p.alpha > 0);

  // background animation
  lanternPhase += 0.02;
  steamWisps.forEach(w=>{
    w.y -= w.speedY;
    if(w.y < H - 150) {
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

  // retro midnight sky
  const grad = ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0, "#0a1633");
  grad.addColorStop(1, "#02040b");
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,W,H);

  // stars
  ctx.save();
  stars.forEach(s=>{
    const tw = 0.5 + 0.5*Math.sin(performance.now()/400 + s.phase);
    ctx.globalAlpha = 0.25 + 0.5*tw;
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

  // snow caps as soft band
  const snowGrad = ctx.createLinearGradient(0, H*0.38, 0, H*0.58);
  snowGrad.addColorStop(0, "rgba(229,236,255,0.7)");
  snowGrad.addColorStop(1, "rgba(229,236,255,0)");
  ctx.fillStyle = snowGrad;
  ctx.fillRect(0, H*0.38, W, H*0.2);
  ctx.restore();

  // lantern runway BEHIND obstacles
  ctx.save();
  const lanternY = H*0.7;
  for(let x = -20; x < W+40; x += 100){ // fewer lanterns
    const phase = lanternPhase + x*0.05;
    const glow = 0.7 + 0.3*Math.sin(phase);
    ctx.globalAlpha = 0.5 + 0.3*glow;

    // lantern body (simple box shape)
    ctx.fillStyle = "#ffcf6b";
    ctx.fillRect(x-4, lanternY-7, 8, 12);
    // top/bottom caps
    ctx.fillStyle = "#b8762a";
    ctx.fillRect(x-5, lanternY-8, 10, 2);
    ctx.fillRect(x-5, lanternY+4, 10, 2);
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

  // drifting steam wisps (foreground environment steam, not circles)
  ctx.save();
  steamWisps.forEach(w=>{
    ctx.globalAlpha = w.alpha;
    ctx.fillStyle = "#f7f9ff";
    ctx.beginPath();
    ctx.ellipse(w.x, w.y, 32, 12, 0, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.restore();

  // obstacles: dark brown wooden pillars with segments (W3)
  obstacles.forEach(o=>{
    const bottomHeight = H - (o.top + o.gap);

    const woodColor = "#3a2615";
    const woodHighlight = "#5c3a20";

    ctx.save();

    // top pillar
    ctx.fillStyle = woodColor;
    ctx.beginPath();
    ctx.roundRect(o.x, 0, 40, o.top, 8);
    ctx.fill();

    // segment lines
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 2;
    for(let y=16; y<o.top; y+=18){
      ctx.beginPath();
      ctx.moveTo(o.x+4, y);
      ctx.lineTo(o.x+36, y+2);
      ctx.stroke();
    }
    // subtle vertical highlight
    ctx.fillStyle = woodHighlight;
    ctx.fillRect(o.x+10, 0, 4, o.top);

    // bottom pillar
    ctx.fillStyle = woodColor;
    ctx.beginPath();
    ctx.roundRect(o.x, o.top+o.gap, 40, bottomHeight, 8);
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    for(let y=o.top+o.gap+16; y< H; y+=18){
      ctx.beginPath();
      ctx.moveTo(o.x+4, y);
      ctx.lineTo(o.x+36, y+2);
      ctx.stroke();
    }
    ctx.fillStyle = woodHighlight;
    ctx.fillRect(o.x+10, o.top+o.gap, 4, bottomHeight);

    ctx.restore();
  });

  // carrots (triangles), golden vs normal
  carrots.forEach(c=>{
    ctx.save();
    ctx.translate(c.x, c.y);

    // leaf
    ctx.fillStyle = "#70c96a";
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(-4, -4);
    ctx.lineTo(4, -4);
    ctx.closePath();
    ctx.fill();

    // body
    ctx.fillStyle = c.golden ? "#ffd94a" : "#ff9d3b";
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(-5, 8);
    ctx.lineTo(5, 8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  });

  // hop puffs (soft fog puffs under feet)
  ctx.save();
  hopPuffs.forEach(p=>{
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = "#f5f7ff";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.radius*1.4, p.radius*0.7, 0, 0, Math.PI*2);
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

  // rank popup
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
