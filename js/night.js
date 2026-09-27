const $ = (id) => document.getElementById(id);
const picker = $("datePicker");
const todayStr = () => Store.today();
let date = todayStr();
picker.value = date;
let calYM = date.slice(0, 7);

function load(d) {
  return Store.get("d:" + d, "ownmything:" + d) || {};
}
function hasEntry(d) {
  const s = load(d);
  return !!(s.oneline || s.photo || (s.todos && s.todos.length) || (s.cells && Object.keys(s.cells).length));
}
function apply(d) {
  const s = load(d);
  $("oneline").value = s.oneline || "";
  $("photoPrev").src = s.photo || "";
  $("goToday").href = `../today.html?date=${d}`;
}
function save() {
  const s = load(date);
  s.oneline = $("oneline").value;
  const src = $("photoPrev").src;
  s.photo = src.startsWith("data:") ? src : (s.photo || "");
  Store.set("d:" + date, s);
  renderSummary(s);
  renderCal();
}
$("photo").onchange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => { $("photoPrev").src = r.result; save(); };
  r.readAsDataURL(f);
};
$("oneline").addEventListener("input", save);
picker.onchange = () => { date = picker.value; calYM = date.slice(0, 7); apply(date); renderCal(); };

// --- calendar ---
const MN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function renderCal() {
  const [y, m] = calYM.split("-").map(Number);
  $("calLabel").textContent = `${MN[m - 1]} ${y}`;
  const box = $("cal");
  box.innerHTML = "";
  ["S","M","T","W","T","F","S"].forEach(d => {
    const h = document.createElement("span");
    h.className = "cal-h";
    h.textContent = d;
    box.appendChild(h);
  });
  renderGallery(y, m);
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
function renderGallery(y, m) {
  const box = $("gallery");
  box.innerHTML = "";
  const days = new Date(y, m, 0).getDate();
  for (let d = days; d >= 1; d--) {
    const ds = `${calYM}-${String(d).padStart(2, "0")}`;
    const s = load(ds);
    if (!s.photo) continue;
    const item = document.createElement("button");
    item.className = "gal-item";
    const img = document.createElement("img");
    img.src = s.photo;
    img.loading = "lazy";
    const cap = document.createElement("span");
    cap.textContent = ds.slice(5);
    item.append(img, cap);
    item.onclick = () => { date = ds; picker.value = ds; apply(ds); renderCal(); window.scrollTo({ top: 0, behavior: "smooth" }); };
    box.appendChild(item);
  }
  if (!box.children.length) box.innerHTML = "<p class='hint'>이번 달 사진 없음</p>";
}
function showTip(e, ds) {
  const s = load(ds);
  if (!s.oneline && !s.photo) return;
  const tip = $("calTip");
  tip.innerHTML = "";
  if (s.photo) {
    const img = document.createElement("img");
    img.src = s.photo;
    tip.appendChild(img);
  }
  if (s.oneline) {
    const p = document.createElement("p");
    p.textContent = s.oneline;
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

apply(date);
renderCal();
