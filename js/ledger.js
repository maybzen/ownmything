const $ = (id) => document.getElementById(id);
const TXN = "ledger-txns";
const LOAN = "ledger-loans";
const STMT = "ledger-statements";
const LEGACY_TXN = "ownmything:ledger-txns";
const LEGACY_LOAN = "ownmything:ledger-loans";
const EXP_CATS = ["Food", "Transport", "Housing", "Medical", "Obok", "Family", "Personal", "Work", "Other"];
const INC_CATS = ["Salary", "Other income"];
const METHODS = ["Cash", "Account", "Card", "Installment"];

const legacyFor = (k) => k === TXN ? LEGACY_TXN : (k === LOAN ? LEGACY_LOAN : undefined);
const load = (k, fb) => {
  const v = Store.get(k, legacyFor(k));
  return v !== undefined ? v : fb;
};
const store = (k, v) => Store.set(k, v);
const uid = () => "t" + Date.now().toString(36) + Math.floor(Math.random() * 99);
const ym = (ds) => ds.slice(0, 7);

function cats() {
  const k = $("tKind").value;
  $("tCat").innerHTML = (k === "income" ? INC_CATS : EXP_CATS).map(c => `<option>${c}</option>`).join("");
}
$("tKind").onchange = cats;
$("tMethod").onchange = () => {
  $("instRow").style.display = $("tMethod").value === "Installment" ? "grid" : "none";
};

function addMonths(ds, n) {
  const [y, m, d] = ds.split("-").map(Number);
  const dt = new Date(y, m - 1 + n, Math.min(d, 28));
  return Store.day(dt);
}

$("addTxn").onclick = () => {
  const date = $("tDate").value || Store.today();
  const kind = $("tKind").value, cat = $("tCat").value;
  const amt = Number($("tAmt").value), memo = $("tMemo").value.trim();
  const method = $("tMethod").value;
  if (!amt) return;
  const txns = load(TXN, []);
  if (method === "Installment" && kind === "expense") {
    const n = Math.max(2, Number($("tMonths").value) || 2);
    const card = $("tCard").value.trim() || "Card";
    const per = Math.round(amt / n);
    const planId = uid();
    for (let i = 0; i < n; i++) {
      txns.push({ id: uid(), date: addMonths(date, i), kind, cat, amt: i === n - 1 ? amt - per * (n - 1) : per, method: `Installment(${card} ${i + 1}/${n})`, memo, planId });
    }
  } else {
    txns.push({ id: uid(), date, kind, cat, amt, method, memo });
  }
  store(TXN, txns);
  $("tAmt").value = ""; $("tMemo").value = "";
  render();
};

function render() {
  const mv = $("mPicker").value || Store.today().slice(0, 7);
  $("mPicker").value = mv;
  $("headDate").textContent = mv;
  const txns = load(TXN, []).filter(t => ym(t.date) === mv).sort((a, b) => a.date.localeCompare(b.date));
  const inc = txns.filter(t => t.kind === "income").reduce((a, t) => a + t.amt, 0);
  const exp = txns.filter(t => t.kind === "expense").reduce((a, t) => a + t.amt, 0);
  $("summary").textContent = `In ${inc.toLocaleString()} · Out ${exp.toLocaleString()} · Balance ${(inc - exp).toLocaleString()} (${txns.length})`;
  const ul = $("txnList");
  ul.innerHTML = "";
  txns.forEach(t => {
    const li = document.createElement("li");
    li.textContent = `${t.date.slice(5)} [${t.kind === "income" ? "In" : "Out"}/${t.cat}] ${t.amt.toLocaleString()}${t.memo ? " · " + t.memo : ""} (${t.method})`;
    const b = document.createElement("button");
    b.textContent = "×";
    b.onclick = () => { store(TXN, load(TXN, []).filter(x => x.id !== t.id)); render(); };
    li.appendChild(b);
    ul.appendChild(li);
  });
  renderCards(mv);
  renderLoans();
  renderStmts(mv);
}

function renderCards(mv) {
  const txns = load(TXN, []);
  const plans = {};
  txns.filter(t => t.planId).forEach(t => { (plans[t.planId] = plans[t.planId] || []).push(t); });
  const box = $("cardList");
  box.innerHTML = Object.keys(plans).length ? "" : "<p class='hint'>No installments</p>";
  Object.values(plans).forEach(items => {
    items.sort((a, b) => a.date.localeCompare(b.date));
    const total = items.reduce((a, t) => a + t.amt, 0);
    const p = document.createElement("p");
    p.textContent = `${items[0].memo || items[0].cat} — ${total.toLocaleString()} (${items[0].method})`;
    box.appendChild(p);
  });
}

// --- loans (detailed) ---
function normLoan(l) {
  return {
    id: l.id, name: l.name || "",
    bank: l.bank || "", principal: Number(l.principal ?? l.total ?? 0),
    rate: Number(l.rate ?? 0), monthly: Number(l.monthly ?? 0),
    start: l.start || "", memo: l.memo || "",
    paid: Number(l.paid ?? 0), reps: Array.isArray(l.reps) ? l.reps : [],
  };
}
function loanLeft(l) {
  return l.principal - l.paid - l.reps.reduce((a, r) => a + r.amt, 0);
}
$("addLoan").onclick = () => {
  const name = $("loanName").value.trim();
  const principal = Number($("loanTotal").value);
  if (!name || !principal) return;
  const loans = load(LOAN, []).map(normLoan);
  loans.push({
    id: uid(), name, principal,
    bank: $("loanBank").value.trim(), rate: Number($("loanRate").value) || 0,
    monthly: Number($("loanMonthly").value) || 0, start: $("loanStart").value,
    memo: $("loanMemo").value.trim(), paid: 0, reps: [],
  });
  store(LOAN, loans);
  ["loanName", "loanBank", "loanTotal", "loanRate", "loanMonthly", "loanStart", "loanMemo"].forEach(id => $(id).value = "");
  renderLoans();
};
function renderLoans() {
  const box = $("loanList");
  const loans = load(LOAN, []).map(normLoan);
  if (JSON.stringify(loans) !== JSON.stringify(load(LOAN, []))) store(LOAN, loans);
  box.innerHTML = loans.length ? "" : "<p class='hint'>No loans</p>";
  loans.forEach(l => {
    const left = loanLeft(l);
    const pct = l.principal ? Math.min(100, Math.round(100 * (l.principal - left) / l.principal)) : 0;
    const div = document.createElement("div");
    div.className = "loan-detail";
    div.innerHTML = `<b>${l.name}</b> <span class="hint">${l.bank} ${l.rate ? l.rate + "%" : ""} ${l.start || ""}</span>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="hint">Left ${left.toLocaleString()} / ${l.principal.toLocaleString()} · Monthly ${Number(l.monthly).toLocaleString()}${l.memo ? " · " + l.memo : ""}</div>`;
    const row = document.createElement("div");
    row.className = "row2";
    const pay = document.createElement("button");
    pay.textContent = "Repay";
    pay.onclick = () => {
      const amt = Number(prompt("Amount", l.monthly || "")) || 0;
      if (!amt) return;
      l.reps.push({ date: Store.today(), amt });
      const txns = load(TXN, []);
      txns.push({ id: uid(), date: Store.today(), kind: "expense", cat: "Housing", amt, method: "Account", memo: `${l.name} repay` });
      store(TXN, txns); store(LOAN, loans); render();
    };
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.className = "ghost-btn";
    del.onclick = () => { if (confirm(`Delete ${l.name}?`)) { store(LOAN, loans.filter(x => x.id !== l.id)); renderLoans(); } };
    const hist = document.createElement("p");
    hist.className = "hint";
    hist.textContent = l.reps.length ? l.reps.map(r => `${r.date.slice(5)} ${r.amt.toLocaleString()}`).join(" · ") : "";
    row.append(pay, del);
    div.append(row, hist);
    box.appendChild(div);
  });
}

// --- statements (card bills, attachable) ---
$("addStmt").onclick = () => {
  const card = $("sCard").value.trim() || "Card";
  const amt = Number($("sAmt").value);
  if (!amt) return;
  const all = load(STMT, []);
  all.unshift({ id: uid(), month: $("sMonth").value || Store.today().slice(0, 7), card, amt, note: $("sNote").value.trim(), receipt: "" });
  store(STMT, all);
  $("sAmt").value = ""; $("sNote").value = "";
  renderStmts($("mPicker").value || Store.today().slice(0, 7));
};
function renderStmts(mv) {
  const box = $("stmtList");
  const all = load(STMT, []).filter(s => s.month === mv);
  box.innerHTML = all.length ? "" : "<p class='hint'>No statements</p>";
  all.forEach(s => {
    const div = document.createElement("div");
    div.className = "loan-detail";
    const p = document.createElement("p");
    p.innerHTML = `<b>${s.card}</b> — ${s.amt.toLocaleString()}${s.note ? " · " + s.note : ""}`;
    div.appendChild(p);
    if (s.receipt) {
      const img = document.createElement("img");
      img.src = s.receipt;
      img.className = "photo-prev";
      div.appendChild(img);
    }
    const row = document.createElement("div");
    row.className = "row2";
    const att = document.createElement("label");
    att.className = "ghost-btn";
    att.textContent = "Receipt";
    const fi = document.createElement("input");
    fi.type = "file"; fi.accept = "image/*"; fi.style.display = "none";
    fi.onchange = () => {
      const f = fi.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        const all2 = load(STMT, []);
        const m = all2.find(x => x.id === s.id);
        if (m) { m.receipt = r.result; store(STMT, all2); renderStmts(mv); }
      };
      r.readAsDataURL(f);
    };
    att.appendChild(fi);
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.className = "ghost-btn";
    del.onclick = () => { store(STMT, load(STMT, []).filter(x => x.id !== s.id)); renderStmts(mv); };
    row.append(att, del);
    div.appendChild(row);
    box.appendChild(div);
  });
}

$("mPicker").onchange = render;
$("goTodayDate").onclick = () => { $("mPicker").value = Store.today().slice(0, 7); render(); };
$("tDate").value = Store.today();
cats();
render();
