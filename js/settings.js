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
  if (!s) return;
  $("accountEmail").textContent = s.user.email || "";
  if (s.user.email === "dlwjdgus417@gmail.com") {
    $("adminCard").style.display = "";
    loadMembers();
  }
})();
$("logoutBtn").onclick = () => Auth.logout();

async function callAdmin(body) {
  const { data, error } = await Auth.sb.functions.invoke("admin-users", { body });
  if (error) throw new Error(error.message);
  if (data && data.error) throw new Error(data.error);
  return data;
}
async function loadMembers() {
  const box = $("memberList");
  box.innerHTML = "<p class='hint'>loading…</p>";
  try {
    const d = await callAdmin({ action: "list" });
    box.innerHTML = "";
    d.users.forEach(u => {
      const l = document.createElement("label");
      l.className = "habit";
      const s = document.createElement("span");
      s.textContent = `${u.email}${u.confirmed ? "" : " (pending)"}`;
      l.appendChild(s);
      const b = document.createElement("button");
      b.textContent = "×";
      b.onclick = async () => {
        if (!confirm(`${u.email} Delete this member and all their data?`)) return;
        try { await callAdmin({ action: "delete", id: u.id }); loadMembers(); }
        catch (e) { $("adminMsg").textContent = e.message; }
      };
      l.appendChild(b);
      box.appendChild(l);
    });
  } catch (e) { box.innerHTML = `<p class='hint'>${e.message}</p>`; }
}
$("inviteBtn").onclick = async () => {
  const email = $("inviteEmail").value.trim();
  if (!email) return;
  $("adminMsg").textContent = "";
  try {
    await callAdmin({ action: "invite", email });
    $("adminMsg").textContent = "Invite sent";
    $("inviteEmail").value = "";
    loadMembers();
  } catch (e) { $("adminMsg").textContent = e.message; }
};
