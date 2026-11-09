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
let data = CLOUD_READY ? { events: [], registrations: [] } : loadLocal();
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
    return value?.access_token && (value.expires_at > Date.now() / 1000 || value.refresh_token) ? value : null;
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
  const scores = Object.create(null);
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
  ["playerGame", "resultGame", "scheduleGame"].forEach(id => { document.getElementById(id).innerHTML = GAMES.map(g => `<option value="${g.id}">${g.name}</option>`).join(""); });
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
  await loadSchedule();
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
  if (session?.access_token) { await refreshAccount(); return; }
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
  setStatus("connectionStatus", `Signed in as ${email}.`);
  await loadMyRegistrations();
  document.getElementById("signInBtn").hidden = true;
  document.getElementById("signUpBtn").hidden = true;
  document.getElementById("signOutBtn").hidden = false;
  document.getElementById("staff").hidden = staffRole !== "staff" && staffRole !== "admin";
  document.getElementById("staffDashboard").hidden = staffRole !== "staff" && staffRole !== "admin";
  document.getElementById("ownerDashboard").hidden = staffRole !== "admin";
  if (!rolesReady) setStatus("connectionStatus", `Signed in as ${email}. The owner still needs to finish the Arena database setup; staff tools remain locked.`);
  try { await loadPaymentHistory(); }
  catch { document.getElementById("paymentHistory").textContent = "Payment history will be available after the owner finishes the Supabase setup."; }
  renderScheduleManagement();
  if (staffRole === "admin" || staffRole === "staff") {
    try { await loadStaffRegistrations(); } catch { document.getElementById("staffRegistrations").textContent = "Registration inbox is unavailable until the database setup is complete."; }
  }
  if (staffRole === "admin") {
    await loadStaffManagement();
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
  const items = await supabase(`/rest/v1/payment_requests?select=id,payment_type,item_name,amount_cents,transaction_reference,status,created_at,reviewed_at&user_id=eq.${encodeURIComponent(session.user.id)}&order=created_at.desc`, { authenticated: true });
  target.innerHTML = items.length ? items.map(item => `<article class="historyitem"><div class="pills"><span class="pill">${esc(item.status)}</span><span class="pill">${esc(new Date(item.created_at).toLocaleDateString())}</span></div><strong>${esc(item.item_name)}</strong> · $${(item.amount_cents / 100).toFixed(2)}<p class="muted">${esc(item.payment_type)} · Reference: ${esc(item.transaction_reference)}</p></article>`).join("") : "No payment records yet.";
}
async function loadStaffManagement() {
  if (staffRole !== "admin") return;
  const target = document.getElementById("staffManagementList");
  try {
    const rows = await supabase("/rest/v1/rpc/list_championship_staff", {
      method: "POST", authenticated: true, body: {}
    });
    target.innerHTML = rows.length
      ? `<table><thead><tr><th>Account</th><th>Role</th><th>Action</th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row.email)}</td><td>${esc(row.role)}</td><td>${row.user_id === session.user.id ? "Your account" : `<button type="button" data-staff-email="${esc(row.email)}" data-staff-role="remove">Revoke</button>`}</td></tr>`).join("")}</tbody></table>`
      : '<div class="empty">No staff accounts found.</div>';
  } catch (error) {
    target.textContent = `Staff management is not ready. Run supabase/staff-management.sql in Supabase SQL Editor. ${error.message}`;
  }
}
async function changeStaffPermission(email, role) {
  if (staffRole !== "admin") return;
  if (role === "admin" && !window.confirm(`Grant full admin access to ${email}? This allows managing other staff and reviewing payments.`)) return;
  if (role === "remove" && !window.confirm(`Revoke Championship staff access for ${email}?`)) return;
  try {
    await supabase("/rest/v1/rpc/manage_championship_staff", {
      method: "POST", authenticated: true, body: { target_email: email, new_role: role }
    });
    setStatus("staffManagementStatus", `Permission updated for ${email}. Existing sessions may need to refresh.`);
    await loadStaffManagement();
  } catch (error) { setStatus("staffManagementStatus", `Could not update permissions: ${error.message}`); }
}
document.getElementById("staffManagementForm").addEventListener("submit", async event => {
  event.preventDefault();
  const email = document.getElementById("staffManageEmail").value.trim();
  const role = document.getElementById("staffManageRole").value;
  await changeStaffPermission(email, role);
});
document.getElementById("staffManagementList").addEventListener("click", async event => {
  const button = event.target.closest("[data-staff-email]");
  if (!button) return;
  await changeStaffPermission(button.dataset.staffEmail, button.dataset.staffRole);
});

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
    document.getElementById("authPassword").value = "";
    await refreshAccount();
  } catch (error) { setStatus("connectionStatus", error.message); }
});
document.getElementById("signUpBtn").addEventListener("click", async () => {
  if (!CLOUD_READY || !document.getElementById("authForm").reportValidity()) return;
  try {
    const redirectTo = window.location.origin + window.location.pathname;
    const result = await authRequest("signup?redirect_to=" + encodeURIComponent(redirectTo), { email: document.getElementById("authEmail").value.trim(), password: document.getElementById("authPassword").value });
    if (result.access_token) {
      saveSession({ ...result, expires_at: Date.now() / 1000 + (result.expires_in || 3600) });
      await refreshAccount();
    } else setStatus("connectionStatus", "Check your email to confirm the new account, then sign in here.");
  } catch (error) { setStatus("connectionStatus", error.message); }
});
document.getElementById("signOutBtn").addEventListener("click", async () => {
  try { await supabase("/auth/v1/logout", {method:"POST", authenticated:true}); }
  catch { /* Local signout must still clear sensitive content if offline. */ }
  clearAccount();
  setStatus("connectionStatus", "You are signed out.");
});

document.getElementById("playerForm").addEventListener("submit", async event => {
  event.preventDefault();
  const selected = scheduleReady ? scheduledEvents.find(item => item.id === document.getElementById("scheduleEvent").value) : {game:document.getElementById("playerGame").value, title:document.getElementById("eventName").value.trim(), starts_at:document.getElementById("eventDate").value+"T12:00:00-08:00"};
  if (!selected) { setStatus("registerStatus", "Choose an upcoming scheduled event."); return; }
  const p = { name: document.getElementById("playerName").value.trim(), game: selected.game, event: selected.title, date: new Date(selected.starts_at).toLocaleDateString("en-CA", {timeZone:"America/Los_Angeles"}), note: document.getElementById("playerNote").value.trim(), savedAt: Date.now() };
  if (CLOUD_READY) {
    if (!session?.access_token) { setStatus("registerStatus", "Sign in or create a player account above before registering."); return; }
    try {
      await supabase("/rest/v1/player_registrations", { method: "POST", authenticated: true, body: { ...(selected.id ? {schedule_id:selected.id} : {}), player_name: p.name, game: p.game, tournament_name: p.event, event_date: p.date, player_note: p.note, user_id: session.user.id }, prefer: "return=minimal" });
      setStatus("registerStatus", `Registration received for ${p.name}. Staff will confirm your seat and any fee.`);
      await loadMyRegistrations();
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
  const playerNames = results.map(result => result.name.toLocaleLowerCase().trim());
  if (new Set(playerNames).size !== playerNames.length) {
    setStatus("resultStatus", "Each player can appear only once in a tournament. Remove duplicate gamer tags.");
    return;
  }
  if (results.filter(result => result.place === 1).length !== 1) {
    setStatus("resultStatus", "A tournament must have exactly one first-place champion.");
    return;
  }
  for (const place of [2, 3]) {
    if (results.filter(result => result.place === place).length > 1) {
      setStatus("resultStatus", `Placement ${place} is listed more than once. Correct the final standings before saving.`);
      return;
    }
  }
  if (results.some(result => result.name.length > 80)) {
    setStatus("resultStatus", "Player names must be 80 characters or fewer.");
    return;
  }
  if (!document.getElementById("resultDate").value || !document.getElementById("resultTitle").value.trim()) {
    setStatus("resultStatus", "Enter the tournament date and name before saving.");
    return;
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

// Shared calendar, registration self-service and Auth redirect handling.
let scheduledEvents = [];
let scheduleReady = false;
function eventTime(value) {
  return new Date(value).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short' }) + ' PT';
}
async function loadSchedule() {
  try {
    scheduledEvents = await supabase('/rest/v1/championship_schedule?select=id,game,title,starts_at,location,details,status&order=starts_at.asc');
    scheduleReady = true;
    document.getElementById('legacyRegistration').hidden = true;
    document.getElementById('scheduleEvent').required = true;
    for(const id of ['eventName','eventDate']) document.getElementById(id).required = false;
    const upcoming = scheduledEvents.filter(item => new Date(item.starts_at) > new Date() && item.status === 'scheduled');
    document.getElementById('scheduleEvent').innerHTML = '<option value="">Choose an event</option>' + upcoming.map(item => `<option value="${esc(item.id)}">${esc(item.title)} · ${esc(eventTime(item.starts_at))}</option>`).join('');
    document.getElementById('calendarList').innerHTML = scheduledEvents.filter(item => new Date(item.starts_at) > new Date(Date.now() - 86400000)).map(item => `<article class="historyitem"><div class="pills"><span class="pill">${esc(gameName(item.game))}</span><span class="pill">${esc(item.status)}</span></div><h3>${esc(item.title)}</h3><p>${esc(eventTime(item.starts_at))} · ${esc(item.location)}</p><p class="muted">${esc(item.details)}</p>${upcoming.includes(item) ? `<a class="btn" href="#register" data-register-event="${esc(item.id)}">Request registration</a> <button type="button" data-calendar="${esc(item.id)}">Save to calendar</button>` : ''}</article>`).join('') || '<div class="empty">No upcoming events published. Please check announcements or contact staff.</div>';
    renderScheduleManagement();
  } catch {
    scheduledEvents = [];
    scheduleReady = false;
    document.getElementById('legacyRegistration').hidden = false;
    document.getElementById('scheduleEvent').required = false;
    for(const id of ['eventName','eventDate']) document.getElementById(id).required = true;
    document.getElementById('calendarList').textContent = 'The event calendar is unavailable. Please contact staff for the current schedule.';
    document.getElementById('scheduleEvent').innerHTML = '<option value="">Schedule unavailable</option>';
  }
}
function renderScheduleManagement() {
  document.getElementById('scheduleManagement').innerHTML = ['staff','admin'].includes(staffRole) ? scheduledEvents.filter(item => item.status === 'scheduled').map(item => `<p>${esc(item.title)} · ${esc(eventTime(item.starts_at))} <button type="button" data-close-event="${esc(item.id)}" data-state="cancelled">Cancel event</button> <button type="button" data-close-event="${esc(item.id)}" data-state="completed">Close registration</button></p>`).join('') : '';
}
document.getElementById('scheduleForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!['staff','admin'].includes(staffRole)) return;
  try {
    const start = new Date(document.getElementById('scheduleStart').value);
    if (!(start > new Date())) throw new Error('Choose a future start time.');
    await supabase('/rest/v1/championship_schedule', {method:'POST', authenticated:true, body:{title:document.getElementById('scheduleTitle').value.trim(), game:document.getElementById('scheduleGame').value, starts_at:start.toISOString(), location:document.getElementById('scheduleLocation').value.trim(), details:document.getElementById('scheduleDetails').value.trim()}, prefer:'return=minimal'});
    await loadSchedule(); event.target.reset(); setStatus('scheduleStatus','Event published.');
  } catch(error) { setStatus('scheduleStatus',error.message); }
});
document.getElementById('scheduleManagement').addEventListener('click', async event => {
  const button=event.target.closest('[data-close-event]');
  if (!button || !['staff','admin'].includes(staffRole) || !confirm('Close registration for this event? Existing registrations remain in the staff inbox.')) return;
  button.disabled=true;
  try { await supabase('/rest/v1/championship_schedule?id=eq.'+encodeURIComponent(button.dataset.closeEvent), {method:'PATCH', authenticated:true, body:{status:button.dataset.state}, prefer:'return=minimal'}); await loadSchedule(); }
  catch(error) { setStatus('scheduleStatus',error.message); button.disabled=false; }
});
function icsEscape(value) { return String(value).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;'); }
function calendarFile(item) {
  const stamp = value => new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Feasted Gaming//Arena//EN','BEGIN:VEVENT',`UID:${item.id}@feastedgaming`, `DTSTAMP:${stamp(Date.now())}`,`DTSTART:${stamp(item.starts_at)}`,`SUMMARY:${icsEscape(item.title)}`,`LOCATION:${icsEscape(item.location)}`,`DESCRIPTION:${icsEscape(item.details)}`,'END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
document.getElementById('calendarList').addEventListener('click', event => {
  const register=event.target.closest('[data-register-event]');
  if(register) document.getElementById('scheduleEvent').value=register.dataset.registerEvent;
  const button=event.target.closest('[data-calendar]');
  const item=scheduledEvents.find(row=>row.id===button?.dataset.calendar);
  if(!item) return;
  const url=URL.createObjectURL(new Blob([calendarFile(item)],{type:'text/calendar;charset=utf-8'}));
  const link=document.createElement('a'); link.href=url; link.download='feasted-event.ics'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
});
async function loadMyRegistrations() {
  const target=document.getElementById('myRegistrationList');
  if(!session?.access_token) { target.textContent='Sign in to view your registrations.'; return; }
  if(!scheduleReady) { target.textContent='Online registration history and withdrawal are awaiting calendar setup. Contact staff to check your existing requests.'; return; }
  try {
    const rows=await supabase('/rest/v1/player_registrations?select=id,game,player_name,tournament_name,event_date&user_id=eq.'+encodeURIComponent(session.user.id)+'&order=event_date.desc',{authenticated:true});
    target.innerHTML=rows.map(item=>`<article class="historyitem"><h3>${esc(item.tournament_name)}</h3><p>${esc(item.player_name)} · ${esc(gameName(item.game))} · ${esc(item.event_date)}</p><p class="muted">Registration request received. Contact staff to confirm your seat and fee.</p><button type="button" data-withdraw="${esc(item.id)}">Withdraw request</button></article>`).join('') || 'No registrations yet.';
  } catch { target.textContent='Registration history is unavailable. Contact staff if you need to withdraw.'; }
}
document.getElementById('myRegistrationList').addEventListener('click',async event=>{
  const button=event.target.closest('[data-withdraw]');
  if(!button || !session || !confirm('Withdraw this registration request? For payment refunds, contact staff separately.')) return;
  button.disabled=true;
  try {
    const removed=await supabase('/rest/v1/player_registrations?id=eq.'+encodeURIComponent(button.dataset.withdraw),{method:'DELETE',authenticated:true,prefer:'return=representation'});
    if(!removed?.length) throw new Error('This request cannot be withdrawn online. Please contact staff.');
    await loadMyRegistrations(); setStatus('withdrawStatus','Registration withdrawn. Contact staff about any payment refund.');
  } catch(error) { setStatus('withdrawStatus',error.message); button.disabled=false; }
});
function clearAccount() {
  saveSession(null); staffRole=null;
  for(const id of ['staff','staffDashboard','ownerDashboard','newPasswordForm','signOutBtn']) document.getElementById(id).hidden=true;
  for(const id of ['signInBtn','signUpBtn']) document.getElementById(id).hidden=false;
  for(const id of ['paymentHistory','paymentRequests','staffRegistrations','staffManagementList','myRegistrationList','scheduleManagement']) document.getElementById(id).textContent='Sign in to view records.';
  document.getElementById('authPassword').value='';
  document.getElementById('newPassword').value='';
}
async function initializeAccount() {
  const hash=new URLSearchParams(location.hash.slice(1));
  if(hash.has('access_token')) {
    const token=hash.get('access_token');
    // Remove credentials from the URL before performing any other work.
    history.replaceState(null,'',location.pathname+location.search+'#account');
    const response=await fetch(CONFIG.url+'/auth/v1/user',{headers:{apikey:CONFIG.anonKey,Authorization:'Bearer '+token}});
    if(!response.ok) throw new Error('The email link has expired. Request a new link.');
    saveSession({access_token:token,refresh_token:hash.get('refresh_token'),expires_at:Date.now()/1000+Number(hash.get('expires_in')||3600),user:await response.json()});
    document.getElementById('newPasswordForm').hidden=hash.get('type')!=='recovery';
  } else if(session?.refresh_token && session.expires_at < Date.now()/1000+120) {
    try { const result=await authRequest('token?grant_type=refresh_token',{refresh_token:session.refresh_token}); saveSession({...result,expires_at:Date.now()/1000+result.expires_in}); }
    catch { clearAccount(); }
  }
}
document.getElementById('resetPasswordBtn').addEventListener('click',async()=>{
  const email=document.getElementById('authEmail');
  if(!email.reportValidity()) return;
  try { await authRequest('recover?redirect_to='+encodeURIComponent(location.origin+location.pathname),{email:email.value.trim()}); setStatus('connectionStatus','If an account exists, check its email for a password reset link.'); }
  catch(error) { setStatus('connectionStatus',error.message); }
});
document.getElementById('newPasswordForm').addEventListener('submit',async event=>{
  event.preventDefault();
  try { await supabase('/auth/v1/user',{method:'PUT',authenticated:true,body:{password:document.getElementById('newPassword').value}}); event.target.reset(); event.target.hidden=true; setStatus('connectionStatus','Password updated.'); }
  catch(error) { setStatus('passwordStatus',error.message); }
});
// Expiry clears private records and controls even if the tab remains open.
setInterval(()=>{if(session && session.expires_at<=Date.now()/1000){clearAccount();setStatus('connectionStatus','Your session expired. Please sign in again.');}},30000);


document.getElementById("year").textContent = new Date().getFullYear();
fillSelects(); render();
initializeAccount().then(loadCloud).catch(error => setStatus("connectionStatus", `Could not load shared data: ${error.message}`));
