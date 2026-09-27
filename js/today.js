const $ = (id) => document.getElementById(id);
const picker = $("datePicker"), title = $("dateTitle");
const todayStr = () => Store.today();
const uid = () => "t" + Date.now().toString(36) + Math.floor(Math.random() * 99);

let date = todayStr();
try {
  const q = new URLSearchParams(location.search).get("date");
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) date = q;
} catch (e) {}
picker.value = date;

const HOURS = [];
for (let i = 0; i < 24; i++) HOURS.push((6 + i) % 24);
const SLOT_IDS = [];
HOURS.forEach(h => {
  const hh = String(h).padStart(2, "0");
  for (let m = 0; m < 60; m += 10) SLOT_IDS.push(`${hh}:${String(m).padStart(2, "0")}`);
});

function load(d) {
  return Store.get("d:" + d, "ownmything:" + d) || {};
}
function save() {
  const prev = load(date);
  Store.set("d:" + date, Object.assign({}, prev, {
    lastSleep: $("lastSleep").value, wake: $("wake").value,
    weight: $("weight").value, sleepH: $("sleepH").value,
    braindump: $("braindump").value,
    cells: cells, labels: labels, autoSleep: autoSleepIds,
    todos: todos,
    habitDone: habitDone,
  }));
  Store.set(monthKey(date), monthTodos);
}
function monthKey(d) { return "month:" + d.slice(0, 7); }

// --- weekday + holiday red ---
const YO = ["일", "월", "화", "수", "목", "금", "토"];
const FALLBACK_HOL = ["01-01", "03-01", "05-05", "06-06", "08-15", "10-03", "10-09", "12-25"];
let holSet = new Set(FALLBACK_HOL);
async function loadHolidays() {
  const y = date.slice(0, 4);
  try {
    const raw = localStorage.getItem("ownmything:hol:" + y);
    if (raw) { holSet = new Set(JSON.parse(raw)); renderDateTitle(); return; }
  } catch (e) {}
  try {
    const r = await fetch(`https://date.nager.at/api/v3/publicholidays/${y}/KR`);
    if (r.ok) {
      const arr = await r.json();
      const mmdd = arr.map(h => h.date.slice(5));
      holSet = new Set(mmdd);
      try { localStorage.setItem("ownmything:hol:" + y, JSON.stringify(mmdd)); } catch (e) {}
      renderDateTitle();
    }
  } catch (e) {}
}
function renderDateTitle() {
  const dt = new Date(date + "T12:00:00");
  const yo = YO[dt.getDay()];
  const hol = dt.getDay() === 0 || holSet.has(date.slice(5));
  title.innerHTML = "";
  title.append(date + " ");
  const s = document.createElement("span");
  s.textContent = yo;
  if (hol) s.className = "holiday";
  title.appendChild(s);
  if (hol && dt.getDay() !== 0) {
    const s2 = document.createElement("span");
    s2.textContent = " · 휴일";
    s2.className = "holiday";
    title.appendChild(s2);
  }
}

let cells = {}, labels = {}, autoSleepIds = [], todos = [], monthTodos = [];

function apply(d) {
  const s = load(d);
  $("lastSleep").value = s.lastSleep || "";
  $("wake").value = s.wake || "";
  $("weight").value = s.weight || "";
  $("sleepH").value = s.sleepH || "";
  $("braindump").value = s.braindump || "";
  cells = s.cells || {};
  Object.keys(cells).forEach(id => {
    if (cells[id] === "obokwalk" || cells[id] === "walk") cells[id] = "obok";
  });
  labels = s.labels || {};
  autoSleepIds = s.autoSleep || [];
  todos = Array.isArray(s.todos) ? s.todos : [];
  monthTodos = Store.get(monthKey(d)) || [];
  const mn = ["January","February","March","April","May","June","July","August","September","October","November","December"][Number(d.slice(5, 7)) - 1];
  $("monthTitleSide").textContent = mn;
  migrateHabits(s);
  habitDone = s.habitDone || {};
  paintAll(); renderBlocks(); renderTodos(); renderMonthTodos(); renderHabitRate();
  syncTimeUI();
  title.textContent = d;
  renderDateTitle();
  loadHolidays();
  if (!$("sleepH").value) { autoSleepCalc(); paintSleepGrid(); }
  if (!$("sleepH").value) { autoSleepCalc(); paintSleepGrid(); }
}

// --- select time input (desktop; touch uses native) ---
function fillTimeSelects() {
  document.querySelectorAll(".hm").forEach(box => {
    const hs = box.querySelector('[data-p="h"]'), ms = box.querySelector('[data-p="m"]');
    hs.innerHTML = '<option value="">--</option>' + Array.from({ length: 24 }, (_, h) => `<option value="${String(h).padStart(2, "0")}">${String(h).padStart(2, "0")}</option>`).join("");
    ms.innerHTML = '<option value="">--</option>' + Array.from({ length: 12 }, (_, i) => { const m = String(i * 5).padStart(2, "0"); return `<option value="${m}">${m}</option>`; }).join("");
    hs.onchange = ms.onchange = () => {
      const id = box.dataset.for;
      $(id).value = (hs.value && ms.value) ? `${hs.value}:${ms.value}` : "";
      syncTimeUI();
      autoSleepCalc(); paintSleepGrid(); save();
    };
  });
}
function syncTimeUI() {
  ["lastSleep", "wake"].forEach(id => {
    const box = document.querySelector(`.hm[data-for="${id}"]`);
    if (box) {
      const [h, m] = ($(id).value || ":").split(":");
      box.querySelector('[data-p="h"]').value = h || "";
      let mm = m || "";
      if (mm && Number(mm) % 5 !== 0) mm = String(Math.round(Number(mm) / 5) * 5 % 60).padStart(2, "0");
      box.querySelector('[data-p="m"]').value = mm;
    }
    const nat = $(id + "-native");
    if (nat && nat.value !== $(id).value) nat.value = $(id).value;
  });
}
fillTimeSelects();
// touch: native spinner instead of selects
const IS_TOUCH = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
if (IS_TOUCH) {
  ["lastSleep", "wake"].forEach(id => {
    const hidden = $(id);
    const nat = document.createElement("input");
    nat.type = "time";
    nat.id = id + "-native";
    nat.value = hidden.value;
    nat.addEventListener("change", () => {
      hidden.value = nat.value;
      syncTimeUI();
      autoSleepCalc(); paintSleepGrid(); save();
    });
    const box = hidden.parentElement.querySelector(".hm");
    if (box) box.replaceWith(nat);
  });
}

// --- sleep ---
function toMin(t) {
  if (!t || !t.includes(":")) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function autoSleepCalc() {
  const s = toMin($("lastSleep").value), w = toMin($("wake").value);
  if (s === null || w === null) return;
  let diff = w - s;
  if (diff <= 0) diff += 24 * 60;
  $("sleepH").value = (diff / 60).toFixed(1);
}
function slotsBetweenMin(a, b) {
  const out = [];
  let t = a - (a % 10);
  while (t < b) {
    const h = Math.floor(t / 60) % 24, m = t % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    t += 10;
  }
  return out;
}
function paintSleepGrid() {
  autoSleepIds.forEach(id => { if (cells[id] === "sleep") delete cells[id]; });
  autoSleepIds = [];
  const s = toMin($("lastSleep").value), w = toMin($("wake").value);
  if (s === null || w === null) { paintAll(); renderBlocks(); return; }
  let e = w;
  if (e <= s) e += 24 * 60;
  autoSleepIds = slotsBetweenMin(s, e);
  autoSleepIds.forEach(id => { cells[id] = "sleep"; });
  paintAll(); renderBlocks();
}

// --- todo (notion-style) ---
function todoRow(item, list, render) {
  const l = document.createElement("div");
  l.className = "todo-check";
  const cb = document.createElement("input");
  cb.type = "checkbox"; cb.checked = !!item.done;
  cb.onchange = () => { item.done = cb.checked; save(); render(); };
  l.appendChild(cb);
  if (item.editing) {
    const inp = document.createElement("input");
    inp.className = "todo-edit";
    inp.value = item.t || "";
    inp.placeholder = "To do";
    const commit = () => {
      item.t = inp.value.trim();
      delete item.editing;
      if (!item.t) list.splice(list.indexOf(item), 1);
      save(); render();
    };
    inp.onkeydown = (e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { list.splice(list.indexOf(item), 1); save(); render(); } };
    inp.onblur = commit;
    l.appendChild(inp);
    requestAnimationFrame(() => inp.focus());
  } else {
    const s = document.createElement("span");
    s.textContent = item.t;
    if (item.done) s.className = "done";
    s.onclick = () => { item.editing = true; render(); };
    const up = document.createElement("button");
    up.textContent = "↑";
    up.onclick = () => { const i = list.indexOf(item); if (i > 0) { list.splice(i, 1); list.splice(i - 1, 0, item); save(); render(); } };
    const dn = document.createElement("button");
    dn.textContent = "↓";
    dn.onclick = () => { const i = list.indexOf(item); if (i < list.length - 1) { list.splice(i, 1); list.splice(i + 1, 0, item); save(); render(); } };
    const del = document.createElement("button");
    del.textContent = "×";
    del.onclick = () => { list.splice(list.indexOf(item), 1); save(); render(); };
    l.append(s, up, dn, del);
  }
  return l;
}
function renderTodos() {
  const box = $("todos");
  box.innerHTML = "";
  todos.forEach(t => box.appendChild(todoRow(t, todos, renderTodos)));
}
function renderMonthTodos() {
  const box = $("monthTodos");
  box.innerHTML = "";
  monthTodos.forEach(t => box.appendChild(todoRow(t, monthTodos, renderMonthTodos)));
}
$("addTodo").onclick = () => { todos.push({ id: uid(), t: "", done: false, editing: true }); renderTodos(); };
$("addMonthTodo").onclick = () => { monthTodos.push({ id: uid(), t: "", done: false, editing: true }); renderMonthTodos(); };

// --- timetable ---
const tt = $("timetable");
let curColor = "work";
let painting = false, erasing = false, eraseColor = null;
const checkedRuns = new Set();

$("clearDay").onclick = () => {
  if (!Object.keys(cells).length) return;
  if (!confirm("Clear today's time plan?")) return;
  cells = {}; labels = {}; autoSleepIds = []; checkedRuns.clear();
  paintAll(); renderBlocks(); save();
};
$("delChecked").onclick = () => {
  if (!checkedRuns.size) return;
  checkedRuns.forEach(start => {
    const r = runs().find(x => x.start === start);
    if (r) r.ids.forEach(id => { delete cells[id]; });
    delete labels[start];
  });
  checkedRuns.clear();
  paintAll(); renderBlocks(); save();
};

document.querySelectorAll("#palette .sw").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll("#palette .sw").forEach(x => x.classList.remove("on"));
    b.classList.add("on");
    curColor = b.dataset.c;
  };
});

HOURS.forEach(h => {
  const hh = String(h).padStart(2, "0");
  const row = document.createElement("div");
  row.className = "trow";
  const lab = document.createElement("div");
  lab.className = "tlabel";
  lab.textContent = hh;
  row.appendChild(lab);
  const grid = document.createElement("div");
  grid.className = "tgrid";
  for (let m = 0; m < 60; m += 10) {
    const id = `${hh}:${String(m).padStart(2, "0")}`;
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
document.addEventListener("pointerup", () => { if (painting) { painting = false; erasing = false; save(); renderBlocks(); } });

function toggleCell(c, drag) {
  const id = c.dataset.id;
  const v = cells[id];
  if (!drag) {
    if (v === curColor) { delete cells[id]; }
    else { cells[id] = curColor; erasing = false; }
    if (!v) { painting = true; }
    else if (v === curColor) { painting = true; erasing = true; eraseColor = v; }
    else { painting = true; }
  } else {
    if (erasing) {
      if (v === eraseColor) delete cells[id];
    } else if (v !== curColor) {
      cells[id] = curColor;
    }
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

// painted runs → label rows + on-grid text
function runs() {
  const out = [];
  let cur = null;
  SLOT_IDS.forEach(id => {
    const v = cells[id];
    if (v && cur && cur.color === v) { cur.end = id; cur.ids.push(id); }
    else {
      if (cur) out.push(cur);
      cur = v ? { color: v, start: id, end: id, ids: [id] } : null;
    }
  });
  if (cur) out.push(cur);
  return out;
}
const CNAMES = { work: "Work", promise: "Meet", personal: "Me", family: "Family", obok: "Obok", sleep: "Sleep" };
function cellEl(id) {
  return tt.querySelector(`[data-id="${id}"]`);
}
function paintOverlays(list) {
  tt.querySelectorAll(".run-label").forEach(o => o.remove());
  list.forEach(r => {
    const txt = labels[r.start] || "";
    if (!txt) return;
    const byHour = {};
    r.ids.forEach(id => { (byHour[id.slice(0, 2)] = byHour[id.slice(0, 2)] || []).push(id); });
    const segs = Object.values(byHour);
    const mid = segs[Math.floor(segs.length / 2)];
    const first = cellEl(mid[0]);
    if (!first) return;
    const grid = first.parentElement;
    const startIdx = Number(mid[0].slice(3)) / 10;
    const o = document.createElement("div");
    o.className = "run-label";
    o.style.left = `calc(${(startIdx / 6) * 100}% + 1px)`;
    o.style.width = `calc(${(mid.length / 6) * 100}% - 2px)`;
    o.textContent = txt;
    grid.appendChild(o);
  });
}
function renderBlocks() {
  Object.keys(labels).forEach(k => { if (!cells[k]) delete labels[k]; });
  tt.querySelectorAll(".cell").forEach(c => { c.textContent = ""; c.classList.remove("labeled"); });
  const box = $("blocks");
  box.innerHTML = "";
  const list = runs();
  paintOverlays(list);
  list.forEach(r => {
    const txt = labels[r.start] || "";
    const row = document.createElement("div");
    row.className = "block-row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = checkedRuns.has(r.start);
    cb.onchange = () => {
      if (cb.checked) checkedRuns.add(r.start);
      else checkedRuns.delete(r.start);
    };
    const dot = document.createElement("span");
    dot.className = "dot " + r.color;
    const range = document.createElement("span");
    range.className = "hint";
    range.textContent = `${r.start}–${r.end} · ${CNAMES[r.color] || r.color}`;
    const inp = document.createElement("input");
    inp.placeholder = "memo";
    inp.value = txt;
    inp.oninput = () => {
      if (inp.value) labels[r.start] = inp.value;
      else delete labels[r.start];
      save(); paintOverlays(runs());
    };
    row.append(cb, dot, range, inp);
    box.appendChild(row);
  });
}

// --- habits rate ---
const DEFS_KEY = "habit-defs";
const LEGACY_DEFS = "ownmything:habit-defs";
let habitDefs = [];
let habitDone = {};
function getDefs() { return Store.get(DEFS_KEY, LEGACY_DEFS) || []; }
function setDefs(d) { Store.set(DEFS_KEY, d); }
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
        { id: "h-water", t: "Water", slot: "morning" },
        { id: "h-walk", t: "Obok walk", slot: "night" },
        { id: "h-read", t: "Read 10m", slot: "anytime" },
      ];
    }
    setDefs(habitDefs);
  } else {
    let changed = false;
    habitDefs.forEach(h => { if (!h.slot) { h.slot = "anytime"; changed = true; } });
    if (changed) setDefs(habitDefs);
  }
}
function renderHabitRate() {
  const el = $("habitRate");
  if (!el) return;
  const rate = habitDefs.length
    ? Math.round(100 * habitDefs.filter(h => habitDone[h.id]).length / habitDefs.length) : 0;
  el.textContent = `${rate}% →`;
}

// --- photo moved to Night page ---

["weight", "sleepH", "braindump"].forEach(id => $(id).addEventListener("input", save));
picker.onchange = () => { save(); date = picker.value; apply(date); };
$("goToday").onclick = () => { save(); date = todayStr(); picker.value = date; apply(date); };

apply(date);
