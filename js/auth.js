window.Auth = (() => {
  const sb = window.supabase.createClient(
    "https://fxfzpkhsfvstutdmndyc.supabase.co",
    "sb_publishable_pnREwJ9hLSj54xtKVGtXWg_50fdSJWN",
    { auth: { persistSession: true, autoRefreshToken: true, storageKey: "ownmything-auth" } }
  );
  let uid = null;
  const timers = {};
  const recentlyPushed = {};
  let realtimeChannel = null;
  const cloudListeners = [];
  const inPages = () => location.pathname.includes("/pages/");
  const loginUrl = () => (inPages() ? "./login.html" : "./pages/login.html");

  const meta = () => {
    try { return JSON.parse(localStorage.getItem("ownmything:meta") || "{}"); } catch (e) { return {}; }
  };
  const setMeta = (m) => { try { localStorage.setItem("ownmything:meta", JSON.stringify(m)); } catch (e) {} };

  function queuePush(key, value) {
    if (!uid) return;
    recentlyPushed[key] = Date.now();
    clearTimeout(timers[key]);
    timers[key] = setTimeout(async () => {
      const { error } = await sb.from("store").upsert({ user_id: uid, key, value });
      if (!error) {
        const m = meta();
        m[uid + ":" + key] = Date.now();
        setMeta(m);
      }
    }, 1500);
  }

  function handleCloudEvent(payload) {
    const row = payload.new;
    if (!row || row.user_id !== uid) return;
    if (recentlyPushed[row.key] && Date.now() - recentlyPushed[row.key] < 3000) return;
    try {
      localStorage.setItem("ownmything:" + uid + ":" + row.key, JSON.stringify(row.value));
      const m = meta();
      m[uid + ":" + row.key] = new Date(row.updated_at).getTime();
      setMeta(m);
      cloudListeners.forEach(fn => { try { fn(row.key); } catch (e) {} });
    } catch (e) {}
  }

  function startRealtime() {
    if (realtimeChannel || !uid) return;
    realtimeChannel = sb.channel("ownmything-store-" + uid)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "store", filter: "user_id=eq." + uid }, handleCloudEvent)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "store", filter: "user_id=eq." + uid }, handleCloudEvent)
      .subscribe();
  }

  function onCloudChange(fn) {
    cloudListeners.push(fn);
  }

  async function pull() {
    const { data, error } = await sb.from("store").select("key,value,updated_at");
    if (error || !data) return false;
    const m = meta();
    let changed = false;
    data.forEach(r => {
      const mk = uid + ":" + r.key;
      const cloudTs = new Date(r.updated_at).getTime();
      if (!m[mk] || cloudTs > m[mk]) {
        try {
          localStorage.setItem("ownmything:" + uid + ":" + r.key, JSON.stringify(r.value));
          m[mk] = cloudTs;
          changed = true;
        } catch (e) {}
      }
    });
    setMeta(m);
    return changed;
  }

  function migrateLocal() {
    let hasUid = false, hasMe = false;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || "";
      if (k.startsWith("ownmything:" + uid + ":")) hasUid = true;
      if (k.startsWith("ownmything:me:")) hasMe = true;
    }
    if (!hasUid && hasMe) {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      keys.forEach(k => {
        if (k && k.startsWith("ownmything:me:")) {
          try { localStorage.setItem("ownmything:" + uid + k.slice("ownmything:me".length), localStorage.getItem(k)); } catch (e) {}
        }
      });
      return true;
    }
    return false;
  }

  async function startSync(userId) {
    uid = userId;
    Store.setProfile(uid);
    const origSet = Store.set.bind(Store);
    Store.set = (k, v) => { origSet(k, v); queuePush(k, v); };
    const migrated = migrateLocal();
    let changed = false;
    try { changed = await pull(); } catch (e) {}
    if (migrated) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || "";
        const pre = "ownmything:" + uid + ":";
        if (k.startsWith(pre)) {
          try { queuePush(k.slice(pre.length), JSON.parse(localStorage.getItem(k))); } catch (e) {}
        }
      }
    }
    startRealtime();
    const flag = "ownmything:synced:" + uid;
    if ((changed || migrated) && !sessionStorage.getItem(flag)) {
      sessionStorage.setItem(flag, "1");
      location.reload();
    }
  }

  async function guard() {
    let session = null;
    try {
      const r = await sb.auth.getSession();
      session = r.data.session;
    } catch (e) {}
    if (!session) {
      if (!location.pathname.endsWith("login.html")) location.href = loginUrl();
      return null;
    }
    await startSync(session.user.id);
    return session;
  }

  async function logout() {
    try { await sb.auth.signOut(); } catch (e) {}
    location.href = loginUrl();
  }

  return { sb, guard, logout, onCloudChange, session: async () => (await sb.auth.getSession()).data.session };
})();
