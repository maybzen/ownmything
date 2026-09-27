const $ = (id) => document.getElementById(id);
const TXN = "ledger-txns";
const LOAN = "ledger-loans";
const LEGACY_TXN = "ownmything:ledger-txns";
const LEGACY_LOAN = "ownmything:ledger-loans";
const EXP_CATS = ["식비", "교통", "주거", "의료", "오복", "가족", "개인", "업무", "기타"];
const INC_CATS = ["급여", "기타소득"];

const legacyFor = (k) => k === TXN ? LEGACY_TXN : LEGACY_LOAN;
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
  $("instRow").style.display = $("tMethod").value === "카드할부" ? "grid" : "none";
};

function addMonths(ds, n) {
  const [y, m, d] = ds.split("-").map(Number);
  const dt = new Date(y, m - 1 + n, Math.min(d, 28));
  return dt.toISOString().slice(0, 10);
}

$("addTxn").onclick = () => {
  const date = $("tDate").value || new Date().toISOString().slice(0, 10);
  const kind = $("tKind").value, cat = $("tCat").value;
  const amt = Number($("tAmt").value), memo = $("tMemo").value.trim();
  const method = $("tMethod").value;
  if (!amt) return;
  const txns = load(TXN, []);
  if (method === "카드할부" && kind === "expense") {
    const n = Math.max(2, Number($("tMonths").value) || 2);
    const card = $("tCard").value.trim() || "카드";
    const per = Math.round(amt / n);
    const planId = uid();
    for (let i = 0; i < n; i++) {
      txns.push({ id: uid(), date: addMonths(date, i), kind, cat, amt: i === n - 1 ? amt - per * (n - 1) : per, method: `카드할부(${card} ${i + 1}/${n})`, memo, planId });
    }
  } else {
    txns.push({ id: uid(), date, kind, cat, amt, method, memo });
  }
  store(TXN, txns);
  $("tAmt").value = ""; $("tMemo").value = "";
  render();
};

function render() {
  const mv = $("mPicker").value || new Date().toISOString().slice(0, 7);
  $("mPicker").value = mv;
  const txns = load(TXN, []).filter(t => ym(t.date) === mv).sort((a, b) => a.date.localeCompare(b.date));
  const inc = txns.filter(t => t.kind === "income").reduce((a, t) => a + t.amt, 0);
  const exp = txns.filter(t => t.kind === "expense").reduce((a, t) => a + t.amt, 0);
  $("summary").textContent = `소득 ${inc.toLocaleString()} · 지출 ${exp.toLocaleString()} · 잔액 ${(inc - exp).toLocaleString()}원 (${txns.length}건)`;
  const ul = $("txnList");
  ul.innerHTML = "";
  txns.forEach(t => {
    const li = document.createElement("li");
    li.textContent = `${t.date.slice(5)} [${t.kind === "income" ? "소득" : "지출"}/${t.cat}] ${t.amt.toLocaleString()}원 ${t.memo ? "· " + t.memo : ""} (${t.method})`;
    const b = document.createElement("button");
    b.textContent = "×";
    b.onclick = () => { store(TXN, load(TXN, []).filter(x => x.id !== t.id)); render(); };
    li.appendChild(b);
    ul.appendChild(li);
  });
  renderCards(mv);
  renderLoans();
}

function renderCards(mv) {
  const txns = load(TXN, []);
  const plans = {};
  txns.filter(t => t.planId).forEach(t => { (plans[t.planId] = plans[t.planId] || []).push(t); });
  const box = $("cardList");
  box.innerHTML = Object.keys(plans).length ? "" : "<p class='hint'>할부 없음</p>";
  Object.values(plans).forEach(items => {
    items.sort((a, b) => a.date.localeCompare(b.date));
    const total = items.reduce((a, t) => a + t.amt, 0);
    const paid = items.filter(t => t.date < mv).length;
    const p = document.createElement("p");
    p.textContent = `${items[0].memo || items[0].cat} — ${total.toLocaleString()}원 (${items[0].method.split("(")[1] || ""} · 이번달 ${ym(items[Math.min(paid, items.length - 1)].date) === mv ? "포함" : "없음"})`;
    box.appendChild(p);
  });
}

$("addLoan").onclick = () => {
  const name = $("loanName").value.trim();
  const total = Number($("loanTotal").value), monthly = Number($("loanMonthly").value);
  if (!name || !total) return;
  const loans = load(LOAN, []);
  loans.push({ id: uid(), name, total, monthly: monthly || 0, paid: 0 });
  store(LOAN, loans);
  $("loanName").value = ""; $("loanTotal").value = ""; $("loanMonthly").value = "";
  renderLoans();
};
function renderLoans() {
  const box = $("loanList");
  const loans = load(LOAN, []);
  box.innerHTML = loans.length ? "" : "<p class='hint'>등록된 대출 없음</p>";
  loans.forEach(l => {
    const div = document.createElement("div");
    div.className = "loan";
    const left = l.total - l.paid;
    div.innerHTML = `<b>${l.name}</b> — 잔액 ${left.toLocaleString()} / 원금 ${l.total.toLocaleString()} (월 ${Number(l.monthly).toLocaleString()}) `;
    const b = document.createElement("button");
    b.textContent = l.monthly ? `월 상환 (${Number(l.monthly).toLocaleString()}원)` : "상환 기록";
    b.onclick = () => {
      const amt = Number(prompt("상환 금액", l.monthly || "")) || 0;
      if (!amt) return;
      l.paid += amt;
      const txns = load(TXN, []);
      txns.push({ id: uid(), date: new Date().toISOString().slice(0, 10), kind: "expense", cat: "주거", amt, method: "계좌", memo: `${l.name} 상환` });
      store(TXN, txns); store(LOAN, loans); render();
    };
    const del = document.createElement("button");
    del.textContent = "삭제";
    del.onclick = () => { store(LOAN, loans.filter(x => x.id !== l.id)); renderLoans(); };
    div.append(b, del);
    box.appendChild(div);
  });
}

$("mPicker").onchange = render;
$("tDate").value = new Date().toISOString().slice(0, 10);
cats();
render();
