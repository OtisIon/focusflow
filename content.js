// Register message listener every time script runs
// But only initialize variables/functions once using window guard

if (!window.__ffLoaded) {
  window.__ffLoaded = true;
  window.__ffNoteCount = 0;
  window.__ffCreating = false; // debounce flag
  const MAX_CHARS = 300;
  const MAX_NOTES = 5;

  window.__ffCreateNote = function() {
    if (window.__ffCreating) return;
    window.__ffCreating = true;
    setTimeout(function() { window.__ffCreating = false; }, 500);

    const existing = document.querySelectorAll(".ff-sticky-note");
    if (existing.length >= MAX_NOTES) {
      alert("Max 5 notes. Close one first.");
      return;
    }
    window.__ffNoteCount++;
    buildNote("ff-note-" + Date.now(), "", window.__ffNoteCount);
  };

  window.__ffOpenNote = function(key, content) {
    if (document.getElementById(key)) return;
    window.__ffNoteCount++;
    buildNote(key, content, window.__ffNoteCount);
  };

  window.__ffToggleFloat = function() {
    const existing = document.getElementById("ff-float-timer");
    if (existing) { existing.remove(); return; }

    const ft = document.createElement("div");
    ft.id = "ff-float-timer";
    ft.innerHTML = `
      <div id="ff-float-header">
        <span id="ff-float-label">FOCUS</span>
        <div id="ff-float-controls">
          <button class="ff-float-btn" id="ff-float-min">─</button>
          <button class="ff-float-btn" id="ff-float-close">✕</button>
        </div>
      </div>
      <div id="ff-float-body">
        <span id="ff-float-time">25:00</span>
      </div>
      <div id="ff-float-msg"></div>
    `;
    document.body.appendChild(ft);

    let isMin = false, isDrag = false;
    let sx, sy, sl, st;
    const header = document.getElementById("ff-float-header");
    const body = document.getElementById("ff-float-body");

    header.addEventListener("mousedown", function(e) {
      if (e.target.classList.contains("ff-float-btn")) return;
      isDrag = true; sx = e.clientX; sy = e.clientY;
      sl = ft.offsetLeft; st = ft.offsetTop;
      e.preventDefault();
    });
    document.addEventListener("mousemove", function(e) {
      if (!isDrag) return;
      ft.style.left = (sl + e.clientX - sx) + "px";
      ft.style.top = (st + e.clientY - sy) + "px";
    });
    document.addEventListener("mouseup", function() { isDrag = false; });

    document.getElementById("ff-float-min").addEventListener("click", function() {
      isMin = !isMin;
      body.style.display = isMin ? "none" : "flex";
      this.textContent = isMin ? "□" : "─";
    });
    document.getElementById("ff-float-close").addEventListener("click", function() { ft.remove(); });
  };

  window.__ffUpdateFloat = function(time, session) {
    const timeEl = document.getElementById("ff-float-time");
    const labelEl = document.getElementById("ff-float-label");
    const msgEl = document.getElementById("ff-float-msg");
    if (timeEl) timeEl.textContent = time;
    if (labelEl) labelEl.textContent = session;
    if (msgEl && time === "00:00") {
      msgEl.textContent = session === "FOCUS" ? "🔥 Break time!" : "🧘 Back to focus!";
      msgEl.style.display = "block";
      setTimeout(function() { if (msgEl) msgEl.style.display = "none"; }, 4000);
    }
  };

  function buildNote(id, content, num) {
    const note = document.createElement("div");
    note.className = "ff-sticky-note";
    note.id = id;
    note.style.left = (30 + (num % 5) * 20) + "px";
    note.style.top = (80 + (num % 5) * 20) + "px";
    note.innerHTML = `
      <div class="ff-note-header">
        <span class="ff-note-title">📝 Note ${num}</span>
        <div class="ff-note-actions">
          <button class="ff-note-btn ff-min-btn">─</button>
          <button class="ff-note-btn ff-close-btn">✕</button>
        </div>
      </div>
      <div class="ff-note-body">
        <textarea class="ff-note-textarea" maxlength="${MAX_CHARS}" placeholder="Write anything...">${content}</textarea>
        <div class="ff-note-footer">
          <span class="ff-char-count">${content.length} / ${MAX_CHARS}</span>
          <span class="ff-saved-status">✓ saved</span>
        </div>
      </div>
    `;
    document.body.appendChild(note);

    const header = note.querySelector(".ff-note-header");
    const body = note.querySelector(".ff-note-body");
    const minBtn = note.querySelector(".ff-min-btn");
    const closeBtn = note.querySelector(".ff-close-btn");
    const textarea = note.querySelector(".ff-note-textarea");
    const charCount = note.querySelector(".ff-char-count");
    const savedStatus = note.querySelector(".ff-saved-status");

    let isMin = false, isDrag = false, sx, sy, sl, st;

    header.addEventListener("mousedown", function(e) {
      if (e.target.classList.contains("ff-note-btn")) return;
      isDrag = true; sx = e.clientX; sy = e.clientY;
      sl = note.offsetLeft; st = note.offsetTop;
      e.preventDefault();
    });
    document.addEventListener("mousemove", function(e) {
      if (!isDrag) return;
      note.style.left = (sl + e.clientX - sx) + "px";
      note.style.top = (st + e.clientY - sy) + "px";
    });
    document.addEventListener("mouseup", function() { isDrag = false; });

    minBtn.addEventListener("click", function() {
      isMin = !isMin;
      body.style.display = isMin ? "none" : "block";
      minBtn.textContent = isMin ? "□" : "─";
    });

    closeBtn.addEventListener("click", function() { note.remove(); });

    let saveTimeout;
    textarea.addEventListener("input", function() {
      charCount.textContent = textarea.value.length + " / " + MAX_CHARS;
      savedStatus.textContent = "saving...";
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(function() {
        chrome.storage.local.set({ [id]: textarea.value });
        savedStatus.textContent = "✓ saved";
      }, 800);
    });
  }
}

// Message listener runs every inject — calls window functions which are safe
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.action === "createNote" && window.__ffCreateNote) window.__ffCreateNote();
  if (msg.action === "openSavedNote" && window.__ffOpenNote) window.__ffOpenNote(msg.key, msg.content);
  if (msg.action === "toggleFloatTimer" && window.__ffToggleFloat) window.__ffToggleFloat();
  if (msg.action === "updateFloatTimer" && window.__ffUpdateFloat) window.__ffUpdateFloat(msg.time, msg.session);
  sendResponse({ status: "ok" });
  return true;
});