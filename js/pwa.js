if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const src = document.currentScript && document.currentScript.src
      ? new URL(document.currentScript.src)
      : null;
    const base = src ? src.pathname.replace(/\/js\/pwa\.js$/, "/") : "./";
    navigator.serviceWorker.register(base + "sw.js", { scope: base }).catch(() => {});
  });
}
