const $ = (id) => document.getElementById(id);
const DEFS_KEY = "ownmything:habit-defs";
const dayKey = (d) => `ownmything:${d}`;
const fmt = (d) => d.toISOString().slice(0, 10);

function getDefs() {
  try {
    const d = JSON.parse(localStorage.getItem(DEFS_KEY)) || [];
    if (d.length) {
      let changed = false;
      d.forEach(x => { if (!x.slot) { x.slot = "anytime"; changed = true; } });
      if (changed) localStorage.setItem(DEFS_KEY, JSON.stringify(d));
      return d;
    }
  } catch {}
  const init = [
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
  localStorage.setItem(DEFS_KEY, JSON.stringify(init));
  return init;
}
function setDefs(d) { localStorage.setItem(DEFS_KEY, JSON.stringify(d)); }
function dayData(ds) {
  try { return JSON.parse(localStorage.getItem(dayKey(ds))) || {}; } catch { return {}; }
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
      if (m) { m.slot = sel.value; setDefs(d); renderWeek(); }
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

function renderAll() { renderDefs(); renderWeek(); renderMonth(); }
renderAll();
