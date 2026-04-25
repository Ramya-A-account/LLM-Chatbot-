// ════════════════════════════════════
//  EduHub — Frontend JavaScript
//  Talks to Flask backend at localhost:5000
// ════════════════════════════════════

const API_BASE = "http://localhost:5000/api";

// ── State ──
let isLoading  = false;
let currentMode = "school";
let sessionId   = null;

// ── DOM refs ──
const messagesEl = document.getElementById("messages");
const chatInput  = document.getElementById("chatInput");
const sendBtn    = document.getElementById("sendBtn");

// ════════════ INIT ════════════
document.addEventListener("DOMContentLoaded", () => {
  sessionId = localStorage.getItem("eduhub_session") || generateId();
  localStorage.setItem("eduhub_session", sessionId);
  chatInput.focus();
  checkBackend();
});

function generateId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

async function checkBackend() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    console.log("✅ Backend connected:", data);
  } catch {
    showSystemMsg("⚠️ Backend not reachable. Make sure Flask is running on port 5000.");
  }
}

// ════════════ MODE ════════════
function setMode(mode) {
  currentMode = mode;
  document.getElementById("btnSchool").classList.toggle("active", mode === "school");
  document.getElementById("btnCollege").classList.toggle("active", mode === "college");
  document.getElementById("schoolQuicks").classList.toggle("hidden", mode !== "school");
  document.getElementById("collegeQuicks").classList.toggle("hidden", mode !== "college");
}

// ════════════ SIDEBAR ════════════
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

// ════════════ TEXTAREA ════════════
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 160) + "px";
}

function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// ════════════ TIME ════════════
function formatTime(ts) {
  const d = ts ? new Date(ts) : new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ════════════ MARKDOWN ════════════
function renderMarkdown(text) {
  return text
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/^---$/gm, "<hr/>")
    .split("\n\n")
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => /^<(ul|ol|h3|hr)/.test(p) ? p : `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function escapeHtml(t) {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ════════════ DOM HELPERS ════════════
function removeWelcome() {
  const w = document.getElementById("welcomeBlock");
  if (w) w.remove();
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showSystemMsg(text) {
  removeWelcome();
  const div = document.createElement("div");
  div.style.cssText = "text-align:center;color:#F87171;font-size:13px;padding:12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:10px;margin:8px 0";
  div.textContent = text;
  messagesEl.appendChild(div);
  scrollToBottom();
}

// ════════════ APPEND MESSAGE ════════════
function appendMessage(role, text, timestamp, searched = false) {
  removeWelcome();

  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;

  const av = document.createElement("div");
  av.className = `avatar ${role === "bot" ? "bot-av" : "user-av"}`;
  av.textContent = role === "bot" ? "🤖" : "YOU";

  const bwrap = document.createElement("div");
  bwrap.className = "bubble-wrap";

  if (searched && role === "bot") {
    const note = document.createElement("div");
    note.className = "search-note";
    note.textContent = "🔍 Searched resources database";
    bwrap.appendChild(note);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = role === "bot" ? renderMarkdown(text) : escapeHtml(text);

  const time = document.createElement("div");
  time.className = "msg-time";
  time.textContent = formatTime(timestamp);

  bwrap.appendChild(bubble);
  bwrap.appendChild(time);

  if (role === "user") {
    wrap.appendChild(bwrap);
    wrap.appendChild(av);
  } else {
    wrap.appendChild(av);
    wrap.appendChild(bwrap);
  }

  messagesEl.appendChild(wrap);
  scrollToBottom();
}

// ════════════ TYPING INDICATOR ════════════
function showTyping() {
  const el = document.createElement("div");
  el.className = "typing";
  el.id = "typingIndicator";

  const av = document.createElement("div");
  av.className = "avatar bot-av";
  av.textContent = "🤖";

  const tb = document.createElement("div");
  tb.className = "typing-bubble";
  tb.innerHTML = "<span></span><span></span><span></span><span class=\"typing-label\">thinking...</span>";

  el.appendChild(av);
  el.appendChild(tb);
  messagesEl.appendChild(el);
  scrollToBottom();
}

function hideTyping() {
  const t = document.getElementById("typingIndicator");
  if (t) t.remove();
}

// ════════════ SEND MESSAGE ════════════
async function sendMessage() {
  const msg = chatInput.value.trim();
  if (!msg || isLoading) return;

  isLoading = true;
  sendBtn.disabled = true;
  chatInput.value = "";
  chatInput.style.height = "auto";

  appendMessage("user", msg);
  showTyping();

  const location = document.getElementById("locationInput").value.trim() || "India";

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg,
        student_type: currentMode,
        location: location,
        session_id: sessionId
      })
    });

    const data = await res.json();
    hideTyping();

    if (data.error) {
      appendMessage("bot", `⚠️ Error: ${data.error}`, null, false);
    } else {
      sessionId = data.session_id || sessionId;
      localStorage.setItem("eduhub_session", sessionId);
      appendMessage("bot", data.response, data.timestamp, data.searched);
    }

  } catch (err) {
    hideTyping();
    appendMessage("bot",
      "⚠️ Cannot reach backend. Make sure Flask is running:\n\n```\npython app.py\n```\n\nThen refresh this page.",
      null, false
    );
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

// ════════════ QUICK PROMPTS ════════════
function sendQuick(text) {
  chatInput.value = text;
  sendMessage();
}

// ════════════ QUICK SEARCH (category) ════════════
async function quickSearch(category) {
  if (isLoading) return;
  isLoading = true;
  sendBtn.disabled = true;

  const location = document.getElementById("locationInput").value.trim() || "India";

  const labels = {
    hackathons:    `🔍 Finding hackathons in ${location}...`,
    school_events: `🔍 Finding school events in ${location}...`,
    jobs:          `🔍 Finding placement drives in ${location}...`,
    internships:   `🔍 Finding internships in ${location}...`,
    symposiums:    `🔍 Finding symposiums in ${location}...`,
    sports:        `🔍 Finding sports events in ${location}...`,
    conferences:   `🔍 Finding conferences for paper submissions...`,
    coding:        `🔍 Finding coding contests...`,
    govt_jobs:     `🔍 Finding government job notifications...`,
    mun:           `🔍 Finding MUN & debate events in ${location}...`,
  };

  appendMessage("user", labels[category] || `Searching ${category}...`);
  showTyping();

  try {
    const res = await fetch(`${API_BASE}/quick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, location, session_id: sessionId })
    });

    const data = await res.json();
    hideTyping();

    if (data.error) {
      appendMessage("bot", `⚠️ ${data.error}`, null, false);
    } else {
      sessionId = data.session_id || sessionId;
      appendMessage("bot", data.response, data.timestamp, true);
    }

  } catch (err) {
    hideTyping();
    appendMessage("bot", "⚠️ Cannot reach backend. Is Flask running on port 5000?", null, false);
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
  }
}

// ════════════ CLEAR CHAT ════════════
async function clearChat() {
  try {
    await fetch(`${API_BASE}/clear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId })
    });
  } catch (e) { /* ignore */ }

  messagesEl.innerHTML = `
    <div class="welcome" id="welcomeBlock">
      <div class="welcome-badge">⚡ Groq LLaMA-3 · 100% Free · No Credit Card</div>
      <h2 class="welcome-title">Find Your Next <em>Big Opportunity</em></h2>
      <p class="welcome-sub">Hackathons · Symposiums · Internships · Placement Drives · School Fests · Sports · Paper Presentations</p>
      <div class="student-cards">
        <div class="scard" onclick="setMode('school'); sendQuick('I am a school student. Show me upcoming project exhibitions science fairs sports events India 2025')">
          <div class="scard-icon">🏫</div>
          <div class="scard-title">School Student</div>
          <div class="scard-desc">Exhibitions · Sports · Olympiads · Cultural Fests</div>
        </div>
        <div class="scard" onclick="setMode('college'); sendQuick('I am a college student. Show me upcoming hackathons symposiums internships placement drives India 2025')">
          <div class="scard-icon">🎓</div>
          <div class="scard-title">College Student</div>
          <div class="scard-desc">Hackathons · Jobs · Symposiums · Papers</div>
        </div>
      </div>
      <div class="welcome-chips">
        <button class="chip" onclick="sendQuick('Top hackathons India 2025')">🔥 Top Hackathons 2025</button>
        <button class="chip" onclick="sendQuick('Paid internships CSE students Hyderabad 2025')">💰 Paid Internships</button>
        <button class="chip" onclick="sendQuick('Smart India Hackathon 2025 details')">🇮🇳 SIH 2025</button>
        <button class="chip" onclick="sendQuick('NTSE scholarship exam class 10 2025')">📚 School Scholarships</button>
        <button class="chip" onclick="sendQuick('Off-campus drives 2025 batch engineers')">👩‍💻 Off-Campus Drives</button>
        <button class="chip" onclick="sendQuick('Paper presentation conferences engineering 2025')">📑 Paper Calls</button>
      </div>
    </div>`;
}
