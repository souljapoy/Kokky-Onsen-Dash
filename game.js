// Kokky's Onsen Dash – Team + Number Version
// No text input, no popup. Player = (Team + Number) or Guest(0).

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl  = document.getElementById("best");
const startBtn = document.getElementById("startBtn");
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

// Team & number config from your list
const TEAM_CONFIG = {
  W: { // White
    label: "White",
    numbers: [5,8,9,18,19,22,28,29,30,34],
    alts: ["A","B"]
  },
  R: { // Red
    label: "Red",
    numbers: [1,4,6,7,11,13,20,21,27,31,40],
    alts: ["A","B"]
  },
  B: { // Blue
    label: "Blue",
    numbers: [2,3,15,16,17,25,32,33,38,41],
    alts: ["A","B"]
  },
  G: { // Green
    label: "Green",
    numbers: [10,12,14,23,24,26,35,36,37,39],
    alts: ["A","B"]
  },
  Guest: {
    label: "Guest",
    numbers: [0], // only 0
    alts: []
  }
};

// Game state
let running = false;
let obstacles = [];
let score = 0;

// Player state
let currentPlayerId = localStorage.getItem("onsen_player_id") || null;
// Example IDs: "W-5", "R-20", "G-A", "B-B", "0"

updatePlayerLabel();
updateBestFromLeaderboard();

// Physics
let player = { x: 120, y: H/2, vy: 0, r: 22 };
const gravity = 0.45;
const hopPower = -8.8;
const gapSize = 180;
let spawnTimer = 0;

// Input
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

startBtn.addEventListener("click", () => {
  startGame();
});

changePlayerBtn.addEventListener("click", () => {
  openPlayerOverlay();
});

cancelPlayerBtn.addEventListener("click", () => {
  closePlayerOverlay(false);
});

// Player selection overlay logic
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
  if(!committed){
    // if no current player at all, force overlay open again
    if(!currentPlayerId){
      setTimeout(openPlayerOverlay, 10);
    }
  }
}

function buildNumberList(teamKey) {
  const cfg = TEAM_CONFIG[teamKey];
  numberList.innerHTML = "";
  if(!cfg) {
    numberList.innerHTML = '<p class="hint">Unknown team.</p>';
    return;
  }

  // Guest: only show 0 – Guest
  if(teamKey === "Guest") {
    const btn = document.createElement("button");
    btn.textContent = "0 – Guest";
    btn.dataset.code = "0";
    btn.addEventListener("click", ()=>selectNumberCode("0", btn));
    numberList.appendChild(btn);
    return;
  }

  // Students
  const allCodes = [...cfg.numbers.map(n => String(n))];

  // ALTs A/B at bottom
  cfg.alts.forEach(aCode => allCodes.push(aCode));

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

teamButtonsContainer.addEventListener("click", e=>{
  const btn = e.target.closest(".teamBtn");
  if(!btn) return;
  const teamKey = btn.dataset.team;
  selectedTeamKey = teamKey;
  selectedNumberCode = null;
  confirmPlayerBtn.disabled = true;
  selectedPreview.textContent = "Player: -";

  // highlight team
  Array.from(teamButtonsContainer.querySelectorAll(".teamBtn")).forEach(b=>{
    b.classList.toggle("selected", b === btn);
  });

  // build numbers for that team
  buildNumberList(teamKey);
});

function updatePreviewAndButton() {
  if(!selectedTeamKey || !selectedNumberCode){
    confirmPlayerBtn.disabled = true;
    selectedPreview.textContent = "Player: -";
    return;
  }

  let idStr;
  if(selectedTeamKey === "Guest"){
    idStr = "0"; // guest
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

// Game logic
function startGame() {
  // must have player selected
  if(!currentPlayerId){
    openPlayerOverlay();
    return;
  }
  running = true;
  score = 0;
  scoreEl.textContent = score;
  msgEl.textContent = "";
  obstacles = [];
  player.y = H/2;
  player.vy = 0;
  spawnTimer = 0;
  loop();
}

function hop() {
  if(!running) return;
  player.vy = hopPower;
}

function addObstacle(){
  const top = 40 + Math.random()*(H - 260);
  obstacles.push({
    x: W + 40,
    top,
    gap: gapSize,
    passed: false
  });
}

function collide(o){
  if(player.x + player.r > o.x && player.x - player.r < o.x + 40){
    if(player.y - player.r < o.top || player.y + player.r > o.top + o.gap){
      return true;
    }
  }
  return false;
}

function endGame(){
  running = false;

  // Update leaderboard for this player
  if(!currentPlayerId || score <= 0){
    msgEl.textContent = `Score: ${score}`;
    return;
  }

  let list = loadBoard();
  let entry = list.find(e=>e.id === currentPlayerId);
  const prev = entry ? entry.score : 0;

  if(score > prev){
    if(!entry){
      entry = {id: currentPlayerId, score, ts: Date.now()};
      list.push(entry);
    }else{
      entry.score = score;
      entry.ts = Date.now();
    }
    // sort best to worst
    list.sort((a,b)=>b.score - a.score || a.ts - b.ts);
    if(list.length > 50) list = list.slice(0,50);
    saveBoard(list);
    msgEl.textContent = `New Best! ${score}`;
  }else{
    msgEl.textContent = `Score: ${score} (Best: ${prev})`;
  }

  updateBestFromLeaderboard();
}

function update(){
  player.vy += gravity;
  player.y += player.vy;

  if(player.y + player.r > H){
    endGame();
    return;
  }

  spawnTimer++;
  if(spawnTimer > 85){
    spawnTimer = 0;
    addObstacle();
  }

  obstacles.forEach(o=>{
    o.x -= 3;
    if(!o.passed && o.x + 40 < player.x){
      o.passed = true;
      score++;
      scoreEl.textContent = score;
    }
  });

  obstacles = obstacles.filter(o=>o.x > -60);

  for(const o of obstacles){
    if(collide(o)){
      endGame();
      return;
    }
  }
}

function draw(){
  // simple background
  ctx.fillStyle = "#0b0f25";
  ctx.fillRect(0,0,W,H);

  // obstacles
  ctx.fillStyle = "rgba(240,240,255,0.75)";
  obstacles.forEach(o=>{
    ctx.fillRect(o.x,0,40,o.top);
    ctx.fillRect(o.x,o.top+o.gap,40,H-(o.top+o.gap));
  });

  // placeholder Kokky
  ctx.fillStyle="#fff";
  ctx.beginPath();
  ctx.ellipse(player.x,player.y,player.r,player.r*1.1,0,0,Math.PI*2);
  ctx.fill();

  ctx.fillStyle="#ff71b5";
  ctx.beginPath();
  ctx.ellipse(player.x,player.y+8,player.r,player.r*0.9,0,0,Math.PI*2);
  ctx.fill();
}

function loop(){
  if(!running) return;
  update();
  draw();
  requestAnimationFrame(loop);
}

// initial draw
draw();

// If no player selected yet, force overlay once (user can close and come back)
if(!currentPlayerId){
  openPlayerOverlay();
}
