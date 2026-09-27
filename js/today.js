const $ = (id) => document.getElementById(id);
const picker = $("datePicker"), title = $("dateTitle");
const todayStr = () => new Date().toISOString().slice(0, 10);
const uid = () => "t" + Date.now().toString(36) + Math.floor(Math.random() * 99);

let date = todayStr();
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
  Store.set("d:" + date, {
    lastSleep: $("lastSleep").value, wake: $("wake").value,
    weight: $("weight").value, sleepH: $("sleepH").value,
    braindump: $("braindump").value,
    cells: cells, labels: labels, autoSleep: autoSleepIds,
    todos: todos,
    oneline: $("oneline").value,
    photo: $("photoPrev").src.startsWith("data:") ? $("photoPrev").src : "",
    habitDone: habitDone,
  });
  Store.set(monthKey(date), monthTodos);
}
function monthKey(d) { return "month:" + d.slice(0, 7); }

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
  $("oneline").value = s.oneline || "";
  $("photoPrev").src = s.photo || "";
  migrateHabits(s);
  habitDone = s.habitDone || {};
  paintAll(); renderBlocks(); renderTodos(); renderMonthTodos(); renderHabitRate();
  title.textContent = d;
  if (!$("sleepH").value) { autoSleepCalc(); paintSleepGrid(); }
}

// --- drum time picker (desktop only; touch uses native) ---
const IS_TOUCH = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
let drumTarget = null;
function buildDrum(el, n, val) {
  el.innerHTML = "";
  el.dataset.count = n;
  for (let i = 0; i < n; i++) {
    const d = document.createElement("div");
    d.className = "drum-item";
    d.textContent = String(i).padStart(2, "0");
    el.appendChild(d);
  }
  requestAnimationFrame(() => { el.scrollTop = val * 34; });
}
function drumVal(el) {
  const i = Math.round(el.scrollTop / 34);
  return String(Math.max(0, Math.min(Number(el.dataset.count) - 1, i))).padStart(2, "0");
}
function openDrum(input) {
  drumTarget = input;
  const [h, m] = (input.value || "07:00").split(":").map(Number);
  buildDrum($("drumH"), 24, h || 0);
  buildDrum($("drumM"), 60, m || 0);
  $("drumModal").style.display = "flex";
}
$("drumCancel").onclick = () => { $("drumModal").style.display = "none"; };
$("drumOk").onclick = () => {
  if (drumTarget) {
    drumTarget.value = drumVal($("drumH")) + ":" + drumVal($("drumM"));
    autoSleepCalc(); paintSleepGrid(); save();
  }
  $("drumModal").style.display = "none";
};
$("lastSleep").onclick = () => { if (!IS_TOUCH) openDrum($("lastSleep")); };
$("wake").onclick = () => { if (!IS_TOUCH) openDrum($("wake")); };
if (IS_TOUCH) {
  ["lastSleep", "wake"].forEach(id => {
    const el = $(id);
    el.type = "time";
    el.removeAttribute("readonly");
    el.addEventListener("change", () => { autoSleepCalc(); paintSleepGrid(); save(); });
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
let painting = false;

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
document.addEventListener("pointerup", () => { if (painting) { painting = false; save(); renderBlocks(); } });

function toggleCell(c, drag) {
  const id = c.dataset.id;
  if (!curColor) { delete cells[id]; delete labels[id]; }
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

// painted runs → label rows
function runs() {
  const out = [];
  let cur = null;
  SLOT_IDS.forEach(id => {
    const v = cells[id];
    if (v && cur && cur.color === v) { cur.end = id; }
    else {
      if (cur) out.push(cur);
      cur = v ? { color: v, start: id, end: id } : null;
    }
  });
  if (cur) out.push(cur);
  return out;
}
const CNAMES = { work: "Work", promise: "Meet", personal: "Me", family: "Family", obok: "Obok", sleep: "Sleep" };
function renderBlocks() {
  const box = $("blocks");
  box.innerHTML = "";
  runs().forEach(r => {
    const row = document.createElement("div");
    row.className = "block-row";
    const dot = document.createElement("span");
    dot.className = "dot " + r.color;
    const range = document.createElement("span");
    range.className = "hint";
    range.textContent = `${r.start}–${r.end} · ${CNAMES[r.color] || r.color}`;
    const inp = document.createElement("input");
    inp.placeholder = "memo";
    inp.value = labels[r.start] || "";
    inp.oninput = () => { labels[r.start] = inp.value; save(); };
    row.append(dot, range, inp);
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

// --- photo ---
$("photo").onchange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => { $("photoPrev").src = r.result; save(); };
  r.readAsDataURL(f);
};

["weight", "sleepH", "oneline", "braindump"].forEach(id => $(id).addEventListener("input", save));
picker.onchange = () => { save(); date = picker.value; apply(date); };

apply(date);
