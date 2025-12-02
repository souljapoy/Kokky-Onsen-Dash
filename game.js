// game.js — improved Pac-Man-like game + Firebase leaderboard + Admin auth + touch + power-pellets + chiptune
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.24.0/firebase-app.js";
import {
  getDatabase, ref, push, onValue, update, remove, get
} from "https://www.gstatic.com/firebasejs/9.24.0/firebase-database.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.24.0/firebase-auth.js";

/* ====== IMPORTANT: Replace the firebaseConfig with your project's config ======
   Get this from Firebase Console > Project settings > Your apps (add web app if needed)
*/
const firebaseConfig = {
    apiKey: "AIzaSyCZ3GCdMWhxHzyeLqw0ZAhcXO72xk1WoRg",
    authDomain: "english-camp-pacman.firebaseapp.com",
    databaseURL: "https://english-camp-pacman-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "english-camp-pacman",
    storageBucket: "english-camp-pacman.firebasestorage.app",
    messagingSenderId: "856665399140",
    appId: "1:856665399140:web:dafbd9120bef47c2f26471"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth ? getAuth(app) : null;
const scoresRef = ref(db, 'pacman-scores');

// --- DOM elements
const playerName = document.getElementById('playerName');
const teamSelect = document.getElementById('teamSelect');
const roundLengthInput = document.getElementById('roundLength');
const btnPlay = document.getElementById('btnPlay');
const btnLeaderboard = document.getElementById('btnLeaderboard');

const menu = document.getElementById('menu');
const gameArea = document.getElementById('gameArea');
const endScreen = document.getElementById('endScreen');
const leaderboard = document.getElementById('leaderboard');
const adminPanel = document.getElementById('adminPanel');

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const finalScore = document.getElementById('finalScore');
const confirmSubmit = document.getElementById('confirmSubmit');

const btnPause = document.getElementById('btnPause');
const btnQuit = document.getElementById('btnQuit');
const btnSubmit = document.getElementById('btnSubmit');
const btnPlayAgain = document.getElementById('btnPlayAgain');
const btnBackMenu = document.getElementById('btnBackMenu');

const btnBackFromLB = document.getElementById('btnBackFromLB');
const btnAdminOpen = document.getElementById('btnAdminOpen');

const adminEmail = document.getElementById('adminEmail');
const adminPass = document.getElementById('adminPass');
const btnAdminSignIn = document.getElementById('btnAdminSignIn');
const btnAdminSignOut = document.getElementById('btnAdminSignOut');
const adminList = document.getElementById('adminList');
const adminActions = document.getElementById('adminActions');
const authArea = document.getElementById('authArea');
const btnCloseAdmin = document.getElementById('btnCloseAdmin');

const topList = document.getElementById('topList');
const teamTotalsEl = document.getElementById('teamTotals');

const touchControls = document.getElementById('touchControls');
const tLeft = document.getElementById('tLeft');
const tRight = document.getElementById('tRight');
const tUp = document.getElementById('tUp');
const tDown = document.getElementById('tDown');
const tAction = document.getElementById('tAction');

// game state
let player = null;
let pellets = [];
let powerPellets = [];
let ghosts = [];
let score = 0;
let timeLeft = 60;
let timerInterval = null;
let gameLoopInterval = null;
let grid = { cols: 20, rows: 20, tile: 20 };

// adapt canvas to grid
canvas.width = grid.cols * grid.tile;
canvas.height = grid.rows * grid.tile;

// sound - simple chiptune using WebAudio
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = AudioCtx ? new AudioCtx() : null;
function playTone(freq, t){ if(!audioCtx) return; const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type='square'; o.frequency.value = freq; o.connect(g); g.connect(audioCtx.destination); g.gain.value = 0.05; o.start(); setTimeout(()=>{ o.stop(); }, t); }

// small intro jingle
function playIntro(){
  if(!audioCtx) return;
  const seq = [440,660,880,0,880,660,440];
  let delay = 0;
  seq.forEach((f,i)=>{
    setTimeout(()=>{ if(f>0) playTone(f,120); }, delay);
    delay += 140;
  });
}

// draw helpers (pixelized)
function drawPixelPacman(x,y,dir,color){
  const px = x * grid.tile;
  const py = y * grid.tile;
  const pad = 3;
  const cell = (grid.tile - pad*2) / 6;
  ctx.fillStyle = color;
  for(let i=0;i<6;i++){
    for(let j=0;j<6;j++){
      let draw = true;
      if(dir.x === 1 && i>=3 && j>=2 && j<=3) draw = false;
      if(dir.x === -1 && i<=2 && j>=2 && j<=3) draw = false;
      if(dir.y === 1 && j>=3 && i>=2 && i<=3) draw = false;
      if(dir.y === -1 && j<=2 && i>=2 && i<=3) draw = false;
      if(draw) ctx.fillRect(px + pad + i*cell, py + pad + j*cell, cell-1, cell-1);
    }
  }
}
function drawPixelGhost(x,y,color){
  const px = x * grid.tile;
  const py = y * grid.tile;
  const pad = 3;
  const cell = (grid.tile - pad*2) / 6;
  ctx.fillStyle = color;
  for(let i=0;i<6;i++){
    for(let j=0;j<5;j++){
      ctx.fillRect(px + pad + i*cell, py + pad + j*cell, cell-1, cell-1);
    }
  }
  for(let i=0;i<6;i++){
    if(i%2===0) ctx.fillRect(px + pad + i*cell, py + pad + 5*cell, cell-1, cell-1);
  }
}

// game creation
function newGame(roundSeconds){
  score = 0; scoreEl.textContent = score;
  timeLeft = parseInt(roundSeconds) || 60; timeEl.textContent = timeLeft;
  pellets = [];
  powerPellets = [];
  for(let r=1;r<grid.rows-1;r++){
    for(let c=1;c<grid.cols-1;c++){
      if((c+r) % 2 === 0) pellets.push({x:c,y:r});
    }
  }
  // place 8 power pellets (spread)
  const spots = [[1,1],[1,grid.rows-2],[grid.cols-2,1],[grid.cols-2,grid.rows-2],[Math.floor(grid.cols/2),1],[Math.floor(grid.cols/2),grid.rows-2],[1,Math.floor(grid.rows/2)],[grid.cols-2,Math.floor(grid.rows/2)]];
  spots.forEach(s=> powerPellets.push({x:s[0], y:s[1]}));

  player = {x: Math.floor(grid.cols/2), y: Math.floor(grid.rows/2), dir:{x:0,y:0}, color:'#ffdd33', powered: false, powerTime:0};
  ghosts = [
    {x:2,y:2, color:'#ff4d4d', vulnerable:false},
    {x:grid.cols-3,y:2, color:'#4de0ff', vulnerable:false},
    {x:2,y:grid.rows-3, color:'#7cff7c', vulnerable:false}
  ];
  // small intro
  playIntro();
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for(let r=0;r<grid.rows;r++){
    for(let c=0;c<grid.cols;c++){
      ctx.fillStyle = (c+r)%2===0 ? '#040420' : '#060630';
      ctx.fillRect(c*grid.tile, r*grid.tile, grid.tile, grid.tile);
    }
  }
  // power pellets (bigger)
  powerPellets.forEach(p=>{
    ctx.fillStyle = '#ff99ff';
    ctx.fillRect(p.x*grid.tile + grid.tile*0.38, p.y*grid.tile + grid.tile*0.38, grid.tile*0.24, grid.tile*0.24);
  });
  // pellets
  ctx.fillStyle = '#ffd966';
  pellets.forEach(p=>{
    ctx.fillRect(p.x*grid.tile + grid.tile*0.45, p.y*grid.tile + grid.tile*0.45, grid.tile*0.12, grid.tile*0.12);
  });
  // player
  drawPixelPacman(player.x, player.y, player.dir, player.color);
  // ghosts (draw blue if vulnerable)
  ghosts.forEach(g=>{
    if(g.vulnerable){
      drawPixelGhost(g.x, g.y, '#6a9cff');
    } else {
      drawPixelGhost(g.x, g.y, g.color);
    }
  });
}

function step(){
  // move player
  if(player.dir.x !== 0 || player.dir.y !== 0){
    let nx = player.x + player.dir.x;
    let ny = player.y + player.dir.y;
    if(nx>0 && nx<grid.cols-1 && ny>0 && ny<grid.rows-1){
      player.x = nx; player.y = ny;
    }
  }
  // collect pellet
  for(let i=pellets.length-1;i>=0;i--){
    const p = pellets[i];
    if(p.x === player.x && p.y === player.y){
      pellets.splice(i,1);
      score += 10;
      scoreEl.textContent = score;
      if(audioCtx) playTone(880,80);
    }
  }
  // collect power pellet
  for(let i=powerPellets.length-1;i>=0;i--){
    const p = powerPellets[i];
    if(p.x === player.x && p.y === player.y){
      powerPellets.splice(i,1);
      score += 50;
      scoreEl.textContent = score;
      // set ghosts vulnerable
      ghosts.forEach(g=> g.vulnerable = true);
      player.powered = true;
      player.powerTime = 10; // seconds
      if(audioCtx) playTone(1000,160);
    }
  }
  // ghosts movement & interactions
  ghosts.forEach(g=>{
    if(Math.random() < 0.5){
      // chase tendency
      const dx = player.x - g.x;
      const dy = player.y - g.y;
      const moveX = Math.abs(dx) > Math.abs(dy);
      if(moveX) g.x += Math.sign(dx);
      else g.y += Math.sign(dy);
    } else {
      const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
      const d = dirs[Math.floor(Math.random()*dirs.length)];
      const gx = g.x + d.x; const gy = g.y + d.y;
      if(gx>0 && gx<grid.cols-1 && gy>0 && gy<grid.rows-1){
        g.x = gx; g.y = gy;
      }
    }
    // collision
    if(g.x === player.x && g.y === player.y){
      if(g.vulnerable){
        // eat ghost
        score += 200;
        scoreEl.textContent = score;
        // respawn ghost
        g.x = 2; g.y = 2; g.vulnerable = false;
        if(audioCtx) playTone(1200,120);
      } else {
        // player hit
        score = Math.max(0, score - 30);
        scoreEl.textContent = score;
        player.x = Math.floor(grid.cols/2); player.y = Math.floor(grid.rows/2);
        if(audioCtx) playTone(220,200);
      }
    }
  });

  // power time decay
  if(player.powered){
    if(player.powerTime > 0){
      player.powerTime -= 0.28;
    } else {
      player.powered = false;
      ghosts.forEach(g=> g.vulnerable = false);
    }
  }

  draw();
}

function startTimer(){
  timerInterval = setInterval(()=> {
    timeLeft--;
    timeEl.textContent = timeLeft;
    if(timeLeft <= 0) endRound();
  }, 1000);
  gameLoopInterval = setInterval(()=> step(), 280);
}
function stopTimer(){
  if(timerInterval){ clearInterval(timerInterval); timerInterval = null; }
  if(gameLoopInterval){ clearInterval(gameLoopInterval); gameLoopInterval = null; }
}
function endRound(){
  stopTimer();
  gameArea.classList.add('hidden');
  endScreen.classList.remove('hidden');
  finalScore.textContent = score;
}

// input
window.addEventListener('keydown', (e)=>{
  if(gameArea.classList.contains('hidden')) return;
  if(e.key === 'ArrowLeft') player.dir = {x:-1,y:0};
  if(e.key === 'ArrowRight') player.dir = {x:1,y:0};
  if(e.key === 'ArrowUp') player.dir = {x:0,y:-1};
  if(e.key === 'ArrowDown') player.dir = {x:0,y:1};
  if(e.key === ' ') { /* action (unused) */ }
});

// touch controls wiring
function showTouchControls(){
  if('ontouchstart' in window){
    touchControls.classList.remove('hidden');
  } else {
    touchControls.classList.add('hidden');
  }
}
tLeft.addEventListener('touchstart', ()=> player.dir = {x:-1,y:0});
tRight.addEventListener('touchstart', ()=> player.dir = {x:1,y:0});
tUp.addEventListener('touchstart', ()=> player.dir = {x:0,y:-1});
tDown.addEventListener('touchstart', ()=> player.dir = {x:0,y:1});
tAction.addEventListener('touchstart', ()=> {
  // small dash action: move two steps in direction if possible
  if(!player.dir) return;
  const nx = player.x + player.dir.x*2;
  const ny = player.y + player.dir.y*2;
  if(nx>0 && nx<grid.cols-1 && ny>0 && ny<grid.rows-1){
    player.x = nx; player.y = ny;
  }
});

// UI wiring
btnPlay.addEventListener('click', ()=>{
  const name = (playerName.value.trim() || 'Player').slice(0,20);
  const team = teamSelect.value || 'Green';
  const roundSeconds = parseInt(roundLengthInput.value) || 60;
  menu.classList.add('hidden');
  gameArea.classList.remove('hidden');
  endScreen.classList.add('hidden');
  leaderboard.classList.add('hidden');
  adminPanel.classList.add('hidden');

  newGame(roundSeconds);
  window._session = { name, team, startedAt: Date.now() };
  draw();
  startTimer();
  showTouchControls();
});

btnPause.addEventListener('click', ()=>{
  if(timerInterval) { stopTimer(); btnPause.textContent = 'Resume'; }
  else { startTimer(); btnPause.textContent = 'Pause'; }
});
btnQuit.addEventListener('click', ()=>{
  stopTimer();
  gameArea.classList.add('hidden');
  menu.classList.remove('hidden');
});

// submit score
btnSubmit.addEventListener('click', async ()=>{
  const doSubmit = confirmSubmit.checked;
  if(doSubmit && window._session){
    const payload = {
      name: window._session.name,
      team: window._session.team,
      score: score,
      timestamp: Date.now(),
      approved: false
    };
    try{
      await push(scoresRef, payload);
      alert('Score submitted! It will appear once an ALT approves it.');
    }catch(err){
      console.error(err);
      alert('Submission failed — check network / Firebase config.');
    }
  }
  endScreen.classList.add('hidden');
  menu.classList.remove('hidden');
});

btnPlayAgain.addEventListener('click', ()=>{
  endScreen.classList.add('hidden');
  menu.classList.remove('hidden');
});
btnBackMenu.addEventListener('click', ()=>{
  endScreen.classList.add('hidden');
  menu.classList.remove('hidden');
});

// Leaderboard UI & live data
btnLeaderboard.addEventListener('click', showLeaderboard);
btnBackFromLB.addEventListener('click', ()=>{
  leaderboard.classList.add('hidden');
  menu.classList.remove('hidden');
});
btnAdminOpen.addEventListener('click', ()=>{
  leaderboard.classList.add('hidden');
  adminPanel.classList.remove('hidden');
});

// Admin sign-in (if auth available)
if(auth){
  btnAdminSignIn.addEventListener('click', async ()=>{
    const email = adminEmail.value.trim();
    const pass = adminPass.value;
    if(!email || !pass){ alert('Enter admin email & password'); return; }
    try{
      await signInWithEmailAndPassword(auth, email, pass);
    }catch(err){
      console.error(err);
      alert('Sign-in failed: ' + err.message);
    }
  });
  btnAdminSignOut.addEventListener('click', async ()=>{
    await signOut(auth);
  });
  onAuthStateChanged(auth, user => {
    if(user){
      authArea.classList.add('hidden');
      adminActions.classList.remove('hidden');
      btnAdminSignOut.classList.remove('hidden');
      btnAdminSignIn.classList.add('hidden');
      loadAdminList();
    } else {
      authArea.classList.remove('hidden');
      adminActions.classList.add('hidden');
      btnAdminSignOut.classList.add('hidden');
      btnAdminSignIn.classList.remove('hidden');
      adminList.innerHTML = '<p>Sign in to moderate submissions.</p>';
    }
  });
} else {
  // if auth not available (older SDK), hide admin features gracefully
  document.getElementById('authArea').innerHTML = '<p class="meta">Auth not available in this environment. Use Firebase Console to moderate.</p>';
}

// Live listeners: show approved top players and compute team totals
function showLeaderboard(){
  menu.classList.add('hidden');
  gameArea.classList.add('hidden');
  endScreen.classList.add('hidden');
  adminPanel.classList.add('hidden');
  leaderboard.classList.remove('hidden');
  topList.innerHTML = 'Loading...';
  teamTotalsEl.textContent = 'Loading totals...';

  onValue(scoresRef, (snap)=>{
    const data = snap.val() || {};
    const arr = Object.keys(data).map(k=>({ id:k, ...data[k] }));
    const approved = arr.filter(x=>x.approved);
    approved.sort((a,b)=>b.score - a.score);
    const top = approved.slice(0,30);
    if(top.length===0){
      topList.innerHTML = '<p>No approved scores yet.</p>';
    } else {
      topList.innerHTML = top.map((s,i)=>`
        <div class="score-item">
          <div>
            <div><strong>${i+1}. ${escapeHtml(s.name)}</strong> <span class="meta">(${escapeHtml(s.team)})</span></div>
            <div class="meta">${new Date(s.timestamp).toLocaleString()}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700;font-size:1.1rem">${s.score}</div>
          </div>
        </div>
      `).join('');
    }
    const totals = { Green:0, Red:0, Blue:0, White:0 };
    approved.forEach(s => {
      if(totals[s.team] !== undefined) totals[s.team] += Number(s.score || 0);
    });
    teamTotalsEl.innerHTML = '';
    Object.keys(totals).forEach(team=>{
      const color = team === 'Green' ? 'var(--green)' : team === 'Red' ? 'var(--red)' : team === 'Blue' ? 'var(--blue)' : 'var(--white)';
      const card = document.createElement('div');
      card.className = 'total-card';
      card.innerHTML = `<div class="meta">${team}</div><div class="num" style="color:${color}">${totals[team]}</div>`;
      teamTotalsEl.appendChild(card);
    });
  });
}

// Admin: show all pending & approved with approve/remove controls (requires signed-in admin)
function loadAdminList(){
  adminList.innerHTML = 'Loading...';
  onValue(scoresRef, (snap)=>{
    const data = snap.val() || {};
    const arr = Object.keys(data).map(k=>({ id:k, ...data[k] }));
    arr.sort((a,b)=>b.timestamp - a.timestamp);
    if(arr.length === 0) adminList.innerHTML = '<p>No submissions yet.</p>';
    else {
      adminList.innerHTML = arr.map(s => `
        <div class="score-item" data-id="${s.id}">
          <div>
            <div><strong>${escapeHtml(s.name)}</strong> <span class="meta">(${escapeHtml(s.team)})</span></div>
            <div class="meta">${new Date(s.timestamp).toLocaleString()}</div>
            <div class="meta">Score: ${s.score} ${s.approved?'<em>(approved)</em>':''}</div>
          </div>
          <div style="text-align:right;">
            <button class="approveBtn">${s.approved ? 'Unapprove' : 'Approve'}</button>
            <button class="removeBtn">Remove</button>
          </div>
        </div>
      `).join('');
      adminList.querySelectorAll('.approveBtn').forEach(btn=>{
        btn.addEventListener('click', async (ev)=>{
          const id = ev.target.closest('.score-item').dataset.id;
          const itemRef = ref(db, 'pacman-scores/' + id);
          try{
            const snapSingle = await get(itemRef);
            const val = snapSingle.val() || {};
            await update(itemRef, { approved: !val.approved });
          }catch(err){ console.error(err); alert('Approve failed: ' + err.message); }
        });
      });
      adminList.querySelectorAll('.removeBtn').forEach(btn=>{
        btn.addEventListener('click', async (ev)=>{
          const id = ev.target.closest('.score-item').dataset.id;
          const itemRef = ref(db, 'pacman-scores/' + id);
          if(!confirm('Remove this submission?')) return;
          try{
            await remove(itemRef);
          }catch(err){ console.error(err); alert('Remove failed: ' + err.message); }
        });
      });
    }
  });
}

// helper
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

// initial show menu
menu.classList.remove('hidden');
