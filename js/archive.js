const $ = (id) => document.getElementById(id);
const P2 = (n) => String(n).padStart(2, "0");
const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
let ym = Store.today().slice(0, 7);

function day(ds) { return Store.get("d:" + ds, "ownmything:" + ds) || {}; }
function monthDays(m) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo, 0).getDate();
}
function habitDefs() { return Store.get("habit-defs", "ownmything:habit-defs") || []; }
function habitDoneOn(ds) { return day(ds).habitDone || {}; }
function habitRate(ds) {
  const defs = habitDefs();
  if (!defs.length) return null;
  const d = habitDoneOn(ds);
  return Math.round(100 * defs.filter(x => d[x.id]).length / defs.length);
}

function hasContent(ds) {
  const s = day(ds);
  const auto = s.autoCal || {};
  const cells = s.cells || {};
  // ignore cells that were only auto-filled from the calendar
  const own = Object.keys(cells).filter(id => auto[id] !== cells[id]);
  return !!(s.oneline || s.photo || s.braindump || s.weight || s.sleepH ||
    own.length || (s.todos || []).some(t => t.t));
}

function allDays() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) || "";
    const pre = "ownmything:" + Store.profile() + ":d:";
    if (k.indexOf(pre) === 0) {
      const ds = k.slice(pre.length);
      if (hasContent(ds)) out.push(ds);
    }
  }
  return out.sort();
}

function stats(m) {
  const n = monthDays(m);
  let logged = 0, blocks = 0, habitHit = 0, habitDays = 0;
  const weights = [], sleeps = [];
  for (let d = 1; d <= n; d++) {
    const ds = `${m}-${P2(d)}`;
    const s = day(ds);
    if (hasContent(ds)) logged++;
    blocks += Object.keys(s.cells || {}).length * 10;
    const r = habitRate(ds);
    if (r !== null && (s.habitDone && Object.keys(s.habitDone).length)) { habitHit += r; habitDays++; }
    if (s.weight) weights.push({ ds, v: parseFloat(s.weight) });
    if (s.sleepH) sleeps.push(parseFloat(s.sleepH));
  }
  const avgW = weights.length ? weights.reduce((a, x) => a + x.v, 0) / weights.length : null;
  const avgS = sleeps.length ? sleeps.reduce((a, x) => a + x, 0) / sleeps.length : null;
  return { n, logged, blocks, habit: habitDays ? Math.round(habitHit / habitDays) : null, weights, avgW, avgS };
}

function renderSummary() {
  const s = stats(ym);
  const all = allDays();
  const box = $("sumCards");
  box.innerHTML = "";
  const cards = [
    ["기록률", s.n ? Math.round(100 * s.logged / s.n) + "%" : "—", `${s.logged}/${s.n}일`],
    ["시간", (s.blocks / 60).toFixed(1) + "h", `${Math.round(s.blocks / 10)}칸`],
    ["습관", s.habit !== null ? s.habit + "%" : "—", "수행률"],
    ["체중", s.avgW ? s.avgW.toFixed(1) + " kg" : "—", s.weights.length ? `${s.weights.length}건` : "없음"],
    ["수면", s.avgS ? s.avgS.toFixed(1) + " h" : "—", s.avgS ? "월 평균" : "없음"],
    ["총 일수", String(all.length), "전체 기록"],
  ];
  cards.forEach(([k, v, sub]) => {
    const d = document.createElement("div");
    d.className = "sm-card";
    d.innerHTML = `<span>${k}</span><b>${v}</b><i>${sub}</i>`;
    box.appendChild(d);
  });
}

function renderCal() {
  const [y, m] = ym.split("-").map(Number);
  $("calLabel").textContent = `${y}년 ${MONTHS[m - 1]}`;
  const grid = $("calGrid");
  grid.innerHTML = "";
  ["일","월","화","수","목","금","토"].forEach(d => {
    const h = document.createElement("span");
    h.className = "mcal-h";
    h.textContent = d;
    grid.appendChild(h);
  });
  for (let i = 0; i < new Date(y, m - 1, 1).getDay(); i++) grid.appendChild(document.createElement("span"));
  const today = Store.today();
  for (let d = 1; d <= monthDays(ym); d++) {
    const ds = `${ym}-${P2(d)}`;
    const c = document.createElement("button");
    const hr = habitRate(ds);
    c.className = "cal-day a" + (hasContent(ds) ? " has" : "") + (ds === today ? " cur" : "");
    c.innerHTML = `<b>${d}</b>` + (hr !== null && hasContent(ds) ? `<i>${hr}%</i>` : "");
    c.onclick = () => { date = ds; renderDay(); };
    grid.appendChild(c);
  }
}

let date = Store.today();
function renderDay() {
  const s = day(date);
  $("dayTitle").textContent = date;
  const d = new Date(date + "T12:00:00");
  $("dayDow").textContent = ["일","월","화","수","목","금","토"][d.getDay()];
  $("dayOne").textContent = s.oneline || "—";
  $("dayW").textContent = s.weight ? s.weight + " kg" : "—";
  $("dayS").textContent = s.sleepH ? s.sleepH + " h" : "—";
  const cells = s.cells || {};
  const mins = Object.keys(cells).length * 10;
  $("dayB").textContent = mins ? (mins / 60).toFixed(1) + " h" : "—";
  $("dayBlock").textContent = Math.round(mins / 10) + "칸";
  const hr = habitRate(date);
  const defs = habitDefs();
  $("dayH").textContent = hr !== null ? hr + "%" : "—";
  $("dayHSub").textContent = defs.length ? `${defs.filter(x => (s.habitDone || {})[x.id]).length}/${defs.length}` : "—";
  const img = $("dayPhoto");
  if (s.photo) { img.src = s.photo; img.style.display = "block"; }
  else { img.removeAttribute("src"); img.style.display = "none"; }
  $("dayLedger").textContent = monthSettle(ym);
}

function monthSettle(m) {
  try {
    const t = (Store.get("ledger-txns", "ownmything:ledger-txns") || []).filter(x => (x.date || "").slice(0, 7) === m);
    if (!t.length) return "없음";
    const inc = t.filter(x => x.kind === "income").reduce((a, x) => a + x.amt, 0);
    const exp = t.filter(x => x.kind === "expense").reduce((a, x) => a + x.amt, 0);
    return `${(inc - exp).toLocaleString()} KRW`;
  } catch (e) { return "없음"; }
}

function renderPhotos() {
  const box = $("photoWall");
  box.innerHTML = "";
  const [y, m] = ym.split("-").map(Number);
  const out = [];
  for (let d = monthDays(ym); d >= 1; d--) {
    const ds = `${ym}-${P2(d)}`;
    const s = day(ds);
    if (s.photo) out.push({ ds, photo: s.photo, line: s.oneline || "" });
  }
  $("photoCount").textContent = out.length ? `${out.length}장` : "";
  if (!out.length) { box.innerHTML = "<p class='hint'>사진 없음</p>"; return; }
  out.forEach(p => {
    const it = document.createElement("button");
    it.className = "pw";
    const i = document.createElement("img");
    i.src = p.photo; i.loading = "lazy";
    const c = document.createElement("span");
    c.textContent = p.ds.slice(5);
    it.append(i, c);
    it.onclick = () => { date = p.ds; renderDay(); window.scrollTo({ top: 0, behavior: "smooth" }); };
    box.appendChild(it);
  });
}

function renderWeight() {
  const s = stats(ym);
  const svg = $("wChart");
  svg.innerHTML = "";
  const goal = parseFloat(Store.get("goal-weight", ""));
  if (s.weights.length < 2) { svg.innerHTML = `<text x="160" y="70" text-anchor="middle" font-size="11" fill="#a0a4af">데이터 부족</text>`; return; }
  const W = 320, H = 140, pad = 20;
  const ws = s.weights.map(x => x.v);
  let min = Math.min(...ws), max = Math.max(...ws);
  if (goal) { min = Math.min(min, goal); max = Math.max(max, goal); }
  min -= 0.5; max += 0.5;
  const x = (i) => pad + (i / (ws.length - 1)) * (W - pad * 2);
  const y = (v) => H - pad - ((v - min) / (max - min)) * (H - pad * 2);
  if (goal >= min && goal <= max) {
    const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
    ln.setAttribute("x1", pad); ln.setAttribute("x2", W - pad);
    ln.setAttribute("y1", y(goal)); ln.setAttribute("y2", y(goal));
    ln.setAttribute("stroke", "#a0a4af"); ln.setAttribute("stroke-dasharray", "3 3");
    svg.appendChild(ln);
  }
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", ws.map((v, i) => (i ? "L" : "M") + x(i) + " " + y(v)).join(" "));
  p.setAttribute("fill", "none"); p.setAttribute("stroke", "#121316"); p.setAttribute("stroke-width", "1.5");
  svg.appendChild(p);
  ws.forEach((v, i) => {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", x(i)); c.setAttribute("cy", y(v)); c.setAttribute("r", "2"); c.setAttribute("fill", "#121316");
    const t = document.createElementNS("http://www.w3.org/2000/svg", "title");
    t.textContent = `${s.weights[i].ds} · ${v}kg`;
    c.appendChild(t);
    svg.appendChild(c);
  });
  const first = ws[0], last = ws[ws.length - 1];
  const diff = (last - first).toFixed(1);
  $("wDelta").textContent = (diff > 0 ? "+" : "") + diff + " kg";
}

$("mLast").onclick = () => { const d = new Date(); d.setDate(0); ym = Store.day(d).slice(0, 7); $("mPicker").value = ym; renderAll(); };
$("mPrev").onclick = () => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 2, 1); ym = `${d.getFullYear()}-${P2(d.getMonth() + 1)}`; $("mPicker").value = ym; renderAll(); };
$("mNext").onclick = () => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m, 1); ym = `${d.getFullYear()}-${P2(d.getMonth() + 1)}`; $("mPicker").value = ym; renderAll(); };
$("mPicker").onchange = () => { ym = $("mPicker").value; renderAll(); };

function renderAll() { renderSummary(); renderCal(); renderDay(); renderPhotos(); renderWeight(); }
$("mPicker").value = ym;
renderAll();
