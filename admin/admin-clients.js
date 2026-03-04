const state = {
  mainSection: "orders", // "orders" | "clients" | "products" | "reports" | "payments"
  tab: "new",
  productsSearch: "",
  productsRaisePercent: 0,
  reports: {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: "",
    summary: null
  },
  payments: {
    year: new Date().getFullYear(),
    month: "",
    day: ""
  },
  paymentsOrders: [],
  paymentView: "orders", // "orders" | "order"
  selectedPaymentOrderId: null,
  paymentOrderFull: null,
  selectedClientId: null,
  selectedProductId: null,
  clients: [],
  products: [],
  orders: [],

  view: "orders",        // "orders" | "order"
  selectedOrderId: null,
  orderFull: null,        // { order, items }
  
  // === Кеширование и оптимизация загрузки ===
  isLoadingClients: false,
  clientsLoadedAt: null,
  clientsLoadAbortController: null,
  CACHE_DURATION_MS: 5 * 60 * 1000  // 5 минут
};

const el = {
  newOrderCount: document.getElementById("newOrderCount"),
  newOrderTitle: document.getElementById("newOrderTitle"),
  board: document.querySelector(".board"),
  panelLeft: document.querySelector(".panel-left"),
  clientsList: document.getElementById("clientsList"),
  ordersList: document.getElementById("ordersList"),
  paymentsSummaryTop: document.getElementById("paymentsSummaryTop"),
  selectedClientAvatar: document.getElementById("selectedClientAvatar"),
  selectedClientName: document.getElementById("selectedClientName"),
  selectedClientMeta: document.getElementById("selectedClientMeta"),
  leftPanelTitle: document.getElementById("leftPanelTitle"),
  navOrdersBtn: document.getElementById("navOrdersBtn"),
  navClientsBtn: document.getElementById("navClientsBtn"),
  navProductsBtn: document.getElementById("navProductsBtn"),
  navReportsBtn: document.getElementById("navReportsBtn"),
  navPaymentsBtn: document.getElementById("navPaymentsBtn"),
  addClientBtn: document.getElementById("addClientBtn"),
  rightControls: document.querySelector(".right-controls"),
  topClientEditBtn: document.getElementById("topClientEditBtn"),
  clientSearch: document.getElementById("clientSearch"),
  tabOrders: document.getElementById("tabOrders"),
  tabDone: document.getElementById("tabDone"),
  tabPayNow: document.getElementById("tabPayNow"),
  yearSelect: document.getElementById("yearSelect"),
  monthSelect: document.getElementById("monthSelect"),
  addModal: document.getElementById("addModal"),
  addClose: document.getElementById("addClose"),
  addSearchInput: document.getElementById("addSearchInput"),
  addProductsList: document.getElementById("addProductsList"),
  addClientModal: document.getElementById("addClientModal"),
  addClientModalTitle: document.getElementById("addClientModalTitle"),
  addClientClose: document.getElementById("addClientClose"),
  addClientCancel: document.getElementById("addClientCancel"),
  addClientSave: document.getElementById("addClientSave"),
  addClientFullName: document.getElementById("addClientFullName"),
  addClientPhone: document.getElementById("addClientPhone"),
  addClientEmail: document.getElementById("addClientEmail"),
  addClientPharmacy: document.getElementById("addClientPharmacy"),
  addClientPhoto: document.getElementById("addClientPhoto"),
  addClientDiscount: document.getElementById("addClientDiscount"),
  addClientPassword: document.getElementById("addClientPassword"),
  discountModal: document.getElementById("discountModal"),
  discountClose: document.getElementById("discountClose"),
  discountCancel: document.getElementById("discountCancel"),
  discountSave: document.getElementById("discountSave"),
  discountInput: document.getElementById("discountInput"),
  orderDiscountModal: document.getElementById("orderDiscountModal"),
  orderDiscountClose: document.getElementById("orderDiscountClose"),
  orderDiscountCancel: document.getElementById("orderDiscountCancel"),
  orderDiscountSave: document.getElementById("orderDiscountSave"),
  orderDiscountInput: document.getElementById("orderDiscountInput"),
  raisePricesModal: document.getElementById("raisePricesModal"),
  raisePricesClose: document.getElementById("raisePricesClose"),
  raisePricesCancel: document.getElementById("raisePricesCancel"),
  raisePricesSave: document.getElementById("raisePricesSave"),
  raisePricesInput: document.getElementById("raisePricesInput"),
  raisePricesSub: document.getElementById("raisePricesSub"),
  productModal: document.getElementById("productModal"),
  productModalTitle: document.getElementById("productModalTitle"),
  productModalClose: document.getElementById("productModalClose"),
  productModalCancel: document.getElementById("productModalCancel"),
  productModalSave: document.getElementById("productModalSave"),
  productNameInput: document.getElementById("productNameInput"),
  productTypeInput: document.getElementById("productTypeInput"),
  productManufacturerInput: document.getElementById("productManufacturerInput"),
  productExpiryFromInput: document.getElementById("productExpiryFromInput"),
  productExpiryToInput: document.getElementById("productExpiryToInput"),
  productPriceInput: document.getElementById("productPriceInput"),
  productStockInput: document.getElementById("productStockInput"),
  productImageInput: document.getElementById("productImageInput")
};

let clientsControlsDataEl = null;

function ensureClientsControlsDataEl() {
  if (!el.rightControls) return null;
  if (clientsControlsDataEl && document.body.contains(clientsControlsDataEl)) return clientsControlsDataEl;
  clientsControlsDataEl = document.getElementById("clientsControlsData");
  if (!clientsControlsDataEl) {
    clientsControlsDataEl = document.createElement("div");
    clientsControlsDataEl.id = "clientsControlsData";
    clientsControlsDataEl.className = "clients-controls-data";
    el.rightControls.appendChild(clientsControlsDataEl);
  }
  return clientsControlsDataEl;
}

function setSelectedClientAvatar(name = "", photoSrc = "") {
  if (!el.selectedClientAvatar) return;

  const letter = String(name || "").trim().charAt(0).toUpperCase() || "?";
  const normalized = normalizeImageSrc(String(photoSrc || "").trim());

  el.selectedClientAvatar.textContent = letter;
  el.selectedClientAvatar.style.backgroundImage = "";
  el.selectedClientAvatar.classList.remove("has-photo");

  if (normalized) {
    el.selectedClientAvatar.textContent = "";
    el.selectedClientAvatar.style.backgroundImage = `url("${normalized}")`;
    el.selectedClientAvatar.classList.add("has-photo");
  }
}

function setSelectedClientAvatarVisible(visible) {
  if (!el.selectedClientAvatar) return;
  el.selectedClientAvatar.style.display = visible ? "inline-flex" : "none";
}

function updateClientUiState() {
  const hasClient = Boolean(state.selectedClientId);
  if (el.board) {
    el.board.classList.toggle("payments-with-client", state.mainSection === "payments" && hasClient);
  }
  if (el.addClientBtn) {
    el.addClientBtn.style.display = (state.mainSection === "clients" || state.mainSection === "products") ? "block" : "none";
    if (state.mainSection === "products") {
      el.addClientBtn.classList.remove("icon-only");
      el.addClientBtn.textContent = "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442";
      el.addClientBtn.removeAttribute("title");
    } else if (state.mainSection === "clients") {
      el.addClientBtn.classList.add("icon-only");
      el.addClientBtn.setAttribute("aria-label", "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043a\u043b\u0438\u0435\u043d\u0442\u0430");
      el.addClientBtn.setAttribute("title", "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043a\u043b\u0438\u0435\u043d\u0442\u0430");
      el.addClientBtn.innerHTML = `
        <span class="add-client-icon add-client-plus" aria-hidden="true">+</span>
      `;
    }
  }
  if (el.rightControls) {
    const isOrders = state.mainSection === "orders";
    const isClients = state.mainSection === "clients";
    const isPayments = state.mainSection === "payments";
    const showOrdersControls = (isOrders || isPayments) && hasClient;

    const orderControls = [
      el.tabOrders,
      el.tabDone,
      document.getElementById("tabNewOrder"),
      el.rightControls.querySelector(".spacer"),
      el.yearSelect?.parentElement,
      el.monthSelect?.parentElement
    ];
    orderControls.forEach(node => {
      if (!node) return;
      node.style.display = showOrdersControls ? "" : "none";
    });

    const newOrderBtn = document.getElementById("tabNewOrder");
    if (newOrderBtn) {
      newOrderBtn.style.display = (state.mainSection === "payments")
        ? "none"
        : (showOrdersControls ? "" : "none");
    }
    if (el.tabPayNow) {
      el.tabPayNow.style.display = (state.mainSection === "payments" && showOrdersControls) ? "" : "none";
    }

    const clientsData = ensureClientsControlsDataEl();
    if (clientsData) {
      clientsData.style.display = isClients && hasClient ? "flex" : "none";
    }

    el.rightControls.style.display = (showOrdersControls || (isClients && hasClient)) ? "flex" : "none";
  }
  if (el.paymentsSummaryTop) {
    const showPaymentsSummary = state.mainSection === "payments" && hasClient && state.paymentView !== "order";
    el.paymentsSummaryTop.style.display = showPaymentsSummary ? "" : "none";
    if (!showPaymentsSummary) {
      el.paymentsSummaryTop.innerHTML = "";
    }
  }
  if (el.topClientEditBtn) {
    el.topClientEditBtn.style.display = "none";
  }
  if (el.selectedClientMeta) {
    el.selectedClientMeta.style.display = "none";
  }
}

function renderNoClientState() {
  if (el.selectedClientName) {
    el.selectedClientName.textContent = "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u043b\u0438\u0435\u043d\u0442\u0430";
  }
  setSelectedClientAvatarVisible(true);
  setSelectedClientAvatar("\u0412", "");
  if (el.selectedClientMeta) {
    el.selectedClientMeta.innerHTML = "";
  }
  const clientsData = ensureClientsControlsDataEl();
  if (clientsData) {
    clientsData.innerHTML = "";
  }
  if (el.paymentsSummaryTop) {
    el.paymentsSummaryTop.style.display = "none";
    el.paymentsSummaryTop.innerHTML = "";
  }
  el.ordersList.innerHTML = "";
}

function getSelectedClient() {
  return state.clients.find(c => Number(c.id) === Number(state.selectedClientId)) || null;
}

async function loadClientMonthlyOrders(year, month) {
  if (!state.selectedClientId) return [];
  const y = Number(year) || new Date().getFullYear();
  const m = Number(month) || (new Date().getMonth() + 1);
  const url = `/api/admin/customers/${state.selectedClientId}/orders?status=done&year=${y}&month=${m}`;
  const data = await fetchJSON(url);
  return Array.isArray(data) ? data : [];
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

let clientsAnalyticsYear = new Date().getFullYear();
let clientsAnalyticsMonth = new Date().getMonth() + 1;

function renderPurchasesChart(daysData, daysInMonth = 31) {
  const chartEl = document.getElementById("purchasesChart");
  if (!chartEl) return;
  const yAxisEl = chartEl.querySelector(".chart-y");
  const gridEl = chartEl.querySelector(".chart-grid");
  const barsEl = chartEl.querySelector(".bars");
  const xAxisEl = chartEl.querySelector(".chart-x");
  if (!yAxisEl || !gridEl || !barsEl || !xAxisEl) return;
  const safeDaysInMonth = Math.min(31, Math.max(1, Number(daysInMonth) || 31));

  const byDay = new Map();
  (Array.isArray(daysData) ? daysData : []).forEach((row) => {
    const day = Number(row?.day);
    const total = Math.max(0, Number(row?.total) || 0);
    if (day >= 1 && day <= safeDaysInMonth) byDay.set(day, total);
  });

  const normalized = Array.from({ length: safeDaysInMonth }, (_, i) => ({
    day: i + 1,
    total: byDay.get(i + 1) || 0
  }));

  const maxTotalRaw = Math.max(0, ...normalized.map(d => d.total));
  const maxTotal = maxTotalRaw > 0 ? maxTotalRaw : 100;
  const tickCount = 5;
  const step = maxTotal / tickCount;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round(i * step));

  yAxisEl.innerHTML = [...yTicks].reverse().map(v => `<div>${formatMoney(v)} с</div>`).join("");

  gridEl.innerHTML = yTicks.map((v) => {
    const p = maxTotal > 0 ? (v / maxTotal) * 100 : 0;
    return `<div class="grid-line" style="bottom:${p}%"></div>`;
  }).join("");

  barsEl.style.gridTemplateColumns = `repeat(${safeDaysInMonth}, minmax(8px, 1fr))`;
  barsEl.innerHTML = normalized.map(({ day, total }) => {
    const p = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
    const hCss = total > 0 ? `${p}%` : "2px";
    const tip = `День ${day} — ${formatMoney(total)} с`;
    return `
      <div class="bar-col">
        <div class="bar-value">${formatMoney(total)}</div>
        <div class="bar ${total > 0 ? "" : "is-zero"}" style="height:${hCss};" data-tip="${tip}" title="${tip}" tabindex="0"></div>
      </div>
    `;
  }).join("");

  xAxisEl.style.gridTemplateColumns = `repeat(${safeDaysInMonth}, minmax(8px, 1fr))`;
  xAxisEl.innerHTML = normalized.map(d => `<div>${d.day}</div>`).join("");
}

async function renderClientDetails() {
  const client = state.clients.find(c => Number(c.id) === Number(state.selectedClientId));
  if (!client) {
    renderNoClientState();
    return;
  }

  const fullName = `${client.first_name || ""} ${client.last_name || ""}`.trim() || "\u0411\u0435\u0437 \u0438\u043c\u0435\u043d\u0438";
  if (el.selectedClientName) el.selectedClientName.textContent = fullName;
  setSelectedClientAvatarVisible(true);
  setSelectedClientAvatar(
    fullName,
    client.photo || client.photo_url || client.avatar || client.avatar_url || client.image || ""
  );

  const phone = client.phone || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e";
  const phoneDigits = String(phone).replace(/\D+/g, "");
  const phoneDisplay = phoneDigits.length === 9
    ? `${phoneDigits.slice(0, 3)} ${phoneDigits.slice(3)}`
    : String(phone);
  const email = client.email || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e";
  const pharmacy = client.pharmacy_name || client.address || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e";

  const createdDate = parseDateSmart(client.created_at);
  const created = createdDate && !Number.isNaN(createdDate.getTime())
    ? createdDate.toLocaleDateString("ru-RU", { timeZone: TZ })
    : "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e";

  const year = Number(clientsAnalyticsYear) || new Date().getFullYear();
  const month = Number(clientsAnalyticsMonth) || (new Date().getMonth() + 1);
  const monthOrders = await loadClientMonthlyOrders(year, month);
  const daysInMonth = getDaysInMonth(year, month);
  const daily = Array.from({ length: daysInMonth }, () => 0);

  for (const o of monthOrders) {
    const d = parseDateSmart(o.created_at);
    if (!d || Number.isNaN(d.getTime())) continue;
    const day = Number(d.toLocaleString("ru-RU", { timeZone: TZ, day: "numeric" }));
    if (day >= 1 && day <= daysInMonth) {
      daily[day - 1] += Number(o.total) || 0;
    }
  }

  let daysData = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    total: Number(daily[i] || 0)
  }));

  const monthOptionsFromOrders = Array.from(el.monthSelect?.options || [])
    .map(o => [Number(o.value), o.textContent || ""])
    .filter(([m]) => Number.isFinite(m) && m >= 1 && m <= 12);
  const monthOptions = monthOptionsFromOrders.length
    ? monthOptionsFromOrders
    : [
        [1, "\u042f\u043d\u0432\u0430\u0440\u044c"], [2, "\u0424\u0435\u0432\u0440\u0430\u043b\u044c"], [3, "\u041c\u0430\u0440\u0442"], [4, "\u0410\u043f\u0440\u0435\u043b\u044c"],
        [5, "\u041c\u0430\u0439"], [6, "\u0418\u044e\u043d\u044c"], [7, "\u0418\u044e\u043b\u044c"], [8, "\u0410\u0432\u0433\u0443\u0441\u0442"],
        [9, "\u0421\u0435\u043d\u0442\u044f\u0431\u0440\u044c"], [10, "\u041e\u043a\u0442\u044f\u0431\u0440\u044c"], [11, "\u041d\u043e\u044f\u0431\u0440\u044c"], [12, "\u0414\u0435\u043a\u0430\u0431\u0440\u044c"]
      ];

  const yearsFromOrders = Array.from(el.yearSelect?.options || [])
    .map(o => Number(o.value || o.textContent))
    .filter(y => Number.isFinite(y));
  const years = yearsFromOrders.length
    ? yearsFromOrders
    : [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2];

  if (el.selectedClientMeta) {
    el.selectedClientMeta.innerHTML = "";
  }
  const clientsData = ensureClientsControlsDataEl();
  if (clientsData) {
    const discountValue = Number(client.discount || 0);
    const discountText = Number.isFinite(discountValue)
      ? `${discountValue % 1 === 0 ? discountValue.toFixed(0) : discountValue.toFixed(2)}%`
      : "0%";

    clientsData.innerHTML = `
      <span class="clients-controls-item"><b>\u0422\u0435\u043b:</b><i>${escapeHtml(phoneDisplay)}</i></span>
      <span class="clients-controls-item"><b>Email:</b><i>${escapeHtml(email)}</i></span>
      <span class="clients-controls-item"><b>\u0410\u0434\u0440\u0435\u0441:</b><i>${escapeHtml(pharmacy)}</i></span>
      <span class="clients-controls-item"><b>\u0421\u043a\u0438\u0434\u043a\u0430:</b><i>${escapeHtml(discountText)}</i></span>
      <span class="clients-controls-item"><b>\u0421\u043e\u0437\u0434\u0430\u043d:</b><i>${escapeHtml(created)}</i></span>
      <div class="clients-controls-actions">
        <button id="clientsHeaderEditBtn" class="clients-controls-edit" type="button" aria-label="\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c" title="\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c">
          <span class="edit-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M3 17.25V21h3.75L19.81 7.94l-3.75-3.75L3 17.25Zm17.71-10.04a1 1 0 0 0 0-1.41l-2.5-2.5a1 1 0 0 0-1.42 0l-1.55 1.55 3.75 3.75 1.72-1.39Z" fill="currentColor"></path>
            </svg>
          </span>
        </button>
        <button id="clientsHeaderDiscountBtn" class="clients-controls-edit" type="button" aria-label="\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0441\u043a\u0438\u0434\u043a\u0443" title="\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0441\u043a\u0438\u0434\u043a\u0443">
          <span class="edit-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M11 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm8 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM7 19l10-14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"></path>
            </svg>
          </span>
        </button>
      </div>
    `;
    document.getElementById("clientsHeaderEditBtn")?.addEventListener("click", () => openAddClientModal("edit", client));
    document.getElementById("clientsHeaderDiscountBtn")?.addEventListener("click", () => openDiscountModal(client));
  }

  el.ordersList.innerHTML = `
    <div class="clients-view">
      <div class="clients-chart-card">
        <div class="clients-chart-top">
          <div class="clients-chart-title">\u041f\u043e\u043a\u0443\u043f\u043a\u0438 \u0437\u0430 \u043c\u0435\u0441\u044f\u0446</div>
          <div class="clients-chart-filters">
            <div class="select-wrap">
              <select id="clientsYearSelect">
                ${years.map(y => `<option value="${y}" ${Number(y) === Number(year) ? "selected" : ""}>${y}</option>`).join("")}
              </select>
            </div>
            <div class="select-wrap">
              <select id="clientsMonthSelect">
                ${monthOptions.map(([m, t]) => `<option value="${m}" ${Number(m) === Number(month) ? "selected" : ""}>${t}</option>`).join("")}
              </select>
            </div>
          </div>
        </div>

        <div class="clients-chart-body">
          <div id="purchasesChart" class="chart">
            <div class="chart-y"></div>
            <div class="chart-area">
              <div class="chart-grid"></div>
              <div class="bars"></div>
              <div class="chart-x"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  renderPurchasesChart(daysData, daysInMonth);

  document.getElementById("clientsYearSelect")?.addEventListener("change", (e) => {
    clientsAnalyticsYear = Number(e.target.value);
    void renderClientDetails();
  });
  document.getElementById("clientsMonthSelect")?.addEventListener("change", (e) => {
    clientsAnalyticsMonth = Number(e.target.value);
    void renderClientDetails();
  });
}

let reportsLoadToken = 0;

function getReportsYears() {
  const now = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => now - i);
}

function getReportsMonthOptions() {
  return [
    [1, "Январь"], [2, "Февраль"], [3, "Март"], [4, "Апрель"],
    [5, "Май"], [6, "Июнь"], [7, "Июль"], [8, "Август"],
    [9, "Сентябрь"], [10, "Октябрь"], [11, "Ноябрь"], [12, "Декабрь"]
  ];
}

function formatReportsPeriodLabel(year, month, day) {
  const monthOptions = getReportsMonthOptions();
  const monthLabel = monthOptions.find(([m]) => Number(m) === Number(month))?.[1] || "";
  if (day && month) return `${day} ${monthLabel} ${year}`;
  if (month) return `${monthLabel} ${year}`;
  return `${year} год`;
}

function printReports() {
  const client = getSelectedClient();
  if (!client) return;

  const fullName = `${client.first_name || ""} ${client.last_name || ""}`.trim() || "Без имени";
  const year = Number(state.reports.year) || new Date().getFullYear();
  const month = Number(state.reports.month) || 0;
  const day = Number(state.reports.day) || 0;
  const periodLabel = formatReportsPeriodLabel(year, month, day);

  const productsRows = document.getElementById("reportsProductsBody")?.innerHTML || "";
  const ordersRows = document.getElementById("reportsOrdersBody")?.innerHTML || "";
  const s = state.reports?.summary || {
    totalBefore: 0,
    discountText: "0%",
    totalAfter: 0,
    totalPaid: 0,
    totalDebt: 0
  };

  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Отчёт</title>
  <style>
    body { font-family: Arial, sans-serif; color:#111; margin:24px; }
    h1 { margin: 0 0 14px 0; font-size: 22px; }
    .meta { margin: 0 0 8px 0; font-size: 14px; }
    .period { margin: 0 0 16px 0; font-size: 14px; }
    table { width:100%; border-collapse: collapse; margin-top:10px; }
    th, td { border:1px solid #d1d5db; padding:8px; text-align:left; font-size:12px; }
    th { background:#f3f4f6; font-weight:700; }
    .section-title { margin-top:18px; font-size:14px; font-weight:700; }
    .grand-total { margin-top:16px; font-size:16px; font-weight:800; color:#0b1f33; }
  </style>
</head>
<body>
  <h1>Отчёт</h1>
  <div class="meta">Клиент: ${escapeHtml(fullName)}</div>
  <div class="period">Период: ${escapeHtml(periodLabel)}</div>
  <div class="meta">Общая сумма: <b>${formatMoney(Number(s.totalBefore) || 0)} с</b></div>
  <div class="meta">Скидка: <b>${escapeHtml(String(s.discountText || "0%"))}</b></div>
  <div class="meta">Со скидкой: <b>${formatMoney(Number(s.totalAfter) || 0)} с</b></div>
  <div class="meta">Итого к оплате: <b>${formatMoney(Number(s.totalAfter) || 0)} с</b></div>
  <div class="meta">Оплачено: <b>${formatMoney(Number(s.totalPaid) || 0)} с</b></div>
  <div class="meta">Долг: <b>${formatMoney(Number(s.totalDebt) || 0)} с</b></div>

  <div class="section-title">Что и сколько купил</div>
  <table>
    <thead>
      <tr>
        <th>Товар</th>
        <th>Количество</th>
        <th>Сумма</th>
      </tr>
    </thead>
    <tbody>${productsRows}</tbody>
  </table>

  <div class="section-title">Заказы</div>
  <table>
    <thead>
      <tr>
        <th>Дата</th>
        <th>Общая сумма</th>
        <th>Скидка</th>
        <th>Сумма со скидкой</th>
      </tr>
    </thead>
    <tbody>${ordersRows}</tbody>
  </table>

  <div class="grand-total">Итого к оплате: ${formatMoney(Number(s.totalAfter) || 0)} с</div>
</body>
</html>`;

  const old = document.getElementById("reportsPrintFrame");
  if (old) old.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "reportsPrintFrame";
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  }, 100);

  setTimeout(() => {
    iframe.remove();
  }, 1500);
}

async function renderReportsData() {
  if (state.mainSection !== "reports" || !state.selectedClientId) return;

  const summaryEl = document.getElementById("reportsSummary");
  const productsEl = document.getElementById("reportsProductsBody");
  const ordersEl = document.getElementById("reportsOrdersBody");
  if (!summaryEl || !productsEl || !ordersEl) return;

  summaryEl.innerHTML = `<div style="padding:8px 0;">Загрузка отчёта...</div>`;
  productsEl.innerHTML = `<tr><td colspan="3" class="stock-empty">Загрузка...</td></tr>`;
  ordersEl.innerHTML = `<tr><td colspan="4" class="stock-empty">Загрузка...</td></tr>`;

  const token = ++reportsLoadToken;
  const year = Number(state.reports.year) || new Date().getFullYear();
  const month = Number(state.reports.month) || 0;
  const day = Number(state.reports.day) || 0;
  const periodLabel = formatReportsPeriodLabel(year, month, day);

  let url = `/api/admin/customers/${state.selectedClientId}/orders?status=done&year=${year}`;
  if (month >= 1 && month <= 12) {
    url += `&month=${month}`;
    if (day >= 1 && day <= 31) url += `&day=${day}`;
  }

  let orders = [];
  try {
    const data = await fetchJSON(url);
    orders = Array.isArray(data) ? data : [];
  } catch (e) {
    if (token !== reportsLoadToken) return;
    summaryEl.innerHTML = `<div style="padding:8px 0; color:#b91c1c;">${escapeHtml(e?.message || "Ошибка загрузки отчёта")}</div>`;
    productsEl.innerHTML = `<tr><td colspan="3" class="stock-empty">Нет данных</td></tr>`;
    ordersEl.innerHTML = `<tr><td colspan="4" class="stock-empty">Нет данных</td></tr>`;
    return;
  }

  if (token !== reportsLoadToken) return;

  if (!month && day >= 1 && day <= 31) {
    orders = orders.filter((o) => {
      const d = parseDateSmart(o.created_at);
      if (!d || Number.isNaN(d.getTime())) return false;
      const localDay = Number(d.toLocaleString("ru-RU", { timeZone: TZ, day: "numeric" }));
      return localDay === day;
    });
  }

  const totalBefore = orders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const totalAfter = orders.reduce((acc, o) => {
    const raw = Number(o.total_after_discount);
    const total = Number(o.total) || 0;
    const discount = Number(o.discount) || 0;
    return acc + (Number.isFinite(raw) ? raw : calcDiscountedTotal(total, discount));
  }, 0);
  const totalPaid = orders.reduce((acc, o) => {
    const raw = Number(o.total_after_discount);
    const total = Number(o.total) || 0;
    const discount = Number(o.discount) || 0;
    const totalAfterOrder = Number.isFinite(raw) ? raw : calcDiscountedTotal(total, discount);
    const paid = Math.max(0, Math.min(totalAfterOrder, Number(o.paid_amount) || 0));
    return acc + paid;
  }, 0);
  const totalDebt = Math.max(0, totalAfter - totalPaid);
  const reportClient = getSelectedClient();
  const clientDiscount = Number(reportClient?.discount) || 0;
  const discountSummary = `${formatPercent(clientDiscount)}%`;
  state.reports.summary = {
    totalBefore,
    discountText: discountSummary,
    totalAfter,
    totalPaid,
    totalDebt
  };
  summaryEl.innerHTML = `
    <div
      class="order-card"
      style="margin:0; grid-template-columns:repeat(6,minmax(0,1fr)); gap:8px; padding:10px 12px; background:rgba(255,255,255,.52); border:none; box-shadow:none;"
    >
      <div class="order-meta" style="margin:0; font-size:11px; color:rgba(11,31,51,.45);">Общая сумма<br><span style="display:inline-block; margin-top:5px; font-weight:800; font-size:13px; color:#0b6cff;">${formatMoney(totalBefore)} с</span></div>
      <div class="order-meta" style="margin:0; font-size:11px; color:rgba(11,31,51,.45);">Скидка<br><span style="display:inline-block; margin-top:5px; font-weight:800; font-size:13px; color:#0b6cff;">${discountSummary}</span></div>
      <div class="order-meta" style="margin:0; font-size:11px; color:rgba(11,31,51,.45);">Со скидкой<br><span style="display:inline-block; margin-top:5px; font-weight:800; font-size:13px; color:#0b6cff;">${formatMoney(totalAfter)} с</span></div>
      <div class="order-meta" style="margin:0; font-size:11px; color:rgba(11,31,51,.45);">Итого к оплате<br><span style="display:inline-block; margin-top:5px; font-weight:800; font-size:13px; color:#0b6cff;">${formatMoney(totalAfter)} с</span></div>
      <div class="order-meta" style="margin:0; font-size:11px; color:rgba(11,31,51,.45);">Оплачено<br><span style="display:inline-block; margin-top:5px; font-weight:800; font-size:13px; color:#0b6cff;">${formatMoney(totalPaid)} с</span></div>
      <div class="order-meta" style="margin:0; font-size:11px; color:rgba(11,31,51,.45);">Долг<br><span style="display:inline-block; margin-top:5px; font-weight:800; font-size:13px; color:#b42323;">${formatMoney(totalDebt)} с</span></div>
    </div>
  `;

  if (!orders.length) {
    productsEl.innerHTML = `<tr><td colspan="3" class="stock-empty">За выбранный период покупок нет</td></tr>`;
    ordersEl.innerHTML = `<tr><td colspan="4" class="stock-empty">За выбранный период заказов нет</td></tr>`;
    return;
  }

  const fullOrders = await Promise.all(
    orders.map(async (o) => {
      try {
        return await fetchJSON(`/api/admin/orders/${Number(o.id)}/full`);
      } catch (_) {
        return null;
      }
    })
  );

  if (token !== reportsLoadToken) return;

  const byProduct = new Map();
  for (const full of fullOrders) {
    const items = Array.isArray(full?.items) ? full.items : [];
    for (const item of items) {
      const name = String(item?.name || `Товар #${Number(item?.product_id) || "-"}`).trim();
      const qty = Math.max(0, Number(item?.qty) || 0);
      const price = Math.max(0, Number(item?.price) || 0);
      const prev = byProduct.get(name) || { qty: 0, total: 0 };
      prev.qty += qty;
      prev.total += qty * price;
      byProduct.set(name, prev);
    }
  }

  const productRows = Array.from(byProduct.entries())
    .map(([name, v]) => ({ name, qty: v.qty, total: v.total }))
    .sort((a, b) => b.qty - a.qty || b.total - a.total);

  productsEl.innerHTML = productRows.length
    ? productRows.map((r) => `
        <tr>
          <td>${escapeHtml(r.name)}</td>
          <td>${Number(r.qty)}</td>
          <td>${formatMoney(r.total)} с</td>
        </tr>
      `).join("")
    : `<tr><td colspan="3" class="stock-empty">Нет данных по товарам</td></tr>`;

  ordersEl.innerHTML = orders.map((o) => {
    const total = Number(o.total) || 0;
    const discount = Number(o.discount) || 0;
    const totalAfterRaw = Number(o.total_after_discount);
    const totalAfterValue = Number.isFinite(totalAfterRaw) ? totalAfterRaw : calcDiscountedTotal(total, discount);
    const dt = parseDateSmart(o.created_at);
    const dateText = dt && !Number.isNaN(dt.getTime())
      ? `${dt.toLocaleDateString("ru-RU", { timeZone: TZ })} ${dt.toLocaleTimeString("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })}`
      : "Дата не указана";
    return `
      <tr>
        <td>${escapeHtml(dateText)}</td>
        <td>${formatMoney(total)} с</td>
        <td>${formatPercent(discount)}%</td>
        <td>${formatMoney(totalAfterValue)} с</td>
      </tr>
    `;
  }).join("");
}

async function renderReportsView() {
  const client = getSelectedClient();
  if (!client) {
    renderNoClientState();
    return;
  }

  const fullName = `${client.first_name || ""} ${client.last_name || ""}`.trim() || "Без имени";
  if (el.selectedClientName) el.selectedClientName.textContent = `Отчёт: ${fullName}`;
  setSelectedClientAvatarVisible(true);
  setSelectedClientAvatar(
    fullName,
    client.photo || client.photo_url || client.avatar || client.avatar_url || client.image || ""
  );
  if (el.selectedClientMeta) el.selectedClientMeta.innerHTML = "";
  const clientsData = ensureClientsControlsDataEl();
  if (clientsData) clientsData.innerHTML = "";

  const years = getReportsYears();
  const year = Number(state.reports.year) || years[0];
  const month = Number(state.reports.month) || 0;
  const day = Number(state.reports.day) || 0;
  const months = getReportsMonthOptions();
  const daysInMonth = month ? getDaysInMonth(year, month) : 0;
  const dayOptions = month
    ? [`<option value="">Все дни</option>`, ...Array.from({ length: daysInMonth }, (_, i) => {
        const d = i + 1;
        return `<option value="${d}" ${d === day ? "selected" : ""}>${d}</option>`;
      })].join("")
    : `<option value="" selected>Все дни</option>`;

  el.ordersList.innerHTML = `
    <div class="stock-view" style="grid-template-rows:auto auto auto auto; align-content:start;">
      <div class="stock-toolbar" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <div class="select-wrap">
          <select id="reportsYearSelect">
            ${years.map((y) => `<option value="${y}" ${Number(y) === year ? "selected" : ""}>${y}</option>`).join("")}
          </select>
        </div>
        <div class="select-wrap">
          <select id="reportsMonthSelect" style="min-width:120px;">
            <option value="">Все месяцы</option>
            ${months.map(([m, label]) => `<option value="${m}" ${Number(m) === month ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </div>
        <div class="select-wrap">
          <select id="reportsDaySelect">
            ${dayOptions}
          </select>
        </div>
        <div style="flex:1 1 auto;"></div>
        <button
          id="reportsRefreshBtn"
          type="button"
          aria-label="Обновить отчёт"
          title="Обновить отчёт"
          style="height:45px; width:45px; min-width:45px; border-radius:14px; border:1px solid rgba(11,108,255,.25); background:rgba(255,255,255,.74); display:inline-flex; align-items:center; justify-content:center; cursor:pointer;"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-2.34-5.66" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M20 4v6h-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button id="reportsPrintBtn" class="stock-add-btn" type="button" style="height:45px;">Печатать</button>
      </div>

      <div id="reportsSummary"></div>

      <div class="stock-table-wrap">
        <table class="stock-table">
          <thead>
            <tr>
              <th>Товар</th>
              <th>Количество</th>
              <th>Сумма</th>
            </tr>
          </thead>
          <tbody id="reportsProductsBody"></tbody>
        </table>
      </div>

      <div class="stock-table-wrap" style="margin-top:12px;">
        <table class="stock-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Общая сумма</th>
              <th>Скидка</th>
              <th>Сумма со скидкой</th>
            </tr>
          </thead>
          <tbody id="reportsOrdersBody"></tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("reportsYearSelect")?.addEventListener("change", (e) => {
    state.reports.year = Number(e.target.value) || new Date().getFullYear();
    if (state.reports.month) {
      const maxDay = getDaysInMonth(state.reports.year, Number(state.reports.month));
      if (Number(state.reports.day) > maxDay) state.reports.day = "";
    }
    void renderReportsView();
  });
  document.getElementById("reportsMonthSelect")?.addEventListener("change", (e) => {
    state.reports.month = String(e.target.value || "");
    state.reports.day = "";
    void renderReportsView();
  });
  document.getElementById("reportsDaySelect")?.addEventListener("change", (e) => {
    state.reports.day = String(e.target.value || "");
    void renderReportsData();
  });
  document.getElementById("reportsRefreshBtn")?.addEventListener("click", () => {
    void renderReportsData();
  });
  document.getElementById("reportsPrintBtn")?.addEventListener("click", () => {
    printReports();
  });

  await renderReportsData();
}

async function toggleOrderPayment(orderId, nextStatus) {
  await fetchJSON(`/api/admin/orders/${Number(orderId)}/payment`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payment_status: nextStatus })
  });
}

function openPaymentModal(orderId, remainingToPay, mode = "add", dueAmount = null, currentPaid = null) {
  pendingPaymentOrderId = Number(orderId) || null;
  pendingPaymentTotal = Number(remainingToPay) || 0;
  pendingPaymentMode = mode;
  pendingPaymentDue = Number(dueAmount ?? remainingToPay) || 0;
  if (paymentSub) {
    paymentSub.textContent = mode === "set"
      ? `Сумма заказа: ${formatMoney(pendingPaymentDue)} с`
      : mode === "bulk"
        ? `Общий долг: ${formatMoney(pendingPaymentTotal)} с`
        : `Итого к оплате: ${formatMoney(pendingPaymentTotal)} с`;
  }
  if (paymentGivenInput) {
    paymentGivenInput.value = mode === "set" ? String(Number(currentPaid || 0)) : "";
    paymentGivenInput.max = String(mode === "set" ? pendingPaymentDue : pendingPaymentTotal);
  }
  if (paymentError) {
    paymentError.textContent = "";
    paymentError.style.display = "none";
  }
  paymentModal?.classList.remove("hidden");
  setTimeout(() => paymentGivenInput?.focus(), 0);
}

function closePaymentModal() {
  pendingPaymentOrderId = null;
  pendingPaymentBulkOrders = [];
  pendingPaymentTotal = 0;
  pendingPaymentDue = 0;
  pendingPaymentMode = "add";
  paymentModal?.classList.add("hidden");
}

async function confirmPaymentModal() {
  if (pendingPaymentMode !== "bulk" && !pendingPaymentOrderId) return;
  const mode = pendingPaymentMode;
  const orderId = pendingPaymentOrderId;
  const given = Number(String(paymentGivenInput?.value || "").trim());
  const total = Number(pendingPaymentTotal) || 0;
  const due = Number(pendingPaymentDue) || total;

  if (paymentError) {
    paymentError.textContent = "";
    paymentError.style.display = "none";
  }

  if (!Number.isFinite(given) || given < 0) {
    if (paymentError) {
      paymentError.textContent = "Введите корректную сумму";
      paymentError.style.display = "block";
    }
    paymentGivenInput?.focus();
    return;
  }
  if (given > total) {
    if (paymentError) {
      paymentError.textContent = mode === "set"
        ? "Сумма не должна быть больше суммы заказа"
        : mode === "bulk"
          ? "Сумма не должна быть больше общего долга"
        : "Сумма не должна быть больше остатка по заказу";
      paymentError.style.display = "block";
    }
    paymentGivenInput?.focus();
    return;
  }

  if (mode === "set") {
    await fetchJSON(`/api/admin/orders/${Number(orderId)}/payment/set`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid_amount: Math.min(given, due) })
    });
  } else if (mode === "bulk") {
    let remaining = Number(given) || 0;
    for (const item of pendingPaymentBulkOrders) {
      if (remaining <= 0) break;
      const canPay = Math.max(0, Number(item.remaining) || 0);
      if (canPay <= 0) continue;
      const pay = Math.min(remaining, canPay);
      await fetchJSON(`/api/admin/orders/${Number(item.id)}/payment/add`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: pay })
      });
      remaining -= pay;
    }
  } else {
    await fetchJSON(`/api/admin/orders/${Number(orderId)}/payment/add`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: given })
    });
  }
  closePaymentModal();
  if (mode === "bulk") {
    state.paymentView = "orders";
    state.selectedPaymentOrderId = null;
    state.paymentOrderFull = null;
    await renderPaymentsView();
    return;
  }
  await openPaymentOrder(orderId);
}

async function renderPaymentsData() {
  if (state.mainSection !== "payments" || !state.selectedClientId) return;

  const listEl = document.getElementById("paymentsList");
  const summaryEl = el.paymentsSummaryTop;
  if (!listEl) return;
  listEl.innerHTML = `<div style="padding:14px; font-weight:600; color:rgba(11,31,51,.55)">Загрузка...</div>`;
  if (summaryEl) {
    summaryEl.style.display = "";
    summaryEl.innerHTML = "";
  }

  const year = Number(state.payments.year) || new Date().getFullYear();
  const month = Number(state.payments.month) || 0;

  let url = `/api/admin/customers/${state.selectedClientId}/orders?status=done&year=${year}`;
  if (month >= 1 && month <= 12) {
    url += `&month=${month}`;
  }

  let orders = [];
  try {
    const data = await fetchJSON(url);
    orders = Array.isArray(data) ? data : [];
  } catch (e) {
    listEl.innerHTML = `<div style="padding:14px; font-weight:600; color:#b91c1c">${escapeHtml(e?.message || "Ошибка загрузки")}</div>`;
    return;
  }

  const allOrders = Array.isArray(orders) ? orders.slice() : [];
  const summary = allOrders.reduce((acc, o) => {
    const total = Number(o.total) || 0;
    const discount = Number(o.discount) || 0;
    const totalAfter = Number.isFinite(Number(o.total_after_discount))
      ? Number(o.total_after_discount)
      : calcDiscountedTotal(total, discount);
    const paidAmountRaw = Number(o.paid_amount) || 0;
    const paidAmount = Math.max(0, Math.min(totalAfter, paidAmountRaw));
    acc.total += totalAfter;
    acc.paid += paidAmount;
    acc.debt += Math.max(0, totalAfter - paidAmount);
    return acc;
  }, { total: 0, paid: 0, debt: 0 });

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div style="border:none; background:rgba(240, 247, 252, 0.85); border-radius:0; padding:12px 14px; display:flex; gap:18px; flex-wrap:wrap;">
        <span style="font-size:13px; font-weight:700; color:rgba(11,31,51,.75);">Общая сумма: <b style="color:rgba(11,31,51,.95);">${formatMoney(summary.total)} с</b></span>
        <span style="font-size:13px; font-weight:700; color:rgba(11,31,51,.75);">Оплачено: <b style="color:rgba(11,31,51,.95);">${formatMoney(summary.paid)} с</b></span>
        <span style="font-size:13px; font-weight:700; color:rgba(11,31,51,.75);">Долг: <b style="color:#b42323;">${formatMoney(summary.debt)} с</b></span>
      </div>
    `;
  }

  if (state.tab === "new") {
    orders = orders.filter((o) => String(o.payment_status || "unpaid") !== "paid");
  } else if (state.tab === "done") {
    orders = orders.filter((o) => String(o.payment_status || "unpaid") === "paid");
  }

  state.paymentsOrders = orders;

  if (!orders.length) {
    listEl.innerHTML = `<div style="padding:14px; font-weight:600; color:rgba(11,31,51,.55)">Заказов для оплаты нет</div>`;
    return;
  }

  listEl.innerHTML = orders.map((o) => {
    const total = Number(o.total) || 0;
    const discount = Number(o.discount) || 0;
    const totalAfter = Number.isFinite(Number(o.total_after_discount))
      ? Number(o.total_after_discount)
      : calcDiscountedTotal(total, discount);
    const paidAmount = Number(o.paid_amount) || 0;
    const remainingAmount = Math.max(0, totalAfter - paidAmount);
    const paid = String(o.payment_status || "unpaid") === "paid";
    const customer = `${o.first_name || ""} ${o.last_name || ""}`.trim() || `Клиент #${Number(o.customer_id) || ""}`;
    const date = parseDateSmart(o.created_at);
    const dateText = date && !Number.isNaN(date.getTime())
      ? `${date.toLocaleDateString("ru-RU", { timeZone: TZ })} ${date.toLocaleTimeString("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })}`
      : "Дата не указана";
    return `
      <div class="order-card">
        <div>
          <div class="order-title">${escapeHtml(dateText)}</div>
          <div class="order-meta">
            Итого к оплате: <b>${formatMoney(totalAfter)} с</b>
            &nbsp;•&nbsp;
            Оплачено: <b>${formatMoney(paidAmount)} с</b>
            &nbsp;•&nbsp;
            Остаток: <b>${formatMoney(remainingAmount)} с</b>
          </div>
        </div>
        <button class="btn-open pay-open-btn" type="button" data-id="${Number(o.id)}">Открыть</button>
      </div>
    `;
  }).join("");

  listEl.querySelectorAll(".pay-open-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.getAttribute("data-id"));
      try {
        await openPaymentOrder(id);
      } catch (e) {
        alert(e?.message || "Ошибка открытия заказа");
      }
    });
  });
}

async function openPaymentOrder(orderId) {
  state.paymentView = "order";
  state.selectedPaymentOrderId = Number(orderId);
  const data = await fetchJSON(`/api/admin/orders/${orderId}/full`);
  state.paymentOrderFull = data;
  renderPaymentOrderView();
}

function backToPaymentsOrders() {
  state.paymentView = "orders";
  state.selectedPaymentOrderId = null;
  state.paymentOrderFull = null;
  void renderPaymentsData();
}

function renderPaymentOrderView() {
  const items = state.paymentOrderFull?.items || [];
  const order = state.paymentOrderFull?.order || {};
  const total = Number(order.total) || calcItemsTotal(items);
  const discount = Number(order.discount) || 0;
  const totalAfterDiscountRaw = Number(order.total_after_discount);
  const totalAfterDiscount = Number.isFinite(totalAfterDiscountRaw)
    ? totalAfterDiscountRaw
    : calcDiscountedTotal(total, discount);
  const paidAmount = Number(order.paid_amount) || 0;
  const remainingAmount = Math.max(0, totalAfterDiscount - paidAmount);
  const paid = String(order.payment_status || "unpaid") === "paid";

  const listEl = document.getElementById("paymentsList");
  if (!listEl) return;
  if (el.paymentsSummaryTop) {
    el.paymentsSummaryTop.style.display = "none";
  }

  listEl.innerHTML = `
    <div class="order-view payment-order-view">
      <div class="order-view-top">
        <button class="ov-back" type="button">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="ov-spacer"></div>
        ${(!paid && paidAmount > 0) ? `<button class="ov-discount pay-edit-btn" type="button" style="font-size:12px;">Исправить оплату</button>` : ""}
        <button class="ov-done pay-status-btn" type="button" style="font-size:12px; ${paid ? "background:rgba(255,230,230,.92); color:#b42323;" : ""}">
          ${paid ? "Снять оплату" : "Оплатить"}
        </button>
      </div>

      <div class="order-view-list">
        ${
          items.length
            ? items.map((it) => {
                const price = Number(it.price) || 0;
                const qty = Number(it.qty) || 0;
                const type = it.type ?? it.product_type ?? "Не указано";
                const man = it.manufacturer ?? it.product_manufacturer ?? "Не указано";
                const exp = it.expiry_date ?? it.product_expiry ?? "Не указано";
                return `
                  <div class="ov-item">
                    <div class="ov-item-left">
                      <div class="ov-name">${escapeHtml(it.name || "")}</div>
                      <div class="ov-sub">
                        Цена <b>${formatMoney(price)} с</b>
                        • Кол <b>${qty}</b>
                        • ${escapeHtml(type)}
                        • ${escapeHtml(man)}
                        • до ${escapeHtml(exp)}
                      </div>
                    </div>
                  </div>
                `;
              }).join("")
            : `<div class="ov-empty">Пусто</div>`
        }
      </div>

      <div class="order-view-bottom">
        <div class="ov-total">
          Итого к оплате: <b>${formatMoney(totalAfterDiscount)} с</b>
          &nbsp;•&nbsp;
          Оплачено: <b>${formatMoney(paidAmount)} с</b>
          &nbsp;•&nbsp;
          Остаток: <b>${formatMoney(remainingAmount)} с</b>
        </div>
      </div>
    </div>
  `;

  listEl.querySelector(".ov-back")?.addEventListener("click", backToPaymentsOrders);
  listEl.querySelector(".pay-edit-btn")?.addEventListener("click", () => {
    if (!state.selectedPaymentOrderId) return;
    openPaymentModal(
      state.selectedPaymentOrderId,
      totalAfterDiscount,
      "set",
      totalAfterDiscount,
      paidAmount
    );
  });
  listEl.querySelector(".pay-status-btn")?.addEventListener("click", async () => {
    if (!state.selectedPaymentOrderId) return;
    try {
      if (!paid) {
        openPaymentModal(
          state.selectedPaymentOrderId,
          remainingAmount,
          "add",
          totalAfterDiscount,
          paidAmount
        );
        return;
      }
      await toggleOrderPayment(state.selectedPaymentOrderId, "unpaid");
      setTab("new");
    } catch (e) {
      alert(e?.message || "Ошибка оплаты");
    }
  });
}

async function renderPaymentsView() {
  const client = getSelectedClient();
  if (!client) {
    renderNoClientState();
    return;
  }

  const fullName = `${client.first_name || ""} ${client.last_name || ""}`.trim() || "Без имени";
  if (el.selectedClientName) el.selectedClientName.textContent = `Оплата: ${fullName}`;
  setSelectedClientAvatarVisible(true);
  setSelectedClientAvatar(
    fullName,
    client.photo || client.photo_url || client.avatar || client.avatar_url || client.image || ""
  );
  if (el.selectedClientMeta) el.selectedClientMeta.innerHTML = "";
  const clientsData = ensureClientsControlsDataEl();
  if (clientsData) clientsData.innerHTML = "";

  // В оплате используем только верхние фильтры (год/месяц).
  state.payments.year = Number(el.yearSelect?.value) || new Date().getFullYear();
  state.payments.month = Number(el.monthSelect?.value) || "";
  state.payments.day = "";

  el.ordersList.innerHTML = `
    <div style="display:grid; grid-template-rows:minmax(0,1fr); gap:14px; height:100%; min-height:0;">
      <div id="paymentsList" style="height:100%; min-height:0;"></div>
    </div>
  `;

  await renderPaymentsData();
}

async function setMainSection(section) {
  state.mainSection = section === "clients" || section === "products" || section === "reports" || section === "payments" ? section : "orders";
  if (el.board) {
    el.board.classList.toggle("products-mode", state.mainSection === "products");
    el.board.classList.toggle("payments-mode", state.mainSection === "payments");
  }

  el.navOrdersBtn?.classList.toggle("is-active", state.mainSection === "orders");
  el.navClientsBtn?.classList.toggle("is-active", state.mainSection === "clients");
  el.navProductsBtn?.classList.toggle("is-active", state.mainSection === "products");
  el.navReportsBtn?.classList.toggle("is-active", state.mainSection === "reports");
  el.navPaymentsBtn?.classList.toggle("is-active", state.mainSection === "payments");

  updateClientUiState();
  setSelectedClientAvatarVisible(state.mainSection !== "products");

  if (el.leftPanelTitle) {
    el.leftPanelTitle.textContent =
      state.mainSection === "products" ? "\u0421\u043a\u043b\u0430\u0434" :
      "\u041a\u043b\u0438\u0435\u043d\u0442\u044b";
  }
  if (el.clientSearch) {
    el.clientSearch.placeholder =
      state.mainSection === "products"
        ? "\u041f\u043e\u0438\u0441\u043a \u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442\u0430..."
        : "\u041f\u043e\u0438\u0441\u043a \u043a\u043b\u0438\u0435\u043d\u0442\u0430...";
    el.clientSearch.value = "";
  }

  if (el.tabDone) {
    el.tabDone.textContent = state.mainSection === "payments"
      ? "\u041e\u043f\u043b\u0430\u0447\u0435\u043d\u043e"
      : "\u0412\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043d\u044b\u0435 \u0437\u0430\u043a\u0430\u0437\u044b";
  }
  if (el.tabOrders) {
    el.tabOrders.textContent = state.mainSection === "payments"
      ? "\u041d\u0435 \u043e\u043f\u043b\u0430\u0447\u0435\u043d\u043e"
      : "\u0417\u0430\u043a\u0430\u0437\u044b";
  }
  applyPaymentsTabColor();

  if (state.mainSection === "products") {
    await loadProducts();
    return;
  }
  if (state.mainSection === "payments") {
    renderClients(el.clientSearch?.value || "");
    if (!state.selectedClientId) {
      renderNoClientState();
      return;
    }
    state.tab = "new";
    el.tabOrders?.classList.add("is-active");
    el.tabDone?.classList.remove("is-active");
    state.paymentView = "orders";
    state.selectedPaymentOrderId = null;
    state.paymentOrderFull = null;
    await renderPaymentsView();
    return;
  }

  // Загружаем клиентов с кешем (или используем кешированные данные)
  await loadClients();
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    credentials: "include",   // Р Р†РЎС™РІР‚В¦ Р В Р вЂ Р В Р’В°Р В Р’В¶Р В Р вЂ¦Р В РЎвЂў: Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂ”Р РЋР вЂљР В Р’В°Р В Р вЂ Р В Р’В»Р РЋР РЏР В Р’ВµР В РЎ admin_token cookie
    ...options
  });

  let data = null;
  try { data = await res.json(); } catch (_) {}

  if (!res.ok) {
    throw new Error(data?.message || `\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u043f\u0440\u043e\u0441\u0430 (${res.status})`);
  }
  return data;
}


/* ================= LOAD CLIENTS ================= */

/**
 * Загружает клиентов с кешированием на 5 минут.
 * Избегает повторных запросов и гонки данных через AbortController.
 */
async function loadClients() {
  if (state.mainSection === "products") return;

  // Если уже загружаются – не запускать ещё один запрос
  if (state.isLoadingClients) {
    return;
  }

  // Если данные свежие (загружены в течение 5 минут) – использовать кеш
  const now = Date.now();
  if (
    state.clients.length > 0 &&
    state.clientsLoadedAt &&
    now - state.clientsLoadedAt < state.CACHE_DURATION_MS
  ) {
    // Данные свежие, просто отобразить их
    renderClients();
    updateClientUiState();
    continueLoadClientDetails();
    return;
  }

  // Отменить старый запрос, если он ещё выполняется
  if (state.clientsLoadAbortController) {
    state.clientsLoadAbortController.abort();
  }

  state.isLoadingClients = true;
  state.clientsLoadAbortController = new AbortController();

  try {
    const res = await fetch("/api/admin/customers", {
      signal: state.clientsLoadAbortController.signal,
      credentials: "include"
    });

    if (!res.ok) throw new Error("Ошибка загрузки клиентов: " + res.status);

    const data = await res.json();
    state.clients = data || [];
    state.clientsLoadedAt = now;

    const nowTime = new Date();
    if (el.yearSelect) el.yearSelect.value = nowTime.getFullYear();
    if (el.monthSelect) el.monthSelect.value = nowTime.getMonth() + 1;

    renderClients();
    updateClientUiState();
    continueLoadClientDetails();
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error("Ошибка при загрузке клиентов:", err);
    }
  } finally {
    state.isLoadingClients = false;
    state.clientsLoadAbortController = null;
  }
}

/**
 * Продолжает загрузку деталей клиента после загрузки списка.
 * Выделена в отдельную функцию для переиспользования.
 */
function continueLoadClientDetails() {
  if (!state.selectedClientId) {
    renderNoClientState();
    return;
  }

  if (state.mainSection === "clients") {
    renderClientDetails();
    return;
  }

  if (state.mainSection === "reports") {
    renderReportsView();
    return;
  }

  loadOrders();
}

function renderClients(filterText = "") {
  if (state.mainSection === "products") {
    renderProductsList(filterText);
    return;
  }
  const q = filterText.trim().toLowerCase();

  const filtered = q
    ? state.clients.filter(c =>
        (c.first_name + " " + c.last_name)
          .toLowerCase()
          .includes(q)
      )
    : state.clients;

  el.clientsList.innerHTML = filtered.map(c => {
    const fullName = `${c.first_name} ${c.last_name}`;
    const active = c.id === state.selectedClientId ? "is-active" : "";
    const letter = String(fullName || "").trim().charAt(0).toUpperCase() || "?";
    const photo = normalizeImageSrc(c.photo || c.photo_url || c.avatar || c.avatar_url || c.image || "");
    const avatarClass = photo ? "client-item-avatar has-photo" : "client-item-avatar";
    const avatarStyle = photo ? ` style="background-image:url('${escapeHtml(photo)}')"` : "";
    return `
      <div class="client-item ${active}" data-id="${c.id}">
        <span class="${avatarClass}"${avatarStyle}>${photo ? "" : escapeHtml(letter)}</span>
        <span class="client-item-name">${escapeHtml(fullName)}</span>
      </div>
    `;
  }).join("");

  el.clientsList.querySelectorAll(".client-item").forEach(node => {
node.addEventListener("click", async () => {
  state.selectedClientId = Number(node.dataset.id);
  updateClientUiState();

  // Р Р†РЎС™РІР‚В¦ Р В Р’В°Р В Р вЂ Р РЋРІР‚С™Р В РЎвЂўР В РЎР В Р’В°Р РЋРІР‚С™Р В РЎвЂР РЋРІР‚РЋР В Р’ВµР РЋР С“Р В РЎвЂќР В РЎвЂ Р РЋР С“Р РЋРІР‚С™Р В Р’В°Р В Р вЂ Р В РЎвЂР В РЎ Р РЋРІР‚С™Р В Р’ВµР В РЎвЂќР РЋРЎвЂњР РЋРІР‚В°Р В РЎвЂР В РІвЂћвЂ“ Р В РЎвЂ“Р В РЎвЂўР В РўвЂ Р В РЎвЂ Р В РЎР В Р’ВµР РЋР С“Р РЋР РЏР РЋРІР‚В 
  const now = new Date();
  if (el.yearSelect)  el.yearSelect.value  = now.getFullYear();
  if (el.monthSelect) el.monthSelect.value = now.getMonth() + 1;

  renderClients(el.clientSearch.value);
  state.selectedProductId = null;
  if (state.mainSection === "clients") {
    renderClientDetails();
    return;
  }
  if (state.mainSection === "reports") {
    await renderReportsView();
    return;
  }
  if (state.mainSection === "payments") {
    await renderPaymentsView();
    return;
  }
  await loadOrders();
});
  });
}

function clearAddClientForm() {
  if (el.addClientFullName) el.addClientFullName.value = "";
  if (el.addClientPhone) el.addClientPhone.value = "";
  if (el.addClientEmail) el.addClientEmail.value = "";
  if (el.addClientPharmacy) el.addClientPharmacy.value = "";
  if (el.addClientPhoto) el.addClientPhoto.value = "";
  if (el.addClientDiscount) el.addClientDiscount.value = "";
  if (el.addClientPassword) el.addClientPassword.value = "";
}

let clientModalMode = "create";
let editingClientId = null;

function openAddClientModal(mode = "create", client = null) {
  clientModalMode = mode;
  editingClientId = mode === "edit" ? Number(client?.id || 0) : null;
  clearAddClientForm();

  if (el.addClientModalTitle) {
    el.addClientModalTitle.textContent =
      mode === "edit"
        ? "\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u043a\u043b\u0438\u0435\u043d\u0442\u0430"
        : "\u041d\u043e\u0432\u044b\u0439 \u043a\u043b\u0438\u0435\u043d\u0442";
  }

  if (client) {
    if (el.addClientFullName) el.addClientFullName.value = `${client.first_name || ""} ${client.last_name || ""}`.trim();
    if (el.addClientPhone) el.addClientPhone.value = String(client.phone || "");
    if (el.addClientEmail) el.addClientEmail.value = String(client.email || "");
    if (el.addClientPharmacy) el.addClientPharmacy.value = String(client.pharmacy_name || client.address || "");
    if (el.addClientDiscount) el.addClientDiscount.value = Number(client.discount || 0);
    if (el.addClientPassword) el.addClientPassword.value = String(client.password || "");
  }

  el.addClientModal?.classList.remove("hidden");
  setTimeout(() => el.addClientFullName?.focus(), 0);
}

function closeAddClientModal() {
  el.addClientModal?.classList.add("hidden");
}

function openDiscountModal(client = null) {
  const c = client || getSelectedClient();
  if (!c) return;
  if (el.discountInput) el.discountInput.value = String(Number(c.discount || 0));
  el.discountModal?.classList.remove("hidden");
  setTimeout(() => el.discountInput?.focus(), 0);
}

function closeDiscountModal() {
  el.discountModal?.classList.add("hidden");
}

async function saveClientDiscount() {
  const client = getSelectedClient();
  if (!client) return;

  const discountRaw = String(el.discountInput?.value || "").trim();
  const discount = discountRaw === "" ? 0 : Number(discountRaw);
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    alert("Скидка должна быть от 0 до 100");
    return;
  }

  try {
    await fetchJSON(`/api/admin/customers/${client.id}/discount`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discount })
    });

    closeDiscountModal();
    await loadClients();
    renderClients(el.clientSearch?.value || "");
    if (state.mainSection === "clients") {
      await renderClientDetails();
    }
  } catch (e) {
    alert(e?.message || "Ошибка обновления скидки");
  }
}

function openOrderDiscountModal() {
  const current = Number(state.orderFull?.order?.order_discount ?? state.orderFull?.order?.discount ?? 0);
  if (el.orderDiscountInput) el.orderDiscountInput.value = String(current);
  el.orderDiscountModal?.classList.remove("hidden");
  setTimeout(() => el.orderDiscountInput?.focus(), 0);
}

function closeOrderDiscountModal() {
  el.orderDiscountModal?.classList.add("hidden");
}

function openRaisePricesModal() {
  const currentPercent = Number(state.productsRaisePercent) || 0;
  if (el.raisePricesInput) el.raisePricesInput.value = String(currentPercent);
  if (el.raisePricesSub) {
    el.raisePricesSub.textContent = `Введите процент повышения цен для всех препаратов. Текущий: ${formatPercent(currentPercent)}%`;
  }
  el.raisePricesModal?.classList.remove("hidden");
  setTimeout(() => el.raisePricesInput?.focus(), 0);
}

function closeRaisePricesModal() {
  el.raisePricesModal?.classList.add("hidden");
}

async function saveRaisedPrices() {
  const raw = String(el.raisePricesInput?.value || "").trim();
  const percent = Number(raw);

  if (!Number.isFinite(percent) || percent < 0 || percent > 1000) {
    alert("Процент должен быть от 0 до 1000");
    return;
  }

  try {
    await fetchJSON("/api/admin/products/raise-prices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ percent })
    });
    state.productsRaisePercent = percent;
    closeRaisePricesModal();
    await loadProducts();
  } catch (e) {
    alert(e?.message || "Ошибка повышения цен");
  }
}

async function saveOrderDiscount() {
  if (!state.selectedOrderId) return;

  const raw = String(el.orderDiscountInput?.value || "").trim();
  const discount = raw === "" ? 0 : Number(raw);
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    alert("Скидка должна быть от 0 до 100");
    return;
  }

  try {
    await fetchJSON(`/api/admin/orders/${state.selectedOrderId}/discount`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discount })
    });
    closeOrderDiscountModal();
    const fresh = await fetchJSON(`/api/admin/orders/${state.selectedOrderId}/full`);
    state.orderFull = fresh;
    renderOrderView();
  } catch (e) {
    alert(e?.message || "Ошибка обновления скидки заказа");
  }
}

async function saveNewClient() {
  const fullName = String(el.addClientFullName?.value || "").trim();
  const phone = String(el.addClientPhone?.value || "").trim();
  const email = String(el.addClientEmail?.value || "").trim();
  const pharmacyName = String(el.addClientPharmacy?.value || "").trim();
  const photoFile = el.addClientPhoto?.files?.[0] || null;
  const discountRaw = String(el.addClientDiscount?.value || "").trim();
  const discount = discountRaw === "" ? 0 : Number(discountRaw);
  const password = String(el.addClientPassword?.value || "").trim();

  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    alert("Скидка должна быть от 0 до 100");
    return;
  }

  try {
    let photo = "";
    if (photoFile) {
      const fd = new FormData();
      fd.append("photo", photoFile);
      const upRes = await fetch("/api/admin/customers/upload-photo", {
        method: "POST",
        credentials: "include",
        body: fd
      });
      const upRaw = await upRes.text();
      let upData = {};
      try { upData = upRaw ? JSON.parse(upRaw) : {}; } catch (_) {}
      if (!upRes.ok) throw new Error(upData?.message || "Ошибка загрузки фото");
      photo = String(upData?.photo || "").trim();
    }

    const body = { fullName, phone, email, pharmacyName, discount, password };
    if (photo) body.photo = photo;
    let createdId = null;

    if (clientModalMode === "edit" && editingClientId) {
      await fetchJSON(`/api/customers/${editingClientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      state.selectedClientId = editingClientId;
    } else {
      const data = await fetchJSON("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      createdId = Number(data?.customer?.id) || null;
      if (createdId) state.selectedClientId = createdId;
    }

    closeAddClientModal();
    await loadClients();
    renderClients(el.clientSearch?.value || "");
  } catch (e) {
    alert(e?.message || "Ошибка удаления");
  }
}

function normalizeImageSrc(src) {
  const s = String(src || "").trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/")) return s;
  return `/${s}`;
}

function getFilteredStockProducts(queryText = "") {
  const q = String(queryText || "").trim().toLowerCase();
  if (!q) return state.products;
  return state.products.filter((p) => {
    const name = String(p.name || "").trim().toLowerCase();
    if (!name) return false;
    if (name.startsWith(q)) return true;
    // Разрешаем поиск по началу любого слова в названии.
    return name.split(/\s+/).some((part) => part.startsWith(q));
  });
}

function renderStockTableRows() {
  const tbody = document.getElementById("stockTableBody");
  if (!tbody) return;

  const filtered = getFilteredStockProducts(state.productsSearch);
  const rows = filtered.map((p) => {
    const rawName = String(p.name || "Без названия");
    const name = escapeHtml(rawName);
    const image = normalizeImageSrc(
      p.image || p.photo || p.photo_url || p.avatar || p.avatar_url || ""
    );
    const type = escapeHtml(p.type || "—");
    const manufacturer = escapeHtml(p.manufacturer || "—");
    const expiryFrom = escapeHtml(p.expiry_from || "—");
    const expiryTo = escapeHtml(p.expiry_to || p.expiry_date || "—");
    const restNum = Number(p.stock);
    const rest = Number.isFinite(restNum) && restNum >= 0 ? restNum : 0;
    const price = Number(p.price) || 0;
    const sum = price * rest;

    return `
      <tr>
        <td>
          <div class="stock-name-wrap">
            ${image ? `<button class="stock-photo-trigger" type="button" data-id="${Number(p.id)}" aria-label="Открыть фото препарата"><span class="stock-name-avatar has-photo"><img src="${escapeHtml(image)}" alt="" loading="lazy" /></span></button>` : ""}
            <span class="stock-name-text">${name}</span>
          </div>
        </td>
        <td>${type}</td>
        <td>${manufacturer}</td>
        <td>${expiryFrom}</td>
        <td>${expiryTo}</td>
        <td>${formatMoney(rest)} шт</td>
        <td>${formatMoney(price)} с</td>
        <td>${formatMoney(sum)} с</td>
        <td>
          <button class="stock-edit-btn" type="button" data-id="${Number(p.id)}" aria-label="Изменить" title="Изменить">✎</button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.innerHTML = rows || `<tr><td colspan="9" class="stock-empty">Нет препаратов</td></tr>`;
  tbody.querySelectorAll(".stock-edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-id"));
      const p = state.products.find((x) => Number(x.id) === id);
      if (!p) return;
      openProductModal("edit", p);
    });
  });

  tbody.querySelectorAll(".stock-photo-trigger").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-id"));
      const p = state.products.find((x) => Number(x.id) === id);
      if (!p) return;
      const src = normalizeImageSrc(p.image || p.photo || p.photo_url || p.avatar || p.avatar_url || "");
      if (!src) return;
      openImage(src);
    });
  });
}

function renderProductsWorkspace() {
  if (el.selectedClientName) el.selectedClientName.textContent = "Склад";
  setSelectedClientAvatarVisible(false);

  el.ordersList.innerHTML = `
    <div class="stock-view">
      <div class="stock-toolbar">
        <input id="stockSearchInput" class="stock-search-input" type="text" placeholder="Поиск препарата..." value="${escapeHtml(state.productsSearch || "")}" />
        <button id="stockRaiseBtn" class="stock-raise-btn" type="button">Повысить цены</button>
        <button id="stockAddBtn" class="stock-add-btn" type="button">Добавить препарат</button>
      </div>

      <div class="stock-table-wrap">
        <table class="stock-table">
          <thead>
            <tr>
              <th>Названия</th>
              <th>Категория</th>
              <th>Фирма</th>
              <th>Срок от</th>
              <th>Срок до</th>
              <th>Остаток</th>
              <th>Цена</th>
              <th>Сумма</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody id="stockTableBody"></tbody>
        </table>
      </div>
    </div>
  `;

  renderStockTableRows();

  document.getElementById("stockSearchInput")?.addEventListener("input", (e) => {
    state.productsSearch = String(e.target.value || "");
    renderStockTableRows();
  });

  document.getElementById("stockRaiseBtn")?.addEventListener("click", openRaisePricesModal);
  document.getElementById("stockAddBtn")?.addEventListener("click", () => openProductModal("create"));
}

function renderProductsList(filterText = "") {
  const q = String(filterText || "").trim().toLowerCase();
  const filtered = q
    ? state.products.filter(p => {
        const name = String(p.name || "").toLowerCase();
        const type = String(p.type || "").toLowerCase();
        const man = String(p.manufacturer || "").toLowerCase();
        return name.includes(q) || type.includes(q) || man.includes(q);
      })
    : state.products;

  el.clientsList.innerHTML = filtered.map(p => {
    const active = Number(p.id) === Number(state.selectedProductId) ? "is-active" : "";
    return `<div class="client-item ${active}" data-product-id="${p.id}">${escapeHtml(p.name || "\u0411\u0435\u0437 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f")}</div>`;
  }).join("");

  el.clientsList.querySelectorAll(".client-item").forEach(node => {
    node.addEventListener("click", () => {
      state.selectedProductId = Number(node.dataset.productId);
      renderProductsList(el.clientSearch?.value || "");
      renderProductDetails();
    });
  });
}

function renderProductDetails() {
  const p = state.products.find(x => Number(x.id) === Number(state.selectedProductId));
  if (!p) {
    if (el.selectedClientName) el.selectedClientName.textContent = "\u041f\u0440\u0435\u043f\u0430\u0440\u0430\u0442\u044b";
    setSelectedClientAvatarVisible(false);
    el.ordersList.innerHTML = `<div style="padding:14px; font-weight:600; color:rgba(11,31,51,.55)">\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442</div>`;
    return;
  }

  if (el.selectedClientName) el.selectedClientName.textContent = "\u041f\u0440\u0435\u043f\u0430\u0440\u0430\u0442\u044b";
  setSelectedClientAvatarVisible(false);
  const image = normalizeImageSrc(p.image);
  const manufacturer = p.manufacturer || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e";
  const expiry = p.expiry_date || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e";
  const type = p.type || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e";
  const price = Number(p.price) || 0;

  el.ordersList.innerHTML = `
    <div class="order-card" style="grid-template-columns:1fr;">
      <div>
        <div class="order-title">${escapeHtml(p.name || "\u0411\u0435\u0437 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f")}</div>
        <div class="order-meta">\u0422\u0438\u043f: <b>${escapeHtml(type)}</b></div>
        <div class="order-meta">\u041f\u0440\u043e\u0438\u0437\u0432\u043e\u0434\u0438\u0442\u0435\u043b\u044c: <b>${escapeHtml(manufacturer)}</b></div>
        <div class="order-meta">\u0421\u0440\u043e\u043a \u0433\u043e\u0434\u043d\u043e\u0441\u0442\u0438: <b>${escapeHtml(expiry)}</b></div>
        <div class="order-meta">\u0426\u0435\u043d\u0430: <b>${formatMoney(price)} \u0441</b></div>
        ${image ? `<div style="margin-top:10px;"><img src="${escapeHtml(image)}" alt="" style="max-width:180px; max-height:120px; border-radius:10px; border:1px solid rgba(11,31,51,.12);" /></div>` : ""}
        <div style="margin-top:12px;">
          <button id="editProductBtn" class="pill" type="button">\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("editProductBtn")?.addEventListener("click", () => openProductModal("edit", p));
}

async function loadProducts() {
  const data = await fetchJSON("/api/admin/products");
  state.products = Array.isArray(data) ? data : [];
  const firstPercent = Number(state.products[0]?.price_raise_percent);
  state.productsRaisePercent = Number.isFinite(firstPercent) ? firstPercent : 0;
  if (state.mainSection === "products") {
    renderProductsWorkspace();
    return;
  }
  renderProductsList(el.clientSearch?.value || "");
  renderProductDetails();
}

function clearProductForm() {
  if (el.productNameInput) el.productNameInput.value = "";
  if (el.productTypeInput) el.productTypeInput.value = "";
  if (el.productManufacturerInput) el.productManufacturerInput.value = "";
  if (el.productExpiryFromInput) el.productExpiryFromInput.value = "";
  if (el.productExpiryToInput) el.productExpiryToInput.value = "";
  if (el.productPriceInput) el.productPriceInput.value = "";
  if (el.productStockInput) el.productStockInput.value = "";
  if (el.productImageInput) el.productImageInput.value = "";
}

let productModalMode = "create";
let productEditId = null;
const DEFAULT_PRODUCT_CATEGORIES = [
  "Таблетка",
  "Капсула",
  "Сироп",
  "Раствор",
  "Инъекция",
  "Мазь",
  "Крем",
  "Гель",
  "Капля",
  "Порошок",
  "Спрей",
  "Суспензия",
  "Свеча"
];

function getProductCategories() {
  return [...DEFAULT_PRODUCT_CATEGORIES];
}

function fillProductTypeOptions(selected = "") {
  if (!el.productTypeInput) return;
  const current = String(selected || "").trim();
  const categories = getProductCategories();
  if (current && !categories.includes(current)) categories.unshift(current);
  el.productTypeInput.innerHTML = [
    `<option value="">Выберите категорию</option>`,
    ...categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
  ].join("");
  el.productTypeInput.value = current || "";
}

function openProductModal(mode = "create", product = null) {
  productModalMode = mode;
  productEditId = mode === "edit" ? Number(product?.id || 0) : null;
  clearProductForm();
  fillProductTypeOptions(product?.type || "");

  if (el.productModalTitle) {
    el.productModalTitle.textContent = mode === "edit" ? "\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442" : "\u041d\u043e\u0432\u044b\u0439 \u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442";
  }

  if (product) {
    if (el.productNameInput) el.productNameInput.value = String(product.name || "");
    if (el.productTypeInput) el.productTypeInput.value = String(product.type || "");
    if (el.productManufacturerInput) el.productManufacturerInput.value = String(product.manufacturer || "");
    if (el.productExpiryFromInput) el.productExpiryFromInput.value = String(product.expiry_from || "");
    if (el.productExpiryToInput) el.productExpiryToInput.value = String(product.expiry_to || product.expiry_date || "");
    if (el.productPriceInput) el.productPriceInput.value = String(product.price ?? "");
    if (el.productStockInput) el.productStockInput.value = String(product.stock ?? 0);
  }

  el.productModal?.classList.remove("hidden");
}

function closeProductModal() {
  el.productModal?.classList.add("hidden");
}

function markInvalidInput(inputEl) {
  if (!inputEl) return;
  inputEl.classList.remove("add-input-invalid");
  void inputEl.offsetWidth;
  inputEl.classList.add("add-input-invalid");
}

function clearInvalidProductInputs() {
  const fields = [
    el.productNameInput,
    el.productTypeInput,
    el.productManufacturerInput,
    el.productExpiryFromInput,
    el.productExpiryToInput,
    el.productPriceInput,
    el.productStockInput
  ];
  fields.forEach((f) => f?.classList.remove("add-input-invalid"));
}

async function saveProductModal() {
  const name = String(el.productNameInput?.value || "").trim();
  const type = String(el.productTypeInput?.value || "").trim();
  const manufacturer = String(el.productManufacturerInput?.value || "").trim();
  const expiry_from = String(el.productExpiryFromInput?.value || "").trim();
  const expiry_to = String(el.productExpiryToInput?.value || "").trim();
  const price = String(el.productPriceInput?.value || "").trim();
  const stock = String(el.productStockInput?.value || "").trim();
  const imageFile = el.productImageInput?.files?.[0] || null;

  clearInvalidProductInputs();
  const required = [
    { el: el.productNameInput, val: name },
    { el: el.productTypeInput, val: type },
    { el: el.productManufacturerInput, val: manufacturer },
    { el: el.productExpiryFromInput, val: expiry_from },
    { el: el.productExpiryToInput, val: expiry_to },
    { el: el.productPriceInput, val: price },
    { el: el.productStockInput, val: stock }
  ];

  const invalid = required.filter((f) => !String(f.val || "").trim());
  if (invalid.length) {
    invalid.forEach((f) => markInvalidInput(f.el));
    invalid[0]?.el?.focus();
    return;
  }

  const fd = new FormData();
  fd.append("name", name);
  fd.append("type", type);
  fd.append("manufacturer", manufacturer);
  fd.append("expiry_from", expiry_from);
  fd.append("expiry_to", expiry_to);
  fd.append("price", price);
  fd.append("stock", stock);
  if (imageFile) fd.append("image", imageFile);

  const url = productModalMode === "edit" && productEditId
    ? `/api/admin/products/${productEditId}`
    : "/api/admin/products";
  const method = productModalMode === "edit" && productEditId ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    credentials: "include",
    body: fd
  });
  const raw = await res.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}
  if (!res.ok) throw new Error(data?.message || "\u041e\u0448\u0438\u0431\u043a\u0430");

  closeProductModal();
  if (productModalMode !== "edit" && data?.id) state.selectedProductId = Number(data.id);
  await loadProducts();
}

/* ================= LOAD ORDERS ================= */

async function loadOrders() {
  if (!state.selectedClientId) return;

  const year = Number(el.yearSelect.value) || "";
  const month = Number(el.monthSelect.value) || "";

  let url = `/api/admin/customers/${state.selectedClientId}/orders?status=${state.tab}`;
  if (year) url += `&year=${year}`;
  if (month) url += `&month=${month}`;

  const data = await fetchJSON(url);
  state.orders = data || [];

  const client = state.clients.find(c => c.id === state.selectedClientId);
  if (client) {
    const fullName = `${client.first_name || ""} ${client.last_name || ""}`.trim();
    if (el.selectedClientName) el.selectedClientName.textContent = fullName;
    setSelectedClientAvatarVisible(true);
    setSelectedClientAvatar(
      fullName,
      client.photo || client.photo_url || client.avatar || client.avatar_url || client.image || ""
    );
  }

  renderOrders();
}

const TZ = "Asia/Dushanbe";

function parseDateSmart(v){
  if (!v) return new Date(NaN);

  // Р РЋРЎвЂњР В Р’В¶Р В Р’Вµ Date
  if (v instanceof Date) return v;

  const s = String(v).trim();

  // ISO Р РЋР С“ Р РЋРІР‚С™Р В Р’В°Р В РІвЂћвЂ“Р В РЎР В Р’В·Р В РЎвЂўР В Р вЂ¦Р В РЎвЂўР В РІвЂћвЂ“ (Z Р В РЎвЂР В Р’В»Р В РЎвЂ +05:00) Р Р†Р вЂљРІР‚Сњ Р В РЎвЂ”Р В Р’В°Р РЋР вЂљР РЋР С“Р В РЎвЂР В РЎ Р РЋР С“Р РЋРІР‚С™Р В Р’В°Р В Р вЂ¦Р В РўвЂР В Р’В°Р РЋР вЂљР РЋРІР‚С™Р В Р вЂ¦Р В РЎвЂў
  if (/[zZ]$/.test(s) || /[+\-]\d{2}:\d{2}$/.test(s)) {
    return new Date(s);
  }

// "YYYY-MM-DD HH:MM:SS" Р В РЎвЂР В Р’В»Р В РЎвЂ "YYYY-MM-DDTHH:MM:SS" (Р В Р’В±Р В Р’ВµР В Р’В· TZ)
// SQLite Р РЋРІР‚РЋР В Р’В°Р РЋР С“Р РЋРІР‚С™Р В РЎвЂў Р РЋРІР‚В¦Р РЋР вЂљР В Р’В°Р В Р вЂ¦Р В РЎвЂР РЋРІР‚С™/Р В РЎвЂўР РЋРІР‚С™Р В РўвЂР В Р’В°Р РЋРІР‚Р РЋРІР‚С™ UTC, Р В РЎвЂ”Р В РЎвЂўР РЋР РЉР РЋРІР‚С™Р В РЎвЂўР В РЎР РЋРЎвЂњ Р В РЎвЂ”Р В Р’В°Р РЋР вЂљР РЋР С“Р В РЎвЂР В РЎ Р В РЎвЂќР В Р’В°Р В РЎвЂќ UTC
const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
if (m) {
  const Y  = Number(m[1]);
  const Mo = Number(m[2]) - 1;
  const D  = Number(m[3]);
  const h  = Number(m[4]);
  const mi = Number(m[5]);
  const se = Number(m[6] || 0);

  return new Date(Date.UTC(Y, Mo, D, h, mi, se));
}
  // fallback
  return new Date(s);
}

function renderOrders() {
  if (!state.orders.length) {
    el.ordersList.innerHTML =
      `<div style="padding:14px; font-weight:600; color:rgba(11,31,51,.55)">\u041d\u0435\u0442 \u0437\u0430\u043a\u0430\u0437\u043e\u0432</div>`;
    return;
  }

  el.ordersList.innerHTML = state.orders.map(o => {
const date = parseDateSmart(o.created_at);
const orderTotal = Number(o.total) || 0;
const discount = Number(o.discount) || 0;
const totalAfterDiscountRaw = Number(o.total_after_discount);
const totalAfterDiscount = Number.isFinite(totalAfterDiscountRaw)
  ? totalAfterDiscountRaw
  : calcDiscountedTotal(orderTotal, discount);

const formattedDate =
  date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("ru-RU", { timeZone: TZ }) + " " +
      date.toLocaleTimeString("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
    : "\u0414\u0430\u0442\u0430 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430";

    return `
      <div class="order-card">
        <div>
          <div class="order-title">
            ${formattedDate}
          </div>
          <div class="order-meta">
            \u041e\u0431\u0449\u0430\u044f \u0441\u0443\u043c\u043c\u0430: <b>${formatMoney(orderTotal)} \u0441</b>
            &nbsp;\u2022&nbsp;
            \u0421\u043a\u0438\u0434\u043a\u0430: <b>${formatPercent(discount)}%</b>
            &nbsp;\u2022&nbsp;
            \u041f\u043e\u0437\u0438\u0446\u0438\u0438: <b>${o.items_count}</b>
          </div>
        </div>
        <button class="btn-open" data-id="${o.id}">\u041e\u0442\u043a\u0440\u044b\u0442\u044c</button>
      </div>
    `;
  }).join("");

el.ordersList.querySelectorAll(".btn-open").forEach(btn => {
  btn.addEventListener("click", () => {
    const orderId = Number(btn.dataset.id);
    openOrder(orderId);
  });
});

}


async function openOrder(orderId){
  state.view = "order";
  state.selectedOrderId = orderId;

  const data = await fetchJSON(`/api/admin/orders/${orderId}/full`);
  state.orderFull = data;

  renderOrderView();
}
// ================== NEW ORDER (ADMIN) ==================
let newOrderAllProducts = [];
let newOrderCart = new Map(); // productId -> qty
let newOrderMode = "products"; // "products" | "selected"

// ===== NEW ORDER MODAL MODE =====
// "create" = Р РЋР С“Р В РЎвЂўР В Р’В·Р В РўвЂР В Р’В°Р РЋРІР‚С™Р РЋР Р‰ Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р РЋРІР‚в„–Р В РІвЂћвЂ“ Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В· (Р В РЎвЂќР В Р’В°Р В РЎвЂќ Р РЋР С“Р В Р’ВµР В РІвЂћвЂ“Р РЋРІР‚РЋР В Р’В°Р РЋР С“)
// "add"    = Р В РўвЂР В РЎвЂўР В Р’В±Р В Р’В°Р В Р вЂ Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰ Р В РЎвЂ”Р В РЎвЂўР В Р’В·Р В РЎвЂР РЋРІР‚В Р В РЎвЂР В РЎвЂ Р В Р вЂ  Р РЋРІР‚С™Р В Р’ВµР В РЎвЂќР РЋРЎвЂњР РЋРІР‚В°Р В РЎвЂР В РІвЂћвЂ“ Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В· (Р В РЎвЂР В Р’В· Р РЋР РЉР В РЎвЂќР РЋР вЂљР В Р’В°Р В Р вЂ¦Р В Р’В° Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В·Р В Р’В°)
let newOrderModalMode = "create";

// Р В Р’В°Р В РЎвЂќР В РЎвЂќР РЋРЎвЂњР РЋР вЂљР В Р’В°Р РЋРІР‚С™Р В Р вЂ¦Р В РЎвЂў Р В РЎР В Р’ВµР В Р вЂ¦Р РЋР РЏР В Р’ВµР В РЎ Р РЋРІР‚С™Р В РЎвЂўР В Р’В»Р РЋР Р‰Р В РЎвЂќР В РЎвЂў Р РЋРІР‚С™Р В Р’ВµР В РЎвЂќР РЋР С“Р РЋРІР‚С™Р РЋРІР‚в„– Р В Р вЂ Р В Р вЂ¦Р РЋРЎвЂњР РЋРІР‚С™Р РЋР вЂљР В РЎвЂ Р В РЎР В РЎвЂўР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂќР В РЎвЂ, Р В Р вЂ¦Р В Р’Вµ Р В Р’В»Р В РЎвЂўР В РЎР В Р’В°Р РЋР РЏ "Р В РЎСљР В РЎвЂўР В Р вЂ Р РЋРІР‚в„–Р В РІвЂћвЂ“ Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В·"
function setNewOrderModalTexts(mode){
  const root = newOrderModal; // #newOrderModal

  // Р РЋР РЉР В Р’В»Р В Р’ВµР В РЎР В Р’ВµР В Р вЂ¦Р РЋРІР‚С™Р РЋРІР‚в„– Р В Р’В·Р В Р’В°Р В РЎвЂ“Р В РЎвЂўР В Р’В»Р В РЎвЂўР В Р вЂ Р В РЎвЂќР В Р’В° (Р В РЎвЂ”Р В РЎвЂў Р В Р вЂ Р В Р’В°Р РЋРІвЂљВ¬Р В РЎвЂР В РЎ Р РЋР С“Р РЋРІР‚С™Р В РЎвЂР В Р’В»Р РЋР РЏР В РЎ)
  const tMain   = root?.querySelector(".no-main");
  const tClient = root?.querySelector(".no-client");

  // Р В РЎвЂќР В Р вЂ¦Р В РЎвЂўР В РЎвЂ”Р В РЎвЂќР В РЎвЂ
  const btnPrimary = newOrderCreateBtn;   // #newOrderCreate
  const btnReview  = newOrderReviewBtn;   // #newOrderReviewBtn

  if (mode === "add") {
    if (tMain)   tMain.textContent = "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0432 \u0437\u0430\u043a\u0430\u0437";
    if (tClient) tClient.textContent = "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442\u044b \u0438 \u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e";

    if (btnPrimary) btnPrimary.textContent = "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c";
    if (btnReview)  btnReview.textContent  = "\u041f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0435";
  } else {
    // Р РЋР вЂљР В Р’ВµР В Р’В¶Р В РЎвЂР В РЎ create (Р В РЎвЂќР В Р’В°Р В РЎвЂќ Р В Р’В±Р РЋРІР‚в„–Р В Р’В»Р В РЎвЂў)
    // Р В РІР‚вЂќР В Р’В°Р В РЎвЂ“Р В РЎвЂўР В Р’В»Р В РЎвЂўР В Р вЂ Р В РЎвЂўР В РЎвЂќ Р В РЎвЂќР В Р’В»Р В РЎвЂР В Р’ВµР В Р вЂ¦Р РЋРІР‚С™Р В Р’В° Р В Р вЂ Р РЋРІР‚в„– Р В РЎвЂ Р РЋРІР‚С™Р В Р’В°Р В РЎвЂќ Р РЋР С“Р РЋРІР‚С™Р В Р’В°Р В Р вЂ Р В РЎвЂР РЋРІР‚С™Р В Р’Вµ Р РЋРІР‚РЋР В Р’ВµР РЋР вЂљР В Р’ВµР В Р’В· el.newOrderTitle / client name.
    if (tMain)   tMain.textContent = "\u041d\u043e\u0432\u044b\u0439 \u0437\u0430\u043a\u0430\u0437";
    if (tClient) tClient.textContent = ""; // Р В РЎР В РЎвЂўР В Р’В¶Р В Р вЂ¦Р В РЎвЂў Р В РЎвЂўР РЋР С“Р РЋРІР‚С™Р В Р’В°Р В Р вЂ Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰ Р В РЎвЂ”Р РЋРЎвЂњР РЋР С“Р РЋРІР‚С™Р РЋРІР‚в„–Р В РЎ

    if (btnPrimary) btnPrimary.textContent = "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0437\u0430\u043a\u0430\u0437";
    if (btnReview)  btnReview.textContent  = "\u041f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0435";
  }
}

// Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™Р РЋР Р‰ Р В РЎР В РЎвЂўР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂќР РЋРЎвЂњ Р В РўвЂР В Р’В»Р РЋР РЏ Р В РўвЂР В РЎвЂўР В Р’В±Р В Р’В°Р В Р вЂ Р В Р’В»Р В Р’ВµР В Р вЂ¦Р В РЎвЂР РЋР РЏ Р В Р вЂ  Р РЋР С“Р РЋРЎвЂњР РЋРІР‚В°Р В Р’ВµР РЋР С“Р РЋРІР‚С™Р В Р вЂ Р РЋРЎвЂњР РЋР вЂ№Р РЋРІР‚В°Р В РЎвЂР В РІвЂћвЂ“ Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В·
function openAddToOrderModal(){
  if (!state.selectedOrderId) {
    alert("\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u043e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u0437\u0430\u043a\u0430\u0437");
    return;
  }

  newOrderModalMode = "add";

  // Р РЋР С“Р В Р’В±Р РЋР вЂљР В РЎвЂўР РЋР С“ Р В РЎвЂќР В РЎвЂўР РЋР вЂљР В Р’В·Р В РЎвЂР В Р вЂ¦Р РЋРІР‚в„–/Р РЋР вЂљР В Р’ВµР В Р’В¶Р В РЎвЂР В РЎР В Р’В°
  newOrderCart = new Map();
  newOrderMode = "products";

  // Р РЋРІР‚С™Р В Р’ВµР В РЎвЂќР РЋР С“Р РЋРІР‚С™Р РЋРІР‚в„– "Р РЋР вЂљР В Р’ВµР В Р’В¶Р В РЎвЂР В РЎР В Р’В° add"
  setNewOrderModalTexts("add");

    // ===== Р В РЎвЂ”Р В РЎвЂўР В РўвЂР В Р’В·Р В Р’В°Р В РЎвЂ“Р В РЎвЂўР В Р’В»Р В РЎвЂўР В Р вЂ Р В РЎвЂўР В РЎвЂќ: Р В РўвЂР В Р’В°Р РЋРІР‚С™Р В Р’В°/Р В Р вЂ Р РЋР вЂљР В Р’ВµР В РЎР РЋР РЏ + Р В РЎвЂР В РЎР РЋР РЏ Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В·Р РЋРІР‚РЋР В РЎвЂР В РЎвЂќР В Р’В° =====
  const root = newOrderModal; // #newOrderModal
  const tClient = root?.querySelector(".no-client");

  const createdAtRaw = state.orderFull?.order?.created_at || "";
  const createdAt = parseDateSmart(createdAtRaw);

  const dt =
    createdAt && !Number.isNaN(createdAt.getTime())
      ? createdAt.toLocaleDateString("ru-RU", { timeZone: TZ }) + " " +
        createdAt.toLocaleTimeString("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
      : "";

  const clientName = getSelectedClientFullName();

  // Р РЋР С“Р РЋРІР‚С™Р РЋР вЂљР В РЎвЂўР В РЎвЂќР В Р’В° Р В РЎвЂ”Р В РЎвЂўР В РўвЂ Р В Р’В·Р В Р’В°Р В РЎвЂ“Р В РЎвЂўР В Р’В»Р В РЎвЂўР В Р вЂ Р В РЎвЂќР В РЎвЂўР В РЎ
  const line = [dt, clientName].filter(Boolean).join(" \u2022 ");

  if (tClient) tClient.textContent = line || "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442\u044b \u0438 \u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e";

  // Р В РЎвЂўР РЋРІР‚РЋР В РЎвЂР РЋР С“Р РЋРІР‚С™Р В РЎвЂќР В Р’В° UI
  if (newOrderSearch) newOrderSearch.value = "";
  if (newOrderProductsBox) newOrderProductsBox.innerHTML = "";
  if (newOrderTotalEl) newOrderTotalEl.textContent = "\u041e\u0431\u0449\u0430\u044f \u0441\u0443\u043c\u043c\u0430: 0 \u0441";
  if (el.newOrderCount) el.newOrderCount.textContent = "\u0422\u043e\u0432\u0430\u0440\u043e\u0432: 0";

  if (newOrderCreateBtn) newOrderCreateBtn.disabled = true;
  if (newOrderReviewBtn) {
    newOrderReviewBtn.disabled = true;
    newOrderReviewBtn.textContent = "\u041f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0435";
  }

  // Р В РЎвЂ”Р В РЎвЂўР В РЎвЂќР В Р’В°Р В Р’В·Р В Р’В°Р РЋРІР‚С™Р РЋР Р‰ Р В РЎР В РЎвЂўР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂќР РЋРЎвЂњ
  newOrderModal.classList.remove("hidden");
  loadAdminProductsForNewOrder();
}


const newOrderBtn = document.getElementById("tabNewOrder"); // Р Р†РЎС™РІР‚В¦ Р В Р’В±Р РЋРІР‚в„–Р В Р’В»Р В РЎвЂў newOrderBtn
const newOrderModal = document.getElementById("newOrderModal");
const newOrderOverlay = document.getElementById("newOrderOverlay");
const newOrderClose = document.getElementById("newOrderClose");
const newOrderSearch = document.getElementById("newOrderSearch");
const newOrderProductsBox = document.getElementById("newOrderProducts");
const newOrderTotalEl = document.getElementById("newOrderTotal");
const newOrderCreateBtn = document.getElementById("newOrderCreate");
const newOrderReviewBtn = document.getElementById("newOrderReviewBtn");


// ===== QTY MODAL (NEW ORDER) =====
const qtyModal   = document.getElementById("qtyModal");
const qtyOverlay = document.getElementById("qtyOverlay");
const qtyClose   = document.getElementById("qtyClose");
const qtyName    = document.getElementById("qtyName");
const qtyInput   = document.getElementById("qtyInput");
const qtyOk      = document.getElementById("qtyOk");
const qtyCancel  = document.getElementById("qtyCancel");

const qtyState = {
  productId: null
};

function openQtyModal(productId){
  const p = newOrderAllProducts.find(x => Number(x.id) === Number(productId));
  if (!p) return;

  qtyState.productId = Number(productId);

  // Р В Р вЂ¦Р В Р’В°Р В Р’В·Р В Р вЂ Р В Р’В°Р В Р вЂ¦Р В РЎвЂР В Р’Вµ
  if (qtyName) qtyName.textContent = String(p.name || "");

  // Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™Р РЋР Р‰ Р В РЎР В РЎвЂўР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂќР РЋРЎвЂњ
  qtyModal.classList.remove("hidden");
  qtyModal.setAttribute("aria-hidden", "false");

  // Р В РЎвЂ”Р В РЎвЂўР В РўвЂР В РЎвЂ“Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂўР В Р вЂ Р В РЎвЂќР В Р’В° Р В РЎвЂР В Р вЂ¦Р В РЎвЂ”Р РЋРЎвЂњР РЋРІР‚С™Р В Р’В°: Р В РЎвЂ”Р РЋРЎвЂњР РЋР С“Р РЋРІР‚С™Р В РЎвЂўР В РІвЂћвЂ“, Р РЋРІР‚РЋР РЋРІР‚С™Р В РЎвЂўР В Р’В±Р РЋРІР‚в„– Р В РЎвЂ”Р В Р’ВµР РЋР вЂљР В Р вЂ Р В Р’В°Р РЋР РЏ Р РЋРІР‚В Р В РЎвЂР РЋРІР‚С›Р РЋР вЂљР В Р’В° Р РЋР С“Р РЋР вЂљР В Р’В°Р В Р’В·Р РЋРЎвЂњ Р В РЎвЂ”Р В РЎвЂўР В РЎвЂ”Р В Р’В°Р В Р’В»Р В Р’В°
  const currentQty = Number(newOrderCart.get(Number(productId)) || 0);
  qtyInput.value = currentQty > 0 ? String(currentQty) : "";
  qtyInput.setAttribute("inputmode", "numeric");
  qtyInput.setAttribute("min", "1");
  qtyInput.setAttribute("step", "1");

  // Р РЋРІР‚С›Р В РЎвЂўР В РЎвЂќР РЋРЎвЂњР РЋР С“ Р В Р’В±Р В Р’ВµР В Р’В· Р В Р вЂ Р РЋРІР‚в„–Р В РўвЂР В Р’ВµР В Р’В»Р В Р’ВµР В Р вЂ¦Р В РЎвЂР РЋР РЏ
  setTimeout(() => {
    if (!qtyInput) return;

    const placeCaretToEnd = () => {
      try {
        const v = qtyInput.value || "";
        qtyInput.setSelectionRange(v.length, v.length);
      } catch (_) {}
    };

    qtyInput.focus({ preventScroll: true });

    placeCaretToEnd();
    requestAnimationFrame(placeCaretToEnd);
    setTimeout(placeCaretToEnd, 0);

    // Р В Р’ВµР РЋР С“Р В Р’В»Р В РЎвЂ Р В РЎвЂќР В Р’В»Р В РЎвЂР В РЎвЂќР В Р вЂ¦Р РЋРЎвЂњР В Р’В»Р В РЎвЂ Р В РЎР РЋРІР‚в„–Р РЋРІвЂљВ¬Р РЋР Р‰Р РЋР вЂ№ Р В РЎвЂ”Р В РЎвЂў Р В РЎвЂР В Р вЂ¦Р В РЎвЂ”Р РЋРЎвЂњР РЋРІР‚С™Р РЋРЎвЂњ Р Р†Р вЂљРІР‚Сњ Р В Р вЂ¦Р В Р’Вµ Р В Р вЂ Р РЋРІР‚в„–Р В РўвЂР В Р’ВµР В Р’В»Р РЋР РЏР В Р’ВµР В РЎ, Р В РЎвЂќР РЋРЎвЂњР РЋР вЂљР РЋР С“Р В РЎвЂўР РЋР вЂљ Р В Р вЂ  Р В РЎвЂќР В РЎвЂўР В Р вЂ¦Р В Р’ВµР РЋРІР‚В 
    qtyInput.addEventListener("mouseup", (e) => {
      e.preventDefault();
      placeCaretToEnd();
    }, { once: true });

  }, 0);
}

function closeQtyModal(){
  qtyState.productId = null;
  qtyModal.classList.add("hidden");
  qtyModal.setAttribute("aria-hidden", "true");
}

function confirmQtyModal(){
  const pid = qtyState.productId;
  if (!pid) return;

  const raw = String(qtyInput?.value ?? "").trim();

  // Р Р†РЎС™РІР‚В¦ Р В Р’ВµР РЋР С“Р В Р’В»Р В РЎвЂ Р В Р вЂ¦Р В РЎвЂР РЋРІР‚РЋР В Р’ВµР В РЎвЂ“Р В РЎвЂў Р В Р вЂ¦Р В Р’Вµ Р В Р вЂ Р В Р вЂ Р В Р’ВµР В Р’В»Р В РЎвЂ Р Р†Р вЂљРІР‚Сњ Р В Р вЂ¦Р В Р’Вµ Р В РўвЂР В РЎвЂўР В Р’В±Р В Р’В°Р В Р вЂ Р В Р’В»Р РЋР РЏР В Р’ВµР В РЎ, Р В Р’В° "Р В РЎР В РЎвЂР В РЎвЂ“Р В Р’В°Р В Р’ВµР В РЎ" Р В РЎвЂ”Р В РЎвЂўР В Р’В»Р В Р’ВµР В РЎ
  if (!raw) {
    qtyInput?.focus();
    qtyInput?.classList.remove("qty-flash"); // Р РЋРІР‚РЋР РЋРІР‚С™Р В РЎвЂўР В Р’В±Р РЋРІР‚в„– Р В РЎР В РЎвЂўР В Р’В¶Р В Р вЂ¦Р В РЎвЂў Р В Р’В±Р РЋРІР‚в„–Р В Р’В»Р В РЎвЂў Р В РЎвЂ”Р В РЎвЂўР В Р вЂ Р РЋРІР‚С™Р В РЎвЂўР РЋР вЂљР В Р вЂ¦Р В РЎвЂў Р В РЎР В РЎвЂР В РЎвЂ“Р В Р’В°Р РЋРІР‚С™Р РЋР Р‰
    void qtyInput?.offsetWidth;              // reflow
    qtyInput?.classList.add("qty-flash");
    return;
  }

  let qty = Number(raw);

  // Р Р†РЎС™РІР‚В¦ Р В Р’ВµР РЋР С“Р В Р’В»Р В РЎвЂ Р В Р вЂ Р В Р вЂ Р В Р’ВµР В Р’В»Р В РЎвЂ Р В РЎР РЋРЎвЂњР РЋР С“Р В РЎвЂўР РЋР вЂљ/0/Р В РЎР В РЎвЂР В Р вЂ¦Р РЋРЎвЂњР РЋР С“ Р Р†Р вЂљРІР‚Сњ Р РЋРІР‚С™Р В РЎвЂўР В Р’В¶Р В Р’Вµ Р В РЎР В РЎвЂР В РЎвЂ“Р В Р’В°Р В Р’ВµР В РЎ
  if (!Number.isFinite(qty) || qty < 1) {
    qtyInput?.focus();
    qtyInput?.classList.remove("qty-flash");
    void qtyInput?.offsetWidth;
    qtyInput?.classList.add("qty-flash");
    return;
  }

  qty = Math.floor(qty);

  // Р РЋРІР‚С›Р В РЎвЂР В РЎвЂќР РЋР С“Р В РЎвЂР РЋР вЂљР РЋРЎвЂњР В Р’ВµР В РЎ Р В РЎвЂќР В РЎвЂўР В Р’В»Р В РЎвЂР РЋРІР‚РЋР В Р’ВµР РЋР С“Р РЋРІР‚С™Р В Р вЂ Р В РЎвЂў
  newOrderCart.set(Number(pid), qty);

  closeQtyModal();

  // Р В РЎвЂўР В Р’В±Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰ Р РЋРІР‚С™Р В Р’ВµР В РЎвЂќР РЋРЎвЂњР РЋРІР‚В°Р В РЎвЂР В РІвЂћвЂ“ Р РЋР РЉР В РЎвЂќР РЋР вЂљР В Р’В°Р В Р вЂ¦ (products/selected)
  if (newOrderMode === "selected") {
    renderNewOrderSelected();
  } else {
    renderNewOrderProducts(newOrderAllProducts);
  }


  updateNewOrderTotal();
}

// events
qtyOverlay?.addEventListener("click", closeQtyModal);
qtyClose?.addEventListener("click", closeQtyModal);
qtyCancel?.addEventListener("click", closeQtyModal);
qtyOk?.addEventListener("click", confirmQtyModal);

document.addEventListener("keydown", (e) => {
  if (!qtyModal || qtyModal.classList.contains("hidden")) return;

  // ESC = Р В РЎвЂєР РЋРІР‚С™Р В РЎР В Р’ВµР В Р вЂ¦Р В Р’В°
  if (e.key === "Escape") {
    e.preventDefault();
    closeQtyModal();
    return;
  }

  // ENTER = Р В РЎвЂєР В РЎв„ў
  if (e.key === "Enter") {
    e.preventDefault();
    confirmQtyModal();
    return;
  }

  // Р В Р’В¦Р В РЎвЂР РЋРІР‚С›Р РЋР вЂљР В Р’В°/Р В РЎвЂќР В Р’В»Р В Р’В°Р В Р вЂ Р В РЎвЂР В Р’В°Р РЋРІР‚С™Р РЋРЎвЂњР РЋР вЂљР В Р вЂ¦Р РЋРІР‚в„–Р В РІвЂћвЂ“ Р В Р вЂ Р В Р вЂ Р В РЎвЂўР В РўвЂ: Р В Р’ВµР РЋР С“Р В Р’В»Р В РЎвЂ Р РЋРІР‚С›Р В РЎвЂўР В РЎвЂќР РЋРЎвЂњР РЋР С“ Р В Р вЂ¦Р В Р’Вµ Р В Р вЂ  input Р Р†Р вЂљРІР‚Сњ Р В РЎвЂ”Р В Р’ВµР РЋР вЂљР В Р’ВµР В Р вЂ¦Р В Р’ВµР РЋР С“Р РЋРІР‚Р В РЎ Р РЋРІР‚С›Р В РЎвЂўР В РЎвЂќР РЋРЎвЂњР РЋР С“ Р В РЎвЂ Р В Р вЂ¦Р В Р’В°Р РЋРІР‚РЋР В Р вЂ¦Р РЋРІР‚Р В РЎ Р В Р вЂ Р В Р вЂ Р В РЎвЂўР В РўвЂ
  if (!qtyInput) return;

  const isDigit = /^[0-9]$/.test(e.key);

  // Р В Р’ВµР РЋР С“Р В Р’В»Р В РЎвЂ Р В Р вЂ¦Р В Р’В°Р В Р’В¶Р В Р’В°Р В Р’В»Р В РЎвЂ Р РЋРІР‚В Р В РЎвЂР РЋРІР‚С›Р РЋР вЂљР РЋРЎвЂњ, Р В Р’В° Р РЋРІР‚С›Р В РЎвЂўР В РЎвЂќР РЋРЎвЂњР РЋР С“ Р РЋР С“Р В Р’ВµР В РІвЂћвЂ“Р РЋРІР‚РЋР В Р’В°Р РЋР С“ Р В Р вЂ¦Р В Р’Вµ Р В Р вЂ  Р В РЎвЂ”Р В РЎвЂўР В Р’В»Р В Р’Вµ Р Р†Р вЂљРІР‚Сњ Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂ”Р РЋР вЂљР В Р’В°Р В Р вЂ Р В Р’В»Р РЋР РЏР В Р’ВµР В РЎ Р РЋРІР‚В Р В РЎвЂР РЋРІР‚С›Р РЋР вЂљР РЋРЎвЂњ Р В Р вЂ  Р В РЎвЂ”Р В РЎвЂўР В Р’В»Р В Р’Вµ
  if (isDigit && document.activeElement !== qtyInput) {
    e.preventDefault();
    qtyInput.focus();
    qtyInput.value = e.key;  // Р Р†РЎС™РІР‚В¦ Р В РЎвЂ”Р В Р’ВµР РЋР вЂљР В Р вЂ Р В Р’В°Р РЋР РЏ Р РЋРІР‚В Р В РЎвЂР РЋРІР‚С›Р РЋР вЂљР В Р’В° Р РЋР С“Р РЋР вЂљР В Р’В°Р В Р’В·Р РЋРЎвЂњ Р В РЎвЂ”Р В РЎвЂўР РЋР РЏР В Р вЂ Р В Р’В»Р РЋР РЏР В Р’ВµР РЋРІР‚С™Р РЋР С“Р РЋР РЏ
    return;
  }
});




function formatMoney(n){
  const x = Number(n) || 0;
  return x.toLocaleString("ru-RU");
}

function formatPercent(n){
  const x = Number(n) || 0;
  if (Number.isInteger(x)) return String(x);
  return x.toFixed(2).replace(/\.?0+$/, "");
}

function calcDiscountedTotal(total, discount){
  const sum = Number(total) || 0;
  const d = Number(discount) || 0;
  const safe = Math.min(100, Math.max(0, d));
  return Math.max(0, sum * (1 - safe / 100));
}

function updateNewOrderTotal() {
  // Р РЋР С“Р РЋРЎвЂњР В РЎР В РЎР В Р’В° Р В РЎвЂ Р В РЎвЂќР В РЎвЂўР В Р’В»Р В РЎвЂР РЋРІР‚РЋР В Р’ВµР РЋР С“Р РЋРІР‚С™Р В Р вЂ Р В РЎвЂў Р РЋРІР‚С™Р В РЎвЂўР В Р вЂ Р В Р’В°Р РЋР вЂљР В РЎвЂўР В Р вЂ  (Р РЋР С“Р РЋРЎвЂњР В РЎР В РЎР В Р’В° qty)
  let total = 0;
  let count = 0;

  for (const [pid, qtyRaw] of newOrderCart.entries()) {
    const qty = Number(qtyRaw) || 0;
    if (qty <= 0) continue;

    const p = newOrderAllProducts.find(x => Number(x.id) === Number(pid));
    const price = Number(p?.price) || 0;

    count += qty;
    total += price * qty;
  }

  // Р Р†РЎС™РІР‚В¦ Р В Р’ВµР РЋР С“Р В Р’В»Р В РЎвЂ Р В РЎвЂќР В РЎвЂўР РЋР вЂљР В Р’В·Р В РЎвЂР В Р вЂ¦Р В Р’В° Р РЋР С“Р РЋРІР‚С™Р В Р’В°Р В Р’В»Р В Р’В° Р В РЎвЂ”Р РЋРЎвЂњР РЋР С“Р РЋРІР‚С™Р В РЎвЂўР В РІвЂћвЂ“ Р В РЎвЂ Р В РЎР РЋРІР‚в„– Р В Р вЂ  selected Р Р†Р вЂљРІР‚Сњ Р В Р вЂ Р В РЎвЂўР В Р’В·Р В Р вЂ Р РЋР вЂљР В Р’В°Р РЋРІР‚В°Р В Р’В°Р В Р’ВµР В РЎР РЋР С“Р РЋР РЏ Р В Р вЂ  products
  if (count === 0 && newOrderMode === "selected") {
    newOrderMode = "products";
    // Р В РЎвЂ”Р В РЎвЂўР В РЎвЂќР В Р’В°Р В Р’В·Р РЋРІР‚в„–Р В Р вЂ Р В Р’В°Р В Р’ВµР В РЎ Р В РЎвЂќР В Р’В°Р РЋРІР‚С™Р В Р’В°Р В Р’В»Р В РЎвЂўР В РЎвЂ“ Р РЋР С“Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В Р’В° (Р В Р’В±Р В Р’ВµР В Р’В· Р В Р’В·Р В Р’В°Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™Р В РЎвЂР РЋР РЏ Р В РЎР В РЎвЂўР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂќР В РЎвЂ)
    renderNewOrderProducts(newOrderAllProducts);
  }

  if (newOrderTotalEl) {
    newOrderTotalEl.textContent = `\u041e\u0431\u0449\u0430\u044f \u0441\u0443\u043c\u043c\u0430: ${formatMoney(total)} \u0441`;
  }

  if (el.newOrderCount) {
    el.newOrderCount.textContent = `\u0422\u043e\u0432\u0430\u0440\u043e\u0432: ${count}`;
  }

  const hasItems = count > 0;

  if (newOrderCreateBtn) newOrderCreateBtn.disabled = !hasItems;

  if (newOrderReviewBtn) {
    newOrderReviewBtn.disabled = !hasItems;

    // Р В Р’ВµР РЋР С“Р В Р’В»Р В РЎвЂ Р В Р вЂ Р РЋРІР‚в„– Р В Р вЂ  Р РЋР вЂљР В Р’ВµР В Р’В¶Р В РЎвЂР В РЎР В Р’Вµ selected, Р В РЎвЂќР В Р вЂ¦Р В РЎвЂўР В РЎвЂ”Р В РЎвЂќР В Р’В° Р В РўвЂР В РЎвЂўР В Р’В»Р В Р’В¶Р В Р вЂ¦Р В Р’В° Р В Р’В±Р РЋРІР‚в„–Р РЋРІР‚С™Р РЋР Р‰ "Р В РЎСљР В Р’В°Р В Р’В·Р В Р’В°Р В РўвЂ"
    if (hasItems) {
      newOrderReviewBtn.textContent =
        (newOrderMode === "selected") ? "\u041d\u0430\u0437\u0430\u0434" : "\u041f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0435";
    } else {
      newOrderReviewBtn.textContent = "\u041f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0435";
    }
  }
}

function openNewOrderModal(){
  if (!state.selectedClientId) {
    alert("\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u043b\u0438\u0435\u043d\u0442\u0430");
    return;
  }

  newOrderModalMode = "create";              // Р Р†РЎС™РІР‚В¦ Р РЋР вЂљР В Р’ВµР В Р’В¶Р В РЎвЂР В РЎ Р РЋР С“Р В РЎвЂўР В Р’В·Р В РўвЂР В Р’В°Р В Р вЂ¦Р В РЎвЂР РЋР РЏ
  setNewOrderModalTexts("create");           // Р Р†РЎС™РІР‚В¦ Р В Р вЂ Р В Р’ВµР РЋР вЂљР В Р вЂ¦Р РЋРЎвЂњР РЋРІР‚С™Р РЋР Р‰ Р РЋРІР‚С™Р В Р’ВµР В РЎвЂќР РЋР С“Р РЋРІР‚С™Р РЋРІР‚в„– "Р В РЎСљР В РЎвЂўР В Р вЂ Р РЋРІР‚в„–Р В РІвЂћвЂ“ Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В·"

  const client = state.clients.find(c => c.id === state.selectedClientId);

  // Р В Р вЂ Р В Р’В°Р РЋРІвЂљВ¬Р В Р’Вµ Р РЋРІР‚С™Р В Р’ВµР В РЎвЂќР РЋРЎвЂњР РЋРІР‚В°Р В Р’ВµР В Р’Вµ Р В РЎвЂ”Р В РЎвЂўР В Р вЂ Р В Р’ВµР В РўвЂР В Р’ВµР В Р вЂ¦Р В РЎвЂР В Р’Вµ: Р В РЎвЂ”Р В РЎвЂўР В РЎвЂќР В Р’В°Р В Р’В·Р РЋРІР‚в„–Р В Р вЂ Р В Р’В°Р В Р’ВµР В РЎ Р В РЎвЂР В РЎР РЋР РЏ Р В РЎвЂќР В Р’В»Р В РЎвЂР В Р’ВµР В Р вЂ¦Р РЋРІР‚С™Р В Р’В° (Р В РЎвЂќР В Р’В°Р В РЎвЂќ Р РЋРЎвЂњ Р В Р вЂ Р В Р’В°Р РЋР С“ Р В Р’В±Р РЋРІР‚в„–Р В Р’В»Р В РЎвЂў)
  if (client && el.newOrderTitle) {
    el.newOrderTitle.textContent = `${client.first_name} ${client.last_name}`;
  }

  newOrderCart = new Map();
  newOrderMode = "products";

  if (newOrderSearch) newOrderSearch.value = "";
  if (newOrderProductsBox) newOrderProductsBox.innerHTML = "";
  if (newOrderTotalEl) newOrderTotalEl.textContent = "\u041e\u0431\u0449\u0430\u044f \u0441\u0443\u043c\u043c\u0430: 0 \u0441";
  if (el.newOrderCount) el.newOrderCount.textContent = "\u0422\u043e\u0432\u0430\u0440\u043e\u0432: 0";

  if (newOrderCreateBtn) newOrderCreateBtn.disabled = true;
  if (newOrderReviewBtn) {
    newOrderReviewBtn.disabled = true;
    newOrderReviewBtn.textContent = "\u041f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0435";
  }

  newOrderModal.classList.remove("hidden");
  loadAdminProductsForNewOrder();
}

function closeNewOrderModal(){
  newOrderModal.classList.add("hidden");
  newOrderMode = "products";

  // Р Р†РЎС™РІР‚В¦ Р В РЎвЂ”Р РЋР вЂљР В РЎвЂ Р В Р’В·Р В Р’В°Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™Р В РЎвЂР В РЎвЂ Р В Р вЂ Р РЋР С“Р В Р’ВµР В РЎвЂ“Р В РўвЂР В Р’В° Р В Р вЂ Р В РЎвЂўР В Р’В·Р В Р вЂ Р РЋР вЂљР В Р’В°Р РЋРІР‚В°Р В Р’В°Р В Р’ВµР В РЎ Р РЋРІР‚С™Р В Р’ВµР В РЎвЂќР РЋР С“Р РЋРІР‚С™Р РЋРІР‚в„– Р В Р вЂ  Р РЋР вЂљР В Р’ВµР В Р’В¶Р В РЎвЂР В РЎ "create",
  // Р РЋРІР‚РЋР РЋРІР‚С™Р В РЎвЂўР В Р’В±Р РЋРІР‚в„– "Р В РЎСљР В РЎвЂўР В Р вЂ Р РЋРІР‚в„–Р В РІвЂћвЂ“ Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В·" Р В Р вЂ¦Р В РЎвЂР В РЎвЂќР В РЎвЂўР В РЎвЂ“Р В РўвЂР В Р’В° Р В Р вЂ¦Р В Р’Вµ Р В Р’В»Р В РЎвЂўР В РЎР В Р’В°Р В Р’В»Р РЋР С“Р РЋР РЏ
  newOrderModalMode = "create";
  setNewOrderModalTexts("create");

  if (newOrderReviewBtn) newOrderReviewBtn.textContent = "\u041f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0435";
}

async function loadAdminProductsForNewOrder(){
  try{
    const res = await fetch("/api/admin/products", { credentials: "include" });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438 \u0442\u043e\u0432\u0430\u0440\u043e\u0432");

    newOrderAllProducts = Array.isArray(data) ? data : [];
    newOrderAllProducts.sort((a, b) =>
  String(a?.name || "").localeCompare(String(b?.name || ""), "ru", { sensitivity: "base" })
);
    renderNewOrderProducts(newOrderAllProducts);
  }catch(e){
    alert(e.message || "\u041e\u0448\u0438\u0431\u043a\u0430");
  }
}

function renderNewOrderProducts(list) {
  const q = (newOrderSearch.value || "").trim().toLowerCase();

  const filtered = (list || []).filter(p => {
    if (!q) return true;
    const name = String(p.name || "").toLowerCase();
    const type = String(p.type || "").toLowerCase();
    const man  = String(p.manufacturer || "").toLowerCase();
    return name.includes(q) || type.includes(q) || man.includes(q);
  });

  if (filtered.length === 0) {
    newOrderProductsBox.innerHTML = `<div class="ov-empty">\u041d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e</div>`;
    updateNewOrderTotal();
    return;
  }

  // Р В Р’В Р В РІР‚СћР В РЎСљР В РІР‚СњР В РІР‚СћР В Р’В 
  newOrderProductsBox.innerHTML = filtered.map(p => {
    const id  = Number(p.id);

    let img = p.image ? String(p.image) : "";
    if (img && !img.startsWith("http") && !img.startsWith("/")) img = "/" + img;

    return `
      <div class="add-row">
        <div class="add-img ${img ? "is-click" : ""}" data-img="${escapeHtml(img)}">
          ${img ? `<img src="${escapeHtml(img)}" alt="">` : ""}
        </div>

        <div class="add-info">
          <div class="add-name">${escapeHtml(p.name || "")}</div>

          <div class="add-sub">
            ${escapeHtml(p.type || "")}
            ${p.manufacturer ? " \u2022 " + escapeHtml(p.manufacturer) : ""}
            ${p.expiry_date ? " \u2022 \u0434\u043e " + escapeHtml(p.expiry_date) : ""}
            \u2022 <span class="add-price-inline">${formatMoney(p.price)} \u0441</span>
          </div>
        </div>

        <div class="add-ctrl">
          <button class="add-btn add-add" data-id="${id}" type="button">\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c</button>
        </div>
      </div>
    `;
  }).join("");

  // 1) Р В РЎв„ўР В РЎСљР В РЎвЂєР В РЎСџР В РЎв„ўР В РЎвЂ™ "Р В РІР‚СњР В РЎвЂўР В Р’В±Р В Р’В°Р В Р вЂ Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰" -> Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р В Р вЂ Р В Р’В°Р В Р’ВµР В РЎ Р В РЎР В РЎвЂўР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂќР РЋРЎвЂњ Р В РЎвЂќР В РЎвЂўР В Р’В»Р В РЎвЂР РЋРІР‚РЋР В Р’ВµР РЋР С“Р РЋРІР‚С™Р В Р вЂ Р В Р’В°
  newOrderProductsBox.querySelectorAll(".add-add").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-id"));
      openQtyModal(id);
    });
  });

  // 2) Р В РЎв„ўР В РІР‚С”Р В Р’Р В РЎв„ў Р В РЎСџР В РЎвЂє Р В Р’В¤Р В РЎвЂєР В РЎС›Р В РЎвЂє -> Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р В Р вЂ Р В Р’В°Р В Р’ВµР В РЎ imageModal
  newOrderProductsBox.querySelectorAll(".add-img.is-click").forEach(imgBox => {
    imgBox.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const src = imgBox.getAttribute("data-img") || "";
      if (!src) return;

      openImage(src);
    });
  });

  updateNewOrderTotal();
}

function flashQtyNeedInput(qtyEl){
  if (!qtyEl) return;
  qtyEl.classList.add("qty-flash");
  setTimeout(() => qtyEl.classList.remove("qty-flash"), 220);
}

function startInlineQtyEdit(pid){
  pid = Number(pid);

  const qtyBox = newOrderProductsBox.querySelector(`.add-qty[data-qty="${pid}"]`);
  if (!qtyBox) return;

  // Р В Р’ВµР РЋР С“Р В Р’В»Р В РЎвЂ Р РЋРЎвЂњР В Р’В¶Р В Р’Вµ Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™ Р В РЎвЂР В Р вЂ¦Р В РЎвЂ”Р РЋРЎвЂњР РЋРІР‚С™ Р Р†Р вЂљРІР‚Сњ Р В Р вЂ¦Р В Р’Вµ Р В РўвЂР РЋРЎвЂњР В Р’В±Р В Р’В»Р В РЎвЂР РЋР вЂљР РЋРЎвЂњР В Р’ВµР В РЎ
  if (qtyBox.querySelector("input")) return;

  const prevQty = Number(newOrderCart.get(pid) || 1);

  qtyBox.dataset.prev = String(prevQty);
  qtyBox.classList.add("qty-edit");

  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.value = String(prevQty);

  input.style.width = "100%";
  input.style.height = "100%";
  input.style.border = "0";
  input.style.outline = "0";
  input.style.background = "transparent";
  input.style.textAlign = "center";
  input.style.font = "inherit";
  input.style.fontWeight = "800";
  input.style.color = "inherit";

  qtyBox.textContent = "";
  qtyBox.appendChild(input);

  const placeCaretToEnd = () => {
    try {
      const v = input.value || "";
      input.setSelectionRange(v.length, v.length);
    } catch (_) {}
  };

  // Р РЋРІР‚С›Р В РЎвЂўР В РЎвЂќР РЋРЎвЂњР РЋР С“ Р В Р’В±Р В Р’ВµР В Р’В· Р В Р вЂ Р РЋРІР‚в„–Р В РўвЂР В Р’ВµР В Р’В»Р В Р’ВµР В Р вЂ¦Р В РЎвЂР РЋР РЏ
  input.focus({ preventScroll: true });
  placeCaretToEnd();
  requestAnimationFrame(placeCaretToEnd);
  setTimeout(placeCaretToEnd, 0);

  // Р В Р’ВµР РЋР С“Р В Р’В»Р В РЎвЂ Р В РЎвЂќР В Р’В»Р В РЎвЂР В РЎвЂќР В Р вЂ¦Р РЋРЎвЂњР В Р’В»Р В РЎвЂ Р В РЎвЂ”Р В РЎвЂў Р В РЎвЂР В Р вЂ¦Р В РЎвЂ”Р РЋРЎвЂњР РЋРІР‚С™Р РЋРЎвЂњ Р В РЎР РЋРІР‚в„–Р РЋРІвЂљВ¬Р РЋР Р‰Р РЋР вЂ№ Р Р†Р вЂљРІР‚Сњ Р В Р вЂ¦Р В Р’Вµ Р В РўвЂР В Р’В°Р РЋРІР‚Р В РЎ Р В Р вЂ Р РЋРІР‚в„–Р В РўвЂР В Р’ВµР В Р’В»Р РЋР РЏР РЋРІР‚С™Р РЋР Р‰, Р В РЎвЂќР РЋРЎвЂњР РЋР вЂљР РЋР С“Р В РЎвЂўР РЋР вЂљ Р В Р вЂ  Р В РЎвЂќР В РЎвЂўР В Р вЂ¦Р В Р’ВµР РЋРІР‚В 
  input.addEventListener("mouseup", (e) => {
    e.preventDefault();
    placeCaretToEnd();
  }, { once: true });

  const closeInput = (commit) => {
    const curText = String(input.value || "").trim();

    if (!commit) {
      qtyBox.innerHTML = "";
      qtyBox.textContent = String(prevQty);
      qtyBox.classList.remove("qty-edit");
      updateNewOrderTotal();
      return;
    }

    if (!curText) {
      qtyBox.classList.add("qty-flash");
      setTimeout(() => qtyBox.classList.remove("qty-flash"), 220);
      input.focus({ preventScroll: true });
      placeCaretToEnd();
      return;
    }

    let next = Number(curText);
    if (!Number.isFinite(next) || next < 1) {
      qtyBox.classList.add("qty-flash");
      setTimeout(() => qtyBox.classList.remove("qty-flash"), 220);
      input.focus({ preventScroll: true });
      placeCaretToEnd();
      return;
    }

    next = Math.floor(next);

    newOrderCart.set(pid, next);

    qtyBox.innerHTML = "";
    qtyBox.textContent = String(next);
    qtyBox.classList.remove("qty-edit");

    updateNewOrderTotal();
    renderNewOrderSelected();
  };

  // Р РЋРІР‚С™Р В РЎвЂўР В Р’В»Р РЋР Р‰Р В РЎвЂќР В РЎвЂў Р РЋРІР‚В Р В РЎвЂР РЋРІР‚С›Р РЋР вЂљР РЋРІР‚в„– + Р РЋР С“Р В Р’В»Р РЋРЎвЂњР В Р’В¶Р В Р’ВµР В Р’В±Р В Р вЂ¦Р РЋРІР‚в„–Р В Р’Вµ Р В РЎвЂќР В Р’В»Р В Р’В°Р В Р вЂ Р В РЎвЂР РЋРІвЂљВ¬Р В РЎвЂ
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); closeInput(true); return; }
    if (e.key === "Escape") { e.preventDefault(); closeInput(false); return; }

    if (
      e.key === "Backspace" || e.key === "Delete" || e.key === "Tab" ||
      e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End"
    ) return;

    if (!/^\d$/.test(e.key)) e.preventDefault();
  });

  // blur = Р В РЎвЂ”Р В РЎвЂўР В РЎвЂ”Р РЋРІР‚в„–Р РЋРІР‚С™Р В РЎвЂќР В Р’В° Р В РЎвЂ”Р В РЎвЂўР В РўвЂР РЋРІР‚С™Р В Р вЂ Р В Р’ВµР РЋР вЂљР В РўвЂР В РЎвЂР РЋРІР‚С™Р РЋР Р‰
  input.addEventListener("blur", () => closeInput(true));

  // Р В РЎвЂќР В Р’В»Р В РЎвЂР В РЎвЂќ Р В Р вЂ Р В Р вЂ¦Р В Р’Вµ: Р В РЎвЂ”Р В РЎвЂў Р В РЎвЂќР В Р вЂ¦Р В РЎвЂўР В РЎвЂ”Р В РЎвЂќР В Р’В°Р В РЎ/Р В РЎвЂР В Р вЂ¦Р РЋРІР‚С™Р В Р’ВµР РЋР вЂљР В Р’В°Р В РЎвЂќР РЋРІР‚С™Р В РЎвЂР В Р вЂ Р РЋРЎвЂњ Р Р†Р вЂљРІР‚Сњ Р В РЎвЂўР РЋРІР‚С™Р В РЎР В Р’ВµР В Р вЂ¦Р В Р’В°; Р В РЎвЂ”Р В РЎвЂў Р В РЎвЂ”Р РЋРЎвЂњР РЋР С“Р РЋРІР‚С™Р В РЎвЂўР В РЎР РЋРЎвЂњ Р В РЎР В Р’ВµР РЋР С“Р РЋРІР‚С™Р РЋРЎвЂњ Р Р†Р вЂљРІР‚Сњ Р В РЎвЂ”Р В РЎвЂўР В РўвЂР РЋРІР‚С™Р В Р вЂ Р В Р’ВµР РЋР вЂљР В Р’В¶Р В РўвЂР В Р’В°Р В Р’ВµР В РЎ
  const onDocDown = (e) => {
    if (qtyBox.contains(e.target)) return;

    const isAction = e.target.closest("button, a, input, select, textarea, [role='button']");
    if (isAction) closeInput(false);
    else closeInput(true);

    document.removeEventListener("mousedown", onDocDown, true);
  };
  document.addEventListener("mousedown", onDocDown, true);
}

function renderNewOrderSelected(){
  // Р Р†РЎС™РІР‚В¦ Р В Р’ВµР РЋР С“Р В Р’В»Р В РЎвЂ Р В РЎвЂќР В РЎвЂўР РЋР вЂљР В Р’В·Р В РЎвЂР В Р вЂ¦Р В Р’В° Р В РЎвЂ”Р РЋРЎвЂњР РЋР С“Р РЋРІР‚С™Р В Р’В°Р РЋР РЏ Р Р†Р вЂљРІР‚Сњ Р РЋР С“Р РЋР вЂљР В Р’В°Р В Р’В·Р РЋРЎвЂњ Р В Р вЂ Р В РЎвЂўР В Р’В·Р В Р вЂ Р РЋР вЂљР В Р’В°Р РЋРІР‚В°Р В Р’В°Р В Р’ВµР В РЎ Р В Р вЂ  Р РЋР вЂљР В Р’ВµР В Р’В¶Р В РЎвЂР В РЎ Р В Р вЂ Р РЋРІР‚в„–Р В Р’В±Р В РЎвЂўР РЋР вЂљР В Р’В° Р РЋРІР‚С™Р В РЎвЂўР В Р вЂ Р В Р’В°Р РЋР вЂљР В РЎвЂўР В Р вЂ 
  if (newOrderCart.size === 0) {
    newOrderMode = "products";
    renderNewOrderProducts(newOrderAllProducts);
    updateNewOrderTotal();
    return;
  }

  const q = (newOrderSearch?.value || "").trim().toLowerCase();

  const items = Array.from(newOrderCart.entries())
    .map(([pid, qty]) => {
      const p = newOrderAllProducts.find(x => Number(x.id) === Number(pid));
      if (!p) return null;
      return { p, qty: Number(qty) || 0 };
    })
    .filter(Boolean)
    .filter(({ p }) => {
      if (!q) return true;
      const name = String(p.name || "").toLowerCase();
      const type = String(p.type || "").toLowerCase();
      const man  = String(p.manufacturer || "").toLowerCase();
      return name.includes(q) || type.includes(q) || man.includes(q);
    });

  // Р В Р’ВµР РЋР С“Р В Р’В»Р В РЎвЂ Р В РЎвЂ”Р В РЎвЂў Р В РЎвЂ”Р В РЎвЂўР В РЎвЂР РЋР С“Р В РЎвЂќР РЋРЎвЂњ Р В Р вЂ¦Р В РЎвЂР РЋРІР‚РЋР В Р’ВµР В РЎвЂ“Р В РЎвЂў Р В Р вЂ¦Р В Р’Вµ Р В Р вЂ¦Р В Р’В°Р В РІвЂћвЂ“Р В РўвЂР В Р’ВµР В Р вЂ¦Р В РЎвЂў, Р В Р вЂ¦Р В РЎвЂў Р В РЎвЂќР В РЎвЂўР РЋР вЂљР В Р’В·Р В РЎвЂР В Р вЂ¦Р В Р’В° Р В Р вЂ¦Р В Р’Вµ Р В РЎвЂ”Р РЋРЎвЂњР РЋР С“Р РЋРІР‚С™Р В Р’В°Р РЋР РЏ Р Р†Р вЂљРІР‚Сњ Р В РЎвЂ”Р В РЎвЂўР В РЎвЂќР В Р’В°Р В Р’В·Р РЋРІР‚в„–Р В Р вЂ Р В Р’В°Р В Р’ВµР В РЎ Р РЋР С“Р В РЎвЂўР В РЎвЂўР В Р’В±Р РЋРІР‚В°Р В Р’ВµР В Р вЂ¦Р В РЎвЂР В Р’Вµ
  if (!items.length){
    newOrderProductsBox.innerHTML = `<div class="ov-empty">\u041d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e</div>`;
    updateNewOrderTotal();
    return;
  }

  newOrderProductsBox.innerHTML = items.map(({p, qty}) => {
    const id = Number(p.id);

    let img = p.image ? String(p.image) : "";
    if (img && !img.startsWith("http") && !img.startsWith("/")) img = "/" + img;

    return `
      <div class="add-row" data-pid="${id}">
        <div class="add-img ${img ? "is-click" : ""}" data-img="${escapeHtml(img)}">
          ${img ? `<img src="${escapeHtml(img)}" alt="">` : ""}
        </div>

        <div class="add-info">
          <div class="add-name">${escapeHtml(p.name || "")}</div>

          <div class="add-sub">
            ${escapeHtml(p.type || "")}
            ${p.manufacturer ? " \u2022 " + escapeHtml(p.manufacturer) : ""}
            ${p.expiry_date ? " \u2022 \u0434\u043e " + escapeHtml(p.expiry_date) : ""}
            \u2022 <span class="add-price-inline">${formatMoney(p.price)} \u0441</span>
          </div>
        </div>

        <div class="add-ctrl">
          <button class="add-btn-icon sel-minus" data-id="${id}" type="button">-</button>
          <div class="add-qty sel-qty" data-qty="${id}" title="\u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u0438 \u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e">${qty}</div>
          <button class="add-btn-icon sel-plus" data-id="${id}" type="button">+</button>
          <button class="ov-trash sel-del" data-id="${id}" type="button" aria-label="\u0423\u0434\u0430\u043b\u0438\u0442\u044c">\ud83d\uddd1</button>
        </div>
      </div>
    `;
  }).join("");

  // Р РЋРІР‚С›Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂў
  newOrderProductsBox.querySelectorAll(".add-img.is-click").forEach(imgBox => {
    imgBox.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const src = imgBox.getAttribute("data-img") || "";
      if (!src) return;

      openImage(src);
    });
  });

  // Р В РЎР В РЎвЂР В Р вЂ¦Р РЋРЎвЂњР РЋР С“
  newOrderProductsBox.querySelectorAll(".sel-minus").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      const cur = Number(newOrderCart.get(id) || 1);
      if (cur <= 1) return;
      newOrderCart.set(id, cur - 1);

      updateNewOrderTotal();
      if (newOrderCart.size === 0) return; // updateNewOrderTotal Р РЋР С“Р В Р’В°Р В РЎ Р В Р вЂ Р В Р’ВµР РЋР вЂљР В Р вЂ¦Р РЋРІР‚Р РЋРІР‚С™ Р В Р вЂ  products
      renderNewOrderSelected();
    });
  });

  // Р В РЎвЂ”Р В Р’В»Р РЋР вЂ№Р РЋР С“
  newOrderProductsBox.querySelectorAll(".sel-plus").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      const cur = Number(newOrderCart.get(id) || 1);
      newOrderCart.set(id, cur + 1);

      updateNewOrderTotal();
      renderNewOrderSelected();
    });
  });

  // Р РЋРЎвЂњР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰
  newOrderProductsBox.querySelectorAll(".sel-del").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      newOrderCart.delete(id);

      // Р Р†РЎС™РІР‚В¦ Р В Р’ВµР РЋР С“Р В Р’В»Р В РЎвЂ Р РЋРЎвЂњР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂР В Р’В»Р В РЎвЂ Р В РЎвЂ”Р В РЎвЂўР РЋР С“Р В Р’В»Р В Р’ВµР В РўвЂР В Р вЂ¦Р В РЎвЂР В РІвЂћвЂ“ Р Р†Р вЂљРІР‚Сњ Р РЋР С“Р РЋР вЂљР В Р’В°Р В Р’В·Р РЋРЎвЂњ Р В Р вЂ Р В РЎвЂўР В Р’В·Р В Р вЂ Р РЋР вЂљР В Р’В°Р РЋРІР‚В°Р В Р’В°Р В Р’ВµР В РЎР РЋР С“Р РЋР РЏ Р В Р вЂ  products
      if (newOrderCart.size === 0) {
        updateNewOrderTotal(); // Р В Р вЂ Р В Р вЂ¦Р РЋРЎвЂњР РЋРІР‚С™Р РЋР вЂљР В РЎвЂ Р В Р’ВµР РЋР С“Р РЋРІР‚С™Р РЋР Р‰ Р В Р’В°Р В Р вЂ Р РЋРІР‚С™Р В РЎвЂў-Р В РЎвЂ”Р В Р’ВµР РЋР вЂљР В Р’ВµР РЋРІР‚В¦Р В РЎвЂўР В РўвЂ
        return;
      }

      updateNewOrderTotal();
      renderNewOrderSelected();
    });
  });

  // Р В РЎвЂќР В Р’В»Р В РЎвЂР В РЎвЂќ Р В РЎвЂ”Р В РЎвЂў Р РЋРІР‚В Р В РЎвЂР РЋРІР‚С›Р РЋР вЂљР В Р’Вµ -> inline Р В Р вЂ Р В Р вЂ Р В РЎвЂўР В РўвЂ
  newOrderProductsBox.querySelectorAll(".sel-qty").forEach(qtyEl => {
    qtyEl.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = Number(qtyEl.dataset.qty);
      startInlineQtyEdit(id);
    });
  });

  updateNewOrderTotal();
}

async function createNewOrder() {
  // items Р В РЎвЂР В Р’В· Р В РЎвЂќР В РЎвЂўР РЋР вЂљР В Р’В·Р В РЎвЂР В Р вЂ¦Р РЋРІР‚в„–
  const items = Array.from(newOrderCart.entries()).map(([productId, qty]) => ({
    productId: Number(productId),
    qty: Number(qty)
  })).filter(x => x.productId && x.qty >= 1);

  if (!items.length) {
    alert("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0445\u043e\u0442\u044f \u0431\u044b \u043e\u0434\u0438\u043d \u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442");
    return;
  }

  // ===== Р В Р’В Р В РІР‚СћР В РІР‚вЂњР В Р’Р В РЎС™: ADD TO EXISTING ORDER =====
  if (newOrderModalMode === "add") {
    if (!state.selectedOrderId) {
      alert("\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u043e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u0437\u0430\u043a\u0430\u0437");
      return;
    }

    try {
      // Р В РўвЂР В РЎвЂўР В Р’В±Р В Р’В°Р В Р вЂ Р В Р’В»Р РЋР РЏР В Р’ВµР В РЎ Р В РЎвЂќР В Р’В°Р В Р’В¶Р В РўвЂР РЋРІР‚в„–Р В РІвЂћвЂ“ Р РЋРІР‚С™Р В РЎвЂўР В Р вЂ Р В Р’В°Р РЋР вЂљ Р В Р вЂ  Р РЋР С“Р РЋРЎвЂњР РЋРІР‚В°Р В Р’ВµР РЋР С“Р РЋРІР‚С™Р В Р вЂ Р РЋРЎвЂњР РЋР вЂ№Р РЋРІР‚В°Р В РЎвЂР В РІвЂћвЂ“ Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В·
      for (const it of items) {
        const res = await fetch(`/api/admin/orders/${state.selectedOrderId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ product_id: it.productId, qty: it.qty })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "\u041e\u0448\u0438\u0431\u043a\u0430 \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0438\u044f \u043f\u043e\u0437\u0438\u0446\u0438\u0438");
      }

      closeNewOrderModal();

      // Р В РЎвЂўР В Р’В±Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В РЎвЂР В РЎ Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™Р РЋРІР‚в„–Р В РІвЂћвЂ“ Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В· (Р РЋРІР‚РЋР РЋРІР‚С™Р В РЎвЂўР В Р’В±Р РЋРІР‚в„– Р В РЎвЂ”Р В РЎвЂўР В Р’В·Р В РЎвЂР РЋРІР‚В Р В РЎвЂР В РЎвЂ Р В РЎвЂ”Р В РЎвЂўР РЋР РЏР В Р вЂ Р В РЎвЂР В Р’В»Р В РЎвЂР РЋР С“Р РЋР Р‰ Р РЋР С“Р РЋР вЂљР В Р’В°Р В Р’В·Р РЋРЎвЂњ)
      const fresh = await fetchJSON(`/api/admin/orders/${state.selectedOrderId}/full`);
      state.orderFull = fresh;
      renderOrderView();

      return;
    } catch (e) {
    alert(e?.message || "Ошибка удаления");
      return;
    }
  }

  // ===== Р В Р’В Р В РІР‚СћР В РІР‚вЂњР В Р’Р В РЎС™: CREATE NEW ORDER (Р В РЎвЂќР В Р’В°Р В РЎвЂќ Р В Р’В±Р РЋРІР‚в„–Р В Р’В»Р В РЎвЂў) =====
  if (!state.selectedClientId) {
    alert("\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u043b\u0438\u0435\u043d\u0442\u0430");
    return;
  }

  try {
    const res = await fetch("/api/admin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        customerId: Number(state.selectedClientId),
        items
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u044f \u0437\u0430\u043a\u0430\u0437\u0430");

    closeNewOrderModal();

    // Р В РЎвЂўР В Р’В±Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰ Р РЋР С“Р В РЎвЂ”Р В РЎвЂР РЋР С“Р В РЎвЂўР В РЎвЂќ Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В·Р В РЎвЂўР В Р вЂ  Р РЋРІР‚С™Р В Р’ВµР В РЎвЂќР РЋРЎвЂњР РЋРІР‚В°Р В Р’ВµР В РЎвЂ“Р В РЎвЂў Р В РЎвЂќР В Р’В»Р В РЎвЂР В Р’ВµР В Р вЂ¦Р РЋРІР‚С™Р В Р’В°
    state.tab = "new";
    el.tabOrders?.classList.add("is-active");
    el.tabDone?.classList.remove("is-active");
    await loadOrders();

  } catch (e) {
    alert(e?.message || "Ошибка удаления");
  }
}

// events
if (newOrderOverlay) newOrderOverlay.addEventListener("click", closeNewOrderModal);
if (newOrderClose) newOrderClose.addEventListener("click", closeNewOrderModal);
if (newOrderSearch) {
  newOrderSearch.addEventListener("input", () => {
    if (newOrderMode === "selected") {
      renderNewOrderSelected();              // Р Р†РЎС™РІР‚В¦ Р В РЎвЂ”Р В РЎвЂўР В РЎвЂР РЋР С“Р В РЎвЂќ Р РЋР вЂљР В Р’В°Р В Р’В±Р В РЎвЂўР РЋРІР‚С™Р В Р’В°Р В Р’ВµР РЋРІР‚С™ Р В РЎвЂ Р В Р вЂ  Р В Р вЂ Р РЋРІР‚в„–Р В Р’В±Р РЋР вЂљР В Р’В°Р В Р вЂ¦Р В Р вЂ¦Р В РЎвЂўР В РЎ
    } else {
      renderNewOrderProducts(newOrderAllProducts);
    }
  });
}
if (newOrderCreateBtn) newOrderCreateBtn.addEventListener("click", createNewOrder);

if (newOrderReviewBtn) {
  newOrderReviewBtn.addEventListener("click", () => {
    if (newOrderCart.size === 0) return;

    if (newOrderMode === "products") {
      newOrderMode = "selected";
      newOrderReviewBtn.textContent = "\u041d\u0430\u0437\u0430\u0434";
      renderNewOrderSelected();
    } else {
      newOrderMode = "products";
      newOrderReviewBtn.textContent = "\u041f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0435";
      renderNewOrderProducts(newOrderAllProducts);
    }
  });
}



async function backToOrders(){
  state.view = "orders";
  state.selectedOrderId = null;
  state.orderFull = null;
  await loadOrders(); // Р Р†РЎС™РІР‚В¦ Р В Р вЂ Р В РЎР В Р’ВµР РЋР С“Р РЋРІР‚С™Р В РЎвЂў renderOrders()
}


function calcItemsTotal(items){
  return (items || []).reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
}

function renderOrderView(){
  const items = state.orderFull?.items || [];
  const total = Number(state.orderFull?.order?.total) || calcItemsTotal(items);
  const discount = Number(state.orderFull?.order?.discount) || 0;
  const totalAfterDiscountRaw = Number(state.orderFull?.order?.total_after_discount);
  const totalAfterDiscount = Number.isFinite(totalAfterDiscountRaw)
    ? totalAfterDiscountRaw
    : calcDiscountedTotal(total, discount);
  const currentStatus = String(state.orderFull?.order?.status || (state.tab === "done" ? "done" : "new"));
  const isDoneOrder = currentStatus === "done";
  const doneBtnText = isDoneOrder ? "Не выполнено" : "Выполнено";

  el.ordersList.innerHTML = `
    <div class="order-view">

     <div class="order-view-top">
  <button class="ov-back" type="button">
    <svg viewBox="0 0 24 24" width="22" height="22">
      <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>

  <div class="ov-spacer"></div>

<button class="ov-del" type="button">\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437</button>
<button class="ov-discount" type="button">\u0421\u043a\u0438\u0434\u043a\u0430</button>
<button class="ov-add" type="button">\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c</button>
</div>

      <div class="order-view-list">
        ${
          items.length
            ? items.map(it => {
                const price = Number(it.price) || 0;
                const qty   = Number(it.qty) || 0;

                // Р В РЎвЂ”Р В РЎвЂўР В Р’В»Р РЋР РЏ Р В РЎР В РЎвЂўР В РЎвЂ“Р РЋРЎвЂњР РЋРІР‚С™ Р В Р вЂ¦Р В Р’В°Р В Р’В·Р РЋРІР‚в„–Р В Р вЂ Р В Р’В°Р РЋРІР‚С™Р РЋР Р‰Р РЋР С“Р РЋР РЏ Р В РЎвЂ”Р В РЎвЂў-Р РЋР вЂљР В Р’В°Р В Р’В·Р В Р вЂ¦Р В РЎвЂўР В РЎР РЋРЎвЂњ Р Р†Р вЂљРІР‚Сњ Р В РўвЂР В Р’ВµР В Р’В»Р В Р’В°Р В Р’ВµР В РЎ Р В Р’В±Р В Р’ВµР В Р’В·Р В РЎвЂўР В РЎвЂ”Р В Р’В°Р РЋР С“Р В Р вЂ¦Р РЋРІР‚в„–Р В Р’Вµ fallback
                const type = it.type ?? it.product_type ?? "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e";
                const man  = it.manufacturer ?? it.product_manufacturer ?? "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e";
                const exp  = it.expiry_date ?? it.product_expiry ?? "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e";

                return `
                  <div class="ov-item" data-item-id="${it.id}">
                    <div class="ov-item-left">
                      <div class="ov-name">${escapeHtml(it.name || "")}</div>
                      <div class="ov-sub">
                        ${escapeHtml(type)}
                        \u2022 ${escapeHtml(man)}
                        \u2022 \u0434\u043e ${escapeHtml(exp)}
                        \u2022 <b>${formatMoney(price)} \u0441</b>
                      </div>
                    </div>

                    <div class="ov-controls">
                      <button class="ov-btn ov-minus" type="button">-</button>
                      <input class="ov-qty" type="number" min="1" step="1" inputmode="numeric" value="${qty}" />
                      <button class="ov-btn ov-plus" type="button">+</button>
                      <button class="ov-trash" type="button" aria-label="\u0423\u0434\u0430\u043b\u0438\u0442\u044c">\ud83d\uddd1</button>
                    </div>
                  </div>
                `;
              }).join("")
            : `<div class="ov-empty">\u041f\u0443\u0441\u0442\u043e</div>`
        }
      </div>

      <div class="order-view-bottom">
        <div class="ov-total">
          \u041e\u0431\u0449\u0430\u044f \u0441\u0443\u043c\u043c\u0430 \u0437\u0430\u043a\u0430\u0437\u0430: <b>${formatMoney(total)} \u0441</b>
          &nbsp;\u2022&nbsp;
          \u0421\u043a\u0438\u0434\u043a\u0430: <b>${formatPercent(discount)}%</b>
        </div>

        <div class="ov-actions">
          <button class="ov-done" type="button">${doneBtnText}</button>
          <button class="ov-print" type="button">\u041f\u0435\u0447\u0430\u0442\u0430\u0442\u044c</button>
        </div>
      </div>

    </div>
  `;

  // Back
  el.ordersList.querySelector(".ov-back").addEventListener("click", backToOrders);

  // Buttons
el.ordersList.querySelector(".ov-add").addEventListener("click", openAddToOrderModal);
el.ordersList.querySelector(".ov-discount").addEventListener("click", openOrderDiscountModal);

el.ordersList.querySelector(".ov-del").addEventListener("click", () => {
  if (!state.selectedOrderId) return;
  openDeleteOrderModal(state.selectedOrderId);
});

el.ordersList.querySelector(".ov-print").addEventListener("click", () => {
  printCurrentOrder();
});

el.ordersList.querySelector(".ov-done").addEventListener("click", () => {
  if (!state.selectedOrderId) return;
  void toggleCurrentOrderStatus(isDoneOrder ? "new" : "done");
});

  // Item controls
  el.ordersList.querySelectorAll(".ov-item").forEach(row => {
    const itemId = Number(row.dataset.itemId);
    const qtyInput = row.querySelector(".ov-qty");

    row.querySelector(".ov-minus").addEventListener("click", () => changeQty(itemId, -1));
    row.querySelector(".ov-plus").addEventListener("click", () => changeQty(itemId, +1));
    row.querySelector(".ov-trash").addEventListener("click", () => deleteItem(itemId));

    qtyInput?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      void applyOrderItemQtyFromInput(itemId, qtyInput);
    });

    qtyInput?.addEventListener("blur", () => {
      void applyOrderItemQtyFromInput(itemId, qtyInput);
    });
  });

  el.ordersList.querySelector(".ov-del")?.addEventListener("click", () => {
  if (!state.selectedOrderId) return;
  openDeleteOrderModal(state.selectedOrderId);
});

}

async function toggleCurrentOrderStatus(nextStatus){
  if (!state.selectedOrderId) return;
  if (nextStatus !== "new" && nextStatus !== "done") return;

  try {
    const res = await fetch(`/api/admin/orders/${state.selectedOrderId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: nextStatus })
    });

    // try to parse server response to show a helpful message
    let data = null;
    try { data = await res.json(); } catch (_) {}

    if (!res.ok) {
      // if backend provided a message – show it
      throw new Error(data?.message || `Не удалось обновить статус (${res.status})`);
    }

    state.tab = nextStatus === "done" ? "done" : "new";
    el.tabOrders?.classList.toggle("is-active", state.tab === "new");
    el.tabDone?.classList.toggle("is-active", state.tab === "done");

    await backToOrders();
  } catch (e) {
    alert(e?.message || "Ошибка обновления статуса");
  }
}
async function changeQty(itemId, delta){
  const items = state.orderFull?.items || [];
  const it = items.find(x => Number(x.id) === Number(itemId));
  if (!it) return;

  const nextQty = (Number(it.qty) || 0) + delta;
  if (nextQty < 1) return;

  await updateOrderItemQty(itemId, nextQty);
}

async function applyOrderItemQtyFromInput(itemId, inputEl){
  const items = state.orderFull?.items || [];
  const it = items.find(x => Number(x.id) === Number(itemId));
  if (!it || !inputEl) return;

  const raw = String(inputEl.value || "").trim();
  const parsed = Math.floor(Number(raw));

  if (!Number.isFinite(parsed) || parsed < 1) {
    inputEl.value = String(Number(it.qty) || 1);
    return;
  }
  if (parsed === Number(it.qty)) {
    inputEl.value = String(parsed);
    return;
  }

  await updateOrderItemQty(itemId, parsed);
}

async function updateOrderItemQty(itemId, nextQty){
  const items = state.orderFull?.items || [];
  const it = items.find(x => Number(x.id) === Number(itemId));
  if (!it) return;

  const res = await fetch(`/api/admin/order-items/${itemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ qty: Number(nextQty) })
  });
  if (!res.ok) return;

  const data = await res.json();
  it.qty = Number(nextQty);

  if (state.orderFull?.order) {
    state.orderFull.order.total = Number(data?.total) || calcItemsTotal(items);
    state.orderFull.order.total_after_discount = calcDiscountedTotal(
      state.orderFull.order.total,
      Number(state.orderFull.order.discount) || 0
    );
  }
  renderOrderView();
}

async function deleteItem(itemId){
const res = await fetch(`/api/admin/order-items/${itemId}`, {
  method: "DELETE",
  credentials: "include"
});

  if (!res.ok) return;

  const items = state.orderFull?.items || [];
  state.orderFull.items = items.filter(x => Number(x.id) !== Number(itemId));

  if (state.orderFull?.order) {
    state.orderFull.order.total = calcItemsTotal(state.orderFull.items);
    state.orderFull.order.total_after_discount = calcDiscountedTotal(
      state.orderFull.order.total,
      Number(state.orderFull.order.discount) || 0
    );
  }
  renderOrderView();
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getSelectedClientFullName(){
  // 1) Р В Р’ВµР РЋР С“Р В Р’В»Р В РЎвЂ Р В РЎвЂР В Р’В·Р В Р вЂ Р В Р’ВµР РЋР С“Р РЋРІР‚С™Р В Р’ВµР В Р вЂ¦ Р В Р вЂ Р РЋРІР‚в„–Р В Р’В±Р РЋР вЂљР В Р’В°Р В Р вЂ¦Р В Р вЂ¦Р РЋРІР‚в„–Р В РІвЂћвЂ“ Р В РЎвЂќР В Р’В»Р В РЎвЂР В Р’ВµР В Р вЂ¦Р РЋРІР‚С™
  const c = state.clients.find(x => Number(x.id) === Number(state.selectedClientId));
  if (c) return `${c.first_name || ""} ${c.last_name || ""}`.trim();

  // 2) Р В Р’В·Р В Р’В°Р В РЎвЂ”Р В Р’В°Р РЋР С“Р В Р вЂ¦Р В РЎвЂўР В РІвЂћвЂ“ Р В Р вЂ Р В Р’В°Р РЋР вЂљР В РЎвЂР В Р’В°Р В Р вЂ¦Р РЋРІР‚С™ (Р РЋРІР‚С™Р В РЎвЂў Р РЋРІР‚РЋР РЋРІР‚С™Р В РЎвЂў Р РЋРЎвЂњР В Р’В¶Р В Р’Вµ Р В Р вЂ  UI)
  return String(el.selectedClientName?.textContent || "").trim();
}

function safeText(v, fallback = "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e"){
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}

function printCurrentOrder(){
  if (!state.orderFull?.order) {
    alert("\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u043e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u0437\u0430\u043a\u0430\u0437");
    return;
  }

  const clientName = getSelectedClientFullName();
  const items = state.orderFull.items || [];
  const total = Number(state.orderFull.order.total) || 0;
  const discount = Number(state.orderFull.order.discount) || 0;
  const totalAfterDiscountRaw = Number(state.orderFull.order.total_after_discount);
  const totalAfterDiscount = Number.isFinite(totalAfterDiscountRaw)
    ? totalAfterDiscountRaw
    : calcDiscountedTotal(total, discount);

const createdAtRaw = state.orderFull?.order?.created_at || "";
const createdAt = parseDateSmart(createdAtRaw);

const orderDateText =
  createdAt && !Number.isNaN(createdAt.getTime())
    ? createdAt.toLocaleDateString("ru-RU", { timeZone: TZ }) + " " +
      createdAt.toLocaleTimeString("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
    : "";

  const rowsHtml = items.map((it, idx) => {
    const name = safeText(it.name, "");
    const type = safeText(it.type);
    const man  = safeText(it.manufacturer);
    const exp  = safeText(it.expiry_date);
    const price = Number(it.price) || 0;
    const qty   = Number(it.qty) || 0;
    const line  = price * qty;

    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(name)}</td>
        <td>${escapeHtml(type)}</td>
        <td>${escapeHtml(man)}</td>
        <td>${escapeHtml(exp)}</td>
        <td>${formatMoney(price)} \u0441</td>
        <td>${qty}</td>
        <td>${formatMoney(line)} \u0441</td>
      </tr>
    `;
  }).join("");

  const printArea = document.createElement("div");
  printArea.id = "printArea";
  printArea.innerHTML = `
   <div style="display:flex; flex-direction:column; gap:4px; margin-bottom:10px;">
  <div style="font-size:22px; font-weight:800;">\u0417\u0430\u043a\u0430\u0437</div>
<div style="font-size:13px; color:#666;">
  ${orderDateText}
</div>
</div>
    <div style="margin-bottom:10px; font-weight:bold">${escapeHtml(clientName)}</div>

    <table border="1" style="width:100%; border-collapse:collapse">
      <thead>
        <tr>
          <th>\u2116</th>
          <th>\u041f\u0440\u0435\u043f\u0430\u0440\u0430\u0442</th>
          <th>\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f</th>
          <th>\u041f\u0440\u043e\u0438\u0437\u0432\u043e\u0434\u0438\u0442\u0435\u043b\u044c</th>
          <th>\u0421\u0440\u043e\u043a \u0433\u043e\u0434\u043d\u043e\u0441\u0442\u0438</th>
          <th>\u0426\u0435\u043d\u0430</th>
          <th>\u041a\u043e\u043b-\u0432\u043e</th>
          <th>\u0421\u0443\u043c\u043c\u0430</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    <div style="margin-top:15px; font-weight:bold; text-align:right; white-space:nowrap;">
      \u041e\u0431\u0449\u0430\u044f \u0441\u0443\u043c\u043c\u0430 \u0437\u0430\u043a\u0430\u0437\u0430: ${formatMoney(total)} \u0441
      &nbsp;\u2022&nbsp;
      \u0421\u043a\u0438\u0434\u043a\u0430: ${formatPercent(discount)}%
      &nbsp;\u2022&nbsp;
      \u0418\u0442\u043e\u0433\u043e \u0441 \u0443\u0447\u0451\u0442\u043e\u043c \u0441\u043a\u0438\u0434\u043a\u0438: ${formatMoney(totalAfterDiscount)} \u0441
    </div>
  `;

  document.body.appendChild(printArea);
  window.print();
  document.body.removeChild(printArea);
}

// ============== ADD MODAL STATE ==============
const addState = {
  open: false,
  products: [],
  qtyById: {},   // productId -> qty
  q: ""
};

function openAddModal(){
  addState.open = true;
  addState.q = "";
  addState.products = [];
  addState.qtyById = {};

  el.addSearchInput.value = "";
  el.addProductsList.innerHTML = `<div class="ov-empty">\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...</div>`;

  // ====== Р В Р РѓР В РЎвЂ™Р В РЎСџР В РЎв„ўР В РЎвЂ™: Р В РўвЂР В Р’В°Р РЋРІР‚С™Р В Р’В°/Р В Р вЂ Р РЋР вЂљР В Р’ВµР В РЎР РЋР РЏ Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В·Р В Р’В° + Р В РЎвЂР В РЎР РЋР РЏ Р В РЎвЂќР В Р’В»Р В РЎвЂР В Р’ВµР В Р вЂ¦Р РЋРІР‚С™Р В Р’В° ======
  const tEl = document.getElementById("addModalTitle");
  const sEl = document.getElementById("addModalSub");

  if (tEl) tEl.textContent = "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0432 \u0437\u0430\u043a\u0430\u0437";

  const createdAtRaw = state.orderFull?.order?.created_at || "";
  const createdAt = parseDateSmart(createdAtRaw);

  const dt =
    createdAt && !Number.isNaN(createdAt.getTime())
      ? createdAt.toLocaleDateString("ru-RU", { timeZone: TZ }) + " " +
        createdAt.toLocaleTimeString("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
      : "";

  const clientName = getSelectedClientFullName();

  const line = [dt, clientName].filter(Boolean).join(" • ");
  if (sEl) sEl.textContent = line;

  // ====== Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™Р РЋР Р‰ Р В РЎР В РЎвЂўР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂќР РЋРЎвЂњ ======
  el.addModal.classList.remove("hidden");
  el.addModal.setAttribute("aria-hidden", "false");

  loadProductsForAdd("");
  setTimeout(() => el.addSearchInput.focus(), 0);
}

function closeAddModal(){
  addState.open = false;
  el.addModal.classList.add("hidden");
  el.addModal.setAttribute("aria-hidden", "true");

  // Р В РЎвЂўР В Р’В±Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В Р’В»Р РЋР РЏР В Р’ВµР В РЎ Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В· Р В РЎвЂ”Р В РЎвЂўР РЋР С“Р В Р’В»Р В Р’Вµ Р В Р’В·Р В Р’В°Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™Р В РЎвЂР РЋР РЏ Р В РЎвЂўР В РЎвЂќР В Р вЂ¦Р В Р’В° Р В РўвЂР В РЎвЂўР В Р’В±Р В Р’В°Р В Р вЂ Р В Р’В»Р В Р’ВµР В Р вЂ¦Р В РЎвЂР РЋР РЏ
  if (state.view === "order" && state.orderFull) renderOrderView();
}



async function loadProductsForAdd(q) {
  try {
    // Р Р†РЎС™РІР‚В¦ Р В РЎвЂ“Р РЋР вЂљР РЋРЎвЂњР В Р’В·Р В РЎвЂР В РЎ Р РЋРІР‚С™Р В РЎвЂўР В Р вЂ Р В Р’В°Р РЋР вЂљР РЋРІР‚в„– Р В РЎвЂўР В РўвЂР В РЎвЂР В Р вЂ¦ Р РЋР вЂљР В Р’В°Р В Р’В·, Р В Р’ВµР РЋР С“Р В Р’В»Р В РЎвЂ Р РЋРЎвЂњР В Р’В¶Р В Р’Вµ Р В Р’В·Р В Р’В°Р В РЎвЂ“Р РЋР вЂљР РЋРЎвЂњР В Р’В¶Р В Р’В°Р В Р’В»Р В РЎвЂ Р Р†Р вЂљРІР‚Сњ Р В Р вЂ¦Р В Р’Вµ Р В РўвЂР РЋРІР‚Р РЋР вЂљР В РЎвЂ“Р В Р’В°Р В Р’ВµР В РЎ Р РЋР С“Р В Р’ВµР РЋР вЂљР В Р вЂ Р В Р’ВµР РЋР вЂљ
    if (!addState._allProducts) {
      const data = await fetchJSON("/api/admin/products");
      addState._allProducts = Array.isArray(data) ? data : (data?.items || []);
    }

    const text = String(q || "").trim().toLowerCase();

    const filtered = !text
      ? addState._allProducts
      : addState._allProducts.filter(p => {
          const name = String(p.name || "").toLowerCase();
          const type = String(p.type || "").toLowerCase();
          const man  = String(p.manufacturer || "").toLowerCase();
          return name.includes(text) || type.includes(text) || man.includes(text);
        });

    addState.products = filtered;
    renderAddProducts();
  } catch (e) {
    el.addProductsList.innerHTML = `<div class="ov-empty">\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438 \u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442\u043e\u0432</div>`;
  }
}

function renderAddProducts(){
  const list = addState.products || [];
  if (!list.length){
    el.addProductsList.innerHTML = `<div class="ov-empty">\u041d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e</div>`;
    return;
  }

  el.addProductsList.innerHTML = list.map(p => {
    const id = Number(p.id);
    const name = escapeHtml(p.name || "");
    const price = Number(p.price) || 0;
    let img = p.image ? String(p.image) : "";
if (img && !img.startsWith("http") && !img.startsWith("/")) img = "/" + img; // Р Р†РЎС™РІР‚В¦ Р В Р вЂ Р В Р’В°Р В Р’В¶Р В Р вЂ¦Р В РЎвЂў

    const qty = addState.qtyById[id] ?? 1;

    return `
      <div class="add-row" data-pid="${id}">
      <div class="add-img ${img ? "is-click" : ""}" data-img="${escapeHtml(img)}">
        ${img ? `<img src="${escapeHtml(img)}" alt="">` : ""}
      </div>

        <div>
          <div class="add-name">${name}</div>
          <div class="add-sub">\u0446\u0435\u043d\u0430: <b>${price}</b>\u0441 &nbsp; \u041e\u0431\u0449\u0430\u044f \u0441\u0443\u043c\u043c\u0430: <b>${price * qty}</b></div>
        </div>

        <div class="add-ctrl">
          <button class="add-btn-icon add-minus" type="button">-</button>
          <div class="add-qty">${qty}</div>
          <button class="add-btn-icon add-plus" type="button">+</button>
          <button class="add-btn add-do" type="button">\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c</button>
        </div>
      </div>
    `;
  }).join("");
  

  // bind controls
  el.addProductsList.querySelectorAll(".add-row").forEach(row => {
    const pid = Number(row.dataset.pid);
    
      // Р Р†РЎС™РІР‚В¦ Р В РІР‚в„ўР В РЎвЂєР В РЎС› Р В Р Р‹Р В Р’В®Р В РІР‚СњР В РЎвЂ™
const imgBox = row.querySelector(".add-img");
if (imgBox) {
  imgBox.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const src = imgBox.getAttribute("data-img") || "";
    if (!src) return;

    openImage(src);
  });
}

    row.querySelector(".add-minus").addEventListener("click", () => {
      const cur = addState.qtyById[pid] ?? 1;
      const next = Math.max(1, cur - 1);
      addState.qtyById[pid] = next;
      renderAddProducts();
    });

    row.querySelector(".add-plus").addEventListener("click", () => {
      const cur = addState.qtyById[pid] ?? 1;
      addState.qtyById[pid] = cur + 1;
      renderAddProducts();
    });

    row.querySelector(".add-do").addEventListener("click", async () => {
      const qty = addState.qtyById[pid] ?? 1;
      await addProductToOrder(pid, qty);
    });
  });
}

async function addProductToOrder(productId, qty){
  if (!state.selectedOrderId) return;

const res = await fetch(`/api/admin/orders/${state.selectedOrderId}/items`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ product_id: Number(productId), qty: Number(qty) })
});

  if (!res.ok){
    alert("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442");
    return;
  }

  // Р Р†РЎС™РІР‚В¦ Р В РЎСљР В РІР‚Сћ Р В Р’В·Р В Р’В°Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р В Р вЂ Р В Р’В°Р В Р’ВµР В РЎ Р В РЎР В РЎвЂўР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂќР РЋРЎвЂњ
  // closeAddModal();

  // Р Р†РЎС™РІР‚В¦ (Р В РЎвЂўР В РЎвЂ”Р РЋРІР‚В Р В РЎвЂР В РЎвЂўР В Р вЂ¦Р В Р’В°Р В Р’В»Р РЋР Р‰Р В Р вЂ¦Р В РЎвЂў) Р РЋР С“Р В Р’В±Р РЋР вЂљР В РЎвЂўР РЋР С“Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰ qty Р В РўвЂР В РЎвЂўР В Р’В±Р В Р’В°Р В Р вЂ Р В Р’В»Р В Р’ВµР В Р вЂ¦Р В Р вЂ¦Р В РЎвЂўР В РЎвЂ“Р В РЎвЂў Р РЋРІР‚С™Р В РЎвЂўР В Р вЂ Р В Р’В°Р РЋР вЂљР В Р’В° Р В РЎвЂўР В Р’В±Р РЋР вЂљР В Р’В°Р РЋРІР‚С™Р В Р вЂ¦Р В РЎвЂў Р В Р вЂ¦Р В Р’В° 1
  addState.qtyById[Number(productId)] = 1;

  // Р Р†РЎС™РІР‚В¦ Р В РЎвЂўР В Р’В±Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В Р’В»Р РЋР РЏР В Р’ВµР В РЎ Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В· Р В Р вЂ  Р РЋРІР‚С›Р В РЎвЂўР В Р вЂ¦Р В Р’Вµ, Р РЋРІР‚РЋР РЋРІР‚С™Р В РЎвЂўР В Р’В±Р РЋРІР‚в„– Р В РЎвЂ”Р РЋР вЂљР В РЎвЂ Р В Р’В·Р В Р’В°Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™Р В РЎвЂР В РЎвЂ Р В РЎР В РЎвЂўР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂќР В РЎвЂ Р В Р вЂ Р РЋР С“Р РЋРІР‚ Р В Р’В±Р РЋРІР‚в„–Р В Р’В»Р В РЎвЂў Р В Р’В°Р В РЎвЂќР РЋРІР‚С™Р РЋРЎвЂњР В Р’В°Р В Р’В»Р РЋР Р‰Р В Р вЂ¦Р В РЎвЂў
  try{
    const data = await fetchJSON(`/api/admin/orders/${state.selectedOrderId}/full`);
    state.orderFull = data;
  }catch(e){
    // Р В Р’ВµР РЋР С“Р В Р’В»Р В РЎвЂ Р В Р вЂ¦Р В Р’Вµ Р В РЎвЂ”Р В РЎвЂўР В Р’В»Р РЋРЎвЂњР РЋРІР‚РЋР В РЎвЂР В Р’В»Р В РЎвЂўР РЋР С“Р РЋР Р‰ Р В РЎвЂўР В Р’В±Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В РЎвЂР РЋРІР‚С™Р РЋР Р‰ Р Р†Р вЂљРІР‚Сњ Р В Р вЂ¦Р В Р’Вµ Р В Р’В»Р В РЎвЂўР В РЎР В Р’В°Р В Р’ВµР В РЎ Р В РЎвЂР В Р вЂ¦Р РЋРІР‚С™Р В Р’ВµР РЋР вЂљР РЋРІР‚С›Р В Р’ВµР В РІвЂћвЂ“Р РЋР С“
    console.error(e);
  }

  // Р Р†РЎС™РІР‚В¦ Р В РЎвЂ”Р В Р’ВµР РЋР вЂљР В Р’ВµР РЋР вЂљР В РЎвЂР РЋР С“Р В РЎвЂўР В Р вЂ Р В Р’В°Р РЋРІР‚С™Р РЋР Р‰ Р РЋР С“Р В РЎвЂ”Р В РЎвЂР РЋР С“Р В РЎвЂўР В РЎвЂќ Р В Р вЂ  Р В РЎР В РЎвЂўР В РўвЂР В Р’В°Р В Р’В»Р В РЎвЂќР В Р’Вµ (Р РЋРІР‚РЋР РЋРІР‚С™Р В РЎвЂўР В Р’В±Р РЋРІР‚в„– Р В РЎвЂўР В Р’В±Р В Р вЂ¦Р В РЎвЂўР В Р вЂ Р В РЎвЂР В Р’В»Р В Р’В°Р РЋР С“Р РЋР Р‰ "Р В РЎвЂєР В Р’В±Р РЋРІР‚В°Р В Р’В°Р РЋР РЏ Р РЋР С“Р РЋРЎвЂњР В РЎР В РЎР В Р’В°" Р В РЎвЂ qty)
  renderAddProducts();

  // Р Р†РЎС™РІР‚В¦ (Р В РЎвЂўР В РЎвЂ”Р РЋРІР‚В Р В РЎвЂР В РЎвЂўР В Р вЂ¦Р В Р’В°Р В Р’В»Р РЋР Р‰Р В Р вЂ¦Р В РЎвЂў) Р В РЎвЂќР В РЎвЂўР РЋР вЂљР В РЎвЂўР РЋРІР‚С™Р В РЎвЂќР В РЎвЂўР В Р’Вµ Р РЋРЎвЂњР В Р вЂ Р В Р’ВµР В РўвЂР В РЎвЂўР В РЎР В Р’В»Р В Р’ВµР В Р вЂ¦Р В РЎвЂР В Р’Вµ Р В Р вЂ Р В РЎР В Р’ВµР РЋР С“Р РЋРІР‚С™Р В РЎвЂў alert
  // toast("Р В РІР‚СњР В РЎвЂўР В Р’В±Р В Р’В°Р В Р вЂ Р В Р’В»Р В Р’ВµР В Р вЂ¦Р В РЎвЂў");
}




/* ================= TABS ================= */

function setTab(tab) {
  state.tab = tab;

  if (state.mainSection === "payments") {
    state.paymentView = "orders";
    state.selectedPaymentOrderId = null;
    state.paymentOrderFull = null;

    el.tabOrders.classList.toggle("is-active", tab === "new");
    el.tabDone.classList.toggle("is-active", tab === "done");
    applyPaymentsTabColor();

    void renderPaymentsData();
    return;
  }

  // Р В Р’ВµР РЋР С“Р В Р’В»Р В РЎвЂ Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™ Р В РЎвЂќР В РЎвЂўР В Р вЂ¦Р В РЎвЂќР РЋР вЂљР В Р’ВµР РЋРІР‚С™Р В Р вЂ¦Р РЋРІР‚в„–Р В РІвЂћвЂ“ Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В· Р Р†Р вЂљРІР‚Сњ Р В Р вЂ Р В РЎвЂўР В Р’В·Р В Р вЂ Р РЋР вЂљР В Р’В°Р РЋРІР‚В°Р В Р’В°Р В Р’ВµР В РЎР РЋР С“Р РЋР РЏ Р В РЎвЂќ Р РЋР С“Р В РЎвЂ”Р В РЎвЂР РЋР С“Р В РЎвЂќР РЋРЎвЂњ
  state.view = "orders";
  state.selectedOrderId = null;
  state.orderFull = null;

  el.tabOrders.classList.toggle("is-active", tab === "new");
  el.tabDone.classList.toggle("is-active", tab === "done");
  applyPaymentsTabColor();

  loadOrders();
}

async function payCurrentPaymentOrder() {
  if (state.mainSection !== "payments" || !state.selectedClientId) return;

  const year = Number(state.payments.year) || Number(el.yearSelect?.value) || new Date().getFullYear();
  const month = Number(state.payments.month) || Number(el.monthSelect?.value) || 0;
  let url = `/api/admin/customers/${state.selectedClientId}/orders?status=done&year=${year}`;
  if (month >= 1 && month <= 12) {
    url += `&month=${month}`;
  }

  let orders = [];
  try {
    const data = await fetchJSON(url);
    orders = Array.isArray(data) ? data : [];
  } catch (e) {
    alert(e?.message || "Ошибка загрузки заказов");
    return;
  }

  const unpaid = orders
    .map((o) => {
      const total = Number(o.total) || 0;
      const discount = Number(o.discount) || 0;
      const totalAfter = Number.isFinite(Number(o.total_after_discount))
        ? Number(o.total_after_discount)
        : calcDiscountedTotal(total, discount);
      const paid = Math.max(0, Number(o.paid_amount) || 0);
      const remaining = Math.max(0, totalAfter - paid);
      return { id: Number(o.id) || 0, created_at: o.created_at, remaining };
    })
    .filter((o) => o.id > 0 && o.remaining > 0)
    .sort((a, b) => {
      const da = parseDateSmart(a.created_at);
      const db = parseDateSmart(b.created_at);
      const ta = da && !Number.isNaN(da.getTime()) ? da.getTime() : Number.POSITIVE_INFINITY;
      const tb = db && !Number.isNaN(db.getTime()) ? db.getTime() : Number.POSITIVE_INFINITY;
      if (ta !== tb) return ta - tb;
      return a.id - b.id;
    });

  const totalDebt = unpaid.reduce((sum, o) => sum + (Number(o.remaining) || 0), 0);
  if (totalDebt <= 0) {
    alert("Долга нет");
    return;
  }

  pendingPaymentBulkOrders = unpaid;
  openPaymentModal(null, totalDebt, "bulk", totalDebt, 0);
}

function onTopPeriodChange() {
  if (state.mainSection === "payments") {
    state.payments.year = Number(el.yearSelect?.value) || new Date().getFullYear();
    state.payments.month = Number(el.monthSelect?.value) || "";
    state.payments.day = "";
    state.paymentView = "orders";
    state.selectedPaymentOrderId = null;
    state.paymentOrderFull = null;
    void renderPaymentsView();
    return;
  }
  void loadOrders();
}

function applyPaymentsTabColor() {
  if (!el.tabOrders || !el.tabDone) return;
  const isPayments = state.mainSection === "payments";

  el.tabOrders.style.background = "";
  el.tabOrders.style.borderColor = "";
  el.tabOrders.style.color = "";

  if (isPayments && state.tab === "new") {
    el.tabOrders.style.background = "rgba(255,70,70,.20)";
    el.tabOrders.style.borderColor = "rgba(220,38,38,.45)";
    el.tabOrders.style.color = "#b42323";
  }
}


const doneModal = document.getElementById("doneModal");
const doneClose = document.getElementById("doneClose");
const doneOk = document.getElementById("doneOk");
const doneClientName = document.getElementById("doneClientName");
let pendingDoneOrderId = null;

// ===== PAYMENT MODAL =====
const paymentModal = document.getElementById("paymentModal");
const paymentClose = document.getElementById("paymentClose");
const paymentCancel = document.getElementById("paymentCancel");
const paymentSave = document.getElementById("paymentSave");
const paymentGivenInput = document.getElementById("paymentGivenInput");
const paymentSub = document.getElementById("paymentSub");
const paymentError = document.getElementById("paymentError");
let pendingPaymentOrderId = null;
let pendingPaymentTotal = 0;
let pendingPaymentDue = 0;
let pendingPaymentMode = "add"; // "add" | "set" | "bulk"
let pendingPaymentBulkOrders = [];

// ===== DELETE ORDER MODAL =====
const delOrderModal  = document.getElementById("delOrderModal");
const delOrderClose  = document.getElementById("delOrderClose");
const delOrderOk     = document.getElementById("delOrderOk");
const delOrderCancel = document.getElementById("delOrderCancel");
const delOrderTitle  = document.getElementById("delOrderTitle");
const delOrderSub    = document.getElementById("delOrderSub");

let pendingDeleteOrderId = null;

function openDeleteOrderModal(orderId){
  pendingDeleteOrderId = Number(orderId);

  // Р В РўвЂР В Р’В°Р РЋРІР‚С™Р В Р’В°/Р В Р вЂ Р РЋР вЂљР В Р’ВµР В РЎР РЋР РЏ
  const createdAtRaw = state.orderFull?.order?.created_at || "";
  const createdAt = parseDateSmart(createdAtRaw);

  const dt =
    createdAt && !Number.isNaN(createdAt.getTime())
      ? createdAt.toLocaleDateString("ru-RU", { timeZone: TZ }) + " " +
        createdAt.toLocaleTimeString("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
      : "";

  // Р РЋР С“Р РЋРЎвЂњР В РЎР В РЎР В Р’В° + Р В РЎвЂ”Р В РЎвЂўР В Р’В·Р В РЎвЂР РЋРІР‚В Р В РЎвЂР В РЎвЂ
  const items = state.orderFull?.items || [];
  const total = Number(state.orderFull?.order?.total) || calcItemsTotal(items);
  const positions = items.length;

  if (delOrderTitle) delOrderTitle.textContent = "\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437?";
  if (delOrderSub) {
    delOrderSub.textContent = [dt, `\u0421\u0443\u043c\u043c\u0430: ${formatMoney(total)} \u0441`, `\u041f\u043e\u0437\u0438\u0446\u0438\u0438: ${positions}`]
      .filter(Boolean)
      .join(" \u2022 ");
  }

  delOrderModal?.classList.remove("hidden");
}

function closeDeleteOrderModal(){
  pendingDeleteOrderId = null;
  delOrderModal?.classList.add("hidden");
}

delOrderClose?.addEventListener("click", closeDeleteOrderModal);
delOrderCancel?.addEventListener("click", closeDeleteOrderModal);

// Р В РЎвЂ”Р В РЎвЂўР В РўвЂР РЋРІР‚С™Р В Р вЂ Р В Р’ВµР РЋР вЂљР В Р’В¶Р В РўвЂР В Р’ВµР В Р вЂ¦Р В РЎвЂР В Р’Вµ Р РЋРЎвЂњР В РўвЂР В Р’В°Р В Р’В»Р В Р’ВµР В Р вЂ¦Р В РЎвЂР РЋР РЏ


delOrderOk?.addEventListener("click", async () => {
  if (!Number.isFinite(pendingDeleteOrderId) || pendingDeleteOrderId <= 0) return;

  try {
    const res = await fetch(`/api/admin/orders/${pendingDeleteOrderId}`, {
      method: "DELETE",
      credentials: "include"
    });

    const raw = await res.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}

    if (!res.ok) {
      const msg =
        data?.message ||
        `Не удалось удалить заказ (HTTP ${res.status})` +
        (raw ? `\nОтвет: ${raw}` : "");
      throw new Error(msg);
    }

    closeDeleteOrderModal();
    await backToOrders();
  } catch (e) {
    alert(e?.message || "Ошибка удаления");
  }
});

function openDoneModal(orderId) {
  pendingDoneOrderId = Number(orderId);

  const client = state.clients.find(c => c.id === state.selectedClientId);
  if (client) {
    doneClientName.textContent = client.first_name + " " + client.last_name;
  }

  doneModal.classList.remove("hidden");
}

function closeDoneModal() {
  pendingDoneOrderId = null;
  doneModal.classList.add("hidden");
}

doneClose.addEventListener("click", closeDoneModal);

// Р В РЎв„ўР В РЎСљР В РЎвЂєР В РЎСџР В РЎв„ўР В РЎвЂ™ "Р В РІР‚СљР В РЎвЂєР В РЎС›Р В РЎвЂєР В РІР‚в„ўР В РЎвЂє" = Р В РЎвЂ”Р В РЎвЂўР В РўвЂР РЋРІР‚С™Р В Р вЂ Р В Р’ВµР РЋР вЂљР В Р’В¶Р В РўвЂР В Р’В°Р В Р’ВµР В РЎ Р В Р вЂ Р РЋРІР‚в„–Р В РЎвЂ”Р В РЎвЂўР В Р’В»Р В Р вЂ¦Р В Р’ВµР В Р вЂ¦Р В РЎвЂР В Р’Вµ
doneOk.addEventListener("click", async () => {
  if (!pendingDoneOrderId) return;

  try {
const res = await fetch(`/api/admin/orders/${pendingDoneOrderId}/status`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ status: "done" })
});


    if (!res.ok) throw new Error("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u0441\u0442\u0430\u0442\u0443\u0441");

    closeDoneModal();
    backToOrders();

    // Р В РЎвЂ”Р В Р’ВµР РЋР вЂљР В Р’ВµР В РЎвЂќР В Р’В»Р РЋР вЂ№Р РЋРІР‚РЋР В Р’В°Р В Р’ВµР В РЎ Р В Р вЂ Р В РЎвЂќР В Р’В»Р В Р’В°Р В РўвЂР В РЎвЂќР РЋРЎвЂњ Р В Р вЂ¦Р В Р’В° "Р В РІР‚в„ўР РЋРІР‚в„–Р В РЎвЂ”Р В РЎвЂўР В Р’В»Р В Р вЂ¦Р В Р’ВµР В Р вЂ¦Р В Р вЂ¦Р РЋРІР‚в„–Р В Р’Вµ"
    state.tab = "done";
    el.tabOrders.classList.remove("is-active");
    el.tabDone.classList.add("is-active");

    // Р В РЎвЂ“Р РЋР вЂљР РЋРЎвЂњР В Р’В·Р В РЎвЂР В РЎ Р РЋРЎвЂњР В Р’В¶Р В Р’Вµ Р В Р вЂ Р РЋРІР‚в„–Р В РЎвЂ”Р В РЎвЂўР В Р’В»Р В Р вЂ¦Р В Р’ВµР В Р вЂ¦Р В Р вЂ¦Р РЋРІР‚в„–Р В Р’Вµ Р В Р’В·Р В Р’В°Р В РЎвЂќР В Р’В°Р В Р’В·Р РЋРІР‚в„–
    await loadOrders();


  } catch (e) {
    console.error(e);
    // Р В РЎвЂ”Р РЋР вЂљР В РЎвЂ Р В Р’В¶Р В Р’ВµР В Р’В»Р В Р’В°Р В Р вЂ¦Р В РЎвЂР В РЎвЂ Р В РЎР В РЎвЂўР В Р’В¶Р В Р вЂ¦Р В РЎвЂў Р В Р вЂ Р РЋРІР‚в„–Р В Р вЂ Р В Р’ВµР РЋР С“Р РЋРІР‚С™Р В РЎвЂ alert
    // alert("Р В РЎвЂєР РЋРІвЂљВ¬Р В РЎвЂР В Р’В±Р В РЎвЂќР В Р’В°. Р В Р Р‹Р РЋРІР‚С™Р В Р’В°Р РЋРІР‚С™Р РЋРЎвЂњР РЋР С“ Р В Р вЂ¦Р В Р’Вµ Р В РЎвЂР В Р’В·Р В РЎР В Р’ВµР В Р вЂ¦Р РЋРІР‚Р В Р вЂ¦.");
  }
});



const imageModal = document.getElementById("imageModal");
const imagePreview = document.getElementById("imagePreview");
const imageClose = document.getElementById("imageClose");
const imageOverlay = document.getElementById("imageOverlay");

function openImage(src){
  imagePreview.src = src;
  imageModal.classList.remove("hidden");
  imageModal.setAttribute("aria-hidden", "false");
}

function closeImage(){
  imageModal.classList.add("hidden");
  imageModal.setAttribute("aria-hidden", "true");
  imagePreview.src = "";
}

imageClose?.addEventListener("click", closeImage);
imageOverlay?.addEventListener("click", closeImage);

// ESC
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!imageModal || imageModal.classList.contains("hidden")) return;
  closeImage();
});


function bind() {


newOrderBtn?.addEventListener("click", openNewOrderModal);

  el.navOrdersBtn?.addEventListener("click", () => { void setMainSection("orders"); });
  el.navClientsBtn?.addEventListener("click", () => { void setMainSection("clients"); });
  el.navProductsBtn?.addEventListener("click", () => { void setMainSection("products"); });
  el.navReportsBtn?.addEventListener("click", () => { void setMainSection("reports"); });
  el.navPaymentsBtn?.addEventListener("click", () => { void setMainSection("payments"); });
  el.topClientEditBtn?.addEventListener("click", () => {
    const client = getSelectedClient();
    if (!client) return;
    openAddClientModal("edit", client);
  });
  el.addClientBtn?.addEventListener("click", () => {
    if (state.mainSection === "products") {
      openProductModal("create");
      return;
    }
    openAddClientModal();
  });
  el.addClientClose?.addEventListener("click", closeAddClientModal);
  el.addClientCancel?.addEventListener("click", closeAddClientModal);
  el.addClientSave?.addEventListener("click", () => { void saveNewClient(); });
  el.addClientModal?.querySelector(".done-overlay")?.addEventListener("click", closeAddClientModal);
  el.discountClose?.addEventListener("click", closeDiscountModal);
  el.discountCancel?.addEventListener("click", closeDiscountModal);
  el.discountSave?.addEventListener("click", () => { void saveClientDiscount(); });
  el.discountModal?.querySelector(".done-overlay")?.addEventListener("click", closeDiscountModal);
  el.orderDiscountClose?.addEventListener("click", closeOrderDiscountModal);
  el.orderDiscountCancel?.addEventListener("click", closeOrderDiscountModal);
  el.orderDiscountSave?.addEventListener("click", () => { void saveOrderDiscount(); });
  el.orderDiscountModal?.querySelector(".done-overlay")?.addEventListener("click", closeOrderDiscountModal);
  el.raisePricesClose?.addEventListener("click", closeRaisePricesModal);
  el.raisePricesCancel?.addEventListener("click", closeRaisePricesModal);
  el.raisePricesSave?.addEventListener("click", () => { void saveRaisedPrices(); });
  el.raisePricesModal?.querySelector(".done-overlay")?.addEventListener("click", closeRaisePricesModal);
  paymentClose?.addEventListener("click", closePaymentModal);
  paymentCancel?.addEventListener("click", closePaymentModal);
  paymentSave?.addEventListener("click", () => { void confirmPaymentModal(); });
  paymentGivenInput?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    void confirmPaymentModal();
  });
  paymentGivenInput?.addEventListener("input", () => {
    if (!paymentError) return;
    paymentError.textContent = "";
    paymentError.style.display = "none";
  });
  paymentModal?.querySelector(".done-overlay")?.addEventListener("click", closePaymentModal);
  el.productModalClose?.addEventListener("click", closeProductModal);
  el.productModalCancel?.addEventListener("click", closeProductModal);
  el.productModalSave?.addEventListener("click", () => { void saveProductModal(); });
  el.productModal?.querySelector(".done-overlay")?.addEventListener("click", closeProductModal);


  el.clientSearch.addEventListener("input", () =>
    renderClients(el.clientSearch.value)
  );

  el.tabOrders.addEventListener("click", () => setTab("new"));
  el.tabDone.addEventListener("click", () => setTab("done"));
  el.tabPayNow?.addEventListener("click", payCurrentPaymentOrder);

  el.yearSelect.addEventListener("change", onTopPeriodChange);
  el.monthSelect.addEventListener("change", onTopPeriodChange);

    // Add modal close
  el.addClose?.addEventListener("click", closeAddModal);
  el.addModal?.querySelector(".add-overlay")?.addEventListener("click", closeAddModal);

  // Search in add modal (Р В РЎвЂ”Р РЋР вЂљР В РЎвЂўР РЋР С“Р РЋРІР‚С™Р В Р’В°Р РЋР РЏ Р В Р’В·Р В Р’В°Р В РўвЂР В Р’ВµР РЋР вЂљР В Р’В¶Р В РЎвЂќР В Р’В°)
  let t = null;
  el.addSearchInput?.addEventListener("input", () => {
    const q = el.addSearchInput.value.trim();
    clearTimeout(t);
    t = setTimeout(() => loadProductsForAdd(q), 250);
  });

  

  // ESC close
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!el.addModal) return;
    if (!el.addModal.classList.contains("hidden")) closeAddModal();
    if (el.discountModal && !el.discountModal.classList.contains("hidden")) closeDiscountModal();
    if (el.orderDiscountModal && !el.orderDiscountModal.classList.contains("hidden")) closeOrderDiscountModal();
    if (el.raisePricesModal && !el.raisePricesModal.classList.contains("hidden")) closeRaisePricesModal();
    if (el.addClientModal && !el.addClientModal.classList.contains("hidden")) closeAddClientModal();
    if (paymentModal && !paymentModal.classList.contains("hidden")) closePaymentModal();
  });



}

/* INIT */
bind();
loadClients();
