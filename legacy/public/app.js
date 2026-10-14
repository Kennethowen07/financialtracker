const $ = (id) => document.getElementById(id);

// ---------- format ----------
const rupiah = (n) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

function compact(n) {
  if (n >= 1_000_000) return `Rp${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`;
  if (n >= 1_000) return `Rp${Math.round(n / 1_000)}rb`;
  return `Rp${n}`;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_LONG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const monthName = (m) => `${MONTHS_LONG[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const shortDate = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS_SHORT[Number(iso.slice(5, 7)) - 1]}`;
const longDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function prevMonth(m) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}

function daysInMonth(m) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** Membuat elemen DOM; teks selalu lewat textContent supaya aman dari HTML injection. */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "style") Object.assign(node.style, value);
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child != null && child !== false) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const SVG_NS = "http://www.w3.org/2000/svg";
function icon(paths, size = 15, strokeWidth = 2) {
  const svg = document.createElementNS(SVG_NS, "svg");
  for (const [k, v] of Object.entries({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    "stroke-width": strokeWidth, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) {
    svg.setAttribute(k, v);
  }
  for (const d of paths) {
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    svg.append(p);
  }
  return svg;
}
const ICONS = {
  pencil: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"],
  trash: ["M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"],
  down: ["M12 5v14M19 12l-7 7-7-7"],
  up: ["M12 19V5M5 12l7-7 7 7"],
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ---------- warna chip kategori (dari design token) ----------
const CHIP_PALETTE = [
  ["#FFE9E3", "#C2502E"],
  ["#E3F0FF", "#2A6FDB"],
  ["#EAE6FF", "#6C4DDB"],
  ["#FFF2D9", "#B7791F"],
  ["#E1F5EC", "#1F8A5B"],
];
const CHIP_FIXED = {
  "Makanan & Minuman": 0,
  Transportasi: 1,
  Belanja: 2,
  Hiburan: 3,
  "Tagihan & Rumah": 4,
};
function chipColors(category, type) {
  if (type === "income") return CHIP_PALETTE[4];
  if (category in CHIP_FIXED) return CHIP_PALETTE[CHIP_FIXED[category]];
  const idx = (meta?.categories.expense ?? []).findIndex((c) => c.name === category);
  return CHIP_PALETTE[Math.max(0, idx) % CHIP_PALETTE.length];
}
function categoryChip(category, type) {
  const [bg, fg] = chipColors(category, type);
  return el("span", { class: "chip", style: { background: bg, color: fg }, title: category }, category);
}

// ---------- tooltip (hover & fokus keyboard) ----------
const tooltip = $("tooltip");
function attachTooltip(node, title, body) {
  const show = (x, y) => {
    tooltip.replaceChildren(el("b", {}, title), body);
    tooltip.hidden = false;
    const { width, height } = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.min(window.innerWidth - width - 8, Math.max(8, x - width / 2))}px`;
    tooltip.style.top = `${Math.max(8, y - height - 12)}px`;
  };
  node.addEventListener("mousemove", (e) => show(e.clientX, e.clientY));
  node.addEventListener("focus", () => {
    const r = node.getBoundingClientRect();
    show(r.left + r.width / 2, r.top);
  });
  for (const evt of ["mouseleave", "blur"]) node.addEventListener(evt, () => (tooltip.hidden = true));
}

// ---------- state ----------
let meta = null;
let report = null;
let view = "dashboard";
let month = "";
let pickerYear = 0;

// ================= SIDEBAR & HEADER =================
function renderChrome() {
  for (const item of document.querySelectorAll(".nav-item")) {
    const active = item.dataset.view === view;
    item.classList.toggle("active", active);
    item.classList.toggle("secondary", active && item.dataset.view === "ai");
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  }
  $("nav-ai").classList.toggle("dimmed", !meta.aiEnabled);
  $("nav-ai-badge").hidden = meta.aiEnabled;
  $("month-text").textContent = monthName(month);

  const isAi = view === "ai";
  const empty = !isAi && report && report.totals.count === 0;
  $("kicker").textContent = isAi ? "Wawasan otomatis" : monthName(month);
  $("title").textContent = isAi ? "AI Analyzer" : empty ? "Pengeluaran" : "Ringkasan Bulan Ini";
  $("title-badge").hidden = !(isAi && !meta.aiEnabled);
  $("add-btn").hidden = isAi;
  $("view-dashboard").hidden = isAi;
  $("view-ai").hidden = !isAi;
}

// ---------- pemilih bulan ----------
const monthPop = $("month-pop");
const monthBtn = $("month-btn");

function renderMonthPicker() {
  $("year-text").textContent = pickerYear;
  const withData = new Set(meta.months);
  $("month-grid").replaceChildren(
    ...MONTHS_SHORT.map((label, i) => {
      const value = `${pickerYear}-${String(i + 1).padStart(2, "0")}`;
      const cls = ["month-cell", value === month && "selected", withData.has(value) && "has-data"].filter(Boolean).join(" ");
      return el(
        "button",
        { type: "button", class: cls, "aria-label": `${MONTHS_LONG[i]} ${pickerYear}${withData.has(value) ? ", ada data" : ""}`,
          onclick: () => { closeMonthPicker(); setMonth(value); } },
        label,
      );
    }),
  );
}
function openMonthPicker() {
  pickerYear = Number(month.slice(0, 4));
  renderMonthPicker();
  monthPop.hidden = false;
  monthBtn.setAttribute("aria-expanded", "true");
  monthPop.querySelector(".selected, .month-cell")?.focus();
}
function closeMonthPicker() {
  if (monthPop.hidden) return;
  monthPop.hidden = true;
  monthBtn.setAttribute("aria-expanded", "false");
}
monthBtn.addEventListener("click", () => (monthPop.hidden ? openMonthPicker() : closeMonthPicker()));
$("year-prev").addEventListener("click", () => { pickerYear--; renderMonthPicker(); });
$("year-next").addEventListener("click", () => { pickerYear++; renderMonthPicker(); });
document.addEventListener("click", (e) => {
  if (!monthPop.hidden && !e.target.closest(".month")) closeMonthPicker();
});

// ================= DASHBOARD =================
function renderStats() {
  const { totals, previous, previousPartial, byCategory } = report;
  const expenseCount = byCategory.filter((r) => r.type === "expense").reduce((s, r) => s + r.count, 0);
  const incomeCount = byCategory.filter((r) => r.type === "income").reduce((s, r) => s + r.count, 0);
  const today = meta.today;
  const days = today.startsWith(month) ? Number(today.slice(8, 10)) : month < today.slice(0, 7) ? daysInMonth(month) : 0;

  $("s-total").textContent = rupiah(totals.expense);
  const prev = prevMonth(month);
  const prevLabel = previousPartial ? `1–${days} ${MONTHS_SHORT[Number(prev.slice(5)) - 1]}` : MONTHS_SHORT[Number(prev.slice(5)) - 1];
  if (!previous.expense) {
    $("s-total-foot").replaceChildren(`belum ada data ${previousPartial ? "periode yang sama " : ""}bulan lalu`);
  } else {
    const pct = ((totals.expense - previous.expense) / previous.expense) * 100;
    const up = pct > 0;
    const pctText = `${Math.abs(pct).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
    $("s-total-foot").replaceChildren(
      el("span", { class: `delta-chip ${up ? "up" : "down"}`, title: `${prevLabel}: ${rupiah(previous.expense)}` },
        icon(up ? ICONS.up : ICONS.down, 12, 2.6), pctText),
      el("span", {}, `vs ${prevLabel}`),
    );
  }

  $("s-count").textContent = expenseCount.toLocaleString("id-ID");
  $("s-count-foot").textContent = incomeCount ? `transaksi bulan ini · ${incomeCount} pemasukan` : "transaksi bulan ini";

  $("s-avg").textContent = days ? rupiah(Math.round(totals.expense / days)) : "–";
  $("s-avg-foot").textContent = days ? `dari ${days} hari berjalan` : "bulan belum dimulai";
}

function renderCategories() {
  const rows = report.byCategory.filter((r) => r.type === "expense");
  const box = $("categories");
  $("cat-meta").textContent = rows.length ? `${rows.length} kategori` : "";
  if (rows.length === 0) {
    box.replaceChildren(el("p", { class: "empty" }, "Belum ada pengeluaran bulan ini."));
    return;
  }
  const max = rows[0].total;
  const total = report.totals.expense;
  const icons = new Map(meta.categories.expense.map((c) => [c.name, c.icon]));
  box.replaceChildren(
    ...rows.map((r) => {
      const pct = Math.round((r.total / total) * 100);
      const row = el(
        "div",
        { class: "hbar", tabindex: "0", "aria-label": `${r.category}: ${rupiah(r.total)}, ${pct}%` },
        el("span", { class: "hbar-label" }, el("span", { "aria-hidden": "true" }, icons.get(r.category) ?? "📦"),
          el("span", { class: "name" }, r.category)),
        el(
          "span",
          { class: "hbar-track" },
          el("span", { class: "hbar-fill", style: { width: `calc((100% - 92px) * ${r.total / max})` } }),
          el("span", { class: "hbar-value" }, `${compact(r.total)} · ${pct}%`),
        ),
      );
      attachTooltip(row, r.category, el("span", {}, `${rupiah(r.total)} · ${r.count} transaksi · ${pct}% dari total`));
      return row;
    }),
  );
}

function niceMax(value) {
  if (value <= 0) return 10_000;
  const exp = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * exp >= value) return step * exp;
  return 10 * exp;
}

function renderDaily() {
  const n = daysInMonth(month);
  $("daily-meta").textContent = monthName(month);
  const byDate = new Map(report.daily.map((d) => [d.date, d.expense]));
  const days = Array.from({ length: n }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { date, day: i + 1, expense: byDate.get(date) ?? 0 };
  });
  const peak = days.reduce((a, b) => (b.expense > a.expense ? b : a));
  const top = niceMax(peak.expense);

  const grid = [1, 0.5].map((f) =>
    el("div", { class: "daily-grid", style: { top: `${(1 - f) * 100}%` } }, el("span", {}, compact(top * f))),
  );
  const cols = days.map((d) => {
    const h = (d.expense / top) * 100;
    const col = el(
      "div",
      { class: "daily-col", tabindex: "0", "aria-label": `${longDate(d.date)}: ${rupiah(d.expense)}` },
      d.expense > 0 ? el("div", { class: "daily-bar", style: { height: `max(${h}%, 3px)` } }) : null,
      d === peak && d.expense > 0 ? el("span", { class: "daily-peak", style: { bottom: `${h}%` } }, compact(d.expense)) : null,
    );
    attachTooltip(col, longDate(d.date), el("span", {}, d.expense ? rupiah(d.expense) : "Tidak ada pengeluaran"));
    return col;
  });
  const xLabels = days.map((d) => el("span", {}, d.day === 1 || d.day % 5 === 0 ? String(d.day) : ""));

  $("daily").replaceChildren(
    el("div", { class: "daily-plot" }, ...grid, el("div", { class: "daily-bars" }, ...cols)),
    el("div", { class: "daily-x", "aria-hidden": "true" }, ...xLabels),
  );
}

function renderCategoryFilter() {
  const select = $("filter-category");
  const current = select.value;
  const used = [...new Set(report.transactions.map((t) => t.category))].sort();
  select.replaceChildren(el("option", { value: "" }, "Semua kategori"), ...used.map((c) => el("option", { value: c }, c)));
  select.value = used.includes(current) ? current : "";
}

function renderTable() {
  const filter = $("filter-category").value;
  const rows = report.transactions.filter((t) => !filter || t.category === filter);
  $("tx-count").textContent = `${rows.length} transaksi`;
  const body = $("tx-body");
  if (rows.length === 0) {
    body.replaceChildren(el("div", { class: "t-empty" }, "Tidak ada transaksi untuk filter ini."));
    return;
  }
  body.replaceChildren(
    ...rows.map((t) =>
      el(
        "div",
        { class: "trow", role: "row" },
        el("span", { class: "t-date" }, shortDate(t.date), categoryChip(t.category, t.type)),
        el("span", { class: "t-desc", title: t.description }, t.description,
          t.source === "lokal" ? el("span", { class: "t-source", title: "Dicatat tanpa AI" }, "lokal") : null),
        el("span", { class: "t-cat" }, categoryChip(t.category, t.type)),
        el("span", { class: `t-amount ${t.type === "income" ? "income" : ""}` }, `${t.type === "income" ? "+" : ""}${rupiah(t.amount)}`),
        el(
          "span",
          { class: "t-actions" },
          el("button", { class: "act edit", type: "button", title: "Edit", "aria-label": `Edit ${t.description}`, onclick: (e) => openForm(t, e.currentTarget) },
            icon(ICONS.pencil)),
          el("button", { class: "act del", type: "button", title: "Hapus", "aria-label": `Hapus ${t.description}`, onclick: (e) => openConfirm(t, e.currentTarget) },
            icon(ICONS.trash)),
        ),
      ),
    ),
  );
}

function renderDashboard() {
  const empty = report.totals.count === 0;
  $("dash").hidden = empty;
  $("dash-empty").hidden = !empty;
  if (empty) {
    $("empty-text").textContent = `Bulan ${monthName(month)} masih kosong. Catat lewat bot Telegram atau tombol di bawah untuk mulai melihat ringkasan dan grafiknya.`;
    return;
  }
  renderStats();
  renderCategories();
  renderDaily();
  renderCategoryFilter();
  renderTable();
}

// ================= AI ANALYZER =================
let insightRequest = 0;

function renderInsightText(text) {
  const blocks = [];
  let list = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[•\-*]\s+/.test(line)) {
      if (!list) blocks.push((list = el("ul")));
      list.append(el("li", {}, line.replace(/^[•\-*]\s+/, "")));
      continue;
    }
    list = null;
    blocks.push(line.startsWith("💡") ? el("div", { class: "ai-tip" }, line) : el("p", {}, line));
  }
  return blocks;
}

async function loadInsight(force = false) {
  $("ai-on").hidden = !meta.aiEnabled;
  $("ai-off").hidden = meta.aiEnabled;
  if (!meta.aiEnabled) return;

  const req = ++insightRequest;
  const body = $("ai-body");
  const button = $("ai-refresh");
  $("ai-title").textContent = `Analisis ${monthName(month)}`;
  button.disabled = true;
  body.replaceChildren(el("p", { class: "muted" }, "AI sedang membaca pola pengeluaranmu…"));
  $("ai-meta").textContent = "";
  try {
    const { content, cached } = await api(`/api/insight?month=${month}${force ? "&force=1" : ""}`);
    if (req !== insightRequest) return;
    body.replaceChildren(...renderInsightText(content));
    $("ai-meta").textContent = cached ? "Dari cache — data bulan ini belum berubah sejak analisis terakhir." : "Baru dibuat oleh AI.";
  } catch (err) {
    if (req === insightRequest) body.replaceChildren(el("p", { class: "muted" }, `Gagal memuat analisis: ${err.message}`));
  } finally {
    if (req === insightRequest) button.disabled = false;
  }
}
$("ai-refresh").addEventListener("click", () => loadInsight(true));

// ================= FORM TAMBAH / EDIT =================
const formOverlay = $("form-overlay");
const form = $("form");
const fAmount = $("f-amount");
const fDesc = $("f-desc");
const fDate = $("f-date");
let formState = null; // { id, type, category, returnFocus, touched: Set }

const digits = (s) => s.replace(/\D/g, "").replace(/^0+/, "");
const formatThousands = (s) => (s ? Number(s).toLocaleString("id-ID") : "");

function renderCategoryChoices() {
  const list = formState.type === "income" ? meta.categories.income : meta.categories.expense;
  const select = (name) => {
    formState.category = name;
    // ubah atribut saja (tanpa render ulang) supaya fokus keyboard tidak hilang
    for (const chip of $("f-cats").children) chip.setAttribute("aria-checked", String(chip.dataset.name === name));
  };
  $("f-cats").replaceChildren(
    ...list.map((c) =>
      el(
        "button",
        { type: "button", class: "cat-chip", role: "radio", "data-name": c.name,
          "aria-checked": String(c.name === formState.category), onclick: () => select(c.name) },
        c.name,
      ),
    ),
  );
}

function validateForm() {
  const amount = Number(digits(fAmount.value));
  const desc = fDesc.value.trim();
  const errors = {
    amount: amount > 0 ? "" : "Nominal wajib lebih dari 0",
    desc: !desc ? "Deskripsi wajib diisi" : desc.length > 100 ? "Maksimal 100 karakter" : "",
    date: fDate.value ? "" : "Tanggal wajib diisi",
  };
  const show = (key, input, box) => {
    const msg = formState.touched.has(key) ? errors[key] : "";
    if (box) $(box).textContent = msg;
    input.classList.toggle("invalid", Boolean(msg));
  };
  show("amount", $("amount-box"), "e-amount");
  show("desc", fDesc, "e-desc");
  show("date", fDate, null);
  const valid = !errors.amount && !errors.desc && !errors.date;
  $("f-save").disabled = !valid;
  return valid;
}

function openForm(tx = null, trigger = null) {
  const type = tx?.type ?? "expense";
  const list = type === "income" ? meta.categories.income : meta.categories.expense;
  formState = {
    id: tx?.id ?? null,
    type,
    category: tx?.category ?? list[list.length - 1].name,
    returnFocus: trigger ?? document.activeElement,
    touched: new Set(),
  };
  $("form-title").textContent = tx ? (type === "income" ? "Edit Pemasukan" : "Edit Pengeluaran") : "Tambah Pengeluaran";
  fAmount.value = tx ? formatThousands(String(tx.amount)) : "";
  fDesc.value = tx?.description ?? "";
  // tambah baru: tanggal default hari ini (atau tgl 1 kalau sedang melihat bulan lain)
  fDate.value = tx?.date ?? (meta.today.startsWith(month) ? meta.today : `${month}-01`);
  fDate.max = meta.today;
  $("e-form").textContent = "";
  renderCategoryChoices();
  validateForm();
  formOverlay.hidden = false;
  fAmount.focus();
}

function closeForm() {
  if (formOverlay.hidden) return;
  formOverlay.hidden = true;
  formState?.returnFocus?.focus?.();
  formState = null;
}

fAmount.addEventListener("input", () => {
  fAmount.value = formatThousands(digits(fAmount.value).slice(0, 13));
  validateForm();
});
for (const [input, key] of [[fAmount, "amount"], [fDesc, "desc"], [fDate, "date"]]) {
  input.addEventListener("blur", () => { formState?.touched.add(key); if (formState) validateForm(); });
  if (input !== fAmount) input.addEventListener("input", validateForm);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formState.touched = new Set(["amount", "desc", "date"]);
  if (!validateForm()) return;
  const payload = {
    type: formState.type,
    amount: Number(digits(fAmount.value)),
    description: fDesc.value.trim(),
    category: formState.category,
    date: fDate.value,
  };
  $("f-save").disabled = true;
  try {
    const path = formState.id ? `/api/transactions/${formState.id}` : "/api/transactions";
    await api(path, { method: formState.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
    closeForm();
    await refreshMeta();
    await setMonth(payload.date.slice(0, 7), { force: true });
  } catch (err) {
    $("e-form").textContent = `Gagal menyimpan: ${err.message}`;
    $("f-save").disabled = false;
  }
});

// ================= KONFIRMASI HAPUS =================
const confirmOverlay = $("confirm-overlay");
let pendingDelete = null;

function openConfirm(tx, trigger) {
  pendingDelete = { tx, returnFocus: trigger };
  $("confirm-title").textContent = tx.type === "income" ? "Hapus pemasukan ini?" : "Hapus pengeluaran ini?";
  $("confirm-text").textContent = `"${tx.description}" · ${rupiah(tx.amount)} · ${shortDate(tx.date)}`;
  confirmOverlay.hidden = false;
  $("confirm-ok").focus();
}
function closeConfirm() {
  if (confirmOverlay.hidden) return;
  confirmOverlay.hidden = true;
  pendingDelete?.returnFocus?.focus?.();
  pendingDelete = null;
}
$("confirm-ok").addEventListener("click", async () => {
  const { tx } = pendingDelete;
  $("confirm-ok").disabled = true;
  try {
    await api(`/api/transactions/${tx.id}`, { method: "DELETE" });
    pendingDelete.returnFocus = null;
    closeConfirm();
    await refreshMeta();
    await setMonth(month, { force: true });
  } catch (err) {
    $("confirm-text").textContent = `Gagal menghapus: ${err.message}`;
  } finally {
    $("confirm-ok").disabled = false;
  }
});

// ---------- penutupan modal & dropdown ----------
for (const overlay of [formOverlay, confirmOverlay]) {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.closest("[data-close]")) overlay === formOverlay ? closeForm() : closeConfirm();
  });
}
document.addEventListener("keydown", (e) => {
  // Enter = Simpan, di mana pun fokusnya dalam form (kecuali tombol Batal/tutup)
  if (e.key === "Enter" && !formOverlay.hidden && !e.target.closest?.("[data-close]")) {
    e.preventDefault();
    if (!$("f-save").disabled) form.requestSubmit();
    return;
  }
  if (e.key !== "Escape") return;
  if (!confirmOverlay.hidden) closeConfirm();
  else if (!formOverlay.hidden) closeForm();
  else if (!monthPop.hidden) { closeMonthPicker(); monthBtn.focus(); }
});

$("add-btn").addEventListener("click", (e) => openForm(null, e.currentTarget));
$("empty-add").addEventListener("click", (e) => openForm(null, e.currentTarget));
$("filter-category").addEventListener("change", renderTable);

// ================= DATA & ROUTING =================
async function refreshMeta() {
  meta = await api("/api/meta");
}

async function setMonth(value, { force = false } = {}) {
  if (value === month && report && !force) return;
  month = value;
  $("main").classList.add("loading");
  try {
    report = await api(`/api/report?month=${month}`);
    renderDashboard();
  } finally {
    $("main").classList.remove("loading");
  }
  renderChrome();
  if (view === "ai") loadInsight();
}

function routeFromHash() {
  view = location.hash === "#/ai" ? "ai" : "dashboard";
  renderChrome();
  if (view === "ai") loadInsight();
}
window.addEventListener("hashchange", routeFromHash);

async function init() {
  await refreshMeta();
  month = meta.today.slice(0, 7);
  report = await api(`/api/report?month=${month}`);
  renderDashboard();
  routeFromHash();
}

init().catch((err) => {
  $("main").replaceChildren(el("p", { class: "empty" }, `Gagal memuat dashboard: ${err.message}`));
});
