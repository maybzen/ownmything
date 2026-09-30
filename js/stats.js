const $ = (id) => document.getElementById(id);

function series(days) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = Store.day(d);
    out.push({ ds, w: parseFloat(Store.get("d:" + ds, "ownmything:" + ds)?.weight), h: parseFloat(Store.get("d:" + ds, "ownmything:" + ds)?.sleepH) });
  }
  return out;
}

function renderWeight() {
  const s = series(60);
  const pts = s.filter(p => !isNaN(p.w));
  const goal = parseFloat(Store.get("goal-weight", ""));
  const sum = pts.length ? pts[pts.length - 1] : null;
  $("wSummary").textContent = sum
    ? `최근 ${sum.w} kg${goal ? ` · 목표 ${goal} kg (${(sum.w - goal).toFixed(1)})` : ""} · ${pts.length}건`
    : "체중 기록 없음";
  const svg = $("chart");
  svg.innerHTML = "";
  if (pts.length < 2) return;
  const ws = pts.map(p => p.w);
  const min = Math.min(...ws, goal || Infinity) - 0.5;
  const max = Math.max(...ws, goal || -Infinity) + 0.5;
  const W = 320, H = 140, pad = 20;
  const x = (i) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const y = (v) => H - pad - ((v - min) / (max - min)) * (H - pad * 2);
  if (goal && goal >= min && goal <= max) {
    const ly = y(goal);
    const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
    ln.setAttribute("x1", pad); ln.setAttribute("x2", W - pad);
    ln.setAttribute("y1", ly); ln.setAttribute("y2", ly);
    ln.setAttribute("stroke", "#a0a4af"); ln.setAttribute("stroke-dasharray", "3 3");
    svg.appendChild(ln);
  }
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pts.map((p, i) => (i ? "L" : "M") + x(i) + " " + y(p.w)).join(" "));
  path.setAttribute("fill", "none"); path.setAttribute("stroke", "#121316"); path.setAttribute("stroke-width", "1.5");
  svg.appendChild(path);
  pts.forEach((p, i) => {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", x(i)); c.setAttribute("cy", y(p.w)); c.setAttribute("r", "2");
    c.setAttribute("fill", "#121316");
    const t = document.createElementNS("http://www.w3.org/2000/svg", "title");
    t.textContent = `${p.ds} · ${p.w}kg`;
    c.appendChild(t);
    svg.appendChild(c);
  });
}

function renderSleep() {
  const s = series(14);
  const pts = s.filter(p => !isNaN(p.h));
  const avg = pts.length ? (pts.reduce((a, p) => a + p.h, 0) / pts.length).toFixed(1) : "-";
  $("sSummary").textContent = pts.length ? `평균 ${avg} h · 최근 14일` : "수면 기록 없음";
  const box = $("sleepBars");
  box.innerHTML = "";
  s.forEach(p => {
    const d = document.createElement("div");
    d.className = "bar-col";
    const fill = document.createElement("i");
    if (!isNaN(p.h)) {
      fill.style.height = Math.min(100, (p.h / 10) * 100) + "%";
      if (p.h >= 7) fill.className = "good";
      else if (p.h < 6) fill.className = "low";
      fill.title = `${p.ds} · ${p.h}h`;
    } else {
      fill.style.height = "2px";
    }
    const lab = document.createElement("span");
    lab.textContent = p.ds.slice(8);
    d.append(fill, lab);
    box.appendChild(d);
  });
}

renderWeight();
renderSleep();
window.refreshStats = () => { renderWeight(); renderSleep(); loadRec(); };

// --- record editor (moved here from Today: log once in the morning) ---
function recDay() { return ($("recDate") && $("recDate").value) || Store.today(); }
function recLoad(ds) { return Store.get("d:" + ds, "ownmything:" + ds) || {}; }
function loadRec() {
  const d = $("recDate");
  if (d && !d.value) d.value = Store.today();
  const s = recLoad(recDay());
  if ($("recSleep")) $("recSleep").value = s.lastSleep || "";
  if ($("recWake")) $("recWake").value = s.wake || "";
  if ($("recWeight")) $("recWeight").value = s.weight || "";
  if ($("recSleepH")) $("recSleepH").value = s.sleepH || "";
  paintRecState(false);
}
function paintRecState(dirty) {
  const b = $("recState");
  if (b) { b.textContent = dirty ? "저장 전" : "저장됨"; b.classList.toggle("warn", dirty); }
}
function recDirty() { paintRecState(true); }
function recAuto() {
  const toMin = (t) => {
    if (!t || !t.includes(":")) return null;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const s = toMin($("recSleep").value), w = toMin($("recWake").value);
  if (s === null || w === null) return;
  let diff = w - s;
  if (diff <= 0) diff += 24 * 60;
  $("recSleepH").value = (diff / 60).toFixed(1);
}
if ($("recDate")) $("recDate").onchange = loadRec;
["recSleep", "recWake", "recWeight", "recSleepH"].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener("input", () => {
    if (id === "recSleep" || id === "recWake") recAuto();
    recDirty();
  });
});
if ($("recSave")) $("recSave").onclick = () => {
  const ds = recDay();
  try {
    Store.set("d:" + ds, Object.assign({}, recLoad(ds), {
      lastSleep: $("recSleep").value, wake: $("recWake").value,
      weight: $("recWeight").value, sleepH: $("recSleepH").value,
    }));
  } catch (e) {
    alert("저장에 실패했어요. 사진이 너무 크면 Night에서 사진을 지워주세요.");
    return;
  }
  paintRecState(false);
  renderWeight(); renderSleep();
};
loadRec();
