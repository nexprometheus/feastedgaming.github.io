"use strict";

const GAMES = [
  { id: "smash", name: "Super Smash Bros. Ultimate", short: "Smash", symbol: "⚔", desc: "1v1 brackets, match results, and weekly champions." },
  { id: "magic", name: "Magic: The Gathering", short: "Magic", symbol: "✧", desc: "Track tabletop standings and season points." },
  { id: "pokemon", name: "Pokémon TCG", short: "Pokémon", symbol: "◉", desc: "Build your record across every Pokémon event." },
  { id: "lorcana", name: "Disney Lorcana", short: "Lorcana", symbol: "✦", desc: "Celebrate storyborn champions and top players." },
  { id: "onepiece", name: "One Piece Card Game", short: "One Piece", symbol: "☠", desc: "Keep a running record of every crew's results." },
  { id: "yugioh", name: "Yu-Gi-Oh!", short: "Yu-Gi-Oh!", symbol: "◇", desc: "Duel, place, and climb the leaderboard." }
];
const KEY = "feastedChampionshipV1";
const SESSION_KEY = "feastedSupabaseSessionV1";
const CONFIG = window.FEASTED_SUPABASE || {};
const CLOUD_READY = /^https:\/\/[\w.-]+\.supabase\.co\/?$/.test(CONFIG.url || "") && Boolean(CONFIG.anonKey);
let data = loadLocal();
let activeGame = "smash";
let session = readSession();
let staffRole = null;

function loadLocal() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    return value && Array.isArray(value.events) && Array.isArray(value.registrations) ? value : { registrations: [], events: [] };
  } catch { return { registrations: [], events: [] }; }
}
function saveLocal() { localStorage.setItem(KEY, JSON.stringify(data)); }
function readSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    return value?.expires_at > Date.now() / 1000 ? value : null;
  } catch { return null; }
}
function saveSession(value) {
  session = value;
  if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
  else sessionStorage.removeItem(SESSION_KEY);
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function gameName(id) { return GAMES.find(g => g.id === id)?.name || id; }
function points(place) { return place === 1 ? 5 : place === 2 ? 3 : place === 3 ? 2 : 1; }
function setStatus(id, message) { const node = document.getElementById(id); if (node) node.textContent = message; }
function safeHttpUrl(value) {
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : ""; }
  catch { return ""; }
}

async function supabase(path, { method = "GET", body, authenticated = false, prefer } = {}) {
  if (!CLOUD_READY) throw new Error("Supabase is not configured yet.");
  const headers = { apikey: CONFIG.anonKey, "Content-Type": "application/json" };
  if (authenticated && session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${CONFIG.url.replace(/\/$/, "")}${path}`, {
    method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const text = await response.text();
  let result;
  try { result = text ? JSON.parse(text) : null; } catch { result = text; }
  if (!response.ok) throw new Error(result?.msg || result?.message || result?.hint || `Supabase request failed (${response.status}).`);
  return result;
}

function allScores(game) {
  const scores = {};
  data.events.filter(event => event.game === game).forEach(event => event.results.forEach(result => {
    const key = result.name.trim().toLowerCase();
    if (!scores[key]) scores[key] = { name: result.name, points: 0, events: 0, wins: 0, podiums: 0 };
    scores[key].points += points(result.place);
    scores[key].events++;
    if (result.place === 1) scores[key].wins++;
    if (result.place <= 3) scores[key].podiums++;
  }));
  return Object.values(scores).sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
}
function renderGames() {
  document.getElementById("gameCards").innerHTML = GAMES.map(g => `<article class="game"><div><div class="symbol">${g.symbol}</div><h3>${g.name}</h3><p>${g.desc}</p></div><a href="#leaderboards" data-game="${g.id}">View ${g.short} rankings →</a></article>`).join("");
  document.querySelectorAll("[data-game]").forEach(a => a.addEventListener("click", () => { activeGame = a.dataset.game; renderRanks(); }));
}
function fillSelects() {
  ["playerGame", "resultGame"].forEach(id => { document.getElementById(id).innerHTML = GAMES.map(g => `<option value="${g.id}">${g.name}</option>`).join(""); });
}
function renderRanks() {
  document.getElementById("rankTabs").innerHTML = GAMES.map(g => `<button type="button" class="${activeGame === g.id ? "active" : ""}" data-rank="${g.id}">${g.short}</button>`).join("");
  document.querySelectorAll("[data-rank]").forEach(b => b.addEventListener("click", () => { activeGame = b.dataset.rank; renderRanks(); }));
  const rows = allScores(activeGame);
  document.getElementById("rankTable").innerHTML = rows.length
    ? `<table><thead><tr><th>Rank</th><th>Player</th><th>Points</th><th>Wins</th><th>Podiums</th><th>Events</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td class="rank">#${i + 1}</td><td>${esc(r.name)}</td><td>${r.points}</td><td>${r.wins}</td><td>${r.podiums}</td><td>${r.events}</td></tr>`).join("")}</tbody></table>`
    : `<div class="empty">No results recorded for ${esc(gameName(activeGame))} yet. Results appear after an authorized staff member records an event.</div>`;
}
function renderSpotlight() {
  const event = [...data.events].sort((a, b) => b.date.localeCompare(a.date) || (b.savedAt || 0) - (a.savedAt || 0))[0];
  const el = document.getElementById("dailySpotlight");
  if (!event) { el.innerHTML = '<div class="empty">The first champion spotlight will appear here after tournament results are saved.</div>'; return; }
  const winner = event.results.find(result => result.place === 1);
  const highlight = safeHttpUrl(event.highlight);
  el.innerHTML = `<article class="spotlight"><div class="trophy">🏆</div><div><div class="kicker">Latest champion · ${esc(event.date)}</div><h3>${esc(winner?.name || "Champion pending")}</h3><p>${esc(event.title)} · ${esc(gameName(event.game))}</p>${event.mvp ? `<p class="muted">Player highlight: <strong>${esc(event.mvp)}</strong></p>` : ""}${event.notes ? `<p class="muted">${esc(event.notes)}</p>` : ""}${highlight ? `<a href="${esc(highlight)}" target="_blank" rel="noopener noreferrer">Watch / view highlight ↗</a>` : ""}</div></article>`;
}
function renderHistory() {
  const events = [...data.events].sort((a, b) => b.date.localeCompare(a.date) || (b.savedAt || 0) - (a.savedAt || 0));
  document.getElementById("historyList").innerHTML = events.length ? events.map(event => {
    const winner = event.results.find(result => result.place === 1);
    const highlight = safeHttpUrl(event.highlight);
    return `<article class="historyitem"><div class="pills"><span class="pill">${esc(gameName(event.game))}</span><span class="pill">${esc(event.date)}</span><span class="pill">${event.results.length} players</span></div><h3>${esc(event.title)}</h3><p class="muted">Champion: <strong>${esc(winner?.name || "Not recorded")}</strong> · ${event.results.filter(result => result.place <= 3).map(result => `${esc(result.name)} (${result.place})`).join(" · ")}</p>${event.mvp ? `<p class="muted">Spotlight: ${esc(event.mvp)}</p>` : ""}${event.notes ? `<p class="muted">${esc(event.notes)}</p>` : ""}${highlight ? `<a href="${esc(highlight)}" target="_blank" rel="noopener noreferrer">View highlight ↗</a>` : ""}</article>`;
  }).join("") : '<div class="empty">No tournaments have been archived yet.</div>';
}
function render() { renderGames(); renderRanks(); renderSpotlight(); renderHistory(); }

async function loadCloud() {
  if (!CLOUD_READY) {
    setStatus("connectionStatus", "Cloud accounts are not connected yet. The public rankings show this browser's existing records, if any.");
    document.getElementById("staff").hidden = true;
    document.getElementById("signInBtn").disabled = true;
    document.getElementById("signUpBtn").disabled = true;
    return;
  }
  const rows = await supabase("/rest/v1/tournament_events?select=id,game,tournament_name,event_date,mvp,highlight_url,match_notes,created_at,tournament_results(player_name,placement)&order=event_date.desc");
  data.events = (rows || []).map(row => ({ id: row.id, game: row.game, title: row.tournament_name, date: row.event_date, mvp: row.mvp, highlight: row.highlight_url, notes: row.match_notes, savedAt: Date.parse(row.created_at) || 0, results: (row.tournament_results || []).map(result => ({ name: result.player_name, place: result.placement })) }));
  render();
  let setupReady = true;
  try { await loadAnnouncements(); }
  catch {
    setupReady = false;
    document.getElementById("announcementList").innerHTML = '<div class="empty">Announcements will be available after the owner finishes the Supabase setup.</div>';
  }
  if (session?.access_token) await refreshAccount();
  setStatus("connectionStatus", setupReady ? "Connected. Tournament history and rankings are shared across devices." : "Tournament history is connected. The owner still needs to run the Arena database setup to enable accounts, announcements, and payment records.");
}
async function loadAnnouncements() {
  const announcements = await supabase("/rest/v1/championship_announcements?select=id,title,body,created_at&published=eq.true&order=created_at.desc&limit=20");
  document.getElementById("announcementList").innerHTML = announcements.length
    ? announcements.map(item => `<article class="historyitem"><div class="kicker">${esc(new Date(item.created_at).toLocaleDateString())}</div><h3>${esc(item.title)}</h3><p class="muted">${esc(item.body).replace(/\n/g, "<br>")}</p></article>`).join("")
    : '<div class="empty">No current announcements.</div>';
}
async function authRequest(path, body) {
  const response = await fetch(`${CONFIG.url.replace(/\/$/, "")}/auth/v1/${path}`, {
    method: "POST", headers: { apikey: CONFIG.anonKey, "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.msg || result.message || "Account request failed.");
  return result;
}
async function refreshAccount() {
  if (!session?.access_token) return;
  let rolesReady = true;
  try {
    staffRole = await supabase("/rest/v1/rpc/get_championship_role", { method: "POST", authenticated: true, body: {} });
  } catch { staffRole = null; rolesReady = false; }
  const email = session.user?.email || "signed in";
  document.getElementById("signInBtn").hidden = true;
  document.getElementById("signUpBtn").hidden = true;
  document.getElementById("signOutBtn").hidden = false;
  document.getElementById("staff").hidden = staffRole !== "staff" && staffRole !== "admin";
  document.getElementById("staffDashboard").hidden = staffRole !== "staff" && staffRole !== "admin";
  document.getElementById("ownerDashboard").hidden = staffRole !== "admin";
  if (!rolesReady) setStatus("connectionStatus", `Signed in as ${email}. The owner still needs to finish the Arena database setup; staff tools remain locked.`);
  try { await loadPaymentHistory(); }
  catch { document.getElementById("paymentHistory").textContent = "Payment history will be available after the owner finishes the Supabase setup."; }
  if (staffRole === "admin" || staffRole === "staff") {
    try { await loadStaffRegistrations(); } catch { document.getElementById("staffRegistrations").textContent = "Registration inbox is unavailable until the database setup is complete."; }
  }
  if (staffRole === "admin") {
    try { await loadAdminDashboard(); } catch { document.getElementById("paymentRequests").textContent = "Payment records are unavailable until the database setup is complete."; }
  }
}
async function loadStaffRegistrations() {
  const items = await supabase("/rest/v1/player_registrations?select=player_name,game,tournament_name,event_date,player_note,created_at&order=created_at.desc&limit=100", { authenticated: true });
  const target = document.getElementById("staffRegistrations");
  target.innerHTML = items.length ? items.map(item => `<article class="historyitem"><div class="pills"><span class="pill">${esc(gameName(item.game))}</span><span class="pill">${esc(item.event_date)}</span></div><h3>${esc(item.player_name)} · ${esc(item.tournament_name)}</h3><p class="muted">${esc(item.player_note || "No player note")}</p></article>`).join("") : '<div class="empty">No registrations yet.</div>';
}
async function loadPaymentHistory() {
  const target = document.getElementById("paymentHistory");
  if (!session?.access_token) { target.textContent = "Sign in to view submitted payments and their review status."; return; }
  const items = await supabase("/rest/v1/payment_requests?select=id,payment_type,item_name,amount_cents,transaction_reference,status,created_at,reviewed_at&order=created_at.desc", { authenticated: true });
  target.innerHTML = items.length ? items.map(item => `<article class="historyitem"><div class="pills"><span class="pill">${esc(item.status)}</span><span class="pill">${esc(new Date(item.created_at).toLocaleDateString())}</span></div><strong>${esc(item.item_name)}</strong> · $${(item.amount_cents / 100).toFixed(2)}<p class="muted">${esc(item.payment_type)} · Reference: ${esc(item.transaction_reference)}</p></article>`).join("") : "No payment records yet.";
}
async function loadAdminDashboard() {
  const items = await supabase("/rest/v1/payment_requests?select=id,user_id,payment_type,item_name,amount_cents,transaction_reference,status,created_at&order=created_at.desc&limit=100", { authenticated: true });
  const target = document.getElementById("paymentRequests");
  target.innerHTML = items.length ? items.map(item => `<article class="historyitem"><div class="pills"><span class="pill">${esc(item.status)}</span><span class="pill">${esc(item.payment_type)}</span><span class="pill">${esc(new Date(item.created_at).toLocaleDateString())}</span></div><h3>${esc(item.item_name)} · $${(item.amount_cents / 100).toFixed(2)}</h3><p class="muted">Account: ${esc(item.user_id)} · Transaction reference: ${esc(item.transaction_reference)}</p>${item.status === "pending" ? `<div class="tools"><button type="button" data-review-payment="${esc(item.id)}" data-status="verified">Mark verified</button><button type="button" data-review-payment="${esc(item.id)}" data-status="rejected">Reject</button></div>` : ""}</article>`).join("") : '<div class="empty">No payment requests yet.</div>';
}

document.getElementById("paymentForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!CLOUD_READY || !session?.access_token) { setStatus("paymentStatus", "Connect Supabase and sign in before submitting a payment record."); return; }
  const amount = Number(document.getElementById("paymentAmount").value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) { setStatus("paymentStatus", "Enter a valid payment amount."); return; }
  const record = { user_id: session.user.id, payment_type: document.getElementById("paymentType").value, item_name: document.getElementById("paymentItem").value.trim(), amount_cents: Math.round(amount * 100), transaction_reference: document.getElementById("paymentReference").value.trim(), status: "pending" };
  try {
    await supabase("/rest/v1/payment_requests", { method: "POST", authenticated: true, body: record, prefer: "return=minimal" });
    event.target.reset();
    setStatus("paymentStatus", "Payment record submitted as pending. A staff member must check Venmo before confirming it.");
    await loadPaymentHistory();
  } catch (error) { setStatus("paymentStatus", `Could not submit payment record: ${error.message}`); }
});

document.getElementById("paymentRequests").addEventListener("click", async event => {
  const button = event.target.closest("[data-review-payment]");
  if (!button || staffRole !== "admin") return;
  const status = button.dataset.status;
  if (status === "verified" && !window.confirm("Confirm that you checked the Venmo account and matched the amount and transaction reference?")) return;
  button.disabled = true;
  try {
    await supabase("/rest/v1/rpc/review_championship_payment", {
      method: "POST", authenticated: true, body: { payment_id: button.dataset.reviewPayment, decision: status }
    });
    await loadAdminDashboard();
    setStatus("paymentStatus", `Payment record marked ${status}.`);
  } catch (error) { button.disabled = false; setStatus("paymentStatus", `Could not review payment: ${error.message}`); }
});

document.getElementById("announcementForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (staffRole !== "admin") return;
  const body = { title: document.getElementById("announcementTitle").value.trim(), body: document.getElementById("announcementBody").value.trim(), created_by: session.user.id, published: true };
  try {
    await supabase("/rest/v1/championship_announcements", { method: "POST", authenticated: true, body, prefer: "return=minimal" });
    event.target.reset();
    setStatus("announcementStatus", "Announcement published.");
    await loadAnnouncements();
  } catch (error) { setStatus("announcementStatus", `Could not publish: ${error.message}`); }
});

document.getElementById("authForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!CLOUD_READY) return;
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  try {
    const result = await authRequest("token?grant_type=password", { email, password });
    saveSession({ ...result, expires_at: Date.now() / 1000 + (result.expires_in || 3600) });
    await refreshAccount();
  } catch (error) { setStatus("connectionStatus", error.message); }
});
document.getElementById("signUpBtn").addEventListener("click", async () => {
  if (!CLOUD_READY) return;
  try {
    const result = await authRequest("signup", { email: document.getElementById("authEmail").value.trim(), password: document.getElementById("authPassword").value });
    if (result.access_token) {
      saveSession({ ...result, expires_at: Date.now() / 1000 + (result.expires_in || 3600) });
      await refreshAccount();
    } else setStatus("connectionStatus", "Check your email to confirm the new account, then sign in here.");
  } catch (error) { setStatus("connectionStatus", error.message); }
});
document.getElementById("signOutBtn").addEventListener("click", () => { saveSession(null); staffRole = null; document.getElementById("staff").hidden = true; document.getElementById("staffDashboard").hidden = true; document.getElementById("ownerDashboard").hidden = true; document.getElementById("signInBtn").hidden = false; document.getElementById("signUpBtn").hidden = false; document.getElementById("signOutBtn").hidden = true; setStatus("connectionStatus", "You are signed out."); });

document.getElementById("playerForm").addEventListener("submit", async event => {
  event.preventDefault();
  const p = { name: document.getElementById("playerName").value.trim(), game: document.getElementById("playerGame").value, event: document.getElementById("eventName").value.trim(), date: document.getElementById("eventDate").value, note: document.getElementById("playerNote").value.trim(), savedAt: Date.now() };
  if (CLOUD_READY) {
    if (!session?.access_token) { setStatus("registerStatus", "Sign in or create a player account above before registering."); return; }
    try {
      await supabase("/rest/v1/player_registrations", { method: "POST", authenticated: true, body: { player_name: p.name, game: p.game, tournament_name: p.event, event_date: p.date, player_note: p.note, user_id: session.user.id }, prefer: "return=minimal" });
      setStatus("registerStatus", `Registration received for ${p.name}. Staff will confirm your seat and any fee.`);
    } catch (error) { setStatus("registerStatus", `Registration could not be saved: ${error.message}`); return; }
  } else {
    data.registrations.push(p); saveLocal();
    setStatus("registerStatus", `Demo only: registration for ${p.name} is saved on this browser and is not shared or confirmed.`);
  }
  event.target.reset();
});

document.getElementById("resultForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!session?.access_token || !["staff", "admin"].includes(staffRole)) { setStatus("resultStatus", "Sign in with an authorized staff account to record results."); return; }
  const lines = document.getElementById("results").value.split(/\n/).map(line => line.trim()).filter(Boolean);
  const results = [];
  for (const line of lines) {
    const match = line.match(/^(.*?)[,\-–:]\s*(\d+)$/);
    if (!match || !match[1].trim()) { setStatus("resultStatus", `Check this line: "${line}". Use Player Name, placement.`); return; }
    const place = Number(match[2]);
    if (place < 1 || place > 999) { setStatus("resultStatus", "Placements must be positive numbers."); return; }
    results.push({ name: match[1].trim(), place });
  }
  if (!results.some(result => result.place === 1)) { setStatus("resultStatus", "Add a player with placement 1 to record the champion."); return; }
  const eventData = { game: document.getElementById("resultGame").value, date: document.getElementById("resultDate").value, title: document.getElementById("resultTitle").value.trim(), results, mvp: document.getElementById("mvp").value.trim(), highlight: document.getElementById("highlight").value.trim(), notes: document.getElementById("eventNotes").value.trim() };
  try {
    await supabase("/rest/v1/rpc/record_championship_event", { method: "POST", authenticated: true, body: { event_game: eventData.game, event_title: eventData.title, event_date: eventData.date, event_mvp: eventData.mvp || null, event_highlight_url: eventData.highlight || null, event_match_notes: eventData.notes || null, event_results: results.map(result => ({ player_name: result.name, placement: result.place })) } });
    await loadCloud();
    setStatus("resultStatus", "Tournament saved. History, rankings, and champion spotlight are updated for everyone.");
    event.target.reset();
  } catch (error) { setStatus("resultStatus", `Could not save the event: ${error.message}`); }
});

document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "feasted-gaming-championship-backup.json"; a.click(); URL.revokeObjectURL(url); setStatus("dataStatus", "Backup downloaded.");
});
document.getElementById("importFile").addEventListener("change", async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.events) || !Array.isArray(parsed.registrations) || parsed.events.some(item => !Array.isArray(item.results))) throw new Error("Invalid backup");
    if (CLOUD_READY) throw new Error("Import is disabled in cloud mode to prevent replacing shared records. Ask an admin to migrate this backup.");
    data = parsed; saveLocal(); render(); setStatus("dataStatus", "Browser-only backup imported.");
  } catch (error) { setStatus("dataStatus", error.message || "Could not import that file. Choose a Feasted Gaming JSON backup."); }
  event.target.value = "";
});

document.getElementById("year").textContent = new Date().getFullYear();
fillSelects(); render();
loadCloud().catch(error => setStatus("connectionStatus", `Supabase could not load data: ${error.message}`));
