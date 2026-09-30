const $ = (id) => document.getElementById(id);
const DEFS_KEY = "habit-defs";
const LEGACY_DEFS = "ownmything:habit-defs";
const fmt = (d) => Store.day(d);
const yestStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return Store.day(d); };
let selDate = Store.today();
$("datePicker").value = selDate;

const HABIT_EN = {
  "환기하기": "Ventilate", "이불 정리": "Make bed", "공복 물 한잔": "Water",
  "체중 기록": "Weigh in", "Sleep Journal": "Sleep log", "Daily Plan": "Daily plan",
  "식후 독서·양치": "Read & brush", "영양제 먹기": "Vitamins", "운동": "Workout",
  "화장실": "Bathroom", "오복 산책": "Walk Obok", "기록": "Log", "필사": "Transcribe",
  "물 마시기": "Water", "독서 10분": "Read 10m",
};
function cleanHabit(t) {
  const s = String(t || "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, "").trim();
  return HABIT_EN[s] || s;
}
function getDefs() {
  let d = Store.get(DEFS_KEY, LEGACY_DEFS) || [];
  if (!d.length) {
    d = [
      { id: "h-water", t: "Water", slot: "morning" },
      { id: "h-walk", t: "Obok walk", slot: "night" },
      { id: "h-read", t: "Read 10m", slot: "anytime" },
    ];
    Store.set(DEFS_KEY, d);
    return d;
  }
  let changed = false;
  const migrated = Store.get("habit-en-v1");
  d.forEach(x => {
    if (!x.slot) { x.slot = "anytime"; changed = true; }
    if (!migrated) {
      const c = cleanHabit(x.t);
      if (c !== x.t) { x.t = c; changed = true; }
    }
  });
  if (!migrated) Store.set("habit-en-v1", true);
  if (changed) Store.set(DEFS_KEY, d);
  return d;
}

// --- explicit save: edits live in memory until Save is pressed -------------
// done: { "2026-09-28": { habitId: true } }
// defs: habit definition edits, or null when untouched
const DKEY = "omt:habit-draft";
let dDefs = null;
let dDone = {};
let dDirty = false;
try {
  const raw = JSON.parse(sessionStorage.getItem(DKEY) || "null");
  if (raw) { dDefs = raw.defs || null; dDone = raw.done || {}; dDirty = true; }
} catch (e) {}
function stash() {
  try {
    if (dDirty) sessionStorage.setItem(DKEY, JSON.stringify({ defs: dDefs, done: dDone }));
    else sessionStorage.removeItem(DKEY);
  } catch (e) {}
}
function isDirty() { return dDirty; }
function markDirty() { dDirty = true; stash(); paintSaveBar(); }
function paintSaveBar() {
  const b = $("saveState");
  if (b) { b.textContent = dDirty ? "저장 전" : "저장됨"; b.classList.toggle("warn", dDirty); }
  const s = $("saveBtn");
  if (s) s.style.opacity = dDirty ? "1" : "0.45";
  const r = $("revertBtn");
  if (r) r.style.display = dDirty ? "inline-block" : "none";
}
function curDefs() { return dDefs || getDefs(); }
function setDefs(d) { dDefs = d; markDirty(); }
function commitAll() {
  if (dDefs) { Store.set(DEFS_KEY, dDefs); dDefs = null; }
  Object.keys(dDone).forEach(ds => {
    const s = dayData(ds);
    s.habitDone = Object.assign({}, s.habitDone, dDone[ds]);
    Store.set("d:" + ds, s);
  });
  dDone = {};
  dDirty = false;
  stash();
  paintSaveBar();
}
function revertAll() {
  if (!dDirty) return;
  if (!confirm("저장하지 않은 습관 변경을 되돌릴까요?")) return;
  dDefs = null; dDone = {}; dDirty = false;
  stash(); paintSaveBar(); renderAll();
}
$("saveBtn").onclick = () => { if (!dDirty) return; commitAll(); renderAll(); };
$("revertBtn").onclick = () => revertAll();
window.addEventListener("beforeunload", (e) => {
  if (!dDirty) return;
  e.preventDefault(); e.returnValue = "";
});
// -----------------------------------------------------------------------

function dayData(ds) {
  return Store.get("d:" + ds, "ownmything:" + ds) || {};
}
function isDone(ds, def) {
  const o = dDone[ds];
  if (o && typeof o[def.id] !== "undefined") return !!o[def.id];
  const s = dayData(ds);
  if (s.habitDone && typeof s.habitDone[def.id] !== "undefined") return !!s.habitDone[def.id];
  if (Array.isArray(s.habits)) {
    const m = s.habits.find(h => h.t === def.t);
    if (m) return !!m.done;
  }
  return false;
}
function setDone(ds, def, v) {
  dDone[ds] = Object.assign({}, dDone[ds]);
  dDone[ds][def.id] = v;
  markDirty();
}

const SLOTS = [["morning", "아침"], ["anytime", "낮"], ["night", "밤"]];
function renderToday() {
  const box = $("todayCheck");
  box.innerHTML = "";
  $("checkTitle").textContent = selDate === Store.today() ? "오늘" : selDate;
  $("headDate").textContent = selDate;
  const defs = curDefs();
  SLOTS.forEach(([slot, label]) => {
    const items = defs.filter(d => (d.slot || "anytime") === slot);
    if (!items.length) return;
    const col = document.createElement("div");
    col.className = "hcol";
    const h = document.createElement("h4");
    h.className = "slot-" + slot;
    const hit = items.filter(d => isDone(selDate, d)).length;
    h.textContent = `${label} · ${hit}/${items.length}`;
    col.appendChild(h);
    items.forEach(def => {
      const b = document.createElement("button");
      b.className = "pill" + (isDone(selDate, def) ? " done" : "");
      b.textContent = def.t;
      b.onclick = () => { setDone(selDate, def, !isDone(selDate, def)); renderToday(); renderWeek(); renderMonth(); };
      col.appendChild(b);
    });
    box.appendChild(col);
  });
}

function renderDefs() {
  const box = $("defs");
  box.innerHTML = "";
  curDefs().forEach((h) => {
    const l = document.createElement("label");
    l.className = "habit";
    const sel = document.createElement("select");
    ["morning", "anytime", "night"].forEach(s => {
      const o = document.createElement("option");
      o.value = s; o.textContent = s === "morning" ? "아침" : s === "anytime" ? "낮" : "밤";
      if ((h.slot || "anytime") === s) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => {
      const d = curDefs();
      const m = d.find(x => x.id === h.id);
      if (m) { m.slot = sel.value; setDefs(d); renderToday(); renderWeek(); }
    };
    const nm = document.createElement("input");
    nm.value = h.t;
    nm.onchange = () => {
      const d = curDefs();
      const m = d.find(x => x.id === h.id);
      if (m && nm.value.trim()) { m.t = nm.value.trim(); setDefs(d); renderToday(); renderWeek(); renderMonth(); }
      else renderDefs();
    };
    const b = document.createElement("button");
    b.textContent = "×";
    b.onclick = () => { setDefs(curDefs().filter(x => x.id !== h.id)); renderAll(); };
    l.append(sel, nm, b);
    box.appendChild(l);
  });
}
$("addDef").onclick = () => {
  const v = $("newDef").value.trim();
  if (!v) return;
  const d = curDefs();
  d.push({ id: "h" + Date.now().toString(36), t: v, slot: "anytime" });
  setDefs(d);
  $("newDef").value = "";
  renderAll();
};

function last7() {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(fmt(d));
  }
  return out;
}
function renderWeek() {
  const defs = curDefs(), days = last7();
  $("weekLabel").textContent = `${days[0]} ~ ${days[6]}`;
  const t = $("weekTable");
  t.innerHTML = "";
  const head = document.createElement("div");
  head.className = "hrow hhead";
  const WD = ["일","월","화","수","목","금","토"];
  head.innerHTML = `<span></span>` +
    days.map(d => `<span>${WD[new Date(d + "T00:00:00").getDay()]}${d.slice(8)}</span>`).join("") +
    `<span>율</span>`;
  t.appendChild(head);
  [["morning", "아침"], ["anytime", "낮"], ["night", "밤"]].forEach(([slot, label]) => {
    const items = defs.filter(d => (d.slot || "anytime") === slot);
    if (!items.length) return;
    const sh = document.createElement("div");
    sh.className = "hrow hsec";
    sh.innerHTML = `<span><b>${label}</b></span>`;
    t.appendChild(sh);
    items.forEach(def => {
      const row = document.createElement("div");
      row.className = "hrow";
      const done = days.filter(d => isDone(d, def)).length;
      const rate = Math.round(100 * done / days.length);
      row.innerHTML = `<span class="hname">${def.t}</span>` +
        days.map(d => `<span class="${isDone(d, def) ? "on" : ""}">${isDone(d, def) ? "●" : "○"}</span>`).join("") +
        `<span>${rate}%</span>`;
      t.appendChild(row);
    });
  });
  const total = defs.length * days.length;
  const hit = defs.reduce((a, def) => a + days.filter(d => isDone(d, def)).length, 0);
  $("weekRates").textContent = defs.length ? `주간 ${Math.round(100 * hit / total)}% (${hit}/${total})` : "습관 없음";
}

function renderMonth() {
  const defs = curDefs();
  const mv = $("monthPicker").value || Store.today().slice(0, 7);
  $("monthPicker").value = mv;
  $("monthLabel").textContent = mv;
  const [y, m] = mv.split("-").map(Number);
  const daysIn = new Date(y, m, 0).getDate();
  const first = new Date(y, m - 1, 1).getDay();
  const box = $("monthCal");
  box.innerHTML = "";
  ["일","월","화","수","목","금","토"].forEach(d => {
    const h = document.createElement("span");
    h.className = "cal-h";
    h.textContent = d;
    box.appendChild(h);
  });
  for (let i = 0; i < first; i++) box.appendChild(document.createElement("span"));
  const today = Store.today();
  for (let d = 1; d <= daysIn; d++) {
    const ds = `${mv}-${String(d).padStart(2, "0")}`;
    let hit = 0;
    defs.forEach(def => { if (isDone(ds, def)) hit++; });
    const rate = defs.length ? Math.round(100 * hit / defs.length) : 0;
    const c = document.createElement("div");
    const lvl = rate >= 100 ? "r100" : rate >= 70 ? "r70" : rate >= 30 ? "r30" : "r0";
    c.className = "cal-day mrate " + lvl + (ds === today ? " cur" : "");
    c.innerHTML = `<b>${d}</b><i>${rate}%</i>`;
    c.title = `${ds} · ${rate}%`;
    box.appendChild(c);
  }
}
$("monthPicker").onchange = renderMonth;
$("datePicker").onchange = () => { selDate = $("datePicker").value; renderToday(); };
$("goYest").onclick = () => { selDate = yestStr(); $("datePicker").value = selDate; renderToday(); };
$("goTodayDate").onclick = () => { selDate = Store.today(); $("datePicker").value = selDate; renderToday(); };

function renderReport() {
  const box = $("repBox");
  if (!box) return;
  const mv = $("monthPicker").value || Store.today().slice(0, 7);
  const [y, m] = mv.split("-").map(Number);
  const daysIn = new Date(y, m, 0).getDate();
  const defs = curDefs();
  const rows = defs.map(def => {
    let hit = 0;
    for (let d = 1; d <= daysIn; d++) if (isDone(`${mv}-${String(d).padStart(2, "0")}`, def)) hit++;
    return { def, hit, rate: Math.round(100 * hit / daysIn) };
  }).sort((a, b) => b.rate - a.rate);
  const grid = document.createElement("div");
  grid.className = "mcal";
  ["일","월","화","수","목","금","토"].forEach(d => {
    const h = document.createElement("span");
    h.className = "mcal-h";
    h.textContent = d;
    grid.appendChild(h);
  });
  for (let i = 0; i < new Date(y, m - 1, 1).getDay(); i++) grid.appendChild(document.createElement("span"));
  const today = Store.today();
  for (let d = 1; d <= daysIn; d++) {
    const ds = `${mv}-${String(d).padStart(2, "0")}`;
    let hit = 0;
    defs.forEach(x => { if (isDone(ds, x)) hit++; });
    const rate = defs.length ? Math.round(100 * hit / defs.length) : 0;
    const c = document.createElement("div");
    c.className = "cal-day mrate " + (rate >= 100 ? "r100" : rate >= 70 ? "r70" : rate >= 30 ? "r30" : "r0") + (ds === today ? " cur" : "");
    c.innerHTML = `<b>${d}</b><i>${rate}%</i>`;
    grid.appendChild(c);
  }
  box.innerHTML = "";
  const best = rows[0];
  const head = document.createElement("p");
  head.className = "hint";
  head.textContent = best
    ? `${mv} · 최고 ${best.def.t} ${best.rate}% · 평균 ${Math.round(rows.reduce((a, r) => a + r.rate, 0) / rows.length)}%`
    : `${mv} · 습관 없음`;
  box.appendChild(head);
  box.appendChild(grid);
  const ul = document.createElement("div");
  ul.style.marginTop = "10px";
  rows.forEach(r => {
    const p = document.createElement("p");
    p.className = "rep-row";
    p.innerHTML = `<span>${r.def.t}</span><b>${r.rate}%</b>`;
    ul.appendChild(p);
  });
  box.appendChild(ul);
}

function renderData() {
  const box = $("dataCount");
  if (!box) return;
  let n = 0;
  const pre = "ownmything:" + Store.profile() + ":d:";
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) || "";
    if (k.indexOf(pre) === 0) n++;
  }
  box.textContent = `${n}일 기록 · 습관 ${curDefs().length}개`;
}
$("clearHabits").onclick = () => {
  if (!confirm("습관 체크를 모두 초기화할까요?")) return;
  if (dDirty) commitAll();
  const pre = "ownmything:" + Store.profile() + ":d:";
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) || "";
    if (k.indexOf(pre) === 0) keys.push(k);
  }
  keys.forEach(k => {
    const ds = k.slice(pre.length);
    const s = dayData(ds);
    delete s.habitDone;
    Store.set("d:" + ds, s);
  });
  renderAll();
};
$("wipeDays").onclick = () => {
  if (!confirm("모든 기록을 삭제할까요? 되돌릴 수 없습니다.")) return;
  if (dDirty) commitAll();
  const pre = "ownmything:" + Store.profile() + ":d:";
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) || "";
    if (k.indexOf(pre) === 0) keys.push(k);
  }
  keys.forEach(k => localStorage.removeItem(k));
  renderAll();
};

function renderAll() { renderToday(); renderDefs(); renderWeek(); renderMonth(); renderReport(); renderData(); paintSaveBar(); }
renderAll();
if (window.Auth && Auth.onCloudChange) {
  Auth.onCloudChange(() => {
    if (isDirty()) return;
    renderAll();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !isDirty()) renderAll(); });
}
