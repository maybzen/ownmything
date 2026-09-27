const $ = (id) => document.getElementById(id);
const K = "ownmything:books";
const load = () => { try { return JSON.parse(localStorage.getItem(K)) || []; } catch { return []; } };
const store = (v) => localStorage.setItem(K, JSON.stringify(v));
$("addBook").onclick = () => {
  const title = $("bTitle").value.trim();
  if (!title) return;
  const b = load();
  b.unshift({ id: "b" + Date.now().toString(36), title, author: $("bAuthor").value.trim(), status: $("bStatus").value, memo: $("bMemo").value.trim(), date: new Date().toISOString().slice(0, 10) });
  store(b);
  $("bTitle").value = ""; $("bAuthor").value = ""; $("bMemo").value = "";
  render();
};
function render() {
  const ul = $("bookList");
  ul.innerHTML = "";
  load().forEach(x => {
    const li = document.createElement("li");
    li.textContent = `${x.title}${x.author ? " · " + x.author : ""} [${x.status}]${x.memo ? " — " + x.memo : ""}`;
    const b = document.createElement("button");
    b.textContent = "×";
    b.onclick = () => { store(load().filter(y => y.id !== x.id)); render(); };
    li.appendChild(b);
    ul.appendChild(li);
  });
}
render();
