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
  return !!(s.oneline || s.photo);
}
function apply(d) {
  const s = load(d);
  $("oneline").value = s.oneline || "";
  $("photoPrev").src = s.photo || "";
  $("headDate").textContent = d;
  $("goToday").href = `../today.html?date=${d}`;
}
function save() {
  const s = load(date);
  s.oneline = $("oneline").value;
  const attr = $("photoPrev").getAttribute("src") || "";
  s.photo = attr.startsWith("data:") ? attr : "";
  Store.set("d:" + date, s);
  renderCal();
}
$("photo").onchange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => { $("photoPrev").src = r.result; save(); };
  r.readAsDataURL(f);
};
$("delPhoto").onclick = () => {
  if (!$("photoPrev").getAttribute("src")) return;
  if (!confirm("Delete this photo?")) return;
  $("photoPrev").setAttribute("src", "");
  $("photo").value = "";
  save();
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
$("goTodayDate").onclick = () => {
  date = Store.today();
  picker.value = date;
  calYM = date.slice(0, 7);
  apply(date); renderCal();
};

apply(date);
renderCal();
