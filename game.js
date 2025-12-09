// Kokky's Onsen Dash – Local Leaderboard Version
// Placeholder Kokky + working score + popup + correct space typing behavior

const canvas=document.getElementById("game");
const ctx=canvas.getContext("2d");

const scoreEl=document.getElementById("score");
const bestEl=document.getElementById("best");
const playBtn=document.getElementById("startBtn");
const msgEl=document.getElementById("msg");

// Popup
const overlayEl=document.getElementById("overlay");
const popupEl=document.getElementById("namePopup");
const nameInput=document.getElementById("nameInput");
const nameError=document.getElementById("nameError");
const submitNameBtn=document.getElementById("submitNameBtn");
const cancelNameBtn=document.getElementById("cancelNameBtn");

// NEW: track if popup is open to disable controls
let popupIsOpen = false;

// Game values
let W=canvas.width;
let H=canvas.height;
let running=false;
let obstacles=[];
let score=0;
let best=Number(localStorage.getItem("onsen_best")||0);
bestEl.textContent=best;

let player={x:120,y:H/2,vy:0,r:22};
const gravity=0.45;
const hopPower=-8.8;
const gapSize=180;
let spawnTimer=0;

// Controls — FIXED SPACE INPUT
window.addEventListener("keydown",e=>{
  if(e.code === "Space"){

    // If typing inside popup → allow normal space
    if(popupIsOpen && document.activeElement === nameInput){
      return; // do NOT block or hop
    }

    if(!popupIsOpen){
      hop();
    }
    
    e.preventDefault();
  }
});

canvas.addEventListener("pointerdown",()=>{
  i
