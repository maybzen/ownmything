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
const YO = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
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
    s2.textContent = " · Holiday";
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
  if (!s.todos && !todos.length) todos = [{ id: uid(), div: true }, { id: uid(), div: true }];
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
function todoRow(item, list, render, box) {
  const l = document.createElement("div");
  l.className = "todo-check";
  l.dataset.id = item.id;
  if (item.div) {
    l.classList.add("divider");
    const grip = document.createElement("span");
    grip.className = "grip";
    grip.textContent = "⋮⋮";
    const line = document.createElement("span");
    line.className = "divline";
    const del = document.createElement("button");
    del.textContent = "×";
    del.onclick = () => { list.splice(list.indexOf(item), 1); save(); render(); };
    l.append(grip, line, del);
    bindGrip(grip, l, box, list);
    return l;
  }
  const cb = document.createElement("input");
  cb.type = "checkbox"; cb.checked = !!item.done;
  cb.onchange = () => { item.done = cb.checked; save(); render(); };
  const grip0 = document.createElement("span");
  grip0.className = "grip";
  grip0.textContent = "⋮⋮";
  l.append(grip0, cb);
  bindGrip(grip0, l, box, list);
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
    s.className = "txt" + (item.done ? " done" : "");
    s.onclick = () => { item.editing = true; render(); };
    const del = document.createElement("button");
    del.textContent = "×";
    del.onclick = () => { list.splice(list.indexOf(item), 1); save(); render(); };
    l.append(s, del);
  }
  return l;
}
function bindGrip(grip, row, box, list) {
  grip.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    row.classList.add("dragging");
    const move = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const over = el ? el.closest(".todo-check") : null;
      if (over && over !== row && over.parentElement === box) {
        const r = over.getBoundingClientRect();
        const after = (ev.clientY - r.top) > r.height / 2;
        box.insertBefore(row, after ? over.nextSibling : over);
      }
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      row.classList.remove("dragging");
      const order = Array.from(box.children).map(c => c.dataset.id);
      list.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      save();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  });
}
function renderTodos() {
  const box = $("todos");
  box.innerHTML = "";
  todos.forEach(t => box.appendChild(todoRow(t, todos, renderTodos, box)));
}
function renderMonthTodos() {
  const box = $("monthTodos");
  box.innerHTML = "";
  monthTodos.forEach(t => box.appendChild(todoRow(t, monthTodos, renderMonthTodos, box)));
}
$("addTodo").onclick = () => { todos.push({ id: uid(), t: "", done: false, editing: true }); renderTodos(); };
$("addMonthTodo").onclick = () => { monthTodos.push({ id: uid(), t: "", done: false, editing: true }); renderMonthTodos(); };
$("loadMonthCal").onclick = async () => {
  const box = $("monthCals");
  box.innerHTML = "<p class='hint'>Loading…</p>";
  try {
    const data = await invokeCal({ month: ym, onlyMe: true });
    if (!data || data.error) throw new Error((data && data.error) || "failed");
    renderMonthCals(data.events || [], ym);
  } catch (e) { box.innerHTML = "<p class='hint'>Load failed</p>"; }
};
$("addDiv").onclick = () => { todos.push({ id: uid(), div: true }); save(); renderTodos(); };

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
      const id = c.dataset.id;
      if (cells[id] === curColor) delete cells[id];
      else cells[id] = curColor;
      paintCell(c);
      save(); renderBlocks();
    });
    grid.appendChild(c);
  }
  row.appendChild(grid);
  tt.appendChild(row);
});
document.addEventListener("pointerup", () => { painting = false; erasing = false; });

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
  h.textContent = "All day";
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
const CNAMES = { work: "Work", promise: "Meet", personal: "Me", family: "Family", obok: "Obok", sleep: "Record" };
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
  const st = $("calStatus");
  if (st) st.textContent = "Syncing…";
  if (!window.Auth || !Auth.sb) { if (st) st.textContent = "Sync off"; return; }
  let session = null;
  try { session = await Auth.session(); } catch (e) { if (st) st.textContent = "Sync failed (session)"; return; }
  if (!session) { if (st) st.textContent = "Sync off"; return; }
  const ym = date.slice(0, 7);
  let res = null;
  try {
    res = await invokeCal({ date });
  } catch (e) { if (st) st.textContent = "Sync failed (network)"; return; }
  if (!res || res.error || !Array.isArray(res.events)) { if (st) st.textContent = "Sync failed: " + (res ? res.error : "?"); return; }
  lastMonthPulled = "";
  const dayEvents = res.events;
  // clear previous auto-fill
  const prev = load(date).autoCal || {};
  Object.keys(prev).forEach(id => { if (cells[id] === prev[id]) delete cells[id]; });
  const autoCal = {};
  const allDay = [];
  dayEvents.forEach(ev => {
    if (/식물/.test(ev.cal || "")) return;
    if (ev.allDay) { allDay.push(ev); return; }
    const color = calColor(ev);
    const memo = calTitle(ev.title);
    const ids = slotsFor(ev.start, ev.end).filter(id => !cells[id]);
    ids.forEach(id => { cells[id] = color; autoCal[id] = color; });
    if (ids.length && memo && !labels[ids[0]]) labels[ids[0]] = memo;
  });
  const s = load(date);
  s.autoCal = autoCal;
  s.allDay = allDay.map(e => ({ title: calTitle(e.title), cal: e.cal }));
  Store.set("d:" + date, s);
  paintAll(); renderBlocks(); save();
  const n = dayEvents.length;
  if (st) {
    const tag = res.cached ? "Cached" : "Synced";
    st.textContent = `${date} · ${tag} · ${n} events`;
  }
  renderReminders(res.todos || []);
  renderAllDay(allDay);
};
let lastMonthPulled = "";
let monthCache = null;
function renderMonthCals(events, ym) {
  const box = $("monthCals");
  box.innerHTML = "";
  const items = events
    .filter(ev => ev.day && ev.day.slice(0, 7) === ym)
    .sort((a, b) => (a.day + String(a.start).padStart(4, "0")) < (b.day + String(b.start).padStart(4, "0")) ? -1 : 1);
  if (!items.length) { box.innerHTML = "<p class='hint'>No events</p>"; return; }
  let lastDay = "";
  items.forEach(ev => {
    if (ev.day !== lastDay) {
      lastDay = ev.day;
      const dh = document.createElement("p");
      dh.className = "hint";
      dh.textContent = ev.day.slice(5);
      box.appendChild(dh);
    }
    const l = document.createElement("div");
    l.className = "todo-check";
    const dot = document.createElement("span");
    dot.className = "dot " + calColor(ev);
    const s = document.createElement("span");
    s.className = "txt";
    const hh = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    s.textContent = ev.allDay ? ev.title : `${hh(ev.start)} ${calTitle(ev.title)}`;
    l.append(dot, s);
    box.appendChild(l);
  });
}
function renderReminders(list) {
  const box = $("remsBox");
  box.innerHTML = "";
  if (!list.length) return;
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "Reminders";
  box.appendChild(hint);
  list.slice(0, 20).forEach(t => {
    const l = document.createElement("div");
    l.className = "todo-check";
    const s = document.createElement("span");
    s.className = "txt";
    s.textContent = t.title + (t.due ? ` (${t.due.slice(0, 10)})` : "");
    const add = document.createElement("button");
    add.textContent = "+ To Do";
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
  if (!el) return;
  const rate = habitDefs.length
    ? Math.round(100 * habitDefs.filter(h => habitDone[h.id]).length / habitDefs.length) : 0;
  el.textContent = `${rate}% →`;
}

// --- photo moved to Night page ---

["weight", "sleepH", "braindump"].forEach(id => $(id).addEventListener("input", save));
picker.onchange = () => { save(); date = picker.value; apply(date); if (window.pullCalendar) pullCalendar(); };
$("goToday").onclick = () => { save(); date = todayStr(); picker.value = date; apply(date); if (window.pullCalendar) pullCalendar(); };
$("goToday").onclick = () => { save(); date = todayStr(); picker.value = date; apply(date); };

apply(date);
