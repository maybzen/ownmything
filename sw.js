const CACHE = "ownmything-v4";
const ASSETS = [
  "./", "./index.html", "./menu.html", "./today.html",
  "./styles/main.css",
  "./js/theme.js", "./js/store.js", "./js/auth.js", "./js/today.js", "./js/habit.js", "./js/ledger.js", "./js/reading.js", "./js/pwa.js", "./js/settings.js", "./js/night.js",
  "./pages/habit.html", "./pages/ledger.html", "./pages/reading.html", "./pages/settings.html", "./pages/login.html", "./pages/night.html",
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
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match("./index.html"))));
});
