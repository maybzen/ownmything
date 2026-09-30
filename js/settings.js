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
  try { Store.set("last-backup", Date.now()); } catch (_) {}
  if ($("lastBackup")) $("lastBackup").textContent = "Last export " + new Date().toLocaleString();
};
$("goalWeight").onchange = () => Store.set("goal-weight", $("goalWeight").value);

$("sysDark").onchange = () => {
  window.setTheme($("sysDark").checked ? "system" : "mono");
};
function currentTheme() {
  try { return localStorage.getItem("ownmything:theme") || "system"; } catch (e) { return "system"; }
}
$("importBtn").onclick = () => $("importFile").click();
$("importFile").onchange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  if (!confirm("현재 기록 위에 가져온 파일을 덮어쓸까요? 먼저 내보내기로 백업하세요.")) { e.target.value = ""; return; }
  const r = new FileReader();
  r.onload = () => {
    try {
      const obj = JSON.parse(r.result);
      const keys = Object.keys(obj).filter(k => k.startsWith("ownmything:"));
      if (!keys.length) throw new Error("empty");
      const pre = "ownmything:" + Store.profile() + ":";
      let n = 0;
      keys.forEach(k => {
        // Route through Store.set so cloud sync picks it up.
        const short = k.startsWith(pre) ? k.slice(pre.length) : null;
        if (short) { try { Store.set(short, obj[k]); n++; return; } catch (_) {} }
        try { localStorage.setItem(k, JSON.stringify(obj[k])); n++; } catch (_) {}
      });
      try { Store.set("last-backup", Date.now()); } catch (_) {}
      alert(`${n}건 가져옴`);
      location.reload();
    } catch (err) { $("lastBackup").textContent = "가져오기 실패"; }
  };
  r.readAsText(f);
};

(async () => {
  const s = await Auth.guard();
  if (!s) return;
  $("accountEmail").textContent = "자동 동기화 중";
  $("avatar").textContent = "o";
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
  if ($("sysDark")) $("sysDark").checked = currentTheme() === "system";
})();

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
