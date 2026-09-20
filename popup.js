// ===== TAB SWITCHING =====
const navButtons = document.querySelectorAll(".nav-btn");
const tabs = document.querySelectorAll(".tab");

navButtons.forEach(function(button) {
  button.addEventListener("click", function() {
    navButtons.forEach(function(btn) { btn.classList.remove("active"); });
    tabs.forEach(function(tab) { tab.classList.remove("active"); });
    button.classList.add("active");
    const tabName = button.getAttribute("data-tab");
    document.getElementById(tabName).classList.add("active");
    if (tabName === "word") loadWord();
    if (tabName === "notes") loadSavedNotes();
  });
});


// ===== SEND TO TAB =====
function sendToTab(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs[0]) return;
    const tabId = tabs[0].id;
    const url = tabs[0].url || "";

    if (url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
      alert("⚠️ Please go to a normal website like google.com first.");
      return;
    }

    // Always inject — content.js guards itself with window.__ffLoaded
    chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] }, function() {
      chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }, function() {
        setTimeout(function() {
          chrome.tabs.sendMessage(tabId, message, function() {
            if (chrome.runtime.lastError) {}
          });
        }, 150);
      });
    });
  });
}


// ===== POMODORO =====
const timerDisplay = document.getElementById("timerDisplay");
const sessionLabel = document.getElementById("sessionLabel");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const floatBtn = document.getElementById("floatBtn");

function syncTimer() {
  chrome.runtime.sendMessage({ action: "getTimerState" }, function(state) {
    if (chrome.runtime.lastError || !state) return;
    timerDisplay.textContent = state.time;
    sessionLabel.textContent = state.session;
    startBtn.textContent = state.isRunning ? "Pause" : "Start";
  });
}

syncTimer();
setInterval(syncTimer, 1000);

function shakeTimer() {
  timerDisplay.classList.remove("shake");
  void timerDisplay.offsetWidth;
  timerDisplay.classList.add("shake");
  setTimeout(() => timerDisplay.classList.remove("shake"), 500);
}

startBtn.addEventListener("click", function() {
  if (startBtn.textContent === "Pause") {
    chrome.runtime.sendMessage({ action: "pausePomodoro" });
    startBtn.textContent = "Start";
  } else {
    chrome.runtime.sendMessage({ action: "startPomodoro" });
    startBtn.textContent = "Pause";
    shakeTimer();
  }
});

resetBtn.addEventListener("click", function() {
  chrome.runtime.sendMessage({ action: "resetPomodoro" });
  startBtn.textContent = "Start";
  shakeTimer();
});

floatBtn.addEventListener("click", function() {
  sendToTab({ action: "toggleFloatTimer" });
});


// ===== WORD OF THE DAY =====
async function loadWord() {
  const wordText = document.getElementById("wordText");
  const wordType = document.getElementById("wordType");
  const wordDef = document.getElementById("wordDef");
  const wordExample = document.getElementById("wordExample");

  wordText.textContent = "Loading...";
  wordType.textContent = "";
  wordDef.textContent = "";
  wordExample.textContent = "";

  const saved = await chrome.storage.local.get("wordOfDay");
  const today = new Date().toDateString();

  if (saved.wordOfDay && saved.wordOfDay.date === today) {
    displayWord(saved.wordOfDay);
    return;
  }

  try {
    const response = await fetch("https://api.dictionaryapi.dev/api/v2/entries/en/serendipity");
    const data = await response.json();
    const entry = data[0];
    const meaning = entry.meanings[0];
    const wordData = {
      date: today,
      word: entry.word,
      type: meaning.partOfSpeech,
      definition: meaning.definitions[0].definition,
      example: meaning.definitions[0].example || "No example available."
    };
    await chrome.storage.local.set({ wordOfDay: wordData });
    displayWord(wordData);
  } catch (error) {
    wordText.textContent = "Couldn't load word.";
  }
}

function displayWord(data) {
  document.getElementById("wordText").textContent = data.word;
  document.getElementById("wordType").textContent = data.type;
  document.getElementById("wordDef").textContent = data.definition;
  document.getElementById("wordExample").textContent = data.example;
}


// ===== BREATHING =====
const breathCircle = document.getElementById("breathCircle");
const breathLabel = document.getElementById("breathLabel");
const breathBtn = document.getElementById("breathBtn");
let breathInterval = null;
let isBreathing = false;
let stepIndex = 0;

const breathSteps = [
  { label: "Inhale...", cls: "inhale" },
  { label: "Hold...",   cls: "inhale" },
  { label: "Exhale...", cls: "exhale" },
];

function runBreathStep() {
  const step = breathSteps[stepIndex];
  breathLabel.textContent = step.label;
  breathCircle.className = "breath-circle " + step.cls;
  stepIndex = (stepIndex + 1) % breathSteps.length;
}

function startBreathing() {
  if (isBreathing) {
    clearInterval(breathInterval);
    isBreathing = false;
    breathBtn.textContent = "Start";
    breathLabel.textContent = "Press Start";
    breathCircle.className = "breath-circle";
    stepIndex = 0;
    return;
  }
  isBreathing = true;
  breathBtn.textContent = "Stop";
  runBreathStep();
  breathInterval = setInterval(runBreathStep, 4000);
}

breathBtn.addEventListener("click", startBreathing);


// ===== FOCUS MODE =====
const siteInput = document.getElementById("siteInput");
const addSiteBtn = document.getElementById("addSite");
const blockedList = document.getElementById("blockedList");
const toggleFocusBtn = document.getElementById("toggleFocus");
const recSites = document.querySelectorAll(".rec-site");
let blockedSites = [];
let focusEnabled = false;

chrome.storage.local.get(["blockedSites", "focusEnabled"], function(data) {
  if (data.blockedSites) { blockedSites = data.blockedSites; renderBlockedList(); updateRecSites(); }
  if (data.focusEnabled) { focusEnabled = data.focusEnabled; updateFocusButton(); if (focusEnabled) applyBlockingRules(); }
});

recSites.forEach(function(tag) {
  tag.addEventListener("click", function() {
    const site = tag.getAttribute("data-site");
    if (blockedSites.includes(site)) return;
    blockedSites.push(site);
    chrome.storage.local.set({ blockedSites });
    renderBlockedList(); updateRecSites();
    if (focusEnabled) applyBlockingRules();
  });
});

function updateRecSites() {
  recSites.forEach(function(tag) {
    const site = tag.getAttribute("data-site");
    tag.classList.toggle("added", blockedSites.includes(site));
  });
}

addSiteBtn.addEventListener("click", function() {
  const site = siteInput.value.trim().toLowerCase();
  if (!site || blockedSites.includes(site)) { siteInput.value = ""; return; }
  blockedSites.push(site);
  chrome.storage.local.set({ blockedSites });
  renderBlockedList(); updateRecSites();
  siteInput.value = "";
});

siteInput.addEventListener("keydown", function(e) { if (e.key === "Enter") addSiteBtn.click(); });

function renderBlockedList() {
  blockedList.innerHTML = "";
  blockedSites.forEach(function(site, index) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${site}</span><span class="remove-btn" data-index="${index}">✕</span>`;
    blockedList.appendChild(li);
  });
  document.querySelectorAll(".remove-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      blockedSites.splice(parseInt(btn.getAttribute("data-index")), 1);
      chrome.storage.local.set({ blockedSites });
      renderBlockedList(); updateRecSites();
      if (focusEnabled) applyBlockingRules();
    });
  });
}

toggleFocusBtn.addEventListener("click", function() {
  focusEnabled = !focusEnabled;
  chrome.storage.local.set({ focusEnabled });
  updateFocusButton();
  focusEnabled ? applyBlockingRules() : removeBlockingRules();
});

function updateFocusButton() {
  if (focusEnabled) {
    toggleFocusBtn.textContent = "Disable Focus";
    toggleFocusBtn.style.backgroundColor = "#f87171";
    toggleFocusBtn.style.color = "#fff";
    toggleFocusBtn.style.borderColor = "#f87171";
  } else {
    toggleFocusBtn.textContent = "Enable Focus";
    toggleFocusBtn.style.backgroundColor = "#3a1a1a";
    toggleFocusBtn.style.color = "#f87171";
    toggleFocusBtn.style.borderColor = "#f87171";
  }
}

function applyBlockingRules() {
  if (blockedSites.length === 0) return;
  const rules = blockedSites.map(function(site, index) {
    return { id: index + 1, priority: 1, action: { type: "block" }, condition: { urlFilter: site, resourceTypes: ["main_frame"] } };
  });
  chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: rules.map(r => r.id), addRules: rules });
}

function removeBlockingRules() {
  chrome.declarativeNetRequest.getDynamicRules(function(rules) {
    chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: rules.map(r => r.id), addRules: [] });
  });
}


// ===== STICKY NOTES =====
document.getElementById("createNote").addEventListener("click", function() {
  sendToTab({ action: "createNote" });
});

function loadSavedNotes() {
  const list = document.getElementById("savedNotesList");
  list.innerHTML = "";
  chrome.storage.local.get(null, function(data) {
    const noteKeys = Object.keys(data).filter(k => k.startsWith("ff-note-"));
    if (noteKeys.length === 0) { list.innerHTML = `<p class="no-notes-msg">No saved notes yet.</p>`; return; }
    noteKeys.slice(0, 5).forEach(function(key) {
      const content = data[key] || "";
      const item = document.createElement("div");
      item.className = "saved-note-item";
      item.innerHTML = `
        <span class="saved-note-preview">${content.trim() || "(empty note)"}</span>
        <div class="saved-note-actions">
          <button class="saved-note-btn open-note" data-key="${key}" data-content="${encodeURIComponent(content)}">Open</button>
          <button class="saved-note-btn delete-note" data-key="${key}">🗑</button>
        </div>
      `;
      list.appendChild(item);
    });
    document.querySelectorAll(".open-note").forEach(function(btn) {
      btn.addEventListener("click", function() {
        sendToTab({ action: "openSavedNote", key: btn.getAttribute("data-key"), content: decodeURIComponent(btn.getAttribute("data-content")) });
      });
    });
    document.querySelectorAll(".delete-note").forEach(function(btn) {
      btn.addEventListener("click", function() {
        chrome.storage.local.remove(btn.getAttribute("data-key"), loadSavedNotes);
      });
    });
  });
}


// ===== BUY ME A CHAI =====
document.getElementById("coffeeBtn").addEventListener("click", function(e) {
  e.preventDefault();
  chrome.tabs.create({ url: "https://buymeachai.ezee.li/rohitmishraaa" });
});