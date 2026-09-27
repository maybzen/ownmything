const $ = (id) => document.getElementById(id);
const DEFS_KEY = "habit-defs";
const LEGACY_DEFS = "ownmything:habit-defs";
const fmt = (d) => d.toISOString().slice(0, 10);
const todayDs = fmt(new Date());

function getDefs() {
  let d = Store.get(DEFS_KEY, LEGACY_DEFS) || [];
  if (!d.length) {
    d = [
      { id: "h-water", t: "공복 물 한잔", slot: "morning" },
      { id: "h-walk", t: "오복 산책", slot: "night" },
      { id: "h-read", t: "독서 10분", slot: "anytime" },
    ];
    Store.set(DEFS_KEY, d);
    return d;
  }
  let changed = false;
  d.forEach(x => { if (!x.slot) { x.slot = "anytime"; changed = true; } });
  if (changed) Store.set(DEFS_KEY, d);
  return d;
}
function setDefs(d) { Store.set(DEFS_KEY, d); }
function dayData(ds) {
  return Store.get("d:" + ds, "ownmything:" + ds) || {};
}
function isDone(ds, def) {
  const s = dayData(ds);
  if (s.habitDone && typeof s.habitDone[def.id] !== "undefined") return !!s.habitDone[def.id];
  if (Array.isArray(s.habits)) {
    const m = s.habits.find(h => h.t === def.t);
    if (m) return !!m.done;
  }
  return false;
}
function setDone(ds, def, v) {
  const s = dayData(ds);
  s.habitDone = s.habitDone || {};
  s.habitDone[def.id] = v;
  Store.set("d:" + ds, s);
}

const SLOTS = [["morning", "Morning"], ["anytime", "Anytime"], ["night", "Night"]];
function renderToday() {
  const box = $("todayCheck");
  box.innerHTML = "";
  const defs = getDefs();
  SLOTS.forEach(([slot, label]) => {
    const items = defs.filter(d => (d.slot || "anytime") === slot);
    if (!items.length) return;
    const col = document.createElement("div");
    col.className = "hcol";
    const h = document.createElement("h4");
    h.className = "slot-" + slot;
    h.textContent = label;
    col.appendChild(h);
    items.forEach(def => {
      const b = document.createElement("button");
      b.className = "pill" + (isDone(todayDs, def) ? " done" : "");
      b.textContent = def.t;
      b.onclick = () => { setDone(todayDs, def, !isDone(todayDs, def)); renderToday(); renderWeek(); renderMonth(); };
      col.appendChild(b);
    });
    box.appendChild(col);
  });
}

function renderDefs() {
  const box = $("defs");
  box.innerHTML = "";
  getDefs().forEach((h) => {
    const l = document.createElement("label");
    l.className = "habit";
    const sel = document.createElement("select");
    ["morning", "anytime", "night"].forEach(s => {
      const o = document.createElement("option");
      o.value = s; o.textContent = s === "morning" ? "Morning" : s === "anytime" ? "Anytime" : "Night";
      if ((h.slot || "anytime") === s) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => {
      const d = getDefs();
      const m = d.find(x => x.id === h.id);
      if (m) { m.slot = sel.value; setDefs(d); renderToday(); renderWeek(); }
    };
    const s = document.createElement("span");
    s.textContent = h.t;
    const b = document.createElement("button");
    b.textContent = "×";
    b.onclick = () => { setDefs(getDefs().filter(x => x.id !== h.id)); renderAll(); };
    l.append(sel, s, b);
    box.appendChild(l);
  });
}
$("addDef").onclick = () => {
  const v = $("newDef").value.trim();
  if (!v) return;
  const d = getDefs();
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
  const defs = getDefs(), days = last7();
  $("weekLabel").textContent = `${days[0]} ~ ${days[6]}`;
  const t = $("weekTable");
  t.innerHTML = "";
  const head = document.createElement("div");
  head.className = "hrow hhead";
  head.innerHTML = `<span></span>` + days.map(d => `<span>${d.slice(5)}</span>`).join("") + `<span>달성</span>`;
  t.appendChild(head);
  [["morning", "Morning"], ["anytime", "Anytime"], ["night", "Night"]].forEach(([slot, label]) => {
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
  $("weekRates").textContent = defs.length ? `주간 전체 ${Math.round(100 * hit / total)}% (${hit}/${total})` : "해빗을 추가해줘";
}

function renderMonth() {
  const defs = getDefs();
  const mv = $("monthPicker").value || fmt(new Date()).slice(0, 7);
  $("monthPicker").value = mv;
  $("monthLabel").textContent = mv;
  const [y, m] = mv.split("-").map(Number);
  const daysIn = new Date(y, m, 0).getDate();
  const box = $("monthRates");
  box.innerHTML = "";
  defs.forEach(def => {
    let hit = 0;
    for (let d = 1; d <= daysIn; d++) {
      const ds = `${mv}-${String(d).padStart(2, "0")}`;
      if (isDone(ds, def)) hit++;
    }
    const rate = Math.round(100 * hit / daysIn);
    const p = document.createElement("p");
    p.textContent = `${def.t} — ${rate}% (${hit}/${daysIn})`;
    box.appendChild(p);
  });
}
$("monthPicker").onchange = renderMonth;

function renderAll() { renderToday(); renderDefs(); renderWeek(); renderMonth(); }
renderAll();
