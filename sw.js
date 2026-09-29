const CACHE = "ownmything-v34";
const ASSETS = [
  "./", "./index.html", "./menu.html", "./today.html",
  "./styles/main.css",
  "./js/theme.js", "./js/store.js", "./js/auth.js", "./js/today.js", "./js/habit.js", "./js/ledger.js", "./js/reading.js", "./js/pwa.js", "./js/settings.js", "./js/night.js", "./js/nav.js", "./js/stats.js", "./js/archive.js",
  "./pages/habit.html", "./pages/ledger.html", "./pages/reading.html", "./pages/settings.html", "./pages/night.html", "./pages/stats.html", "./pages/archive.html",
  "./manifest.webmanifest"
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request).then((hit) => hit || caches.match("./index.html"))));
});
