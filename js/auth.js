window.Auth = (() => {
  const sb = window.supabase.createClient(
    "https://fxfzpkhsfvstutdmndyc.supabase.co",
    "sb_publishable_pnREwJ9hLSj54xtKVGtXWg_50fdSJWN",
    { auth: { persistSession: true, autoRefreshToken: true, storageKey: "ownmything-auth" } }
  );
  let uid = null;
  const timers = {};
  const recentlyPushed = {};
  const lastPushed = {};
  // Keys with a local write that has not reached the cloud yet. A pull must
  // never overwrite these — otherwise a focus/online resync silently reverts
  // whatever the user just typed.
  const pendingPush = new Set();
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
    try { lastPushed[key] = JSON.stringify(value); } catch (e) {}
    pendingPush.add(key);
    clearTimeout(timers[key]);
    timers[key] = setTimeout(async () => {
      recentlyPushed[key] = Date.now();
      const { error } = await sb.from("store").upsert({ user_id: uid, key, value });
      if (!error) {
        const m = meta();
        m[uid + ":" + key] = Date.now();
        setMeta(m);
        pendingPush.delete(key);
      } else {
        // keep it pending: a later resync must still not clobber it
        try { await sb.from("store").upsert({ user_id: uid, key, value }); pendingPush.delete(key); } catch (e) {}
      }
    }, 800);
  }

  function handleCloudEvent(payload) {
    const row = payload.new;
    if (!row || row.user_id !== uid) return;
    const lk = "ownmything:" + uid + ":" + row.key;
    let incoming = null, current = null;
    try { incoming = JSON.stringify(row.value); } catch (e) {}
    try { current = localStorage.getItem(lk); } catch (e) {}
    // No-op: cloud already matches local. Update meta, do NOT re-render.
    if (incoming !== null && current !== null && current === incoming) {
      try {
        const m = meta();
        m[uid + ":" + row.key] = new Date(row.updated_at).getTime();
        setMeta(m);
      } catch (e) {}
      return;
    }
    // Own echo (even a stale one): never clobber local with it.
    // NOTE: no blanket time-window block here. Blocking all cloud events
    // for N seconds after a local edit also drops legitimate remote edits
    // (phone -> PC within the window) and is the main "바로 안됨" cause.
    // Stale-echo protection is handled by the exact-match above + the
    // editor-focus guard on each page.
    if (incoming !== null && lastPushed[row.key] === incoming) return;
    try {
      localStorage.setItem(lk, JSON.stringify(row.value));
      const m = meta();
      m[uid + ":" + row.key] = new Date(row.updated_at).getTime();
      setMeta(m);
      cloudListeners.forEach(fn => { try { fn(row.key); } catch (e) {} });
    } catch (e) {}
  }

  function startRealtime() {
    if (!uid) return;
    if (realtimeChannel) { try { sb.removeChannel(realtimeChannel); } catch (e) {} realtimeChannel = null; }
    realtimeChannel = sb.channel("ownmything-store-" + uid)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "store", filter: "user_id=eq." + uid }, handleCloudEvent)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "store", filter: "user_id=eq." + uid }, handleCloudEvent)
      .subscribe();
  }

  function onCloudChange(fn) {
    cloudListeners.push(fn);
  }

  // Fallback when realtime drops (mobile sleep / network flap):
  // re-pull and notify listeners so the UI refreshes even without a push event.
  async function resync() {
    if (!uid) return false;
    let changed = false;
    try { changed = await pull(); } catch (e) { return false; }
    if (changed) {
      try {
        const keys = new Set();
        try {
          const { data } = await sb.from("store").select("key");
          (data || []).forEach(r => keys.add(r.key));
        } catch (e) {}
        keys.forEach(k => cloudListeners.forEach(fn => { try { fn(k); } catch (e) {} }));
      } catch (e) {}
    }
    return changed;
  }
  if (typeof window !== "undefined") {
    document.addEventListener("visibilitychange", () => { if (!document.hidden) resync(); });
    window.addEventListener("online", () => resync());
    window.addEventListener("focus", () => resync());
  }

  async function pull() {
    const { data, error } = await sb.from("store").select("key,value,updated_at");
    if (error || !data) return false;
    const m = meta();
    let changed = false;
    data.forEach(r => {
      if (pendingPush.has(r.key)) return; // local write wins until it lands
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
    if (!Store.set.__synced) {
      const origSet = Store.set.bind(Store);
      const wrapped = (k, v) => { origSet(k, v); queuePush(k, v); };
      wrapped.__synced = true;
      Store.set = wrapped;
    }
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

  return { sb, guard, logout, onCloudChange, resync, session: async () => (await sb.auth.getSession()).data.session };
})();
