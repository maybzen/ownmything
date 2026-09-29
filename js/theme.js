(function () {
  var K = "ownmything:theme";
  // stored: "system" (default, follows the phone) | "mono" | "warm" | "dark"
  function stored() {
    try { return localStorage.getItem(K) || "system"; }
    catch (e) { return "system"; }
  }
  function sysDark() {
    try { return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches; }
    catch (e) { return false; }
  }
  function resolved(s) {
    if (s === "warm" || s === "dark" || s === "mono") return s;
    return sysDark() ? "dark" : "mono";
  }
  function paint(t) {
    document.documentElement.setAttribute("data-theme", t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "dark" ? "#101014" : t === "warm" ? "#fbf6ee" : "#ffffff");
  }
  function sync(s) {
    document.querySelectorAll("[data-set-theme]").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-set-theme") === s);
    });
  }
  function apply(s) {
    paint(resolved(s));
    sync(s);
  }
  window.setTheme = function (t) {
    try { localStorage.setItem(K, t); } catch (e) {}
    apply(t);
  };
  window.currentTheme = stored;
  apply(stored());
  // follow the phone while in system mode
  try {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onChange = function () { if (stored() === "system") apply("system"); };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  } catch (e) {}
  document.addEventListener("DOMContentLoaded", function () {
    sync(stored());
    document.querySelectorAll("[data-set-theme]").forEach(function (b) {
      if (b.dataset.themeBound) return;
      b.dataset.themeBound = "1";
      b.addEventListener("click", function () { window.setTheme(b.getAttribute("data-set-theme")); });
    });
  });
})();
