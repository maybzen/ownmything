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
$("goalWeight").onchange = () => Store.set("goal-weight", $("goalWeight").value);

$("sysDark").onchange = () => {
  const on = $("sysDark").checked;
  const dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  window.setTheme(on && dark ? "dark" : currentTheme());
};
function currentTheme() {
  try { return localStorage.getItem("ownmything:theme") || "mono"; } catch (e) { return "mono"; }
}
$("autoExport").onchange = () => {
  Store.set("auto-export", $("autoExport").checked);
  Store.set("last-backup", Date.now());
};
$("importBtn").onclick = () => $("importFile").click();
$("importFile").onchange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const obj = JSON.parse(r.result);
      let n = 0;
      Object.keys(obj).forEach(k => { localStorage.setItem(k, JSON.stringify(obj[k])); n++; });
      Store.set("last-backup", Date.now());
      location.reload();
    } catch (err) { $("lastBackup").textContent = "가져오기 실패"; }
  };
  r.readAsText(f);
};
$("exportBtn2").onclick = () => $("exportBtn").click();

(async () => {
  const s = await Auth.guard();
  if (!s) return;
  $("accountEmail").textContent = s.user.email || "";
  $("avatar").textContent = (s.user.email || "o").charAt(0).toUpperCase();
  const gw = Store.get("goal-weight", "");
  if (gw !== undefined) $("goalWeight").value = gw;
  let n = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) || "";
    if (k.indexOf("ownmything:" + Store.profile() + ":d:") === 0) n++;
  }
  $("dayCount").textContent = n ? `${n} days recorded` : "No records yet";
  if ($("svRecords")) $("svRecords").textContent = n;
  if ($("svCloud")) $("svCloud").textContent = "Supabase";
  if ($("svCal")) $("svCal").textContent = "iCloud";
  if ($("lastBackup")) {
    const lb = Store.get("last-backup", "");
    $("lastBackup").textContent = lb ? "Last export " + new Date(lb).toLocaleString() : "No export yet";
  }
  const ae = Store.get("auto-export", "");
  if (typeof ae === "boolean") $("autoExport").checked = ae;
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
        if (!confirm(`${u.email} 멤버와 모든 기록을 삭제할까요?`)) return;
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
    $("adminMsg").textContent = "초대 보냄";
    $("inviteEmail").value = "";
    loadMembers();
  } catch (e) { $("adminMsg").textContent = e.message; }
};
