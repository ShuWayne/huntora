/* HUNTORA — app.js
 * Single-page command center. All state lives in js/data.js; user
 * changes (pipeline stages, tasks, prospect stages) persist in
 * localStorage. No network calls except CDN assets (fonts, Three.js).
 * Integration points for real APIs later are marked API:.
 */
import { META, PROSPECTS, OPPORTUNITIES, LAB_IDEAS, PIPELINE_STAGES, SEED_DEALS, SEED_TASKS, REGIONS, store, loadStaticData } from "./data.js";
import { Radar } from "./radar.js";
import { renderMap } from "./map.js";
import { drawBarChart, drawHBarChart } from "./charts.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = n => "$" + Number(n || 0).toLocaleString("en-US");

const state = loadStaticData();
let radarMini = null, radarMain = null;

/* ---------------- toast ---------------- */
let toastTimer = null;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------------- clock + countdown ---------------- */
const TARGET_DATE = new Date("2026-12-02T00:00:00+05:30");
function daysLeft() {
  return Math.max(0, Math.ceil((TARGET_DATE - Date.now()) / 86400000));
}
function tickClock() {
  const now = new Date();
  $("#clock").textContent = now.toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }) + " · " + now.toLocaleDateString("en-GB", { weekday: "short" });
  const d = daysLeft();
  $("#countdownDays").textContent = d + "d";
  $("#sideDays").textContent = d;
  $("#cmdDaysLeft").textContent = d + " days";
  $("#revDays").textContent = d + " days left";
  $("#revDaily").textContent = money(Math.ceil(META.revenueTarget / Math.max(d, 1))) + "/day needed";
}

/* ---------------- router ---------------- */
const TITLES = {
  command: ["Command Deck", "Live opportunity intelligence · data researched 18–19 Nov 2026"],
  radar: ["Opportunity Radar", "Scanning 16 researched opportunities across 12 categories"],
  hunter: ["AI Business Hunter", "Research briefs, pitches and execution plans — template-generated locally"],
  clients: ["Client Discovery", "22 real businesses · 7 pitched 19 Nov · reply check 21–22 Nov"],
  map: ["Global Opportunity Map", "Where the researched prospects live"],
  execution: ["Execution Center", "Discovery → payment · drag cards or advance them"],
  lab: ["Idea Laboratory", "Score ideas on demand, competition, cost and profit"],
  revenue: ["Revenue Command Center", "Target $200 actually received by 2 Dec 2026"],
};
function currentView() {
  const h = location.hash.replace(/^#\/?/, "") || "command";
  return TITLES[h] ? h : "command";
}
function showView(name) {
  $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + name));
  $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === name));
  $("#viewTitle").textContent = TITLES[name][0];
  $("#viewSub").textContent = TITLES[name][1];
  $("#sidebar").classList.remove("open");
  if (name === "radar" && radarMain) radarMain.start();
  else if (radarMain) radarMain.stop();
  if (name === "execution") drawStageChart();
  if (name === "revenue") drawRevenueChart();
  window.scrollTo({ top: 0 });
}
window.addEventListener("hashchange", () => showView(currentView()));
$$(".nav-item").forEach(n => n.addEventListener("click", () => { location.hash = "#/" + n.dataset.view; }));
$$("[data-goto]").forEach(b => b.addEventListener("click", () => { location.hash = "#/" + b.dataset.goto; }));
$("#menuBtn").addEventListener("click", () => $("#sidebar").classList.toggle("open"));

/* ---------------- derived numbers ---------------- */
function pipelinePotential() {
  return state.deals.filter(d => d.stage !== "Paid").reduce((s, d) => s + (d.value || 0), 0);
}
function activeDeals() { return state.deals.filter(d => d.stage !== "Paid").length; }
function refreshStats() {
  const pot = pipelinePotential();
  $("#cmdPotential").textContent = money(pot);
  $("#revPotential").textContent = money(pot);
  $("#pipeTotal").textContent = money(pot);
  $("#cmdDeals").textContent = activeDeals();
  $("#revDeals").textContent = activeDeals();
  const pct = Math.round((META.revenueReceived / META.revenueTarget) * 100);
  $("#sideReceived").textContent = money(META.revenueReceived);
  $("#sidePct").textContent = pct + "%";
  $("#sideTargetBar").style.width = pct + "%";
  $("#cmdProgress").style.width = pct + "%";
  $("#revProgress").style.width = pct + "%";
}

/* ---------------- command deck ---------------- */
function renderTopSignals() {
  const top = [...state.opportunities].filter(o => o.researched)
    .sort((a, b) => b.probability - a.probability).slice(0, 4);
  $("#topSignals").innerHTML = top.map(o => `
    <div style="display:flex;gap:11px;align-items:flex-start;border:1px solid var(--border);border-radius:10px;padding:11px 12px;background:rgba(255,255,255,.02)">
      <div style="font-family:var(--font-display);font-size:20px;font-weight:700;color:var(--cyan);min-width:52px">${o.probability}%</div>
      <div>
        <div style="font-weight:600;font-size:13.5px;line-height:1.35">${esc(o.name)}</div>
        <div style="font-size:12px;color:var(--muted)">${esc(o.earning)} · ${esc(o.timeToPay)}</div>
      </div>
    </div>`).join("");
}
function renderCmdTasks() {
  const open = state.tasks.filter(t => !t.done).slice(0, 4);
  $("#cmdTasks").innerHTML = open.length ? open.map(t => `
    <div class="task-row"><input type="checkbox" data-task="${t.id}" aria-label="Mark done"><span>${esc(t.text)}</span><span class="due">${esc(t.due)}</span></div>`).join("")
    : `<div class="empty">All tasks done. Add the next hunt in the Execution Center.</div>`;
  $$("#cmdTasks input[type=checkbox]").forEach(cb => cb.addEventListener("change", () => toggleTask(cb.dataset.task)));
}

/* ---------------- radar view ---------------- */
let activeCat = "All";
const CATEGORIES = ["All", ...new Set(OPPORTUNITIES.map(o => o.category))];
function renderCatChips() {
  $("#catChips").innerHTML = CATEGORIES.map(c =>
    `<button class="chip ${c === activeCat ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  $$("#catChips .chip").forEach(ch => ch.addEventListener("click", () => { activeCat = ch.dataset.cat; renderCatChips(); renderOppGrid(); }));
}
function probBadge(o) {
  if (!o.researched) return `<span class="badge demo">Demo</span>`;
  if (o.status === "Blocked — legal") return `<span class="badge blocked">Blocked · legal</span>`;
  if (o.status === "Contacted") return `<span class="badge contacted">Contacted</span>`;
  return `<span class="badge researched">Researched</span>`;
}
function oppCard(o) {
  return `<article class="opp-card ${o.researched ? "" : "demo-card"}" data-opp="${o.id}">
    <div class="opp-top"><span class="opp-cat">${esc(o.category)}</span>${probBadge(o)}</div>
    <h3>${esc(o.name)}</h3>
    <div class="src">Source: ${esc(o.source)}</div>
    <div class="kv">
      <div><b>Earning</b>${esc(o.earning)}</div>
      <div><b>First payment</b>${esc(o.timeToPay)}</div>
      <div><b>Difficulty</b>${esc(o.difficulty)} · ${esc(o.competition)} comp.</div>
      <div><b>Investment</b>${esc(o.investment)}</div>
      <div><b>Skills</b>${esc(o.skills)}</div>
      <div><b>Location</b>${esc(o.location)}</div>
    </div>
    <div class="prob"><div class="prob-head"><span>Probability score</span><b>${o.probability}%</b></div>
    <div class="prob-bar"><i style="width:${o.probability}%"></i></div></div>
    <div class="reason"><b>Why ${o.probability}%:</b> ${esc(o.reasoning)}</div>
    <div class="opp-foot"><div class="next"><b>Next action</b>${esc(o.next)}</div><span class="badge ${o.status === "Blocked — legal" ? "blocked" : "researched"}">${esc(o.status)}</span></div>
  </article>`;
}
function renderOppGrid() {
  const q = ($("#oppSearch").value || "").toLowerCase();
  const sort = $("#oppSort").value;
  let list = state.opportunities.filter(o =>
    (activeCat === "All" || o.category === activeCat) &&
    (!q || (o.name + " " + o.skills + " " + o.source + " " + o.category).toLowerCase().includes(q)));
  if (sort === "prob") list.sort((a, b) => b.probability - a.probability);
  if (sort === "pay") list.sort((a, b) => (b.earningMax || 0) - (a.earningMax || 0));
  if (sort === "fast") {
    const rank = { "UPI from ₹50, <1 min–24h": 1, "Days after a client closes + pays": 2, "Days after delivery": 2, "Setup fee on delivery; retainer monthly": 3, "On delivery of audit": 3, "$5 minimum; hours–7 days": 4, "PayPal $5 min, payouts in minutes": 4, "First payout $1, then $0.50": 5, "Weekly payouts": 6, "Weekly/biweekly if an agent agrees": 7, "80% after 14-day hold — ~2 Dec at best": 8, "Straight to PayPal at moment of sale": 2, "Same day if client pays on delivery": 1, "Winners announced 21 Dec 2026": 9, "Deadline ~23 Nov; payout timing unverified": 9, "Only at closing (Feb–Apr 2027 at best)": 10 };
    list.sort((a, b) => (rank[a.timeToPay] || 5) - (rank[b.timeToPay] || 5));
  }
  $("#oppGrid").innerHTML = list.length ? list.map(oppCard).join("")
    : `<div class="empty">No opportunities match this filter. Try another category or search.</div>`;
  $("#radarMiniCount").textContent = state.opportunities.filter(o => o.researched).length;
}
$("#oppSearch").addEventListener("input", renderOppGrid);
$("#oppSort").addEventListener("change", renderOppGrid);

/* ---------------- hunter ---------------- */
const QUICK = ["Dentists in New Jersey", "Roofers running old ads", "AI receptionist for clinics", "Cafés with no booking flow", "Real estate lead generation"];
function renderQuickPrompts() {
  $("#quickPrompts").innerHTML = QUICK.map(q => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join("");
  $$("#quickPrompts .chip").forEach(c => c.addEventListener("click", () => { $("#hunterInput").value = c.dataset.q; runHunter(); }));
}
function matchProspects(query) {
  const q = query.toLowerCase();
  const words = q.split(/[^a-z]+/).filter(w => w.length > 2);
  return PROSPECTS.map(p => {
    const hay = (p.company + " " + p.trade + " " + p.city + " " + p.problem + " " + p.pitch).toLowerCase();
    const score = words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
    return { p, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map(x => x.p);
}
function matchOpps(query) {
  const q = query.toLowerCase();
  const words = q.split(/[^a-z]+/).filter(w => w.length > 2);
  return OPPORTUNITIES.filter(o => o.researched).map(o => {
    const hay = (o.name + " " + o.category + " " + o.skills).toLowerCase();
    return { o, score: words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0) };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map(x => x.o);
}
function runHunter() {
  const q = $("#hunterInput").value.trim();
  if (!q) { toast("Type a niche or a question first."); return; }
  const prospects = matchProspects(q);
  const opps = matchOpps(q);
  const legal = /real estate|realtor|referral|lead gen/i.test(q);
  const first = prospects[0];
  const out = $("#hunterOut");
  out.innerHTML = `
    <h3>1 · Research brief — “${esc(q)}”</h3>
    <p>${prospects.length ? `Matched <b>${prospects.length}</b> researched prospect${prospects.length > 1 ? "s" : ""} in the live database:` : "No direct match in the researched prospect database — the brief below uses the closest researched opportunity lanes instead."}</p>
    ${prospects.length ? `<ul>${prospects.map(p => `<li><b>${esc(p.company)}</b> (${esc(p.city)}, ${esc(p.region)}) — ${esc(p.problem)} Contact: ${p.email ? esc(p.email) : "no public email — reach via Facebook / Google Business"}.</li>`).join("")}</ul>` : ""}
    ${opps.length ? `<p>Related researched lanes: ${opps.map(o => `<b>${esc(o.name)}</b> (${o.probability}% probability, ${esc(o.earning)})`).join("; ")}.</p>` : ""}
    ${legal ? `<div class="disclaimer">Legal check (from real-estate research): referral fees to an unlicensed person are illegal in essentially every US state and a RESPA §8 federal violation where a mortgage is involved. Pitch flat-fee appointment-setting or list-building as a service — never a % of commission.</div>` : ""}
    <h3>2 · Personalised pitch draft</h3>
    <div class="pitch-draft">${first ? `Subject: ${first.trade} in ${first.city} — one thing your website / ads are missing\n\nHi ${esc(first.company)} team,\n\nI looked at your online presence and noticed something specific: ${esc(first.problem.toLowerCase())}\n\nI run Wayne.clips, a premium creative studio. We build modern, interactive websites and short-form video ads for local businesses — portfolio: https://harryyt01.github.io/wanye-clips/\n\n${esc(first.pitch)}\n\nWould you like a free homepage mockup to see what it could look like? No obligation — one reply and I will send it over.\n\nBest,\nShu Wayne — Wayne.clips` : `Subject: A quick idea for your business\n\nHi,\n\nI run Wayne.clips, a premium creative studio (portfolio: https://harryyt01.github.io/wanye-clips/). We help local businesses turn their online presence into paying customers — modern websites, short-form video ads, and AI tools.\n\nTell me the one thing your website or ads are not doing for you, and I will send a free mockup or sample showing the fix. No obligation.\n\nBest,\nShu Wayne — Wayne.clips`}</div>
    <h3>3 · Execution plan (7 steps)</h3>
    <ol>
      <li>Verify the prospect's contact email on their own website before sending — never guess an address.</li>
      <li>Send the pitch above (personalise the first line with their exact defect).</li>
      <li>Log the outreach with date + status in the Execution Center.</li>
      <li>Follow up once after 3 days, once after 7 days — each time adding something new (a sample, a mockup).</li>
      <li>If they reply: 10-minute call, agree scope + price, confirm payment route (Wise Business first; PayPal as fallback; USDT only if they ask).</li>
      <li>Deliver, get paid, confirm receipt before starting the next piece of work.</li>
      <li>Move the deal to Won, then Paid, and record the amount in Revenue Command.</li>
    </ol>
    <p style="margin-top:10px;font-size:12px;color:var(--faint)">Generated locally from researched data in this app · ${new Date().toLocaleDateString("en-GB")} · Template-generated, not live AI research.</p>`;
  out.classList.add("show");
  out.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
$("#hunterRun").addEventListener("click", runHunter);
$("#hunterInput").addEventListener("keydown", e => { if (e.key === "Enter") runHunter(); });

/* ---------------- clients ---------------- */
function renderClients() {
  const q = ($("#clientSearch").value || "").toLowerCase();
  const region = $("#regionFilter").value;
  const stage = $("#stageFilter").value;
  const list = state.prospects.filter(p =>
    (!region || p.region === region) &&
    (!stage || p.stage === stage) &&
    (!q || (p.company + " " + p.city + " " + p.trade + " " + p.problem).toLowerCase().includes(q)));
  $("#clientRows").innerHTML = list.length ? list.map(p => `
    <tr data-id="${p.id}">
      <td><div class="c-name">${esc(p.company)}</div><div class="c-sub">${esc(p.trade)} · ${esc(p.city)}, ${esc(p.region)}</div></td>
      <td style="max-width:280px">${esc(p.problem)}</td>
      <td>${p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : `<span style="color:var(--faint)">No public email — Facebook / GBP</span>`}<div class="c-sub">${esc(p.website)}</div></td>
      <td class="prob-mini">${money(p.value)}</td>
      <td><select class="status-select" data-stage="${p.id}" aria-label="Stage">${PIPELINE_STAGES.map(s => `<option ${p.stage === s ? "selected" : ""}>${s}</option>`).join("")}</select>${p.contactedOn ? `<div class="c-sub">Pitched ${esc(p.contactedOn)}</div>` : ""}</td>
      <td><input type="date" class="follow-input" data-follow="${p.id}" value="${esc(p.followUp || "")}" aria-label="Follow-up date"></td>
    </tr>`).join("")
    : `<tr><td colspan="6"><div class="empty">No prospects match these filters.</div></td></tr>`;
  $$("#clientRows tr[data-id]").forEach(tr => tr.addEventListener("click", e => {
    if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT" || e.target.tagName === "A") return;
    openClientDetail(tr.dataset.id);
  }));
  $$("#clientRows .status-select").forEach(sel => sel.addEventListener("change", () => {
    const p = state.prospects.find(x => x.id === sel.dataset.stage);
    p.stage = sel.value;
    store.set("prospect." + p.id, { stage: p.stage, followUp: p.followUp });
    toast(`${p.company} → ${p.stage}`);
  }));
  $$("#clientRows .follow-input").forEach(inp => inp.addEventListener("change", () => {
    const p = state.prospects.find(x => x.id === inp.dataset.follow);
    p.followUp = inp.value;
    store.set("prospect." + p.id, { stage: p.stage, followUp: p.followUp });
    toast(`Follow-up saved for ${p.company}`);
  }));
}
function openClientDetail(id) {
  const p = state.prospects.find(x => x.id === id);
  const d = $("#clientDetail");
  d.innerHTML = `
    <h2>${esc(p.company)}</h2>
    <p class="hint">${esc(p.trade)} · ${esc(p.city)}, ${esc(p.region)} · Website: ${esc(p.website)} · Source: ${esc(p.source)}</p>
    <div class="grid grid-2">
      <div><b style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)">Problem identified</b><p style="font-size:13.5px;margin-top:4px">${esc(p.problem)}</p></div>
      <div><b style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)">Pitch strategy</b><p style="font-size:13.5px;margin-top:4px">${esc(p.pitch)}</p></div>
    </div>
    <div class="mt" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      ${p.email ? `<a class="btn" href="mailto:${esc(p.email)}?subject=${encodeURIComponent("Your website / ads — one quick idea from Wayne.clips")}">✉ Email ${esc(p.email)}</a>` : `<span class="badge demo">No public email — reach via Facebook / Google Business</span>`}
      <span class="badge researched">Est. value ${money(p.value)}</span>
      <span class="badge ${p.stage === "Contacted" ? "contacted" : "researched"}">Stage: ${esc(p.stage)}</span>
      <button class="btn ghost" id="detailClose">Close</button>
    </div>`;
  d.classList.add("show");
  $("#detailClose").addEventListener("click", () => d.classList.remove("show"));
}
["clientSearch", "regionFilter", "stageFilter"].forEach(id =>
  $("#" + id).addEventListener("input", renderClients));

/* ---------------- map ---------------- */
function renderRegions() {
  $("#regionList").innerHTML = REGIONS.map(r => `
    <div class="region-row" data-region="${r.id}">
      <div class="r-count">${r.prospects}</div>
      <div><div class="r-name">${esc(r.name)}</div><div class="r-note">${esc(r.note)}</div></div>
    </div>`).join("");
  $$("#regionList .region-row").forEach(row => row.addEventListener("click", () => {
    const r = REGIONS.find(x => x.id === row.dataset.region);
    $$("#regionList .region-row").forEach(x => x.classList.remove("active"));
    row.classList.add("active");
    location.hash = "#/clients";
    const map = { "United States": "USA", "United Kingdom": "UK", "Europe": "Europe", "Canada": "Canada", "Australia": "Australia" };
    $("#regionFilter").value = map[r.name] || "";
    renderClients();
  }));
}

/* ---------------- execution ---------------- */
function saveDeals() { store.set("deals", state.deals); }
function saveTasks() { store.set("tasks", state.tasks); }
function renderKanban() {
  const kb = $("#kanban");
  kb.innerHTML = PIPELINE_STAGES.map(stage => {
    const deals = state.deals.filter(d => d.stage === stage);
    return `<div class="kanban-col" data-stage="${stage}">
      <h3>${stage} <span>${deals.length}</span></h3>
      ${deals.map(d => `
        <div class="deal-card" draggable="true" data-deal="${d.id}">
          <div class="d-title">${esc(d.title)}</div>
          <div class="d-val">${money(d.value)} <span style="color:var(--muted);font-weight:400;font-size:11px">est.</span></div>
          <div class="d-note">${esc(d.notes)}</div>
          <div class="d-actions">
            ${stage !== "Paid" ? `<button data-advance="${d.id}">Advance →</button>` : ""}
            ${stage === "Paid" ? `<button data-paid="${d.id}" disabled>✓ Paid</button>` : ""}
          </div>
        </div>`).join("") || `<div class="empty" style="padding:10px">No deals</div>`}
    </div>`;
  }).join("");
  // drag & drop
  $$(".deal-card", kb).forEach(card => {
    card.addEventListener("dragstart", e => { e.dataTransfer.setData("text/plain", card.dataset.deal); card.classList.add("dragging"); });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
  });
  $$(".kanban-col", kb).forEach(col => {
    col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("drag-over"); });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", e => {
      e.preventDefault(); col.classList.remove("drag-over");
      const id = e.dataTransfer.getData("text/plain");
      moveDeal(id, col.dataset.stage);
    });
  });
  $$("[data-advance]", kb).forEach(b => b.addEventListener("click", () => {
    const d = state.deals.find(x => x.id === b.dataset.advance);
    const i = PIPELINE_STAGES.indexOf(d.stage);
    if (i < PIPELINE_STAGES.length - 1) moveDeal(d.id, PIPELINE_STAGES[i + 1]);
  }));
}
function moveDeal(id, stage) {
  const d = state.deals.find(x => x.id === id);
  if (!d || d.stage === stage) return;
  d.stage = stage;
  d.updated = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  saveDeals(); renderKanban(); drawStageChart(); refreshStats();
  toast(`${d.title} → ${stage}`);
  if (stage === "Paid") toast("Deal marked Paid — record the amount in Revenue Command (edit data.js).");
}
function drawStageChart() {
  const items = PIPELINE_STAGES.map((s, i) => ({
    label: s, value: state.deals.filter(d => d.stage === s).reduce((a, d) => a + (d.value || 0), 0),
    color: ["#60a5fa", "#22d3ee", "#8b5cf6", "#fbbf24", "#34d399", "#34d399"][i],
  }));
  drawHBarChart($("#stageChart"), items);
  $("#stageLegend").innerHTML = items.map(i => `<span><i style="background:${i.color}"></i>${i.label}: ${money(i.value)}</span>`).join("");
}
function renderTasks() {
  const list = $("#taskList");
  list.innerHTML = state.tasks.length ? state.tasks.map(t => `
    <div class="task-row ${t.done ? "done" : ""}">
      <input type="checkbox" data-task="${t.id}" ${t.done ? "checked" : ""} aria-label="Mark done">
      <span>${esc(t.text)}</span>
      <span class="due">${t.done ? "Done" : "Due " + esc(t.due)}</span>
      <button class="del" data-del="${t.id}" aria-label="Delete task">×</button>
    </div>`).join("") : `<div class="empty">No tasks. Add the next hunt above.</div>`;
  $$("#taskList input[type=checkbox]").forEach(cb => cb.addEventListener("change", () => toggleTask(cb.dataset.task)));
  $$("#taskList [data-del]").forEach(b => b.addEventListener("click", () => {
    state.tasks = state.tasks.filter(t => t.id !== b.dataset.del);
    saveTasks(); renderTasks(); renderCmdTasks();
  }));
}
function toggleTask(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  saveTasks(); renderTasks(); renderCmdTasks();
}
$("#taskAddBtn").addEventListener("click", () => {
  const text = $("#taskText").value.trim();
  if (!text) { toast("Type a task first."); return; }
  state.tasks.push({ id: "t" + Date.now(), text, due: $("#taskDue").value || "2026-12-02", done: false });
  $("#taskText").value = ""; $("#taskDue").value = "";
  saveTasks(); renderTasks(); renderCmdTasks(); toast("Task added.");
});
$("#taskText").addEventListener("keydown", e => { if (e.key === "Enter") $("#taskAddBtn").click(); });

/* ---------------- lab ---------------- */
function scoreIdea({ demand, competition, cost, profit }) {
  const costScore = cost <= 0 ? 10 : cost <= 100 ? 8 : cost <= 500 ? 5 : cost <= 2000 ? 3 : 1;
  const profitScore = Math.min(10, Math.max(1, Math.round(profit / 100)));
  const s = Math.round(demand * 4 + (10 - competition) * 2.5 + costScore * 1.5 + profitScore * 2);
  return { score: Math.min(100, s), costScore, profitScore };
}
function verdictFor(score) { return score >= 70 ? "GO" : score >= 50 ? "TEST" : "PARK"; }
function renderLabIdeas() {
  $("#labIdeas").innerHTML = state.labIdeas.map(idea => {
    const sc = scoreIdea({ demand: idea.demand, competition: idea.competition, cost: idea.startupCost, profit: idea.monthlyProfit });
    const v = verdictFor(sc.score);
    const note = v === "GO"
      ? "Strong signal: high demand, manageable competition, workable economics. Build the smallest demo and pitch one buyer this week."
      : v === "TEST"
        ? "Worth a cheap test, not a full build: validate demand with one real prospect before spending more time."
        : "Weak economics right now — park it and revisit only if demand or costs change.";
    return `<div class="panel idea-card" style="box-shadow:none">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
        <h3>${esc(idea.name)}</h3><span class="badge ${v === "GO" ? "won" : v === "TEST" ? "demo" : "blocked"}">${v} · ${sc.score}</span>
      </div>
      <p>${esc(idea.summary)}</p>
      <div class="score-bars">
        <div class="score-bar"><span>Demand ${idea.demand}/10</span><div class="track"><i style="width:${idea.demand * 10}%"></i></div><span>${idea.demand}</span></div>
        <div class="score-bar"><span>Low competition</span><div class="track"><i style="width:${(10 - idea.competition) * 10}%"></i></div><span>${10 - idea.competition}</span></div>
        <div class="score-bar"><span>Low startup cost</span><div class="track"><i style="width:${sc.costScore * 10}%"></i></div><span>${sc.costScore}</span></div>
        <div class="score-bar"><span>Profit potential</span><div class="track"><i style="width:${sc.profitScore * 10}%"></i></div><span>${sc.profitScore}</span></div>
      </div>
      <p style="margin-top:10px;font-size:12.5px;color:var(--text)"><b>Verdict:</b> ${esc(idea.verdictNote || note)}</p>
      <div style="font-size:12px;color:var(--muted)">Startup $${idea.startupCost} · ~$${idea.monthlyProfit}/mo profit potential</div>
    </div>`;
  }).join("");
}
function bindLabRanges() {
  $("#labDemand").addEventListener("input", e => $("#labDemandVal").textContent = e.target.value);
  $("#labComp").addEventListener("input", e => $("#labCompVal").textContent = e.target.value);
}
function evalLab() {
  const idea = {
    name: $("#labName").value.trim() || "Untitled idea",
    demand: +$("#labDemand").value,
    competition: +$("#labComp").value,
    startupCost: +$("#labCost").value || 0,
    monthlyProfit: +$("#labProfit").value || 0,
    summary: $("#labNote").value.trim() || "No summary provided.",
  };
  const sc = scoreIdea({ demand: idea.demand, competition: idea.competition, cost: idea.startupCost, profit: idea.monthlyProfit });
  const v = verdictFor(sc.score);
  const vd = $("#labVerdict");
  vd.className = "verdict show " + v.toLowerCase();
  vd.innerHTML = `
    <div class="v-score">${sc.score}/100 — ${v === "GO" ? "GO" : v === "TEST" ? "TEST IT" : "PARK IT"}</div>
    <h3>${esc(idea.name)}</h3>
    <p>${v === "GO" ? "Strong signal: high demand, manageable competition, workable economics. Build the smallest demo and pitch one buyer this week." : v === "TEST" ? "Worth a cheap test, not a full build: validate demand with one real prospect before spending more time." : "Weak economics right now — park it and revisit only if demand or costs change."}</p>
    <div class="score-bars">
      <div class="score-bar"><span>Demand</span><div class="track"><i style="width:${idea.demand * 10}%"></i></div><span>${idea.demand}</span></div>
      <div class="score-bar"><span>Low competition</span><div class="track"><i style="width:${(10 - idea.competition) * 10}%"></i></div><span>${10 - idea.competition}</span></div>
      <div class="score-bar"><span>Low startup cost</span><div class="track"><i style="width:${sc.costScore * 10}%"></i></div><span>${sc.costScore}</span></div>
      <div class="score-bar"><span>Profit potential</span><div class="track"><i style="width:${sc.profitScore * 10}%"></i></div><span>${sc.profitScore}</span></div>
    </div>`;
  vd.dataset.idea = JSON.stringify({ ...idea, verdict: v, verdictNote: vd.querySelector("p").textContent });
  return idea;
}
$("#labEvalBtn").addEventListener("click", evalLab);
$("#labSaveBtn").addEventListener("click", () => {
  const vd = $("#labVerdict");
  if (!vd.dataset.idea) { evalLab(); }
  const idea = JSON.parse(vd.dataset.idea);
  idea.id = "i" + Date.now();
  state.labIdeas.push(idea);
  store.set("labIdeas", state.labIdeas);
  renderLabIdeas();
  toast("Idea saved to the lab.");
});

/* ---------------- revenue ---------------- */
function drawRevenueChart() {
  const byStrategy = {};
  for (const d of state.deals) {
    const p = PROSPECTS.find(x => x.id === d.prospectId);
    let s = "Microtasks / surveys";
    if (p) {
      const idx = PROSPECTS.indexOf(p);
      s = idx < 12 ? "Website rebuilds" : "Video ad creative";
    }
    byStrategy[s] = (byStrategy[s] || 0) + (d.value || 0);
  }
  const items = Object.entries(byStrategy).map(([label, value], i) => ({
    label, value, color: ["#22d3ee", "#8b5cf6", "#34d399"][i % 3],
  }));
  drawBarChart($("#revChart"), items.length ? items : [{ label: "No pipeline", value: 0 }]);
  $("#revLegend").innerHTML = items.map(i => `<span><i style="background:${i.color}"></i>${i.label}: ${money(i.value)} est.</span>`).join("");
}
function renderRevenueSources() {
  const rows = [
    { name: "Wayne.clips — website rebuilds", received: 0, note: "7 pitches sent 19 Nov · reply check 21–22 Nov" },
    { name: "Wayne.clips — clipping / Shorts", received: 0, note: "10 creator emails sent 18 Nov · 0 replies so far" },
    { name: "PollPe (surveys, UPI)", received: 0, note: "Fastest first dollar — not started yet" },
    { name: "Paid research (Userlytics etc.)", received: 0, note: "Accounts live; no paid study invited yet" },
    { name: "Bounties (Raenest / Superteam)", received: 0, note: "Entries due 23 Nov / 13 Dec; winners Dec" },
  ];
  $("#revSources").innerHTML = `<div class="table-wrap"><table style="min-width:640px"><thead><tr><th>Source</th><th>Received</th><th>Status</th></tr></thead><tbody>
    ${rows.map(r => `<tr style="cursor:default"><td><div class="c-name">${esc(r.name)}</div></td><td class="prob-mini">$0</td><td style="color:var(--muted)">${esc(r.note)}</td></tr>`).join("")}
  </tbody></table></div>
  <p class="hint" style="margin-top:10px;margin-bottom:0">No source has paid yet. The first dollar will change this table — and the target bar — immediately.</p>`;
}

/* ---------------- 3D background (Three.js, guarded) ---------------- */
function initBackground() {
  const host = $("#bg3d");
  if (typeof THREE === "undefined") return; // offline / CDN blocked — CSS gradients carry the look
  try {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
    camera.position.z = 9;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    // particle field
    const N = 420;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 26;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 15;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x22d3ee, size: 0.045, transparent: true, opacity: 0.55 }));
    scene.add(pts);

    // wireframe globe, top-right
    const globe = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.5, 1),
      new THREE.MeshBasicMaterial({ color: 0x8b5cf6, wireframe: true, transparent: true, opacity: 0.16 })
    );
    globe.position.set(5.4, 2.6, -2);
    scene.add(globe);
    const globe2 = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.5, 1),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.07 })
    );
    globe2.position.copy(globe.position);
    globe2.scale.setScalar(1.15);
    scene.add(globe2);

    let mx = 0, my = 0;
    addEventListener("pointermove", e => { mx = (e.clientX / innerWidth - 0.5); my = (e.clientY / innerHeight - 0.5); });
    addEventListener("resize", () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });
    (function loop() {
      requestAnimationFrame(loop);
      pts.rotation.y += 0.00045;
      pts.rotation.x = my * 0.12;
      globe.rotation.y += 0.0016;
      globe.rotation.x += 0.0006;
      globe2.rotation.y -= 0.0011;
      camera.position.x += (mx * 0.5 - camera.position.x) * 0.03;
      camera.position.y += (-my * 0.3 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    })();
  } catch { /* WebGL unavailable — CSS fallback stays */ }
}

/* ---------------- boot ---------------- */
function boot() {
  tickClock();
  setInterval(tickClock, 1000);
  refreshStats();
  renderTopSignals();
  renderCmdTasks();
  renderCatChips();
  renderOppGrid();
  renderQuickPrompts();
  renderClients();
  renderRegions();
  renderMap($("#worldMap"), REGIONS, r => {
    toast(`${r.name}: ${r.prospects} researched prospect${r.prospects === 1 ? "" : "s"}`);
  });
  renderKanban();
  renderTasks();
  drawStageChart();
  bindLabRanges();
  renderLabIdeas();
  drawRevenueChart();
  renderRevenueSources();
  initBackground();

  radarMini = new Radar($("#radarMini"), state.opportunities, opp => {
    location.hash = "#/radar";
    setTimeout(() => {
      const card = document.querySelector(`[data-opp="${opp.id}"]`);
      if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  });
  radarMain = new Radar($("#radarMain"), state.opportunities, opp => {
    const card = document.querySelector(`[data-opp="${opp.id}"]`);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  radarMini.start();
  if (currentView() === "radar") radarMain.start();
  showView(currentView());
  addEventListener("resize", () => { drawStageChart(); drawRevenueChart(); });
}

boot();
