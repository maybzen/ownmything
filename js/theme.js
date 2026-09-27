(function () {
  var K = "ownmything:theme";
  function current() {
    try { return localStorage.getItem(K) || "mono"; }
    catch (e) { return "mono"; }
  }
  function apply(t) {
    document.documentElement.setAttribute("data-theme", t);
    sync(t);
  }
  function sync(t) {
    document.querySelectorAll("[data-set-theme]").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-set-theme") === t);
    });
  }
  window.setTheme = function (t) {
    try { localStorage.setItem(K, t); } catch (e) {}
    apply(t);
  };
  apply(current());
  document.addEventListener("DOMContentLoaded", function () {
    sync(current());
    document.querySelectorAll("[data-set-theme]").forEach(function (b) {
      if (b.dataset.themeBound) return;
      b.dataset.themeBound = "1";
      b.addEventListener("click", function () { window.setTheme(b.getAttribute("data-set-theme")); });
    });
  });
})();
