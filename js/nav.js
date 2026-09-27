// bottom nav for mobile — injected on every page
(function () {
  if (document.getElementById("bnav")) return;
  const path = location.pathname;
  const inPages = path.includes("/pages/");
  const base = inPages ? "../" : "./";
  const cur = (f) => (path.endsWith(f) ? " on" : "");
  const links = [
    ["today.html", "view_day", "Today"],
    ["pages/archive.html", "calendar_month", "Archive"],
    ["pages/habit.html", "checklist", "Habit"],
    ["pages/ledger.html", "account_balance_wallet", "Ledger"],
  ];

  // bottom bar (mobile only, shown via CSS)
  const el = document.createElement("nav");
  el.id = "bnav";
  el.className = "bnav";
  el.innerHTML = links.map(([f, i, t]) =>
    '<a href="' + base + f + '" class="bna' + cur(f) + '">' +
    '<span class="material-symbols-outlined">' + i + '</span>' + t + '</a>').join("");
  document.body.appendChild(el);

  // footer (desktop)
  const f = document.createElement("div");
  f.id = "dfoot";
  f.className = "dfoot";
  f.innerHTML = links.map(([p, i, t]) =>
    '<a href="' + base + p + '"' + (path.endsWith(p) ? ' class="on"' : '') + '>' + t + '</a>').join("") +
    '<a href="' + base + 'pages/night.html"' + (path.endsWith("night.html") ? ' class="on"' : '') + '>Night</a>' +
    '<a href="' + base + 'pages/reading.html"' + (path.endsWith("reading.html") ? ' class="on"' : '') + '>Library</a>' +
    '<a href="' + base + 'pages/settings.html"' + (path.endsWith("settings.html") ? ' class="on"' : '') + '>Settings</a>';
  document.body.appendChild(f);
})();
