// bottom nav for mobile — injected on every page
(function () {
  if (document.getElementById("bnav")) return;
  const path = location.pathname;
  const inPages = path.includes("/pages/");
  const base = inPages ? "../" : "./";
  const cur = (f) => (path.endsWith(f) ? " on" : "");
  const el = document.createElement("nav");
  el.id = "bnav";
  el.className = "bnav";
  el.innerHTML =
    '<a href="' + base + 'today.html" class="bna' + cur("today.html") + '">' +
    '<span class="material-symbols-outlined">view_day</span>Today</a>' +
    '<a href="' + base + 'pages/habit.html" class="bna' + cur("habit.html") + '">' +
    '<span class="material-symbols-outlined">checklist</span>Habit</a>' +
    '<a href="' + base + 'pages/ledger.html" class="bna' + cur("ledger.html") + '">' +
    '<span class="material-symbols-outlined">account_balance_wallet</span>Ledger</a>' +
    '<a href="' + base + 'pages/archive.html" class="bna' + cur("archive.html") + '">' +
    '<span class="material-symbols-outlined">calendar_month</span>Archive</a>';
  document.body.appendChild(el);
})();
