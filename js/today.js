const $ = (id) => document.getElementById(id);
const picker = $("datePicker"), title = $("dateTitle");
const todayStr = (d) => Store.day(d || new Date());
const yestStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return Store.day(d); };
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
// Nothing is persisted until Save is pressed. Edits live in `drafts`
// (mirrored to sessionStorage so an accidental reload doesn't lose them).
const DKEY = "omt:drafts";
const drafts = (function () {
  try { return JSON.parse(sessionStorage.getItem(DKEY)) || {}; } catch (e) { return {}; }
})();
function stashDrafts() {
  try {
    if (Object.keys(drafts).length) sessionStorage.setItem(DKEY, JSON.stringify(drafts));
    else sessionStorage.removeItem(DKEY);
  } catch (e) {}
}
function isDirty() { return Object.keys(drafts).length > 0; }
function markDirty() { drafts[date] = draftData(); stashDrafts(); paintSaveBar(); }
function draftData() {
  return {
    lastSleep: $("lastSleep").value, wake: $("wake").value,
    weight: $("weight").value, sleepH: $("sleepH").value,
    braindump: $("braindump").value,
    cells: cells, labels: labels, autoSleep: autoSleepIds,
    todos: cleanTodos(todos),
    habitDone: habitDone,
    monthTodos: cleanTodos(monthTodos),
  };
}
function paintSaveBar() {
  const n = Object.keys(drafts).length;
  const b = $("saveState");
  if (b) {
    b.textContent = n ? (n === 1 ? "저장 전" : `저장 전 ·${n}`) : "저장됨";
    b.classList.toggle("warn", n > 0);
    b.title = n ? "저장을 눌러야 기록됩니다" : "모두 저장됨";
  }
  const s = $("saveBtn");
  if (s) s.style.opacity = n ? "1" : "0.45";
  const r = $("revertBtn");
  if (r) r.style.display = n ? "inline-block" : "none";
}
function cleanTodos(arr) {
  return (Array.isArray(arr) ? arr : [])
    .filter(t => t && (t.div || (t.t && String(t.t).trim())))
    .map(t => {
      const c = Object.assign({}, t);
      delete c.editing;
      if (typeof c.t !== "string") c.t = c.t ? String(c.t) : "";
      return c;
    });
}
function commit() {
  try {
    const keys = Object.keys(drafts);
    if (keys.length) {
      keys.forEach(k => {
        const d = drafts[k];
        Store.set("d:" + k, Object.assign({}, load(k), d));
        Store.set(monthKey(k), d.monthTodos || []);
      });
      drafts[date] = drafts[date] || draftData();
    }
    const d = drafts[date] || draftData();
    Store.set("d:" + date, Object.assign({}, load(date), d));
    Store.set(monthKey(date), d.monthTodos || cleanTodos(monthTodos));
  } catch (e) {
    alert("저장에 실패했어요. 사진이 너무 크면 Night에서 사진을 지워주세요.");
    return false;
  }
  Object.keys(drafts).forEach(k => delete drafts[k]);
  stashDrafts();
  paintSaveBar();
  return true;
}
function revert() {
  if (!isDirty()) return;
  const keys = Object.keys(drafts);
  if (!confirm(`저장하지 않은 변경을 되돌릴까요?${keys.length > 1 ? ` (${keys.length}일)` : ""}`)) return;
  keys.forEach(k => delete drafts[k]);
  stashDrafts();
  apply(date);
}
// calendar auto-fill is machine data, not a user edit — keep it persisted
// even while the user's own edits sit unsaved in `drafts`.
function saveCal() {
  const prev = load(date);
  Store.set("d:" + date, Object.assign({}, prev, {
    autoCal: prev.autoCal || {},
    autoLabels: prev.autoLabels || {},
    allDay: prev.allDay || [],
  }));
}
function save() { markDirty(); }
function monthKey(d) { return "month:" + d.slice(0, 7); }

// --- weekday + holiday red ---
const YO = ["일","월","화","수","목","금","토"];
const FALLBACK_HOL = ["01-01", "03-01", "05-05", "06-06", "08-15", "10-03", "10-09", "12-25"];
let holSet = new Set(FALLBACK_HOL);
async function loadHolidays() {
  const y = date.slice(0, 4);
  try {
    const raw = localStorage.getItem("ownmything:hol:" + y);
    if (raw) { holSet = new Set(JSON.parse(raw)); renderDateTitle(); paintWorkHours(); return; }
  } catch (e) {}
  try {
    const r = await fetch(`https://date.nager.at/api/v3/publicholidays/${y}/KR`);
    if (r.ok) {
      const arr = await r.json();
      const mmdd = arr.map(h => h.date.slice(5));
      holSet = new Set(mmdd);
      try { localStorage.setItem("ownmything:hol:" + y, JSON.stringify(mmdd)); } catch (e) {}
      renderDateTitle();
      paintWorkHours();
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
    s2.textContent = " · 공휴일";
    s2.className = "holiday";
    title.appendChild(s2);
  }
}

let cells = {}, labels = {}, autoSleepIds = [], todos = [], monthTodos = [];

function isWorkday(d) {
  const day = new Date(d + "T12:00:00").getDay();
  if (day === 0 || day === 6) return false;
  const mmdd = d.slice(5);
  if (holSet.has(mmdd)) return false;
  return true;
}

function isWorkfillOn() {
  const v = Store.get("auto-workfill", "ownmything:auto-workfill");
  return v === undefined ? true : !!v;
}
function paintWorkHours() {
  if (!isWorkfillOn()) return;
  if (!isWorkday(date)) return;
  const isLunch = (id) => id >= "11:40" && id < "13:00";
  const inWorkRange = (id) => id >= "09:30" && id < "17:30";
  const filled = [];
  for (let t = 9 * 60 + 30; t < 17 * 60 + 30; t += 10) {
    const h = Math.floor(t / 60), m = t % 60;
    const id = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const want = isLunch(id) ? "lunch" : "work";
    if (!cells[id]) { cells[id] = want; filled.push(id); }
  }
  // Auto memo: company slots → BZen, lunch → 점심 (only when empty, never overwrite).
  let touched = filled.length > 0;
  runs().forEach(r => {
    if (!inWorkRange(r.start)) return;
    if (r.color === "work" && !labels[r.start]) { labels[r.start] = "BZen"; touched = true; }
    if (r.color === "lunch" && !labels[r.start]) { labels[r.start] = "점심"; touched = true; }
  });
  if (touched) { paintAll(); renderBlocks(); saveCal(); }
}

// committed cells/labels carry auto-filled entries; peel them off, then
// re-apply the fresh auto layer so auto data is never treated as user input.
function merged(d) {
  const committed = load(d);
  const cc = Object.assign({}, committed.cells || {});
  const cl = Object.assign({}, committed.labels || {});
  const ac = committed.autoCal || {};
  const al = committed.autoLabels || {};
  Object.keys(ac).forEach(id => { if (cc[id] === ac[id]) delete cc[id]; });
  Object.keys(al).forEach(id => { if (cl[id] === al[id]) delete cl[id]; });
  Object.keys(ac).forEach(id => { if (cc[id] === undefined) cc[id] = ac[id]; });
  Object.keys(al).forEach(id => { if (cl[id] === undefined) cl[id] = al[id]; });
  return Object.assign({}, committed, { cells: cc, labels: cl });
}
function apply(d) {
  const s = merged(d);
  const f = drafts[d] || s;
  $("lastSleep").value = f.lastSleep || "";
  $("wake").value = f.wake || "";
  $("weight").value = f.weight || "";
  $("sleepH").value = f.sleepH || "";
  $("braindump").value = f.braindump || "";
  resizeBraindump();
  cells = f.cells || {};
  Object.keys(cells).forEach(id => {
    if (cells[id] === "obokwalk" || cells[id] === "walk") cells[id] = "obok";
  });
  labels = f.labels || {};
  autoSleepIds = f.autoSleep || [];
  todos = cleanTodos(f.todos);
  if (!Array.isArray(f.todos)) todos = [];
  monthTodos = cleanTodos(f.monthTodos || Store.get(monthKey(d)));
  const mn = Number(d.slice(5, 7));
  $("monthTitleSide").textContent = mn + "월";
  migrateHabits(s);
  habitDone = f.habitDone || {};
  if (syncDumpMarks()) markDirty();
  paintAll(); renderBlocks(); renderTodos(); renderMonthTodos(); renderHabitRate();
  paintSaveBar();
  paintUndoBtn();
  paintWorkfillBtn();
  renderTodayHabits();
  title.textContent = d;
  renderDateTitle();
  loadHolidays();
  if (!$("sleepH").value) { autoSleepCalc(); paintSleepGrid(); }
  if (d === Store.today()) carryOver(false);
}

// --- time input: OS native ---
["lastSleep", "wake"].forEach(id => $(id).addEventListener("change", () => {
  autoSleepCalc(); paintSleepGrid(); save();
}));

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
// Focus is only stolen when the user explicitly starts editing (click / Enter-chain).
// Plain re-renders (save, cloud sync, calendar pull) must never call focus().
let nextFocusId = null;
function todoRow(item, list, render, box, opts) {
  const o = opts || {};
  const l = document.createElement("div");
  l.className = "todo-check" + (item.done && !item.editing ? " done-item" : "");
  l.dataset.id = item.id;
  if (item.div) return l; // legacy dividers are dropped
  const cb = document.createElement("input");
  cb.type = "checkbox"; cb.checked = !!item.done;
  cb.onchange = () => { item.done = cb.checked; save(); render(); };
  l.append(cb);
  if (moveMode && moveMode === moveTarget(list)) {
    l.classList.add("movable");
    l.onclick = (e) => {
      if (e.target.closest("button") || e.target.closest("input[type=checkbox]")) return;
      moveItem(item, list);
    };
  }
  if (item.editing) {
    const inp = document.createElement("input");
    inp.className = "todo-edit";
    inp.value = item.t || "";
    inp.placeholder = "할 일";
    let saved = false;
    const commit = (skipRender) => {
      if (saved) return;
      saved = true;
      item.t = inp.value.trim();
      delete item.editing;
      if (!item.t) {
        const idx = list.indexOf(item);
        if (idx !== -1) list.splice(idx, 1);
      }
      save();
      if (!skipRender) render();
    };
    inp.onkeydown = (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter") {
        e.preventDefault();
        commit(true);
        if (o.chain) {
          const i = list.indexOf(item);
          if (i !== -1) {
            const nid = uid();
            nextFocusId = nid;
            list.splice(i + 1, 0, { id: nid, t: "", done: false, editing: true });
          }
        }
        save(); render();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        saved = true;
        delete item.editing;
        const idx = list.indexOf(item);
        if (idx !== -1) list.splice(idx, 1);
        save(); render();
      }
    };
    inp.onblur = () => { if (!saved) markDirty(); };
    // Preserve in-progress text so a re-render (cloud sync, calendar) never wipes typing.
    inp.oninput = () => { item.t = inp.value; };
    l.appendChild(inp);
    if (item.id === nextFocusId) {
      nextFocusId = null;
      requestAnimationFrame(() => {
        inp.focus();
        try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e) {}
      });
    }
  } else {
    const s = document.createElement("span");
    s.textContent = item.t;
    s.className = "txt" + (item.done ? " done" : "");
    s.onclick = () => { if (!item.editing) { item.editing = true; nextFocusId = item.id; render(); } };
    const del = document.createElement("button");
    del.textContent = "×";
    del.onclick = () => { list.splice(list.indexOf(item), 1); markDirty(); render(); };
    l.append(s, del);
  }
  return l;
}
function renderTodos() {
  const box = $("todos");
  box.innerHTML = "";
  todos.forEach(t => box.appendChild(todoRow(t, todos, renderTodos, box, { chain: true })));
  if (!todos.some(t => t.editing)) {
    const d = { id: uid(), t: "", done: false, editing: true };
    todos.push(d);
    box.appendChild(todoRow(d, todos, renderTodos, box, { chain: true, draft: true }));
  }
}
function syncDumpMarks() {
  // Legacy: old records stored dumpMarks; new ones parse braindump live.
  const src = ($("braindump") && $("braindump").value) || "";
  const legacy = (load(date).dumpMarks) || [];
  const marks = src.split("\n")
    .filter(l => /^\s*[-*]?\s*\[\s*\]\s*/.test(l))
    .map(m => m.replace(/^\s*[-*]?\s*\[\s*\]\s*/, "").trim())
    .filter(Boolean);
  const all = marks.length ? marks : legacy;
  if (!all.length) return false;
  const seen = new Set(monthTodos.map(t => t.t));
  let added = 0;
  all.forEach(m => { if (m && !seen.has(m)) { monthTodos.push({ id: uid(), t: m, done: false }); seen.add(m); added++; } });
  return added > 0;
}
function renderMonthTodos() {
  const box = $("monthTodos");
  // Render must be pure: never write to Store here (write caused save→render loops).
  box.innerHTML = "";
  monthTodos.forEach(t => box.appendChild(todoRow(t, monthTodos, renderMonthTodos, box, { chain: true })));
  if (!monthTodos.some(t => t.editing)) {
    const d = { id: uid(), t: "", done: false, editing: true };
    monthTodos.push(d);
    box.appendChild(todoRow(d, monthTodos, renderMonthTodos, box, { chain: true, draft: true }));
  }
}
$("loadMonthCal").onclick = (e) => { if (e) e.stopPropagation(); autoMonthDone = ""; autoMonth(); pullCalendar(); };
// Month section folds by tapping its header; choice persists.
try {
  const MO = "omt:month-open";
  const setMonth = (on) => {
    $("monthBody").style.display = on ? "" : "none";
    try { localStorage.setItem(MO, on ? "1" : "0"); } catch (e) {}
  };
  setMonth(localStorage.getItem(MO) === "1");
  $("monthHead").onclick = () => setMonth($("monthBody").style.display === "none");
} catch (e) {}
let autoMonthBusy = false, autoMonthDone = "";
async function autoMonth() {
  const ym = date.slice(0, 7);
  if (autoMonthBusy || autoMonthDone === ym) return;
  autoMonthBusy = true;
  const box = $("monthCals");
  box.innerHTML = "<p class='hint'>Loading…</p>";
  try {
    const data = await invokeCal({ month: ym, onlyMe: true });
    autoMonthDone = ym;
    if (!data || data.error) { box.innerHTML = "<p class='hint'>—</p>"; return; }
    renderMonthCals(data.events || [], ym);
  } catch (e) { box.innerHTML = "<p class='hint'>—</p>"; }
  finally { autoMonthBusy = false; }
}
// Move mode: press → 월간 (or → 오늘), then tap the rows you want to move.
let moveMode = null; // "month" | "today" | null
function moveTarget(list) { return list === monthTodos ? "today" : "month"; }
function setMoveMode(m) {
  moveMode = (moveMode === m) ? null : m;
  const bt = $("moveMonth"), bm = $("moveToday");
  bt.classList.toggle("on", moveMode === "month");
  bm.classList.toggle("on", moveMode === "today");
  bt.textContent = moveMode === "month" ? "취소" : "→ 월간";
  bm.textContent = moveMode === "today" ? "취소" : "→ 오늘";
  const hint = $("moveHint");
  if (hint) hint.style.display = moveMode === "today" ? "" : "none";
  const hintTo = $("moveHintTo");
  if (hintTo) hintTo.style.display = moveMode === "month" ? "" : "none";
  renderTodos(); renderMonthTodos();
}
function moveItem(item, list) {
  const i = list.indexOf(item);
  if (i === -1) return;
  const to = moveTarget(list);
  list.splice(i, 1);
  (to === "month" ? monthTodos : todos).push({ id: uid(), t: item.t, done: item.done });
  moveMode = null;
  markDirty();
  renderTodos(); renderMonthTodos();
  setMoveMode(null);
}
$("moveMonth").onclick = () => setMoveMode("month");
$("moveToday").onclick = () => setMoveMode("today");
$("saveBtn").onclick = () => {
  if (!isDirty()) return;
  commit();
  paintSaveBar();
};
$("revertBtn").onclick = () => revert();
$("wipeBtn").onclick = () => {
  if (!confirm(`${date} 기록을 전부 지울까요?`)) return;
  Store.set("d:" + date, {});
  Store.set(monthKey(date), []);
  delete drafts[date];
  stashDrafts();
  paintSaveBar();
  apply(date);
};
$("braindump").addEventListener("input", onDump);
function resizeBraindump() {
  const bd = $("braindump");
  if (!bd) return;
  bd.style.height = "auto";
  bd.style.height = Math.max(80, bd.scrollHeight) + "px";
}
function onDump() {
  markDirty();
  resizeBraindump();
  // - [ ] lines become month todos, but only in memory until Save.
  // (No direct Store.set here: everything persists via commit.)
  const v = $("braindump").value;
  const marks = v.split("\n")
    .filter(l => /^\s*[-*]?\s*\[\s*\]\s*/.test(l))
    .map(m => m.replace(/^\s*[-*]?\s*\[\s*\]\s*/, "").trim())
    .filter(Boolean);
  const seen = new Set(monthTodos.map(t => t.t));
  let added = false;
  marks.forEach(m => { if (m && !seen.has(m)) { monthTodos.push({ id: uid(), t: m, done: false }); seen.add(m); added = true; } });
  if (added) renderMonthTodos();
}

// --- timetable ---
// The time plan uses the same explicit Save as everything else.
// Undo in the card head is the safety net for mis-taps.
const tt = $("timetable");
let curColor = "work";
let painting = false, erasing = false, eraseColor = null;
const checkedRuns = new Set();

const gridUndo = [];
function gridSnap() { return { date: date, cells: Object.assign({}, cells), labels: Object.assign({}, labels) }; }
function pushUndo() { gridUndo.push(gridSnap()); if (gridUndo.length > 50) gridUndo.shift(); paintUndoBtn(); }
function hasUndo() { for (let i = gridUndo.length - 1; i >= 0; i--) if (gridUndo[i].date === date) return true; return false; }
function paintUndoBtn() {
  const b = $("undoGrid");
  if (!b) return;
  b.disabled = !hasUndo();
  b.style.opacity = hasUndo() ? "1" : "0.4";
}
function undoGrid() {
  while (gridUndo.length && gridUndo[gridUndo.length - 1].date !== date) gridUndo.pop();
  const s = gridUndo.pop();
  if (!s) return;
  cells = s.cells;
  labels = s.labels;
  autoSleepIds = (autoSleepIds || []).filter(id => cells[id] === "sleep");
  markDirty(); paintAll(); renderBlocks(); paintUndoBtn();
}
if ($("undoGrid")) $("undoGrid").onclick = undoGrid;

$("clearDay").onclick = () => {
  if (!Object.keys(cells).length) return;
  if (!confirm("시간표를 전부 비울까요?")) return;
  pushUndo();
  cells = {}; labels = {}; autoSleepIds = []; checkedRuns.clear();
  paintAll(); renderBlocks(); markDirty();
};
$("delChecked").onclick = () => {
  if (!checkedRuns.size) return;
  pushUndo();
  checkedRuns.forEach(start => {
    const r = runs().find(x => x.start === start);
    if (r) r.ids.forEach(id => { delete cells[id]; });
    delete labels[start];
  });
  checkedRuns.clear();
  paintAll(); renderBlocks(); markDirty();
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
      try { c.setPointerCapture(e.pointerId); } catch (_) {}
      pushUndo();
      const id = c.dataset.id;
      // tap toggles; drag paints (decided on first move)
      dragActive = true; dragMoved = false;
      dragErase = cells[id] === curColor;
      if (dragErase) delete cells[id];
      else cells[id] = curColor;
      paintCell(c);
      markDirty(); renderBlocks();
    });
    c.addEventListener("pointermove", (e) => {
      if (!dragActive) return;
      if (e.buttons === 0 && e.pointerType === "mouse") return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const t = el && el.closest ? el.closest(".cell") : null;
      if (!t || t === lastDragCell) return;
      lastDragCell = t;
      dragMoved = true;
      const tid = t.dataset.id;
      if (dragErase) { if (cells[tid] === curColor) delete cells[tid]; }
      else if (cells[tid] !== curColor) cells[tid] = curColor;
      paintCell(t);
      markDirty(); renderBlocks();
    });
    grid.appendChild(c);
  }
  row.appendChild(grid);
  tt.appendChild(row);
});
let dragActive = false, dragMoved = false, dragErase = false, lastDragCell = null;
document.addEventListener("pointerup", () => {
  if (painting || erasing) { markDirty(); renderBlocks(); }
  painting = false; erasing = false;
  dragActive = false; lastDragCell = null;
});

function toggleCell(c, drag) {
  const id = c.dataset.id;
  const v = cells[id];
  if (!drag) {
    pushUndo();
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
function renderAllDay(list) {
  let box = $("alldayBox");
  if (!box) {
    box = document.createElement("div");
    box.id = "alldayBox";
    $("blocks").parentElement.insertBefore(box, $("blocks"));
  }
  box.innerHTML = "";
  if (!list.length) { box.style.display = "none"; return; }
  box.style.display = "block";
  const h = document.createElement("p");
  h.className = "hint";
  h.textContent = "종일";
  box.appendChild(h);
  list.forEach(ev => {
    const l = document.createElement("div");
    l.className = "todo-check";
    const dot = document.createElement("span");
    dot.className = "dot " + calColor(ev);
    const sp = document.createElement("span");
    sp.className = "txt";
    sp.textContent = calTitle(ev.title);
    l.append(dot, sp);
    box.appendChild(l);
  });
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
const CNAMES = { work: "일", lunch: "점심", promise: "약속", personal: "나", family: "가족", obok: "오복", sleep: "수면" };
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
  // category totals (10min cells → hours)
  const totals = {};
  Object.values(cells).forEach(c => { totals[c] = (totals[c] || 0) + 1; });
  const tEl = $("ttTotals");
  if (tEl) {
    const parts = Object.keys(totals).sort().map(k => `${CNAMES[k] || k} ${(totals[k] / 6).toFixed(1)}h`);
    tEl.textContent = parts.length ? parts.join(" · ") : "비어 있음";
  }
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
    let memoUndo = false;
    inp.oninput = () => {
      if (!memoUndo) { pushUndo(); memoUndo = true; }
      if (inp.value) labels[r.start] = inp.value;
      else delete labels[r.start];
      markDirty(); paintOverlays(runs());
    };
    inp.onblur = () => { memoUndo = false; };
    row.append(cb, dot, range, inp);
    box.appendChild(row);
  });
}

// --- iCloud calendar + reminders ---
const CALMAP = [
  [/\[업무\]|\[work\]/i, "work"],
  [/\[약속\]|\[meet\]/i, "promise"],
  [/\[개인\]|\[me\]/i, "personal"],
  [/\[가족\]/, "family"],
  [/\[오복\]/, "obok"],
  [/\[수면\]|\[sleep\]/i, "sleep"],
];
function calColor(ev) {
  const cal = ev.cal || "";
  if (/정현/.test(cal)) return "personal";
  if (/하트|[❤♥💜💛💚💙]/.test(cal)) return "promise";
  if (/식물/.test(cal)) return "personal";
  if (/업무/.test(cal)) return "work";
  if (/기록/.test(cal)) return "sleep";
  if (/공부/.test(cal)) return "work";
  for (const [re, c] of CALMAP) if (re.test(ev.title)) return c;
  return "promise";
}
function calTitle(title) {
  return title.replace(/^\[[^\]]+\]\s*/, "").trim() || title;
}
function slotsFor(startMin, endMin) {
  const out = [];
  let t = Math.floor(startMin / 10) * 10;
  const e = Math.min(1440, Math.max(t + 10, endMin));
  while (t < e) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
    t += 10;
  }
  return out;
}
async function invokeCal(body) {
  const call = async () => {
    const r = await Auth.sb.functions.invoke("calendar-sync", { body });
    if (r.error) {
      let status = 0;
      try { status = r.error.context ? r.error.context.status : 0; } catch (_) {}
      const err = new Error(r.error.message || "failed");
      err.status = status;
      throw err;
    }
    return r.data;
  };
  try {
    return await call();
  } catch (e) {
    if (e.status !== 401) throw e;
    try { await Auth.sb.auth.refreshSession(); } catch (_) {}
    try {
      return await call();
    } catch (e2) {
      if (e2.status === 401) Auth.logout();
      throw e2;
    }
  }
}
window.pullCalendar = async function () {
  const st = null;
  const say = () => {};
  if (!window.Auth || !Auth.sb) { say(""); return; }
  let session = null;
  try { session = await Auth.session(); } catch (e) { say(""); return; }
  if (!session) { say(""); return; }
  let res = null;
  try {
    res = await invokeCal({ date });
  } catch (e) { say(""); return; }
  if (!res || res.error || !Array.isArray(res.events)) { say(""); return; }
  lastMonthPulled = "";
  const dayEvents = res.events;
  // clear previous auto-fill
  const prev = load(date).autoCal || {};
  Object.keys(prev).forEach(id => { if (cells[id] === prev[id]) delete cells[id]; });
  const autoCal = {};
  const autoLabels = {};
  const allDay = [];
  dayEvents.forEach(ev => {
    if (/식물/.test(ev.cal || "")) return;
    if (ev.allDay) { allDay.push(ev); return; }
    const color = calColor(ev);
    const memo = calTitle(ev.title);
    const ids = slotsFor(ev.start, ev.end).filter(id => !cells[id]);
    ids.forEach(id => { cells[id] = color; autoCal[id] = color; });
    if (ids.length && memo && !labels[ids[0]]) { labels[ids[0]] = memo; autoLabels[ids[0]] = memo; }
  });
  const s = load(date);
  s.autoCal = autoCal;
  s.autoLabels = autoLabels;
  s.allDay = allDay.map(e => ({ title: calTitle(e.title), cal: e.cal }));
  Store.set("d:" + date, s);
  if (isDirty()) drafts[date] = draftData();
  paintAll(); renderBlocks();
  renderReminders(res.todos || []);
  renderAllDay(allDay);
  autoMonth();
};
let lastMonthPulled = "";
let monthCache = null;
function renderMonthCals(events, ym) {
  const box = $("monthCals");
  box.innerHTML = "";
  const WD = ["일", "월", "화", "수", "목", "금", "토"];
  const items = events
    .filter(ev => ev.day && ev.day.slice(0, 7) === ym)
    .sort((a, b) => (a.day + String(a.start).padStart(4, "0")) < (b.day + String(b.start).padStart(4, "0")) ? -1 : 1);
  if (!items.length) { box.innerHTML = "<p class='hint'>일정 없음</p>"; return; }
  const p = document.createElement("p");
  p.className = "mlist";
  const today = Store.today();
  items.forEach((ev, i) => {
    const d = new Date(ev.day + "T12:00:00");
    const wk = WD[d.getDay()];
    const s = document.createElement("span");
    s.className = "ml" + (ev.day < today ? " past" : "");
    s.textContent = `${d.getDate()}${wk} ${calTitle(ev.title)}`;
    p.appendChild(s);
    if (i < items.length - 1) {
      const sep = document.createElement("i");
      sep.textContent = "·";
      p.appendChild(sep);
    }
  });
  box.appendChild(p);
  box.style.opacity = "0.75";
}
function renderReminders(list) {
  const box = $("remsBox");
  box.innerHTML = "";
  if (!list.length) return;
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "리마인더";
  box.appendChild(hint);
  list.slice(0, 20).forEach(t => {
    const l = document.createElement("div");
    l.className = "todo-check";
    const s = document.createElement("span");
    s.className = "txt";
    s.textContent = t.title + (t.due ? ` (${t.due.slice(0, 10)})` : "");
    const add = document.createElement("button");
    add.textContent = "+ 할 일";
    add.onclick = () => {
      todos.push({ id: uid(), t: t.title, done: false });
      save(); renderTodos();
    };
    l.append(s, add);
    box.appendChild(l);
  });
}

// --- habits rate ---;
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
    const migrated = Store.get("habit-en-v1");
    const strip = (t) => String(t || "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, "").trim();
    const map = { "환기하기": "Ventilate", "이불 정리": "Make bed", "공복 물 한잔": "Water", "체중 기록": "Weigh in", "Sleep Journal": "Sleep log", "Daily Plan": "Daily plan", "식후 독서·양치": "Read & brush", "영양제 먹기": "Vitamins", "운동": "Workout", "화장실": "Bathroom", "오복 산책": "Walk Obok", "기록": "Log", "필사": "Transcribe", "물 마시기": "Water", "독서 10분": "Read 10m" };
    habitDefs.forEach(h => {
      if (!h.slot) { h.slot = "anytime"; changed = true; }
      if (!migrated) {
        const s = strip(h.t), c = map[s] || s;
        if (c !== h.t) { h.t = c; changed = true; }
      }
    });
    if (!migrated) Store.set("habit-en-v1", true);
    if (changed) setDefs(habitDefs);
  }
}
function renderHabitRate() {
  const el = $("habitRate");
  if (el) {
    const rate = habitDefs.length
      ? Math.round(100 * habitDefs.filter(h => habitDone[h.id]).length / habitDefs.length) : 0;
    el.textContent = `${rate}% →`;
  }
  renderTodayHabits();
}
function renderTodayHabits() {
  const box = $("todayHabits");
  if (!box) return;
  box.innerHTML = "";
  if (!habitDefs.length) { box.innerHTML = "<p class='hint'>습관 없음</p>"; return; }
  habitDefs.forEach(def => {
    const b = document.createElement("button");
    b.className = "pill" + (habitDone[def.id] ? " done" : "");
    b.textContent = def.t;
    b.onclick = () => {
      habitDone[def.id] = !habitDone[def.id];
      if (!habitDone[def.id]) delete habitDone[def.id];
      markDirty(); renderTodayHabits(); renderHabitRate();
    };
    box.appendChild(b);
  });
}
// --- carry-over: yesterday's unfinished todos → today (once per day + manual) ---
function carryOver(manual) {
  const y = new Date(date + "T12:00:00"); y.setDate(y.getDate() - 1);
  const yds = Store.day(y);
  const ys = load(yds);
  const undone = (ys.todos || []).filter(t => t && t.t && !t.done).map(t => t.t.trim()).filter(Boolean);
  if (!undone.length) { if (manual) alert("어제 미완료 할 일이 없어요."); return; }
  const flag = "carried:" + date;
  if (!manual && Store.get(flag)) return;
  const seen = new Set(todos.map(t => (t.t || "").trim()));
  let added = 0;
  undone.forEach(t => { if (!seen.has(t)) { todos.push({ id: uid(), t, done: false }); seen.add(t); added++; } });
  if (added) { markDirty(); renderTodos(); }
  try { Store.set(flag, true); } catch (_) {}
  if (manual && !added) alert("이미 가져왔어요.");
}
// --- routine template (explicit; replaces the old silent auto-fill) ---
function applyRoutine() {
  pushUndo();
  for (let t = 9 * 60 + 30; t < 17 * 60 + 30; t += 10) {
    const h = Math.floor(t / 60), m = t % 60;
    const id = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    if (!cells[id]) cells[id] = (id >= "11:40" && id < "13:00") ? "lunch" : "work";
  }
  paintAll(); renderBlocks(); markDirty();
}
function paintWorkfillBtn() {
  const b = $("workfillBtn");
  if (b) b.textContent = `평일 자동채움 ${isWorkfillOn() ? "켬" : "끔"}`;
}

// --- photo moved to Night page ---

["weight", "sleepH"].forEach(id => $(id).addEventListener("input", markDirty));
// date switching never writes — drafts stay in memory until Save is pressed
picker.onchange = () => { date = picker.value; apply(date); if (window.pullCalendar) pullCalendar(); };
$("goYest").onclick = () => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  date = yestStr(); picker.value = date; apply(date); if (window.pullCalendar) pullCalendar();
};
$("goToday").onclick = () => { date = todayStr(); picker.value = date; apply(date); if (window.pullCalendar) pullCalendar(); };
if ($("carryBtn")) $("carryBtn").onclick = () => carryOver(true);
if ($("routineBtn")) $("routineBtn").onclick = () => { if (confirm("평일 루틴(09:30–17:30)을 빈 칸에 채울까요?")) applyRoutine(); };
if ($("workfillBtn")) $("workfillBtn").onclick = () => {
  try { Store.set("auto-workfill", !isWorkfillOn()); } catch (_) {}
  paintWorkfillBtn();
};
window.addEventListener("beforeunload", (e) => {
  if (!isDirty()) return;
  e.preventDefault();
  e.returnValue = "";
});

// --- realtime sync: refresh when cloud data changes ---
let pendingTodoSync = false;
if (window.Auth && Auth.onCloudChange) {
  Auth.onCloudChange((key) => {
    const curD = "d:" + date;
    const curM = "month:" + date.slice(0, 7);
    if (key !== curD && key !== curM) return;
    const active = document.activeElement;
    const editingTodo = !!(active && active.classList && active.classList.contains("todo-edit"));
    const focusInTodos = !!($("todos") && $("todos").contains(active));
    const focusInMonth = !!($("monthTodos") && $("monthTodos").contains(active));
    const editingDump = !!(active && active.id === "braindump");
    // Never destroy focused inputs: cloud value is already in
    // localStorage, so it will be picked up on the next render/save.
    // Rendering todos while the user types recreates the <input> and
    // causes flicker/shake + lost keystrokes. So: apply everything that
    // is NOT focused now, and defer the todo-list re-render until blur.
    // The draft always wins: never let a cloud echo clobber unsaved edits.
    if (isDirty()) return;
    const s = merged(date);
    if (s.cells) { cells = s.cells; paintAll(); renderBlocks(); }
    if (s.labels) labels = s.labels;
    if (!editingDump && s.braindump !== undefined && $("braindump").value !== s.braindump) {
      $("braindump").value = s.braindump;
      if (typeof resizeBraindump === "function") resizeBraindump();
    }
    if (document.activeElement !== $("lastSleep") && s.lastSleep !== undefined) $("lastSleep").value = s.lastSleep || "";
    if (document.activeElement !== $("wake") && s.wake !== undefined) $("wake").value = s.wake || "";
    if (document.activeElement !== $("weight") && s.weight !== undefined) $("weight").value = s.weight || "";
    if (editingTodo || focusInTodos || focusInMonth) {
      pendingTodoSync = true;
      return;
    }
    if (s.todos !== undefined) {
      const fresh = cleanTodos(s.todos);
      todos.length = 0;
      fresh.forEach(t => todos.push(t));
    }
    const freshM = cleanTodos(Store.get(monthKey(date)));
    monthTodos.length = 0;
    freshM.forEach(t => monthTodos.push(t));
    renderTodos(); renderMonthTodos();
    paintSaveBar();
  });
  // Deferred todo refresh: apply the pending cloud todos once the user leaves the input.
  document.addEventListener("focusout", (e) => {
    if (!pendingTodoSync) return;
    if (e.target && e.target.classList && e.target.classList.contains("todo-edit")) {
      setTimeout(() => {
        if (document.activeElement && document.activeElement.classList &&
            document.activeElement.classList.contains("todo-edit")) return;
        pendingTodoSync = false;
        const s = load(date);
        if (s.todos !== undefined) {
          const fresh = cleanTodos(s.todos);
          todos.length = 0;
          fresh.forEach(t => todos.push(t));
        }
        const freshM = cleanTodos(Store.get(monthKey(date)));
        monthTodos.length = 0;
        freshM.forEach(t => monthTodos.push(t));
        renderTodos(); renderMonthTodos();
        paintSaveBar();
      }, 300);
    }
  });
}

apply(date);
// Auth switches Store.profile (me → shared id) async; re-apply so the
// timetable/habits/todos reload under the synced profile.
window.refreshToday = () => apply(date);
