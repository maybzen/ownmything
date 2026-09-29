// Bottom nav for mobile — daily pages only: 투데이 · 습관 · 야간 · 메뉴.
// Archive and Settings live in the main menu (menu.html) and the drawer.
(function () {
  if (document.getElementById("bnav")) return;
  const path = location.pathname;
  const base = path.includes("/pages/") ? "../" : "./";
  const here = (f) => path.endsWith(f);

  const DRAWER = [
    ["pages/archive.html", "calendar_month", "기록"],
    ["pages/settings.html", "settings", "설정"],
  ];
  const ALL = [
    ["today.html", "view_day", "Today"],
    ["pages/habit.html", "checklist", "Habit"],
    ["pages/night.html", "bedtime", "Night"],
    ["pages/archive.html", "calendar_month", "Archive"],
    ["pages/settings.html", "settings", "Settings"],
  ];
  const inDrawer = DRAWER.some(([f]) => here(f)) || here("menu.html");

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
    '<button id="bnaMore" class="bna bna-mid' + (inDrawer ? " on" : "") + '" aria-haspopup="true" aria-expanded="false">' +
      '<span class="material-symbols-outlined">menu</span>메뉴</button>';
  document.body.appendChild(el);

  // ---------- drawer: the whole menu ----------
  const scrim = document.createElement("div");
  scrim.id = "sheetScrim";
  scrim.className = "sheet-scrim";

  const sheet = document.createElement("div");
  sheet.id = "sheet";
  sheet.className = "sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", "메뉴");
  sheet.innerHTML =
    '<div class="sheet-grab"></div>' +
    '<div class="sheet-head"><span>메뉴</span><button id="sheetX" class="ghost-btn sm">닫기</button></div>' +
    DRAWER.map(([f, i, ko]) =>
      '<a href="' + base + f + '" class="sheet-row' + (here(f) ? " on" : "") + '">' +
        '<span class="sheet-ico material-symbols-outlined">' + i + '</span>' +
        '<span class="sheet-t">' + ko + '</span>' +
        '<span class="sheet-go">→</span></a>').join("") +
    '<a href="' + base + 'menu.html" class="sheet-row sheet-all">' +
      '<span class="sheet-ico material-symbols-outlined">language</span>' +
      '<span class="sheet-t">메인 메뉴</span>' +
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

  // Freeze the page behind the drawer without losing the scroll position.
  let lockedY = 0;
  const freeze = () => {
    lockedY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = -lockedY + "px";
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  };
  const thaw = () => {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    window.scrollTo(0, lockedY);
  };
  const sync = () => {
    const open = document.body.classList.contains("sheet-open");
    if (open && document.body.style.position !== "fixed") freeze();
    else if (!open && document.body.style.position === "fixed") thaw();
  };
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("resize", () => { if (!document.body.classList.contains("sheet-open") && document.body.style.position === "fixed") thaw(); });

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
