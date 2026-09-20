// ===== KEEP SERVICE WORKER ALIVE =====
const keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 20000);
chrome.runtime.onStartup.addListener(keepAlive);
keepAlive();

// ===== TIMER STATE =====
let timerInterval = null;
let timeLeft = 25 * 60;
let isRunning = false;
let isFocusSession = true;

function getTimeStr() {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function broadcastTime() {
  const timeStr = getTimeStr();
  const session = isFocusSession ? "FOCUS" : "BREAK";
  chrome.tabs.query({}, function(tabs) {
    tabs.forEach(function(tab) {
      chrome.tabs.sendMessage(tab.id, {
        action: "updateFloatTimer",
        time: timeStr,
        session: session
      }, function() { if (chrome.runtime.lastError) {} });
    });
  });
}

function startTicking() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(function() {
    if (!isRunning) return;
    timeLeft--;
    broadcastTime();
    if (timeLeft <= 0) {
      isRunning = false;
      clearInterval(timerInterval);
      timerInterval = null;
      chrome.notifications.create("pomodoroEnd", {
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "FocusFlow",
        message: isFocusSession ? "Time's up! Take a break 🧘" : "Break over! Back to focus 🔥"
      });
      isFocusSession = !isFocusSession;
      timeLeft = isFocusSession ? 25 * 60 : 5 * 60;
      broadcastTime();
    }
  }, 1000);
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.action === "startPomodoro") {
    isRunning = true;
    startTicking();
    sendResponse({ status: "ok" });
    return true;
  }
  if (message.action === "pausePomodoro") {
    isRunning = false;
    sendResponse({ status: "ok" });
    return true;
  }
  if (message.action === "resetPomodoro") {
    isRunning = false;
    isFocusSession = true;
    timeLeft = 25 * 60;
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    broadcastTime();
    sendResponse({ status: "ok" });
    return true;
  }
  if (message.action === "getTimerState") {
    sendResponse({
      time: getTimeStr(),
      isRunning: isRunning,
      session: isFocusSession ? "Focus Session" : "Break Time"
    });
    return true;
  }
  return true;
});