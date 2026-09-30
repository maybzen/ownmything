// Capture the script URL synchronously: document.currentScript is null inside
// the load handler, which made every /pages/*.html register /pages/sw.js (404),
// so those pages ran with no service worker and no offline support.
if ("serviceWorker" in navigator) {
  const here = document.currentScript && document.currentScript.src
    ? new URL(document.currentScript.src)
    : null;
  const base = here ? here.pathname.replace(/\/js\/pwa\.js$/, "/") : "./";
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(base + "sw.js", { scope: base }).catch(() => {});
  });
}
