const $ = (id) => document.getElementById(id);
const picker = $("datePicker");
const todayStr = () => new Date().toISOString().slice(0, 10);
let date = todayStr();
picker.value = date;

function load(d) {
  return Store.get("d:" + d, "ownmything:" + d) || {};
}
function apply(d) {
  const s = load(d);
  $("oneline").value = s.oneline || "";
  $("photoPrev").src = s.photo || "";
}
function save() {
  const s = load(date);
  s.oneline = $("oneline").value;
  const src = $("photoPrev").src;
  s.photo = src.startsWith("data:") ? src : (s.photo || "");
  Store.set("d:" + date, s);
}
$("photo").onchange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => { $("photoPrev").src = r.result; save(); };
  r.readAsDataURL(f);
};
$("oneline").addEventListener("input", save);
picker.onchange = () => { date = picker.value; apply(date); };
apply(date);
