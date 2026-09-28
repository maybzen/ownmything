// Bottom nav for mobile — 3 items, Notion style.
//   오늘 (Today) · 기록 (drawer of the detailed sections) · 보관함 (Archive)
// The desktop footer keeps the full English list.
(function () {
  if (document.getElementById("bnav")) return;
  const path = location.pathname;
  const base = path.includes("/pages/") ? "../" : "./";
  const here = (f) => path.endsWith(f);

  const DRAWER = [
    ["pages/habit.html", "checklist", "습관", "checklist"],
    ["pages/ledger.html", "account_balance_wallet", "가계부", "account_balance_wallet"],
    ["pages/reading.html", "auto_stories", "서재", "auto_stories"],
    ["pages/night.html", "bedtime", "야간", "bedtime"],
    ["pages/settings.html", "settings", "설정", "settings"],
  ];
  const ALL = [
    ["today.html", "view_day", "Today"],
    ["pages/habit.html", "checklist", "Habit"],
    ["pages/ledger.html", "account_balance_wallet", "Ledger"],
    ["pages/reading.html", "auto_stories", "Library"],
    ["pages/night.html", "bedtime", "Night"],
    ["pages/archive.html", "calendar_month", "Archive"],
    ["pages/settings.html", "settings", "Settings"],
  ];
  const inDrawer = DRAWER.some(([f]) => here(f));

  // ---------- bottom bar ----------
  const el = document.createElement("nav");
  el.id = "bnav";
  el.className = "bnav";
  el.innerHTML =
    '<a href="' + base + 'today.html" class="bna' + (here("today.html") ? " on" : "") + '">' +
      '<span class="material-symbols-outlined">view_day</span>오늘</a>' +
    '<button id="bnaMore" class="bna bna-mid' + (inDrawer ? " on" : "") + '" aria-haspopup="true" aria-expanded="false">' +
      '<span class="material-symbols-outlined">checklist</span>기록</button>' +
    '<a href="' + base + 'pages/archive.html" class="bna' + (here("pages/archive.html") ? " on" : "") + '">' +
      '<span class="material-symbols-outlined">inventory_2</span>보관함</a>';
  document.body.appendChild(el);

  // ---------- drawer ----------
  const scrim = document.createElement("div");
  scrim.id = "sheetScrim";
  scrim.className = "sheet-scrim";

  const sheet = document.createElement("div");
  sheet.id = "sheet";
  sheet.className = "sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", "기록");
  sheet.innerHTML =
    '<div class="sheet-grab"></div>' +
    '<div class="sheet-head"><span>기록</span><button id="sheetX" class="ghost-btn sm">닫기</button></div>' +
    DRAWER.map(([f, i, ko]) =>
      '<a href="' + base + f + '" class="sheet-row' + (here(f) ? " on" : "") + '">' +
        '<span class="sheet-ico material-symbols-outlined">' + i + '</span>' +
        '<span class="sheet-t">' + ko + '</span>' +
        '<span class="sheet-go">→</span></a>').join("") +
    '<a href="' + base + 'menu.html" class="sheet-row sheet-all">' +
      '<span class="sheet-ico material-symbols-outlined">apps</span>' +
      '<span class="sheet-t">전체 메뉴</span>' +
      '<span class="sheet-go">→</span></a>';
  document.body.appendChild(scrim);
  document.body.appendChild(sheet);

  const btn = document.getElementById("bnaMore");
  const setOpen = (on) => {
    document.body.classList.toggle("sheet-open", on);
    btn.setAttribute("aria-expanded", on ? "true" : "false");
  };
  btn.onclick = () => setOpen(!document.body.classList.contains("sheet-open"));
  scrim.onclick = () => setOpen(false);
  document.getElementById("sheetX").onclick = () => setOpen(false);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  sheet.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setOpen(false)));

  // ---------- desktop footer (full list, English) ----------
  const f = document.createElement("div");
  f.id = "dfoot";
  f.className = "dfoot";
  f.innerHTML = ALL.map(([p, i, t]) =>
    '<a href="' + base + p + '"' + (here(p) ? ' class="on"' : "") + '>' + t + '</a>').join("");
  document.body.appendChild(f);
})();
