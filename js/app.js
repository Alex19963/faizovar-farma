
// ========== APP.JS LOADED ==========
console.log("[APP.JS] Script loaded");

const CLIENT_AUTH_KEY = "client-auth";
const CLIENT_DATA_KEY = "client";


const DEFAULT_IMAGE = "img/products/2323.jpg";

function imgUrl(path) {
  const src = String(path || "").trim();

  // нормализуем Windows слэши
  const clean = src.replace(/\\/g, "/").replace(/^\/+/, "");

  // если пусто — дефолт
  const def = DEFAULT_IMAGE.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!clean) return API_BASE ? `${API_BASE}/${def}` : `/${def}`;

  // если есть — всегда абсолютный путь
  return API_BASE ? `${API_BASE}/${clean}` : `/${clean}`;
}

/**
 * ВАЖНО:
 * - Если сайт открыт через Live Server (localhost:5500), а Node API на localhost:3000,
 *   тогда API_BASE будет "http://localhost:3000".
 * - Если сайт открыт с Node-сервера или через ngrok (не localhost), тогда API_BASE = "" (тот же домен).
 */
const API_BASE = (location.hostname === "localhost" && location.port !== "3000")
  ? "http://localhost:3000"
  : "";

let products = [];
let cart = JSON.parse(localStorage.getItem("cart")) || {};

const productList  = document.getElementById("productList");
const searchInput  = document.getElementById("searchInput");

const cartItems    = document.getElementById("cartItems");
const cartCount    = document.getElementById("cartCount");
const cartTotalBar = document.getElementById("cartTotalBar");
const cartTotal    = document.getElementById("cartTotal");
const cartItemsCount = document.getElementById("cartItemsCount");

const cartScreen = document.getElementById("cartScreen");
const cartBack = document.getElementById("cartBack");
const cartItemsBox = document.getElementById("cartItems");
const cartTotalEl = document.getElementById("cartTotal");
const cartSearchInput = document.getElementById("cartSearchInput");

const histYear = document.getElementById("histYear");
const histMonth = document.getElementById("histMonth");
const histDay = document.getElementById("histDay");
const historyList = document.getElementById("historyList");
const historySummary = document.getElementById("historySummary");


const imageOverlay = document.getElementById("imageOverlay");
const imagePreview = document.getElementById("imagePreview");

// кнопка "Оформить заказ"
const orderBtn = document.querySelector(".order-btn");

// модалка подтверждения
const orderModal = document.getElementById("orderModal");
const sendOrderBtn = document.getElementById("sendOrderBtn");
const cancelOrderBtn = document.getElementById("cancelOrderBtn");

// success state
const orderSuccess = document.getElementById("orderSuccess");
const closeSuccessBtn = document.getElementById("closeSuccessBtn");


// ===== PROFILE (под твой HTML: div#pf*) =====
const profileScreen = document.getElementById("profileScreen");
const pfFullName   = document.getElementById("pfFullName");
const pfPhone      = document.getElementById("pfPhone");
const pfEmail      = document.getElementById("pfEmail");
const pfPharmacy   = document.getElementById("pfPharmacy");
const profileLogoutBtn = document.getElementById("profileLogoutBtn");

function safeText(v, fallback = "—") {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}

function normalizeClient(raw) {
  const c = raw || {};
  const fullName =
    (c.fullName || c.full_name || c.name || "").toString().trim() ||
    `${c.first_name || ""} ${c.last_name || ""}`.trim();

  return {
    id: c.id,
    fullName,
    phone: c.phone || "",
    email: c.email || "",
    pharmacy: c.pharmacy_name || c.pharmacyName || c.address || ""
  };
}

function setText(el, v) {
  if (!el) return;
  el.textContent = safeText(v, "—");
}

function fillProfileView(client) {
  const n = normalizeClient(client);
  setText(pfFullName, n.fullName);
  setText(pfPhone, n.phone);
  setText(pfEmail, n.email);
  setText(pfPharmacy, n.pharmacy);
}

function openProfileScreenOverlay() {
  if (!profileScreen) {
    console.error("[PROFILE] profileScreen element not found in DOM!");
    return;
  }

  console.log("[PROFILE] openProfileScreenOverlay called");
  console.log("[PROFILE] profileScreen element info:", {
    id: profileScreen.id,
    className: profileScreen.className,
    display: profileScreen.style.display,
    computedDisplay: window.getComputedStyle(profileScreen).display,
    hasHiddenClass: profileScreen.classList.contains("hidden")
  });

  // Убедимся, что элемент удален из скрытого состояния
  profileScreen.classList.remove("hidden");
  
  // Явно установим display для гарантии видимости
  profileScreen.style.display = "flex";
  profileScreen.style.visibility = "visible";
  
  // Добавим класс для визуального контроля
  document.body.classList.add("cart-open");

  console.log("[PROFILE] After changes:", {
    display: profileScreen.style.display,
    computedDisplay: window.getComputedStyle(profileScreen).display,
    hasHiddenClass: profileScreen.classList.contains("hidden")
  });

  openProfileScreen();
}

function closeProfileScreenOverlay() {
  if (!profileScreen) return;

  profileScreen.classList.add("hidden");
  document.body.classList.remove("cart-open");
}

window.closeProfileScreen = function closeProfileScreen() {
  closeProfileScreenOverlay();
};

function getClient() {
  try {
    const raw = localStorage.getItem(CLIENT_DATA_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setClient(clientObj) {
  localStorage.setItem(CLIENT_DATA_KEY, JSON.stringify(clientObj));
}

function setProfileAction(mode) {
  if (!profileLogoutBtn) return;

  if (mode === "auth-required") {
    profileLogoutBtn.textContent = "Перейти к авторизации";
    profileLogoutBtn.onclick = () => {
      window.location.href = "auth.html";
    };
    return;
  }

  profileLogoutBtn.textContent = "Выйти из профиля";
  profileLogoutBtn.onclick = logoutClient;
}

function showProfileAuthRequired() {
  setText(pfFullName, "Сначала авторизуйтесь");
  setText(pfPhone, "—");
  setText(pfEmail, "Откройте auth.html");
  setText(pfPharmacy, "—");
  setProfileAction("auth-required");
}

async function fetchCustomerFromDb(customerId){
  const res = await fetch(`${API_BASE}/api/customers/${customerId}`, {
    method: "GET",
    headers: { "Accept": "application/json" }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Не удалось загрузить профиль");
  return data.customer || data;
}

async function openProfileScreen() {
  const client = getClient();
  const authed = localStorage.getItem(CLIENT_AUTH_KEY) === "true";

  if (!authed || !client || !client.id) {
    showProfileAuthRequired();
    return;
  }

  setProfileAction("logout");

  try {
    const fresh = await fetchCustomerFromDb(client.id);
    setClient(fresh);
    fillProfileView(fresh);
  } catch (e) {
    fillProfileView(client);
    alert(e.message || "Профиль временно недоступен");
  }
}

function logoutClient() {
  localStorage.removeItem(CLIENT_AUTH_KEY);
  localStorage.removeItem(CLIENT_DATA_KEY);
  window.closeProfileScreen();
  window.location.href = "auth.html";
}

/**
 * Handler for profile button click
 */
window.handleProfileButtonClick = function(e) {
  e?.preventDefault?.();
  e?.stopPropagation?.();
  e?.stopImmediatePropagation?.();
  openProfileScreenOverlay();
  return false;
};

const accountBtn = document.querySelector(".account-btn");
if (accountBtn) {
  accountBtn.addEventListener("click", (e) => {
    window.handleProfileButtonClick(e);
  }, { capture: true });
}


const orderNotice = document.getElementById("orderNotice");

function showOrderNotice() {
  if (!orderNotice) return;

  orderNotice.classList.remove("hidden");

  // авто-скрытие через 5 секунд (можно убрать если не нужно)
  clearTimeout(showOrderNotice._t);
  showOrderNotice._t = setTimeout(() => {
    orderNotice.classList.add("hidden");
  }, 5000);
}


if (cartSearchInput) {
  cartSearchInput.addEventListener("input", () => {
    renderCartScreen();
  });
}



const categorySelect = document.getElementById("categorySelect");
if (categorySelect) {
  categorySelect.addEventListener("change", renderProducts);
}

if (searchInput) searchInput.addEventListener("input", renderProducts);



/* ================== LOAD PRODUCTS ================== */
async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    products = await res.json();
    renderProducts();
    updateHeaderCart();
  } catch {
    if (productList) productList.textContent = "Ошибка загрузки товаров";
  }
}









/* ================== PRODUCTS UI ================== */
function renderProducts() {
  if (!productList) return;

  productList.innerHTML = "";

  const q = (searchInput?.value || "").toLowerCase().trim();
  const selectedCategory = (categorySelect?.value || "").toLowerCase();

  const mode = (document.getElementById("searchMode")?.value || "name").toLowerCase();

  const getField = (p) => {
    if (mode === "manufacturer") return String(p.manufacturer || "").toLowerCase(); // ИСПРАВЛЕНО
    return String(p.name || "").toLowerCase();
  };

  products
    .filter(p => {
      const textMatch = !q || getField(p).includes(q);
      const categoryMatch =
        !selectedCategory || String(p.type || "").toLowerCase() === selectedCategory;

      return textMatch && categoryMatch;
    })
    .forEach(p => productList.appendChild(productCard(p)));
}

function productCard(p) {
  const id = Number(p.id);
  const hasImg = !!(p.image && String(p.image).trim());
  const imgSrc = hasImg ? imgUrl(p.image) : "";

  const manufacturer = p.manufacturer || "Не указан";
  const expiry = p.expiry_date || "—";

  const row = document.createElement("div");
  row.className = "product-row";

  row.innerHTML = `
<div class="pr-col pr-img">
  ${
    hasImg
      ? `<img src="${imgSrc}" alt="" onclick="openImage('${imgSrc}')" style="cursor: zoom-in;">`
      : `<span class="no-photo">Нет фото</span>`
  }
</div>

<!-- ПК-колонки -->
<div class="pr-col pr-name">${p.name}</div>
<div class="pr-col pr-type">${p.type || "—"}</div>
<div class="pr-col pr-manufacturer">${manufacturer}</div>
<div class="pr-col pr-expiry">${expiry}</div>
<div class="pr-col pr-price">${p.price} c</div>

<div class="pr-col pr-action">
  <button onclick="openQtyModal(${id})">В корзину</button>
</div>
  `;

  return row;
}



function addToCart(id, qty = 1) {
  qty = Math.max(1, Number(qty) || 1);

  cart[id] = (cart[id] || 0) + qty;
  localStorage.setItem("cart", JSON.stringify(cart));

  updateHeaderCart();

  // анимация корзины в шапке (кнопка)
  const cartBtn = document.querySelector(".nav-cart");
  if (cartBtn) {
    cartBtn.classList.remove("cart-bounce");
    void cartBtn.offsetWidth; // перезапуск
    cartBtn.classList.add("cart-bounce");
  }

if (cartScreen && !cartScreen.classList.contains("hidden")) {
  renderCartScreen();
}

}

function addToCartFromCard(id, qty) {
  qty = Math.max(1, Number(qty) || 1);
  addToCart(id, qty);
  closeQtyModal();

  // берём строку товара
  const row = qtyInput?.closest(".product-row");

  // анимация кнопки "В корзину"
  const btn = row?.querySelector(".pr-action button");
  if (btn) {
    btn.classList.remove("btn-pulse");
    void btn.offsetWidth;
    btn.classList.add("btn-pulse");
  }

  // подсветка строки
  if (row) {
    row.classList.remove("row-flash");
    void row.offsetWidth;
    row.classList.add("row-flash");
  }
}



/* ================== CART HEADER + BUTTON VISIBILITY ================== */
function updateOrderButtonVisibility(itemsCount) {
  if (!orderBtn) return;
  orderBtn.style.display = itemsCount > 0 ? "block" : "none";
}

function updateHeaderCart() {
  let count = 0, total = 0;

  for (const id in cart) {
    const p = products.find(x => x.id == id);
    if (!p) continue;

    count += cart[id];
    total += (Number(p.price) || 0) * cart[id];
  }

  if (cartCount) cartCount.textContent = count;
  if (cartTotalBar) cartTotalBar.textContent = total;
  if (cartTotal) cartTotal.textContent = total;
  if (cartItemsCount) cartItemsCount.textContent = count;

  const cartBtn = document.querySelector(".nav-cart");
  if (cartBtn) cartBtn.classList.toggle("is-active", count > 0);

  updateOrderButtonVisibility(count);
}

/* ================== CART SCREEN ================== */
function openCartScreen() {
  if (!cartScreen) return;

  document.body.classList.add("cart-open");     // ВАЖНО
  cartScreen.classList.remove("hidden");

  renderCartScreen();
  updateHeaderCart();
}

function closeCartScreen() {
  if (!cartScreen) return;

  cartScreen.classList.add("hidden");
  document.body.classList.remove("cart-open");  // ВАЖНО

  closeOrderModal();
}





function renderCartScreen() {
  if (!cartItems) return;

  cartItems.innerHTML = "";

  const ids = Object.keys(cart);

  // если корзина пустая
  if (!ids.length) {
    cartItems.innerHTML = `<div style="padding:14px;font-weight:900;color:rgba(11,31,51,.65)">Корзина пустая</div>`;
    return;
  }

  // ===== ПОИСК ПО КОРЗИНЕ =====
  const q = (cartSearchInput?.value || "").toLowerCase().trim();

  // фильтруем позиции корзины по тексту
  const filteredIds = !q
    ? ids
    : ids.filter((idStr) => {
        const id = Number(idStr);
        const p = products.find(x => Number(x.id) === id);
        if (!p) return false;

        const haystack = [
          p.name,
          p.type,
          p.manufacturer,
          p.expiry_date
        ]
          .map(v => String(v || "").toLowerCase())
          .join(" ");

        return haystack.includes(q);
      });

  // если ничего не найдено
  if (!filteredIds.length) {
    cartItems.innerHTML = `<div style="padding:14px;font-weight:900;color:rgba(11,31,51,.65)">Ничего не найдено</div>`;
    return;
  }

  // рендерим только отфильтрованные
  filteredIds.forEach((idStr) => {
    const id = Number(idStr);
    const p = products.find(x => Number(x.id) === id);
    if (!p) return;

    const hasImg = !!(p.image && String(p.image).trim());
    const imgSrc = hasImg ? imgUrl(p.image) : "";

    const manufacturer = p.manufacturer || "Не указан";
    const expiry = p.expiry_date || "—";
    const qty = cart[id] || 1;

    const row = document.createElement("div");
    row.className = "product-row";

    row.innerHTML = `
      <div class="pr-col pr-img">
        ${
          hasImg
            ? `<img src="${imgSrc}" alt="" onclick="openImage('${imgSrc}')" style="cursor: zoom-in;">`
            : `<span class="no-photo">Нет фото</span>`
        }
      </div>

      <!-- MOBILE -->
      <div class="pr-col pr-mobileline">
        <div class="m-name">${p.name}</div>

        <div class="m-sub">
          <span class="m-meta">${p.type || "—"}</span>
          <span class="m-dot">•</span>
          <span class="m-meta">${manufacturer}</span>
          <span class="m-dot">•</span>
          <span class="m-meta">${expiry}</span>
        </div>

        <div class="m-price">${p.price} c</div>
      </div>

      <!-- DESKTOP -->
      <div class="pr-col pr-name">${p.name}</div>
      <div class="pr-col pr-type">${p.type || "—"}</div>
      <div class="pr-col pr-manufacturer">${manufacturer}</div>
      <div class="pr-col pr-expiry">${expiry}</div>
      <div class="pr-col pr-price">${p.price} c</div>

      <div class="pr-col pr-qty">
        <button onclick="changeQty(${id}, -1)">−</button>
        <input type="text" value="${qty}" readonly>
        <button onclick="changeQty(${id}, 1)">+</button>
      </div>

      <div class="pr-col pr-action">
        <button onclick="removeFromCart(${id})">Удалить</button>
      </div>
    `;

    cartItems.appendChild(row);
  });
}


function changeQty(id, delta) {
  cart[id] = (cart[id] || 0) + delta;
  if (cart[id] <= 0) delete cart[id];
  localStorage.setItem("cart", JSON.stringify(cart));
  updateHeaderCart();
  renderCartScreen();
}

function removeFromCart(id) {
  delete cart[id];
  localStorage.setItem("cart", JSON.stringify(cart));
  updateHeaderCart();
  renderCartScreen();
}

/* ================== IMAGE OVERLAY ================== */
function openImage(src) {
  if (!imagePreview || !imageOverlay) return;
  imagePreview.src = src;
  imageOverlay.style.display = "flex";
}

function closeImage() {
  if (!imageOverlay) return;
  imageOverlay.style.display = "none";
}

/* ================== AUTH / PROFILE ================== */
function isClientAuthed() {
  return localStorage.getItem(CLIENT_AUTH_KEY) === "true";
}










function closeProfileScreen() {
  closeProfileScreenOverlay();
}



// クリック по иконке профиля
// ================== PROFILE BUTTON CLICK ==================
// REMOVED bindProfileButton - using onclick handler instead
// (See handleProfileButtonClick in window global scope)




/* ================== ORDER MODAL UI ================== */
function resetOrderModalUi() {
  if (!orderModal) return;

  const actions = orderModal.querySelector(".modal-actions");
  const title = orderModal.querySelector(".modal-title");
  const subtitle = orderModal.querySelector(".modal-subtitle");

  if (actions) actions.style.display = "flex";
  if (title) title.style.display = "block";
  if (subtitle) subtitle.style.display = "block";

  if (orderSuccess) orderSuccess.style.display = "none";
}

function showOrderSuccess() {
  if (!orderModal) return;

  const actions = orderModal.querySelector(".modal-actions");
  const title = orderModal.querySelector(".modal-title");
  const subtitle = orderModal.querySelector(".modal-subtitle");

  if (actions) actions.style.display = "none";
  if (title) title.style.display = "none";
  if (subtitle) subtitle.style.display = "none";

  if (orderSuccess) orderSuccess.style.display = "flex";
}

function openOrderModal() {
  if (!orderModal) return;
  resetOrderModalUi();
  orderModal.style.display = "flex";
}

function closeOrderModal() {
  if (!orderModal) return;
  orderModal.style.display = "none";
  resetOrderModalUi();
}

/* ================== ORDER FLOW ================== */
function getCartCount() {
  let count = 0;
  for (const id in cart) count += cart[id];
  return count;
}

function buildOrderPayload() {
  const client = getClient();
  const items = [];
  let total = 0;

  for (const id in cart) {
    const p = products.find(x => x.id == id);
    if (!p) continue;

    const qty = cart[id];
    items.push({ productId: p.id, name: p.name, price: p.price, qty });
    total += (Number(p.price) || 0) * qty;
  }

  return {
    customerId: client?.id,
    items,
    total
  };
}

async function sendOrder() {
  const payload = buildOrderPayload();

if (!payload.customerId) {
  localStorage.setItem("afterAuthOpenCart", "true");
  window.location.href = "auth.html";
  return;
}




  if (sendOrderBtn) {
    sendOrderBtn.disabled = true;
    sendOrderBtn.textContent = "Отправка...";
  }

  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      let msg = "Не удалось отправить заказ";
      const data = await res.json().catch(() => ({}));
      msg = data?.message || msg;
      alert(msg);
      return;
    }

    // УСПЕХ: очищаем корзину и показываем success-внутри модалки
    cart = {};
    localStorage.setItem("cart", JSON.stringify(cart));
    updateHeaderCart();
    renderCartScreen();

   closeOrderModal();   // закрываем модалку
showOrderNotice();   // показываем зелёный блок в корзине

  } catch {
    alert("Сервер недоступен");
  } finally {
    if (sendOrderBtn) {
      sendOrderBtn.disabled = false;
      sendOrderBtn.textContent = "Отправить заказ";
    }
  }
}

// клик по кнопке "Оформить заказ"
if (orderBtn) {
  orderBtn.addEventListener("click", () => {
    if (getCartCount() <= 0) return;

if (!isClientAuthed()) {
  localStorage.setItem("afterAuthOpenCart", "true");
  window.location.href = "auth.html";
  return;
}
sendOrder();


  });
}

if (cancelOrderBtn) cancelOrderBtn.addEventListener("click", closeOrderModal);
if (sendOrderBtn) sendOrderBtn.addEventListener("click", sendOrder);

// клик по фону модалки — закрыть
if (orderModal) {
  orderModal.addEventListener("click", (e) => {
    if (e.target === orderModal) closeOrderModal();
  });
}

// кнопка "Закрыть" в success
if (closeSuccessBtn) {
  closeSuccessBtn.addEventListener("click", () => {
    closeOrderModal();
    closeCartScreen();
    window.scrollTo(0, 0);
  });
}

// ================= SEARCH MODE DROPDOWN =================
(function initSearchModeDropdown() {
  const dd = document.getElementById("searchModeDD");
  if (!dd) return;

  const btn = document.getElementById("searchModeBtn");
  const menu = document.getElementById("searchModeMenu");
  const hidden = document.getElementById("searchMode");
  const text = document.getElementById("searchModeText");

  if (!btn || !menu || !hidden || !text) return;

  function open() {
    dd.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
  }

  function close() {
    dd.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
  }

  function toggle() {
    dd.classList.contains("open") ? close() : open();
  }

  // открыть/закрыть по клику на кнопку
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  });

  // выбор пункта
  menu.addEventListener("click", (e) => {
    const item = e.target.closest(".search-dd-item");
    if (!item) return;

    e.preventDefault();
    e.stopPropagation();

    const value = item.dataset.value || "name";
    const label = item.textContent.trim();

    hidden.value = value;
    text.textContent = label;

    // активный пункт
    menu.querySelectorAll(".search-dd-item").forEach((b) => b.classList.remove("is-active"));
    item.classList.add("is-active");

    close();
  });

  // закрыть по клику вне
  document.addEventListener("click", (e) => {
    if (!dd.contains(e.target)) close();
  });

  // закрыть по Esc
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
})();

(function initCategoryDropdown(){
  const dd = document.getElementById("categoryDD");
  if (!dd) return;

  const btn = document.getElementById("categoryBtn");
  const menu = document.getElementById("categoryMenu");
  const hidden = document.getElementById("categorySelect");
  const text = document.getElementById("categoryText");

  btn.onclick = (e) => {
    e.stopPropagation();
    dd.classList.toggle("open");
  };

  menu.onclick = (e) => {
    const item = e.target.closest(".search-dd-item");
    if (!item) return;

    hidden.value = item.dataset.value || "";
    text.textContent = item.textContent.trim();

    menu.querySelectorAll(".search-dd-item").forEach(i => i.classList.remove("is-active"));
    item.classList.add("is-active");

    dd.classList.remove("open");
    renderProducts();
  };

  document.addEventListener("click", () => dd.classList.remove("open"));
})();

/* ================== AUTO RETURN TO CART AFTER AUTH ================== */
function handleAfterAuthReturn() {
  if (localStorage.getItem("afterAuthOpenCart") === "true") {
    localStorage.removeItem("afterAuthOpenCart");
    openCartScreen();
  }
}

/* ================== CART BUTTON CLICK ================== */
const navCartBtn = document.querySelector(".nav-cart");

if (navCartBtn) {
  navCartBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openCartScreen();
  });
}


// ================== QUANTITY MODAL ==================
let currentQtyProductId = null;
let currentQtyValue = 1;

const qtyModal = document.getElementById("qtyModal");
const qtyDisplay = document.getElementById("qtyDisplay");
const qtyMinusBtn = document.getElementById("qtyMinusBtn");
const qtyPlusBtn = document.getElementById("qtyPlusBtn");
const qtyConfirmBtn = document.getElementById("qtyConfirmBtn");
const qtyModalTitle = document.getElementById("qtyModalTitle");
const qtyPrice = document.getElementById("qtyPrice");
const qtyTotal = document.getElementById("qtyTotal");

function openQtyModal(id) {
  currentQtyProductId = id;
  currentQtyValue = 1;
  const product = products.find(p => p.id == id);
  
  if (!product) return;
  
  qtyModalTitle.textContent = product.name;
  qtyPrice.textContent = product.price;
  
  updateQtyModalDisplay();
  
  if (qtyModal) {
    qtyModal.classList.remove("hidden");
  }
}

function closeQtyModal() {
  if (qtyModal) {
    qtyModal.classList.add("hidden");
  }
  currentQtyProductId = null;
  currentQtyValue = 1;
}

function updateQtyModalDisplay() {
  const product = products.find(p => p.id == currentQtyProductId);
  if (!product) return;
  
  const price = Number(product.price) || 0;
  const total = price * currentQtyValue;
  
  qtyDisplay.textContent = currentQtyValue;
  qtyTotal.textContent = formatMoney(total);
}

// Bind quantity modal controls
if (qtyMinusBtn) {
  qtyMinusBtn.addEventListener("click", () => {
    currentQtyValue = Math.max(1, currentQtyValue - 1);
    updateQtyModalDisplay();
  });
}

if (qtyPlusBtn) {
  qtyPlusBtn.addEventListener("click", () => {
    currentQtyValue = currentQtyValue + 1;
    updateQtyModalDisplay();
  });
}

if (qtyConfirmBtn) {
  qtyConfirmBtn.addEventListener("click", () => {
    if (currentQtyProductId !== null) {
      addToCartFromCard(currentQtyProductId, currentQtyValue);
    }
  });
}





// ================== MOBILE ONLY: REAL HEADER HEIGHT ==================
(function bindTopbarHeightMobileOnly(){
  const root = document.documentElement;
  const header = document.querySelector(".nav-wrapper");
  if (!header) return;

  const mq = window.matchMedia("(max-width: 720px)");

  function setTopbarH(){
    // если не мобилка — сбрасываем и выходим
    if (!mq.matches) {
      root.style.removeProperty("--topbar-h");
      return;
    }
    const h = Math.ceil(header.getBoundingClientRect().height);
    root.style.setProperty("--topbar-h", `${h}px`);
  }



/* --------- LIST RENDER --------- */




  // запуск
  setTopbarH();

  // реагируем на изменение ширины (мобилка <-> ПК)
  if (mq.addEventListener) mq.addEventListener("change", setTopbarH);
  else mq.addListener(setTopbarH); // старые браузеры

  window.addEventListener("resize", setTopbarH);

  // если шрифты догружаются и меняют высоту
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(setTopbarH).catch(() => {});
  }
})();


/* ================== HISTORY SCREEN (ADD) ================== */
const historyScreen = document.getElementById("historyScreen");

function openHistoryScreen() {
  if (!historyScreen) return;

  document.body.classList.add("cart-open");
  historyScreen.classList.remove("hidden");

  loadHistory(); // ВАЖНО: вместо renderHistoryScreen()
}

function closeHistoryScreen() {
  if (!historyScreen) return;

  historyScreen.classList.add("hidden");
  document.body.classList.remove("cart-open");
}

/* ВАЖНО: чтобы onclick="openHistoryScreen()" работал */
window.openHistoryScreen = openHistoryScreen;
window.closeHistoryScreen = closeHistoryScreen;

function renderHistoryScreen() {
  if (!historyList) return;

  // Вариант 1 (без сервера): читаем историю из localStorage
  // Ожидаемый формат: [{id, created_at, total, items:[...]}]
  let orders = [];
  try {
    orders = JSON.parse(localStorage.getItem("orders") || "[]");
  } catch {
    orders = [];
  }

  if (!orders.length) {
    historyList.innerHTML = `<div style="padding:14px;font-weight:900;color:rgba(11,31,51,.65)">История заказов пуста</div>`;
    return;
  }

  // сортировка по дате (новые сверху), если есть created_at
  orders.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));

  historyList.innerHTML = orders.map((o) => {
    const dt = o.created_at ? new Date(o.created_at) : null;
    const dateStr = dt && !isNaN(dt) ? dt.toLocaleString("ru-RU") : "—";
    const total = Number(o.total) || 0;

    return `
      <div class="history-card">
        <div class="history-card-top">
          <div class="history-date">${dateStr}</div>
          <div class="history-total">${total} c</div>
        </div>
      </div>
    `;
  }).join("");
}

function getCustomerId(){
  try{
    const client = JSON.parse(localStorage.getItem("client") || "null");
    return client?.id ? Number(client.id) : 0;
  }catch(e){
    return 0;
  }
}
async function loadHistory(){
  const customerId = getCustomerId();
  if (!customerId) return;

  const year = document.getElementById("histYear")?.value || "";
  const month = document.getElementById("histMonth")?.value || "";
  const day = document.getElementById("histDay")?.value || "";

  const qs = new URLSearchParams({ customerId, year, month, day });

  // 1) summary
  const sumRes = await fetch(`/api/history/summary?${qs.toString()}`);
  const sumData = await sumRes.json();

  document.getElementById("histOrdersCount").textContent = sumData.ordersCount ?? 0;
  document.getElementById("histTotalSum").textContent = sumData.totalSum ?? 0;

  // 2) list
  const listRes = await fetch(`/api/history/list?${qs.toString()}`);
  const listData = await listRes.json();

  renderHistoryList(listData.orders || []);
}

function renderHistoryList(orders){
  const box = document.getElementById("historyList");
  if (!box) return;

  if (!orders.length){
    box.innerHTML = `
      <div style="padding:14px;font-weight:900;color:rgba(11,31,51,.65)">
        История пуста
      </div>
    `;
    return;
  }

  box.innerHTML = orders.map(o => {
    let dateText = "—";

    if (o.created_at){
      const d = new Date(o.created_at);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      dateText = `${dd}.${mm}.${yyyy}`;
    }

    const total = Number(o.total) || 0;

    return `
      <div class="hist-item">
        <div class="hist-col">
          <div class="hist-label">Дата заказа</div>
          <div class="hist-value">${dateText}</div>
        </div>

        <div class="hist-col hist-col-right">
          <div class="hist-label">Сумма</div>
          <div class="hist-value">${total} c</div>
        </div>
      </div>
    `;
  }).join("");
}



["histYear","histMonth","histDay"].forEach(id=>{
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", loadHistory);
});


/* ===============================
   HISTORY FILTERS: make selects like search-dd
   =============================== */

function initHistoryDropdowns() {
  const wrap = document.querySelector("#historyScreen .history-filters");
  if (!wrap) return;

  const items = wrap.querySelectorAll(".hist-dd");
  if (!items.length) return;

  // чтобы при клике вне — закрывать
  document.addEventListener("click", (e) => {
    wrap.querySelectorAll(".search-dd.open").forEach(dd => {
      if (!dd.contains(e.target)) dd.classList.remove("open");
    });
  });

  items.forEach((box) => {
    const select = box.querySelector("select.history-select");
    if (!select) return;

    // если уже сделано — не дублируем
    if (box.querySelector(".search-dd")) return;

    // 1) прячем нативный select
    select.classList.add("js-native-hidden");

    // 2) создаём кастомный dropdown (как в поиске)
    const dd = document.createElement("div");
    dd.className = "search-dd";

    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.value = select.value || "";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "search-dd-btn";
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");

    const text = document.createElement("span");
    text.className = "search-dd-text";

    const arrow = document.createElement("span");
    arrow.className = "search-dd-arrow";
    arrow.setAttribute("aria-hidden", "true");

    btn.appendChild(text);
    btn.appendChild(arrow);

    const menu = document.createElement("div");
    menu.className = "search-dd-menu";
    menu.setAttribute("role", "listbox");

    function getLabelForValue(val) {
      const opt = Array.from(select.options).find(o => o.value === val);
      return opt ? (opt.textContent || "").trim() : "";
    }

    // текст кнопки
    function syncText() {
      const val = hidden.value;
      const label = getLabelForValue(val);

      // если value пустой — показываем placeholder (первый option)
      if (val === "" || val == null) {
        const first = select.options[0] ? (select.options[0].textContent || "").trim() : "";
        text.textContent = first || "Выбрать";
      } else {
        text.textContent = label || "Выбрать";
      }
    }

    // пункты меню
    function buildMenu() {
      menu.innerHTML = "";
      Array.from(select.options).forEach((opt) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "search-dd-item";
        b.setAttribute("role", "option");
        b.dataset.value = opt.value;

        b.textContent = (opt.textContent || "").trim();

        if ((opt.value || "") === (hidden.value || "")) b.classList.add("is-active");

        b.addEventListener("click", () => {
          // обновляем hidden
          hidden.value = opt.value;

          // обновляем select (чтобы ваша логика истории работала)
          select.value = opt.value;

          // триггерим change
          select.dispatchEvent(new Event("change", { bubbles: true }));

          // обновляем UI
          buildMenu();
          syncText();

          dd.classList.remove("open");
          btn.setAttribute("aria-expanded", "false");
        });

        menu.appendChild(b);
      });
    }

    // открыть/закрыть
    btn.addEventListener("click", (e) => {
      e.stopPropagation();

      // закрываем другие dropdown в истории
      wrap.querySelectorAll(".search-dd.open").forEach(other => {
        if (other !== dd) other.classList.remove("open");
      });

      const open = dd.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    // собрать
    dd.appendChild(hidden);
    dd.appendChild(btn);
    dd.appendChild(menu);

    // вставляем ВМЕСТО select (но select остаётся в box скрытым)
    box.appendChild(dd);

    // начальная синхронизация
    hidden.value = select.value || "";
    buildMenu();
    syncText();
  });
}

// запуск после загрузки DOM
document.addEventListener("DOMContentLoaded", initHistoryDropdowns);

// если история рендерится/переоткрывается динамически — запускаем при открытии тоже
const _origOpenHistoryScreen = window.openHistoryScreen;
window.openHistoryScreen = function () {
  if (typeof _origOpenHistoryScreen === "function") _origOpenHistoryScreen();
  initHistoryDropdowns();
};



/* ================== START ================== */
loadProducts().finally(handleAfterAuthReturn);
