const $ = (id) => document.getElementById(id);
const picker = $("datePicker");
const todayStr = () => Store.today();
let date = todayStr();
picker.value = date;
let calYM = date.slice(0, 7);

function load(d) {
  return Store.get("d:" + d, "ownmything:" + d) || {};
}

// --- explicit save: the one-liner stays in memory until Save is pressed ---
const DKEY = "omt:night-draft";
const drafts = (function () {
  try { return JSON.parse(sessionStorage.getItem(DKEY)) || {}; } catch (e) { return {}; }
})();
function stash() {
  try {
    if (Object.keys(drafts).length) sessionStorage.setItem(DKEY, JSON.stringify(drafts));
    else sessionStorage.removeItem(DKEY);
  } catch (e) {}
}
function isDirty() { return Object.keys(drafts).length > 0; }
function markDirty() { drafts[date] = $("oneline").value; stash(); paintSaveBar(); }
function paintSaveBar() {
  const n = isDirty();
  const b = $("saveState");
  if (b) { b.textContent = n ? "저장 전" : "저장됨"; b.classList.toggle("warn", n); }
  const s = $("saveBtn");
  if (s) s.style.opacity = n ? "1" : "0.45";
  const r = $("revertBtn");
  if (r) r.style.display = n ? "inline-block" : "none";
}
function commit() {
  Object.keys(drafts).forEach(k => {
    const s = load(k);
    s.oneline = drafts[k];
    Store.set("d:" + k, s);
  });
  Object.keys(drafts).forEach(k => delete drafts[k]);
  stash();
  paintSaveBar();
  renderCal();
}
function revert() {
  if (!isDirty()) return;
  if (!confirm("저장하지 않은 내용을 되돌릴까요?")) return;
  Object.keys(drafts).forEach(k => delete drafts[k]);
  stash();
  apply(date);
}
$("saveBtn").onclick = () => { if (!isDirty()) return; commit(); };
$("revertBtn").onclick = () => revert();
window.addEventListener("beforeunload", (e) => {
  if (!isDirty()) return;
  e.preventDefault(); e.returnValue = "";
});

function hasEntry(d) {
  const s = load(d);
  const o = drafts[d];
  return !!(o !== undefined ? o : s.oneline) || !!s.photo;
}
function apply(d) {
  const s = load(d);
  const o = drafts[d];
  $("oneline").value = o !== undefined ? o : (s.oneline || "");
  $("photoPrev").src = s.photo || "";
  $("photoPrev").style.display = s.photo ? "" : "none";
  $("headDate").textContent = d;
  $("goToday").href = `../today.html?date=${d}`;
  paintSaveBar();
}
// photo is an explicit pick/confirm action, so it persists right away
function savePhoto() {
  const s = load(date);
  const attr = $("photoPrev").getAttribute("src") || "";
  s.photo = attr.startsWith("data:") ? attr : "";
  Store.set("d:" + date, s);
  $("photoPrev").style.display = s.photo ? "" : "none";
  renderCal();
}
$("photo").onchange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => { $("photoPrev").src = r.result; savePhoto(); };
  r.readAsDataURL(f);
};
$("delPhoto").onclick = () => {
  if (!$("photoPrev").getAttribute("src")) return;
  if (!confirm("사진을 지울까요?")) return;
  $("photoPrev").setAttribute("src", "");
  $("photo").value = "";
  savePhoto();
};
$("oneline").addEventListener("input", markDirty);
$("oneline").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); if (isDirty()) commit(); $("oneline").blur(); }
});
picker.onchange = () => { date = picker.value; calYM = date.slice(0, 7); apply(date); renderCal(); };

// --- calendar ---
const MN = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
function renderCal() {
  const [y, m] = calYM.split("-").map(Number);
  $("calLabel").textContent = `${y}년 ${MN[m - 1]}`;
  const box = $("cal");
  box.innerHTML = "";
  ["일","월","화","수","목","금","토"].forEach(d => {
    const h = document.createElement("span");
    h.className = "cal-h";
    h.textContent = d;
    box.appendChild(h);
  });
  const first = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  for (let i = 0; i < first; i++) box.appendChild(document.createElement("span"));
  for (let d = 1; d <= days; d++) {
    const ds = `${calYM}-${String(d).padStart(2, "0")}`;
    const c = document.createElement("button");
    c.className = "cal-day" + (hasEntry(ds) ? " has" : "") + (ds === date ? " cur" : "");
    c.textContent = d;
    c.onmouseenter = (e) => showTip(e, ds);
    c.onmouseleave = hideTip;
    c.onclick = () => { date = ds; picker.value = ds; apply(ds); renderCal(); };
    box.appendChild(c);
  }
}
function showTip(e, ds) {
  const s = load(ds);
  const line = drafts[ds] !== undefined ? drafts[ds] : s.oneline;
  if (!line && !s.photo) return;
  const tip = $("calTip");
  tip.innerHTML = "";
  if (s.photo) {
    const img = document.createElement("img");
    img.src = s.photo;
    tip.appendChild(img);
  }
  if (line) {
    const p = document.createElement("p");
    p.textContent = line;
    tip.appendChild(p);
  }
  tip.style.display = "block";
  const r = e.target.getBoundingClientRect();
  tip.style.left = Math.min(window.innerWidth - 190, r.left + window.scrollX) + "px";
  tip.style.top = (r.bottom + window.scrollY + 6) + "px";
}
function hideTip() { $("calTip").style.display = "none"; }
$("calPrev").onclick = () => {
  const [y, m] = calYM.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  calYM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  renderCal();
};
$("calNext").onclick = () => {
  const [y, m] = calYM.split("-").map(Number);
  const d = new Date(y, m, 1);
  calYM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  renderCal();
};
$("goTodayDate").onclick = () => {
  date = Store.today();
  picker.value = date;
  calYM = date.slice(0, 7);
  apply(date); renderCal();
};

apply(date);
renderCal();
