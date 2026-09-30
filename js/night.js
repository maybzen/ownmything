const $ = (id) => document.getElementById(id);
const todayStr = (d) => Store.day(d || new Date());
const yestStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return Store.day(d); };
let date = todayStr();
let calYM = date.slice(0, 7);
function setDate(ds) {
  flushSave();
  date = ds;
  calYM = ds.slice(0, 7);
  // Undo is per-date; the snapshot for the previous date is no longer reachable.
  SAVED = null;
  UNDO = null;
  undoAt = 0;
  apply(ds);
  renderCal();
  paintSaveBar();
}

function load(d) {
  return Store.get("d:" + d, "ownmything:" + d) || {};
}

// --- autosave: oneline + photo persist automatically (debounced) -----------
const DKEY = "omt:night-draft";
let draftsProfile = null;
const drafts = (function () {
  try {
    const raw = JSON.parse(sessionStorage.getItem(DKEY)) || {};
    if (raw && typeof raw === "object" && raw.data) {
      if (raw.profile && raw.profile !== Store.profile()) return {};
      draftsProfile = raw.profile || Store.profile();
      return raw.data || {};
    }
    draftsProfile = Store.profile();
    return raw;
  } catch (e) { draftsProfile = Store.profile(); return {}; }
})();
if (!draftsProfile) draftsProfile = Store.profile();
// date -> dataUrl string (new/changed), "" (delete), undefined (no change).
// Persisted to sessionStorage when it fits; otherwise kept in memory.
// (beforeunload still guards the in-memory case.)
const photoDraft = {};
const PKEY = "omt:night-photo-draft";
try {
  const praw = JSON.parse(sessionStorage.getItem(PKEY) || "null");
  const pdata = praw && praw.data ? (praw.profile && praw.profile !== Store.profile() ? {} : praw.data) : (praw || {});
  Object.keys(pdata).forEach(k => { if (typeof pdata[k] === "string") photoDraft[k] = pdata[k]; });
} catch (e) {}
function stashPhoto() {
  try {
    if (Object.keys(photoDraft).length) sessionStorage.setItem(PKEY, JSON.stringify({ profile: Store.profile(), data: photoDraft }));
    else sessionStorage.removeItem(PKEY);
  } catch (e) {
    // Too big for sessionStorage: keep in memory only.
    try { sessionStorage.removeItem(PKEY); } catch (_) {}
  }
}
function stash() {
  try {
    draftsProfile = Store.profile();
    if (Object.keys(drafts).length) sessionStorage.setItem(DKEY, JSON.stringify({ profile: draftsProfile, data: drafts }));
    else sessionStorage.removeItem(DKEY);
  } catch (e) {}
}
function isDirty() { return Object.keys(drafts).length > 0 || Object.keys(photoDraft).length > 0; }
function autoGrow() {
  const el = $("oneline");
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}
// --- autosave -------------------------------------------------------------
// SAVED snapshots `date` before the *current* burst of writes; on commit it
// becomes UNDO, the state 되돌리기 restores. Clearing SAVED at commit lets the
// next burst snapshot afresh instead of rewinding to the very first.
// Photos make localStorage writes expensive, hence the longer debounce.
let SAVED = null;
let UNDO = null;
let undoAt = 0;
const UNDO_WINDOW = 30 * 60 * 1000;
let saveTimer = null;

function markDirty() {
  if (!SAVED) SAVED = load(date);
  drafts[date] = $("oneline").value;
  stash();
  paintSaveBar();
  autoGrow();
  scheduleSave();
}
function markPhotoDirty() {
  if (!SAVED) SAVED = load(date);
  stash();
  stashPhoto();
  paintSaveBar();
  scheduleSave();
}
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; commit(); }, 600);
}
function flushSave() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; commit(); }
}
function canUndo() { return !!UNDO && (Date.now() - undoAt) < UNDO_WINDOW; }
function paintSaveBar() {
  const pending = isDirty();
  const b = $("saveState");
  if (b) {
    b.textContent = pending ? "저장 중" : "자동 저장됨";
    b.classList.remove("warn");
    b.title = pending ? "곧 저장됩니다" : "입력하면 자동으로 저장돼요";
  }
  const r = $("revertBtn");
  if (r) r.style.display = canUndo() ? "inline-block" : "none";
}
function commit() {
  const keys = new Set([...Object.keys(drafts), ...Object.keys(photoDraft)]);
  if (!keys.size) { paintSaveBar(); return; }
  if (!SAVED) SAVED = load(date);
  try {
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
  stashPhoto();
  UNDO = SAVED;
  SAVED = null;
  undoAt = Date.now();
  paintSaveBar();
  renderCal();
}
// 되돌리기: restore the snapshot taken before the last autosave burst.
function revert() {
  if (!canUndo()) return;
  if (!confirm("자동 저장된 내용을 되돌릴까요?")) return;
  try { Store.set("d:" + date, UNDO); } catch (e) { alert("되돌리기에 실패했어요."); return; }
  UNDO = null;
  SAVED = null;
  undoAt = 0;
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  Object.keys(drafts).forEach(k => delete drafts[k]);
  Object.keys(photoDraft).forEach(k => delete photoDraft[k]);
  stash();
  stashPhoto();
  apply(date);
  renderCal();
}
$("revertBtn").onclick = () => revert();
window.addEventListener("pagehide", () => flushSave());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushSave();
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
  autoGrow();
  const ph = curPhoto(d);
  // removeAttribute, not src = "": an empty src re-requests the page URL.
  if (ph) $("photoPrev").src = ph;
  else $("photoPrev").removeAttribute("src");
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
  $("photoPrev").removeAttribute("src");
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
          const MAX = 720;
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          const scale = Math.min(1, MAX / Math.max(w, h));
          w = Math.round(w * scale);
          h = Math.round(h * scale);
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL("image/jpeg", 0.65));
        } catch (e) {
          // Never fall back to the original: an uncompressed phone photo is
          // 4-6 MB of base64 and would blow the localStorage quota on its own.
          reject(new Error("resize failed"));
        }
      };
      // The image could not be decoded, so there is nothing to downscale.
      // Storing the raw original here is what used to fill the quota.
      img.onerror = () => reject(new Error("decode failed"));
      img.src = r.result;
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
$("oneline").addEventListener("input", markDirty);
$("oneline").addEventListener("keydown", (e) => {
  // 길어질 수 있으니 Enter는 줄바꿈, Cmd/Ctrl+Enter는 저장
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); flushSave(); $("oneline").blur(); }
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
// Pending edits belong to the old profile — drop them rather than writing
// another profile's data. Nothing is lost: autosave already persisted locally.
window.refreshNight = () => {
  if (draftsProfile !== Store.profile()) {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    Object.keys(drafts).forEach(k => delete drafts[k]);
    Object.keys(photoDraft).forEach(k => delete photoDraft[k]);
    stash(); stashPhoto();
    SAVED = null;
    UNDO = null;
    undoAt = 0;
  }
  apply(date);
  renderCal();
  paintSaveBar();
};
