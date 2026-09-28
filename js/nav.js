// bottom nav for mobile — injected on every page
(function () {
  if (document.getElementById("bnav")) return;
  const path = location.pathname;
  const inPages = path.includes("/pages/");
  const base = inPages ? "../" : "./";
  const cur = (f) => (path.endsWith(f) ? " on" : "");
  const links = [
    ["today.html", "view_day", "오늘"],
    ["pages/habit.html", "checklist", "습관"],
    ["pages/ledger.html", "account_balance_wallet", "가계부"],
    ["pages/reading.html", "auto_stories", "서재"],
    ["pages/night.html", "bedtime", "야간"],
    ["pages/archive.html", "calendar_month", "기록"],
    ["pages/settings.html", "settings", "설정"],
  ];

  // bottom bar (mobile only, shown via CSS)
  const el = document.createElement("nav");
  el.id = "bnav";
  el.className = "bnav";
  el.innerHTML = links.map(([f, i, t]) =>
    '<a href="' + base + f + '" class="bna' + cur(f) + '">' +
    '<span class="material-symbols-outlined">' + i + '</span>' + t + '</a>').join("");
  document.body.appendChild(el);

  // footer / bottom bar share the same list
  const f = document.createElement("div");
  f.id = "dfoot";
  f.className = "dfoot";
  f.innerHTML = links.map(([p, i, t]) =>
    '<a href="' + base + p + '"' + (path.endsWith(p) ? ' class="on"' : '') + '>' + t + '</a>').join("");
  document.body.appendChild(f);
})();
