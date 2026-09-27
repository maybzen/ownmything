const $ = (id) => document.getElementById(id);
const uid = () => "p" + Date.now().toString(36);

function renderProfiles() {
  const box = $("profileList");
  box.innerHTML = "";
  const cur = Store.profile();
  Store.profiles().forEach(p => {
    const l = document.createElement("label");
    l.className = "habit";
    const r = document.createElement("input");
    r.type = "radio"; r.name = "profile"; r.checked = p.id === cur;
    r.onchange = () => { Store.setProfile(p.id); location.href = "../today.html"; };
    const s = document.createElement("span");
    s.textContent = p.name + (p.id === cur ? " (사용 중)" : "");
    l.append(r, s);
    if (Store.profiles().length > 1) {
      const del = document.createElement("button");
      del.textContent = "×";
      del.onclick = () => {
        if (p.id === cur) { alert("사용 중인 계정은 삭제할 수 없어"); return; }
        Store.saveProfiles(Store.profiles().filter(x => x.id !== p.id));
        renderProfiles();
      };
      l.appendChild(del);
    }
    box.appendChild(l);
  });
}
$("addProfile").onclick = () => {
  const v = $("newProfile").value.trim();
  if (!v) return;
  const ps = Store.profiles();
  const np = { id: uid(), name: v };
  ps.push(np);
  Store.saveProfiles(ps);
  Store.setProfile(np.id);
  location.href = "../today.html";
};

$("exportBtn").onclick = () => {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("ownmything:")) {
      try { out[k] = JSON.parse(localStorage.getItem(k)); } catch (e) { out[k] = localStorage.getItem(k); }
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
  a.download = "ownmything-backup.json";
  a.click();
};

renderProfiles();
