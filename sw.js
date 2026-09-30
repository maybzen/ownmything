const CACHE = "ownmything-v40";
const ASSETS = [
  "./", "./index.html", "./menu.html", "./today.html",
  "./styles/main.css",
  "./js/theme.js", "./js/store.js", "./js/auth.js", "./js/today.js", "./js/habit.js", "./js/pwa.js", "./js/settings.js", "./js/night.js", "./js/nav.js", "./js/stats.js", "./js/archive.js",
  "./pages/habit.html", "./pages/settings.html", "./pages/night.html", "./pages/stats.html", "./pages/archive.html",
  "./manifest.webmanifest",
  // Icons are referenced by every page head and by the manifest. Without them
  // an offline install has no icon at all.
  "./assets/icons/icon-192.png", "./assets/icons/icon-512.png", "./assets/icons/apple-touch-icon.png",
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
  }).catch(() => caches.match(e.request).then((hit) => {
    if (hit) return hit;
    // Only a page navigation may fall back to the app shell. Falling back for
    // a missing CSS/JS request served it index.html as text/html, and the
    // relative path resolved to an uncached /pages/index.html.
    if (e.request.mode === "navigate") {
      return caches.match(new URL("index.html", self.registration.scope).href);
    }
    return Response.error();
  })));
});
