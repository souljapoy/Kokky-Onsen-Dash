const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");

let currentPlayerId = localStorage.getItem("onsen_player_id") || null;

let W = canvas.width;
let H = canvas.height;

// Player
let player = { x: 120, y: H/2, vy: 0, r: 24 };
const gravity = 0.45;
const hopPower = -8.8;

// Images
const kokkyImg = new Image();
kokkyImg.src = "kokky.png";
let kokkyLoaded = false;
kokkyImg.onload = ()=> kokkyLoaded = true;

const mountainsImg = new Image();
mountainsImg.src = "mountains.png";
let mountainsLoaded = false;
mountainsImg.onload = ()=> mountainsLoaded = true;

const woodImg = new Image();
woodImg.src = "wood.png";
let woodLoaded = false;
woodImg.onload = ()=> woodLoaded = true;

const steamImg = new Image();
steamImg.src = "steam.png";
let steamLoaded = false;
steamImg.onload = ()=> steamLoaded = true;

// Game state
let running = false;
let score = 0;
let bestScore = 0;
let obstacles = [];
let spawnTimer = 0;

// Steam puffs
let hopPuffs = [];

// Parallax positions
let mountainsOffset = 0;
let steamOffset = 0;

const gapSize = 150;
const baseSpeed = 3;

// Init
updateBestFromLeaderboard();
setupControls();

// Controls
function setupControls() {
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

function startGame() {
  running = true;
  score = 0;
  scoreEl.textContent = "0";
  player.y = H/2;
  player.vy = 0;
  obstacles = [];
  spawnTimer = 0;
}

function hop() {
  player.vy = hopPower;
  hopPuffs.push({
    x: player.x,
    y: player.y + 20,
    alpha: 0.6,
    r: 4
  });
}

// Leaderboard
function loadBoard() {
  try {
    const raw = localStorage.getItem("onsen_lb");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBoard(list) {
  localStorage.setItem("onsen_lb", JSON.stringify(list));
}

function updateBestFromLeaderboard() {
  if (!currentPlayerId) { bestEl.textContent = "0"; return; }
  const list = loadBoard();
  const e = list.find(v => v.id === currentPlayerId);
  bestScore = e ? e.score : 0;
  bestEl.textContent = bestScore;
}

function endGame() {
  running = false;
  if (!currentPlayerId) return;
  let list = loadBoard();
  let e = list.find(v=>v.id===currentPlayerId);
  if (!e) {
    list.push({ id: currentPlayerId, score: score, ts: Date.now()});
  } else if (score > e.score) {
    e.score = score;
    e.ts = Date.now();
  }
  list.sort((a,b)=> b.score-a.score || a.ts-b.ts);
  if (list.length>50) list=list.slice(0,50);
  saveBoard(list);
  updateBestFromLeaderboard();
}

// Obstacles
function addObstacle() {
  const minTop = 80;
  const maxTop = H - gapSize - 80;
  const top = minTop + Math.random()*(maxTop-minTop);
  obstacles.push({
    x: W + 40,
    top,
    gap: gapSize,
    passed:false
  });
}

function collide(o) {
  if (player.x + player.r > o.x && player.x - player.r < o.x + 40) {
    if (player.y - player.r < o.top || player.y + player.r > o.top + o.gap)
      return true;
  }
  return false;
}

// Loop
function update() {
  if (!running) return;

  player.vy += gravity;
  player.y += player.vy;

  if (player.y+player.r > H || player.y-player.r < 0) {
    endGame();
    return;
  }

  const speed = baseSpeed;

  mountainsOffset -= speed*0.25;
  if (mountainsOffset <= -W) mountainsOffset += W;

  steamOffset -= speed*0.5;
  if (steamOffset <= -W) steamOffset += W;

  spawnTimer++;
  if (spawnTimer > 75) {
    spawnTimer = 0;
    addObstacle();
  }

  obstacles.forEach(o=>{
    o.x -= speed;
    if (!o.passed && o.x + 40 < player.x) {
      o.passed = true;
      score++;
      scoreEl.textContent = score;
    }
  });

  obstacles = obstacles.filter(o=>{
    if (collide(o)) { endGame(); return false;}
    return o.x>-60;
  });

  hopPuffs.forEach(p=>{
    p.y += 1;
    p.alpha -=0.03;
    p.r +=0.15;
  });
  hopPuffs = hopPuffs.filter(p=> p.alpha>0);
}

function draw() {
  ctx.clearRect(0,0,W,H);

  // background sky
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,"#0a1633");
  g.addColorStop(1,"#02040b");
  ctx.fillStyle=g;
  ctx.fillRect(0,0,W,H);

  // mountains
  if(mountainsLoaded){
    const mh=200;
    const my=H*0.55;
    const scale=mh/mountainsImg.height;
    const mw=mountainsImg.width*scale;
    let x=mountainsOffset%mw;
    if(x>0)x-=mw;
    ctx.globalAlpha=0.93;
    for(;x<W;x+=mw) ctx.drawImage(mountainsImg,x,my,mw,mh);
    ctx.globalAlpha=1;
  }

  // steam bottom
  if(steamLoaded){
    const sh=180;
    const sy=H-sh;
    const scale=sh/steamImg.height;
    const sw=steamImg.width*scale;
    let x=steamOffset%sw;
    if(x>0)x-=sw;
    for(;x<W;x+=sw) ctx.drawImage(steamImg,x,sy,sw,sh);
  }

  // hop puffs brighter
  hopPuffs.forEach(p=>{
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = "#fafafa";
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // obstacles
  obstacles.forEach(o=>{
    if(woodLoaded){
      ctx.drawImage(woodImg,o.x,0,40,o.top);
      ctx.drawImage(woodImg,o.x,o.top+o.gap,40,H-(o.top+o.gap));
    } else {
      ctx.fillStyle="#5c3b1e";
      ctx.fillRect(o.x,0,40,o.top);
      ctx.fillRect(o.x,o.top+o.gap,40,H-(o.top+o.gap));
    }
  });

  // player
  if(kokkyLoaded){
    const s=56;
    ctx.drawImage(kokkyImg,player.x-s/2,player.y-s/2,s,s);
  }else{
    ctx.fillStyle="white";
    ctx.beginPath();
    ctx.arc(player.x,player.y,player.r,0,Math.PI*2);
    ctx.fill();
  }
}

function loop(){
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();
