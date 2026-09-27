const $ = (id) => document.getElementById(id);
const picker = $("datePicker"), title = $("dateTitle");
const todayStr = () => new Date().toISOString().slice(0, 10);
const key = (d) => `ownmything:${d}`;

let date = todayStr();
picker.value = date;

function load(d) {
  try { return JSON.parse(localStorage.getItem(key(d))) || {}; }
  catch { return {}; }
}
function save() {
  const data = {
    lastSleep: $("lastSleep").value, wake: $("wake").value, sleepPlan: $("sleepPlan").value,
    braindump: $("braindump").value,
    am: $("am").value, pm: $("pm").value, eve: $("eve").value,
    amDone: $("amDone").checked, pmDone: $("pmDone").checked, eveDone: $("eveDone").checked,
    cells: cells, weight: $("weight").value, sleepH: $("sleepH").value,
    oneline: $("oneline").value, photo: $("photoPrev").src.startsWith("data:") ? $("photoPrev").src : "",
    habitDone: habitDone, exps: exps,
  };
  localStorage.setItem(key(date), JSON.stringify(data));
}
function apply(d) {
  const s = load(d);
  $("lastSleep").value = s.lastSleep || "";
  $("wake").value = s.wake || ""; $("sleepPlan").value = s.sleepPlan || "";
  $("braindump").value = s.braindump || "";
  $("am").value = s.am || ""; $("pm").value = s.pm || ""; $("eve").value = s.eve || "";
  $("amDone").checked = !!s.amDone; $("pmDone").checked = !!s.pmDone; $("eveDone").checked = !!s.eveDone;
  cells = s.cells || {};
  $("weight").value = s.weight || ""; $("sleepH").value = s.sleepH || "";
  $("oneline").value = s.oneline || "";
  $("photoPrev").src = s.photo || "";
  migrateHabits(s);
  habitDone = s.habitDone || {};
  exps = s.exps || [];
  paintAll(); renderHabits(); renderExps();
  title.textContent = d;
}

// --- timetable: 06:00 -> +24h, 10min = 144 cells ---
const tt = $("timetable");
let cells = {};
let curColor = "work";
let painting = false, eraseDrag = false;

document.querySelectorAll("#palette .sw").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll("#palette .sw").forEach(x => x.classList.remove("on"));
    b.classList.add("on");
    curColor = b.dataset.c;
  };
});

const hours = [];
for (let i = 0; i < 24; i++) hours.push((6 + i) % 24);

hours.forEach(h => {
  const row = document.createElement("div");
  row.className = "trow";
  const lab = document.createElement("div");
  lab.className = "tlabel";
  lab.textContent = String(h).padStart(2, "0");
  row.appendChild(lab);
  const grid = document.createElement("div");
  grid.className = "tgrid";
  for (let m = 0; m < 60; m += 10) {
    const id = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const c = document.createElement("div");
    c.className = "cell";
    c.dataset.id = id;
    c.title = id;
    c.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      painting = true;
      toggleCell(c);
    });
    c.addEventListener("pointerenter", () => { if (painting) toggleCell(c, true); });
    grid.appendChild(c);
  }
  row.appendChild(grid);
  tt.appendChild(row);
});
document.addEventListener("pointerup", () => { painting = false; save(); });

function toggleCell(c, drag) {
  const id = c.dataset.id;
  if (!curColor) { delete cells[id]; }
  else if (!drag && cells[id] === curColor) { delete cells[id]; }
  else {
    if (drag && cells[id] === curColor) return;
    cells[id] = curColor;
  }
  paintCell(c);
}
function paintCell(c) {
  const v = cells[c.dataset.id];
  c.className = "cell" + (v ? ` fill ${v}` : "");
}
function paintAll() {
  tt.querySelectorAll(".cell").forEach(paintCell);
}

// --- 회사 고정 스케줄: 평일 9:30-17:30 업무, 점심 11:40-13:00 개인 ---
function slotsBetween(start, end) {
  const out = [];
  let [h, m] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  while (h * 60 + m < eh * 60 + em) {
    out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    m += 10;
    if (m >= 60) { m -= 60; h++; }
  }
  return out;
}
$("fillWork").onclick = () => {
  slotsBetween("09:30", "17:30").forEach(id => { cells[id] = "work"; });
  slotsBetween("11:40", "13:00").forEach(id => { cells[id] = "personal"; });
  paintAll(); save();
};

// --- habits (global defs + per-day done) ---
const DEFS_KEY = "ownmything:habit-defs";
let habitDefs = [];
let habitDone = {};
function getDefs() {
  try { return JSON.parse(localStorage.getItem(DEFS_KEY)) || []; }
  catch { return []; }
}
function setDefs(d) { localStorage.setItem(DEFS_KEY, JSON.stringify(d)); }
function migrateHabits(s) {
  habitDefs = getDefs();
  if (habitDefs.length === 0) {
    if (Array.isArray(s.habits) && s.habits.length) {
      habitDefs = s.habits.map(h => ({ id: "h" + Math.random().toString(36).slice(2, 8), t: h.t, slot: "anytime" }));
      const done = {};
      s.habits.forEach((h, i) => { if (h.done) done[habitDefs[i].id] = true; });
      s.habitDone = done;
    } else {
      habitDefs = [
        { id: "h-vent", t: "🪟 환기하기", slot: "morning" },
        { id: "h-bed", t: "🧺 이불 정리", slot: "morning" },
        { id: "h-water", t: "🥛 공복 물 한잔", slot: "morning" },
        { id: "h-weight", t: "🎀 체중 기록", slot: "morning" },
        { id: "h-sleepj", t: "🛏️ Sleep Journal", slot: "morning" },
        { id: "h-daily", t: "🌱 Daily Plan", slot: "morning" },
        { id: "h-read", t: "📚 식후 독서·양치", slot: "anytime" },
        { id: "h-pill", t: "💊 영양제 먹기", slot: "anytime" },
        { id: "h-ex", t: "🧷 운동", slot: "anytime" },
        { id: "h-bath", t: "🚽 화장실", slot: "anytime" },
        { id: "h-walk", t: "🐕 오복 산책", slot: "night" },
        { id: "h-log", t: "⏳ 기록", slot: "night" },
        { id: "h-write", t: "🖊️ 필사", slot: "night" },
      ];
    }
    setDefs(habitDefs);
  } else {
    let changed = false;
    habitDefs.forEach(h => { if (!h.slot) { h.slot = "anytime"; changed = true; } });
    if (changed) setDefs(habitDefs);
  }
}
const SLOTS = [["morning", "Morning"], ["anytime", "Anytime"], ["night", "Night"]];
function renderHabits() {
  const box = $("habits");
  box.innerHTML = "";
  SLOTS.forEach(([slot, label]) => {
    const col = document.createElement("div");
    col.className = "hcol";
    const h = document.createElement("h4");
    h.className = "slot-" + slot;
    h.textContent = label;
    col.appendChild(h);
    habitDefs.filter(x => (x.slot || "anytime") === slot).forEach((x) => {
      const b = document.createElement("button");
      b.className = "pill" + (habitDone[x.id] ? " done" : "");
      b.textContent = x.t;
      b.onclick = () => { habitDone[x.id] = !habitDone[x.id]; save(); renderHabits(); };
      col.appendChild(b);
    });
    box.appendChild(col);
  });
  const rate = habitDefs.length
    ? Math.round(100 * habitDefs.filter(h => habitDone[h.id]).length / habitDefs.length) : 0;
  $("habitRate").textContent = `오늘 달성률 ${rate}%`;
}
$("addHabit").onclick = () => {
  const v = $("newHabit").value.trim();
  if (!v) return;
  habitDefs = getDefs();
  habitDefs.push({ id: "h" + Date.now().toString(36), t: v, slot: "anytime" });
  setDefs(habitDefs);
  $("newHabit").value = "";
  save(); renderHabits();
};

// --- expenses quick ---
let exps = [];
function renderExps() {
  const ul = $("expList");
  ul.innerHTML = "";
  exps.forEach((e, i) => {
    const li = document.createElement("li");
    li.textContent = `${e.what} — ${Number(e.amt).toLocaleString()}원`;
    const b = document.createElement("button");
    b.textContent = "×";
    b.onclick = () => { exps.splice(i, 1); save(); renderExps(); };
    li.appendChild(b);
    ul.appendChild(li);
  });
}
$("addExp").onclick = () => {
  const w = $("expWhat").value.trim(), a = $("expAmt").value;
  if (!w || !a) return;
  exps.push({ what: w, amt: Number(a) });
  try {
    const k = "ownmything:ledger-txns";
    const txns = JSON.parse(localStorage.getItem(k)) || [];
    txns.push({ id: "t" + Date.now().toString(36), date, kind: "expense", cat: "기타", amt: Number(a), method: "현금", memo: w });
    localStorage.setItem(k, JSON.stringify(txns));
  } catch {}
  $("expWhat").value = ""; $("expAmt").value = "";
  save(); renderExps();
};

// --- photo ---
$("photo").onchange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => { $("photoPrev").src = r.result; save(); };
  r.readAsDataURL(f);
};

// --- sleep auto: 어제 취침 -> 오늘 기상 ---
function toMin(t) {
  if (!t || !t.includes(":")) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function autoSleep() {
  const s = toMin($("lastSleep").value), w = toMin($("wake").value);
  if (s === null || w === null) return;
  let diff = w - s;
  if (diff <= 0) diff += 24 * 60;
  $("sleepH").value = (diff / 60).toFixed(1);
}
["lastSleep", "wake"].forEach(id => $(id).addEventListener("input", () => { autoSleep(); save(); }));

// --- generic autosave ---
["sleepPlan", "braindump", "am", "pm", "eve", "weight", "sleepH", "oneline"]
  .forEach(id => $(id).addEventListener("input", save));
["amDone", "pmDone", "eveDone"].forEach(id => $(id).addEventListener("change", save));

picker.onchange = () => { save(); date = picker.value; apply(date); };

apply(date);
