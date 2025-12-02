// leaderboard.js
// Firebase leaderboard reader (no imports needed)

// Your Firebase config (SAME AS game.js)
const firebaseConfig = {
    apiKey: "YOUR-KEY",
    authDomain: "YOUR.firebaseapp.com",
    databaseURL: "https://YOUR.firebaseio.com",
    projectId: "YOUR",
    storageBucket: "YOUR.appspot.com",
    messagingSenderId: "xxxx",
    appId: "xxxx"
};

// Load Firebase from CDN
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Load leaderboard
const list = document.getElementById("leaderboardList");

db.ref("pacman-scores")
  .orderByChild("score")
  .limitToLast(20)
  .on("value", snapshot => {

      const entries = [];
      snapshot.forEach(child => entries.push(child.val()));
      entries.reverse();

      list.innerHTML = "";

      entries.forEach(entry => {
          const li = document.createElement("li");
          li.textContent = `${entry.name}: ${entry.score}`;
          list.appendChild(li);
      });
  });
