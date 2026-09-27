const $ = (id) => document.getElementById(id);
const picker = $("datePicker"), title = $("dateTitle");
const todayStr = () => new Date().toISOString().slice(0, 10);
const uid = () => "t" + Date.now().toString(36) + Math.floor(Math.random() * 99);

let date = todayStr();
picker.value = date;

function load(d) {
  return Store.get("d:" + d, "ownmything:" + d) || {};
}
function save() {
  Store.set("d:" + date, {
    lastSleep: $("lastSleep").value, wake: $("wake").value,
    weight: $("weight").value, sleepH: $("sleepH").value,
    cells: cells, memos: memos,
    todos: todos,
    oneline: $("oneline").value,
    photo: $("photoPrev").src.startsWith("data:") ? $("photoPrev").src : "",
    habitDone: habitDone,
  });
  saveMonthTodos();
}
function monthKey(d) { return "month:" + d.slice(0, 7); }
function loadMonthTodos() {
  monthTodos = Store.get(monthKey(date)) || [];
  const m = Number(date.slice(5, 7));
  $("monthTitle").textContent = m + "월";
}
function saveMonthTodos() {
  Store.set(monthKey(date), monthTodos);
}

let cells = {}, memos = {}, todos = [], monthTodos = [];

function apply(d) {
  const s = load(d);
  $("lastSleep").value = s.lastSleep || "";
  $("wake").value = s.wake || "";
  $("weight").value = s.weight || "";
  $("sleepH").value = s.sleepH || "";
  if (!$("sleepH").value) autoSleep();
  cells = s.cells || {};
  memos = s.memos || {};
  todos = Array.isArray(s.todos) ? s.todos : migrateLegacyTodos(s);
  $("oneline").value = s.oneline || "";
  $("photoPrev").src = s.photo || "";
  migrateHabits(s);
  habitDone = s.habitDone || {};
  loadMonthTodos();
  paintAll(); paintMemos(); renderTodos(); renderMonthTodos(); renderHabitRate();
  title.textContent = d;
}
// 구버전 오전/오후/저녁 → To Do로 1회 이관
function migrateLegacyTodos(s) {
  const out = [];
  [["오전", s.am, s.amDone], ["오후", s.pm, s.pmDone], ["저녁", s.eve, s.eveDone]].forEach(([pre, t, done]) => {
    if (t && t.trim()) out.push({ id: uid(), t: t.trim(), done: !!done });
  });
  return out;
}

// --- sleep auto ---
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

// --- todo list (monthly + daily, movable) ---
function todoRow(item, list, render) {
  const l = document.createElement("label");
  l.className = "todo-check";
  const cb = document.createElement("input");
  cb.type = "checkbox"; cb.checked = !!item.done;
  cb.onchange = () => { item.done = cb.checked; save(); render(); };
  const s = document.createElement("span");
  s.textContent = item.t;
  if (item.done) s.className = "done";
  const up = document.createElement("button");
  up.textContent = "↑"; up.title = "위로";
  up.onclick = () => { const i = list.indexOf(item); if (i > 0) { list.splice(i, 1); list.splice(i - 1, 0, item); save(); render(); } };
  const dn = document.createElement("button");
  dn.textContent = "↓"; dn.title = "아래로";
  dn.onclick = () => { const i = list.indexOf(item); if (i < list.length - 1) { list.splice(i, 1); list.splice(i + 1, 0, item); save(); render(); } };
  const del = document.createElement("button");
  del.textContent = "×";
  del.onclick = () => { list.splice(list.indexOf(item), 1); save(); render(); };
  l.append(cb, s, up, dn, del);
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
$("addTodo").onclick = () => {
  const v = $("newTodo").value.trim();
  if (!v) return;
  todos.push({ id: uid(), t: v, done: false });
  $("newTodo").value = "";
  save(); renderTodos();
};
$("newTodo").addEventListener("keydown", (e) => { if (e.key === "Enter") $("addTodo").onclick(); });
$("addMonthTodo").onclick = () => {
  const v = $("newMonthTodo").value.trim();
  if (!v) return;
  monthTodos.push({ id: uid(), t: v, done: false });
  $("newMonthTodo").value = "";
  save(); renderMonthTodos();
};
$("newMonthTodo").addEventListener("keydown", (e) => { if (e.key === "Enter") $("addMonthTodo").onclick(); });

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

const hours = [];
for (let i = 0; i < 24; i++) hours.push((6 + i) % 24);

hours.forEach(h => {
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
  const memo = document.createElement("input");
  memo.className = "tmemo";
  memo.placeholder = hh + "시 일정";
  memo.dataset.hour = hh;
  memo.addEventListener("input", () => { memos[hh] = memo.value; save(); });
  row.appendChild(memo);
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
function paintMemos() {
  tt.querySelectorAll(".tmemo").forEach(m => { m.value = memos[m.dataset.hour] || ""; });
}

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

// --- habits (rate only on today) ---
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
        { id: "h-water", t: "공복 물 한잔", slot: "morning" },
        { id: "h-walk", t: "오복 산책", slot: "night" },
        { id: "h-read", t: "독서 10분", slot: "anytime" },
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
  el.textContent = `오늘 ${rate}% →`;
}

// --- photo ---
$("photo").onchange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => { $("photoPrev").src = r.result; save(); };
  r.readAsDataURL(f);
};

["weight", "sleepH", "oneline"].forEach(id => $(id).addEventListener("input", save));
picker.onchange = () => { save(); date = picker.value; apply(date); };

apply(date);
