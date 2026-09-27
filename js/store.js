window.Store = (() => {
  const PKEY = "ownmything:profile";
  const LKEY = "ownmything:profiles";
  const profile = () => {
    try { return localStorage.getItem(PKEY) || "me"; } catch (e) { return "me"; }
  };
  const profiles = () => {
    try { return JSON.parse(localStorage.getItem(LKEY)) || [{ id: "me", name: "Me" }]; }
    catch (e) { return [{ id: "me", name: "Me" }]; }
  };
  const k = (s) => `ownmything:${profile()}:${s}`;
  const p2 = (n) => String(n).padStart(2, "0");
  const day = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const today = () => day(new Date());
  const get = (nk, legacy) => {
    try {
      const v = localStorage.getItem(k(nk));
      if (v !== null) return JSON.parse(v);
      if (legacy) {
        const l = localStorage.getItem(legacy);
        if (l !== null) return JSON.parse(l);
      }
    } catch (e) {}
    return undefined;
  };
  const set = (nk, v) => localStorage.setItem(k(nk), JSON.stringify(v));
  return {
    profile, profiles,
    saveProfiles: (p) => localStorage.setItem(LKEY, JSON.stringify(p)),
    setProfile: (id) => localStorage.setItem(PKEY, id),
    k, get, set, day, today,
  };
})();
