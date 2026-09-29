const $ = (id) => document.getElementById(id);
const todayStr = (d) => Store.day(d || new Date());
const yestStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return Store.day(d); };
let date = todayStr();
let calYM = date.slice(0, 7);
function setDate(ds) { date = ds; calYM = ds.slice(0, 7); apply(ds); renderCal(); }

function load(d) {
  return Store.get("d:" + d, "ownmything:" + d) || {};
}

// --- explicit save: oneline + photo both stay pending until Save is pressed ---
const DKEY = "omt:night-draft";
const drafts = (function () {
  try { return JSON.parse(sessionStorage.getItem(DKEY)) || {}; } catch (e) { return {}; }
})();
// date -> dataUrl string (new/changed), "" (delete), undefined (no change).
// In-memory only: dataURLs are too big for sessionStorage.
const photoDraft = {};
function stash() {
  try {
    if (Object.keys(drafts).length) sessionStorage.setItem(DKEY, JSON.stringify(drafts));
    else sessionStorage.removeItem(DKEY);
  } catch (e) {}
}
function isDirty() { return Object.keys(drafts).length > 0 || Object.keys(photoDraft).length > 0; }
function markDirty() { drafts[date] = $("oneline").value; stash(); paintSaveBar(); }
function markPhotoDirty() { stash(); paintSaveBar(); }
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
  try {
    const keys = new Set([...Object.keys(drafts), ...Object.keys(photoDraft)]);
    keys.forEach(k => {
      const s = load(k); // load first so timetable etc. are preserved
      if (drafts[k] !== undefined) s.oneline = drafts[k];
      if (photoDraft[k] !== undefined) s.photo = photoDraft[k];
      Store.set("d:" + k, s);
    });
  } catch (e) {
    alert("저장에 실패했어요. 사진이 너무 크면 사진을 지우고 다시 시도해주세요.");
    return;
  }
  Object.keys(drafts).forEach(k => delete drafts[k]);
  Object.keys(photoDraft).forEach(k => delete photoDraft[k]);
  stash();
  paintSaveBar();
  apply(date);
  renderCal();
}
function revert() {
  if (!isDirty()) return;
  if (!confirm("저장하지 않은 내용을 되돌릴까요?")) return;
  Object.keys(drafts).forEach(k => delete drafts[k]);
  Object.keys(photoDraft).forEach(k => delete photoDraft[k]);
  stash();
  apply(date);
}
$("saveBtn").onclick = () => { if (!isDirty()) return; commit(); };
$("revertBtn").onclick = () => revert();
window.addEventListener("beforeunload", (e) => {
  if (!isDirty()) return;
  e.preventDefault(); e.returnValue = "";
});

function curPhoto(d) {
  if (photoDraft[d] !== undefined) return photoDraft[d];
  return load(d).photo || "";
}
function hasEntry(d) {
  const s = load(d);
  const o = drafts[d];
  return !!(o !== undefined ? o : s.oneline) || !!curPhoto(d);
}
function apply(d) {
  const s = load(d);
  const o = drafts[d];
  $("oneline").value = o !== undefined ? o : (s.oneline || "");
  const ph = curPhoto(d);
  $("photoPrev").src = ph || "";
  $("photoPrev").style.display = ph ? "" : "none";
  $("photo").value = "";
  $("headDate").textContent = d;
  $("goToday").href = `../today.html?date=${d}`;
  paintSaveBar();
}
// photo is pending until Save, same as oneline. pickDate is captured so a
// slow compress can't leak the image into another date.
$("photo").onchange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const pickDate = date;
  fileToPhotoDataUrl(f).then((dataUrl) => {
    photoDraft[pickDate] = dataUrl;
    if (pickDate === date) {
      $("photoPrev").src = dataUrl;
      $("photoPrev").style.display = dataUrl ? "" : "none";
    }
    markPhotoDirty();
    renderCal();
  }).catch(() => alert("사진을 읽지 못했어요."));
};
$("delPhoto").onclick = () => {
  if (!curPhoto(date)) return;
  if (!confirm("사진을 지울까요?")) return;
  photoDraft[date] = "";
  $("photoPrev").src = "";
  $("photoPrev").style.display = "none";
  $("photo").value = "";
  markPhotoDirty();
  renderCal();
};
function fileToPhotoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 800;
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          const scale = Math.min(1, MAX / Math.max(w, h));
          w = Math.round(w * scale);
          h = Math.round(h * scale);
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL("image/jpeg", 0.7));
        } catch (e) {
          resolve(r.result);
        }
      };
      img.onerror = () => resolve(r.result);
      img.src = r.result;
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
$("oneline").addEventListener("input", markDirty);
$("oneline").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); if (isDirty()) commit(); $("oneline").blur(); }
});
$("goYest").onclick = () => setDate(yestStr());
$("goTodayDate").onclick = () => setDate(Store.today());

function storedHas(d) { const s = load(d); return !!(s.oneline || s.photo); }
function renderStreak() {
  const el = $("streak");
  if (!el) return;
  const shift = (ds, n) => { const d = new Date(ds + "T12:00:00"); d.setDate(d.getDate() + n); return Store.day(d); };
  let cur = Store.today();
  if (!storedHas(cur)) cur = shift(cur, -1);
  let n = 0;
  while (storedHas(cur) && n < 3650) { n++; cur = shift(cur, -1); }
  el.textContent = n > 0 ? n + "일 연속" : "";
}
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
    c.onclick = () => setDate(ds);
    box.appendChild(c);
  }
  renderStreak();
}
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
apply(date);
renderCal();
