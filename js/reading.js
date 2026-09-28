const $ = (id) => document.getElementById(id);
const K = "books";
const LEGACY_K = "ownmything:books";
const yestStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return Store.day(d); };
const load = () => Store.get(K, LEGACY_K) || [];
const store = (v) => Store.set(K, v);
$("addBook").onclick = () => {
  const title = $("bTitle").value.trim();
  if (!title) return;
  const b = load();
  b.unshift({
    id: "b" + Date.now().toString(36), title,
    author: $("bAuthor").value.trim(), status: $("bStatus").value,
    rating: Number($("bRating").value) || 0,
    memo: $("bMemo").value.trim(), date: Store.today(),
  });
  store(b);
  $("bTitle").value = ""; $("bAuthor").value = ""; $("bMemo").value = ""; $("bRating").value = "0";
  render();
};
function stars(n) { return n ? "★".repeat(n) + "☆".repeat(5 - n) : ""; }
function render() {
  const g = $("bookGrid");
  g.innerHTML = "";
  const f = $("dateFilter").value;
  $("headDate").textContent = f || "All";
  const items = load().filter(x => !f || x.date === f);
  if (!items.length) g.innerHTML = "<p class='hint'>책 없음</p>";
  items.forEach(x => {
    const d = document.createElement("div");
    d.className = "book-card";
    d.innerHTML = `<span class="chip">${({Reading:"읽는 중",Done:"완독",Want:"읽을 것"})[x.status] || x.status}</span>
      <b>${x.title}</b>
      <span class="hint">${x.author || ""}</span>
      <span class="hint">${stars(x.rating)}${x.memo ? " · " + x.memo : ""}</span>
      <span class="hint">${x.date || ""}</span>`;
    const b = document.createElement("button");
    b.textContent = "×";
    b.onclick = () => { store(load().filter(y => y.id !== x.id)); render(); };
    d.appendChild(b);
    g.appendChild(d);
  });
}
$("dateFilter").onchange = render;
$("goYest").onclick = () => { $("dateFilter").value = yestStr(); render(); };
$("goTodayDate").onclick = () => { $("dateFilter").value = ""; render(); };
render();
