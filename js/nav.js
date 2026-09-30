// Bottom nav for mobile — daily pages only: 투데이 · 습관 · 야간 · 메뉴.
// 메뉴 goes straight to the main menu (menu.html); Archive and Settings live there.
(function () {
  if (document.getElementById("bnav")) return;
  const path = location.pathname;
  const base = path.includes("/pages/") ? "../" : "./";
  const here = (f) => path.endsWith(f);

  const ALL = [
    ["today.html", "view_day", "Today"],
    ["pages/habit.html", "checklist", "Habit"],
    ["pages/night.html", "bedtime", "Night"],
    ["pages/archive.html", "calendar_month", "Archive"],
    ["pages/ledger.html", "account_balance", "Ledger"],
    ["pages/reading.html", "book", "Library"],
    ["pages/stats.html", "monitoring", "Stats"],
    ["pages/settings.html", "settings", "Settings"],
  ];

  // ---------- bottom bar ----------
  const el = document.createElement("nav");
  el.id = "bnav";
  el.className = "bnav";
  el.innerHTML =
    '<a href="' + base + 'today.html" class="bna' + (here("today.html") ? " on" : "") + '">' +
      '<span class="material-symbols-outlined">view_day</span>투데이</a>' +
    '<a href="' + base + 'pages/habit.html" class="bna' + (here("pages/habit.html") ? " on" : "") + '">' +
      '<span class="material-symbols-outlined">checklist</span>습관</a>' +
    '<a href="' + base + 'pages/night.html" class="bna' + (here("pages/night.html") ? " on" : "") + '">' +
      '<span class="material-symbols-outlined">bedtime</span>나잇</a>' +
    '<a href="' + base + 'menu.html" class="bna' + (here("menu.html") ? " on" : "") + '">' +
      '<span class="material-symbols-outlined">menu</span>메뉴</a>';
  document.body.appendChild(el);

  // Restore where you were on each page when you navigate back and forth.
  const SKIP = /#|^\s*javascript:/i;
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href || SKIP.test(href) || href.startsWith("http")) return;
    try { sessionStorage.setItem("scroll:" + location.pathname, String(window.scrollY)); } catch (err) {}
  });
  addEventListener("load", () => {
    const k = "scroll:" + location.pathname;
    let y = 0;
    try { y = Number(sessionStorage.getItem(k) || 0); } catch (err) {}
    if (y > 0) requestAnimationFrame(() => window.scrollTo(0, y));
  });

  // ---------- desktop footer (full list, English) ----------
  const f = document.createElement("div");
  f.id = "dfoot";
  f.className = "dfoot";
  f.innerHTML = ALL.map(([p, i, t]) =>
    '<a href="' + base + p + '"' + (here(p) ? ' class="on"' : "") + '>' + t + '</a>').join("");
  document.body.appendChild(f);
})();
