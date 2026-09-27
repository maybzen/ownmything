const $ = (id) => document.getElementById(id);

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

(async () => {
  const s = await Auth.guard();
  if (s) $("accountEmail").textContent = s.user.email || "";
})();
$("logoutBtn").onclick = () => Auth.logout();
