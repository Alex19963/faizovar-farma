// admin-products.js

const productsListEl = document.getElementById("productsList");

const productNameEl = document.getElementById("productName");
const productTypeEl = document.getElementById("productType");
const productPriceEl = document.getElementById("productPrice");
const productImageEl = document.getElementById("productImage");
const fileNameEl = document.getElementById("fileName");

const editModal = document.getElementById("editModal");
const editNameEl = document.getElementById("editName");
const editTypeEl = document.getElementById("editType");
const editPriceEl = document.getElementById("editPrice");
const editPreviewEl = document.getElementById("editPreview");
const editImageEl = document.getElementById("editImage");
const editFileNameEl = document.getElementById("editFileName");


const adminImageOverlay = document.getElementById("adminImageOverlay");
const adminImagePreview = document.getElementById("adminImagePreview");

const productsSearchEl = document.getElementById("productsSearch");
let productsCache = []; // полный список с сервера


const productToastEl = document.getElementById("productToast");
let productToastTimer = null;

function showProductToast(msg = "Препарат загружен") {
  if (!productToastEl) return;

  const text = productToastEl.querySelector(".toast-text");
  if (text) text.textContent = msg;

  productToastEl.classList.remove("hidden");

  if (productToastTimer) clearTimeout(productToastTimer);
  productToastTimer = setTimeout(() => {
    productToastEl.classList.add("hidden");
  }, 3000);
}


function openAdminImage(src) {
  if (!adminImageOverlay || !adminImagePreview) return;
  adminImagePreview.src = src || "";
  adminImageOverlay.classList.add("show");
}

function closeAdminImage() {
  if (!adminImageOverlay) return;
  adminImageOverlay.classList.remove("show");
  if (adminImagePreview) adminImagePreview.src = "";
}

if (adminImageOverlay) {
  adminImageOverlay.addEventListener("click", (e) => {
    // закрываем только по фону, не по самой картинке
    if (e.target === adminImageOverlay) closeAdminImage();
  });
}



let editId = null;
let editCurrentImage = null;

/* ================= helpers ================= */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

function toNum(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function showProductsLoading() {
  if (productsListEl) productsListEl.textContent = "Загрузка…";
}

function showProductsError(msg) {
  if (productsListEl) productsListEl.textContent = msg || "Ошибка загрузки";
}

/* ================= API: load list ================= */
async function loadProducts() {
  if (!productsListEl) return;

  showProductsLoading();

  try {
    const res = await fetch("/api/admin/products", {
      credentials: "same-origin"
    });

    if (res.status === 401) {
      // если кука не пришла/сессия слетела
      window.location.href = "admin-login.html";
      return;
    }

    if (!res.ok) {
      showProductsError("Ошибка загрузки (server)");
      return;
    }

    const rows = await res.json().catch(() => []);
    productsCache = Array.isArray(rows) ? rows : [];
applyProductsFilter();


  } catch (e) {
    showProductsError("Ошибка сети");
  }
}

/* ================= render list ================= */
function renderProducts(rows) {
  if (!productsListEl) return;

  if (!Array.isArray(rows) || rows.length === 0) {
    productsListEl.textContent = "Препаратов нет";
    return;
  }

  productsListEl.innerHTML = "";

  rows.forEach(p => {
    const id = p.id;
    const name = p.name || "Без названия";
    const type = p.type || "—";
    const price = p.price ?? "—";
    const image = p.image || "";

    const item = document.createElement("div");
    item.className = "admin-list-item";

const imgSrc = image ? ("/" + String(image).replace(/^\/+/, "")) : "";

item.innerHTML = `
  <div class="ap-item">
    <div class="ap-media">
      ${
        imgSrc
          ? `<img class="ap-img" src="${esc(imgSrc)}" alt=""
                 onerror="this.onerror=null;this.remove();">`
          : `<div class="ap-ph" aria-hidden="true">Фото</div>`
      }
    </div>

    <div class="ap-info">
      <div class="ap-name">${esc(name)}</div>
      <div class="ap-sub">
        <span class="ap-type-text">${esc(type || "")}</span>
<span class="ap-price">Цена: ${esc(price)} c</span>

      </div>
    </div>

    <div class="ap-actions">
      <button class="btn-soft ap-btn" type="button" data-act="edit">Редактировать</button>
      <button class="btn-danger ap-btn" type="button" data-act="del">Удалить</button>
    </div>
  </div>
`;


item.querySelector('[data-act="edit"]').addEventListener("click", () => openEditModal({
  id, name, type, price, image
}));

item.querySelector('[data-act="del"]').addEventListener("click", () => deleteProduct(id));

/* ✅ КЛИК ПО ФОТО -> ОТКРЫТЬ OVERLAY */
const imgEl = item.querySelector(".ap-img");
if (imgEl) {
  imgEl.style.cursor = "pointer";
  imgEl.addEventListener("click", (e) => {
    e.stopPropagation();
    openAdminImage(imgEl.getAttribute("src"));
  });
}

productsListEl.appendChild(item);

  });
}


function applyProductsFilter() {
  const q = (productsSearchEl?.value || "").trim().toLowerCase();

  if (!q) {
    renderProducts(productsCache);
    return;
  }

  const filtered = productsCache.filter(p => {
    const name = String(p?.name || "").toLowerCase();
    const type = String(p?.type || "").toLowerCase();
    return name.includes(q) || type.includes(q);
  });

  renderProducts(filtered);
}


/* ================= add product (onclick в HTML) ================= */
async function addProduct() {
  const name = productNameEl?.value.trim();
  const type = productTypeEl?.value.trim() || "";
  const price = toNum(productPriceEl?.value);

if (!name) { alert("Введите название"); return; }
if (!type) { alert("Выберите тип препарата"); return; }
if (!price || price < 0) { alert("Введите цену"); return; }


  const fd = new FormData();
  fd.append("name", name);
  fd.append("type", type);
  fd.append("price", String(price));

  if (productImageEl && productImageEl.files && productImageEl.files[0]) {
    fd.append("image", productImageEl.files[0]);
  }

  try {
    const res = await fetch("/api/admin/products", {
      method: "POST",
      credentials: "same-origin",
      body: fd
    });

    if (res.status === 401) {
      window.location.href = "admin-login.html";
      return;
    }

    if (productsSearchEl) {
  productsSearchEl.addEventListener("input", applyProductsFilter);
}


    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.message || "Ошибка добавления");
      return;
    }

// очистка формы
if (productNameEl) productNameEl.value = "";
if (productTypeEl) productTypeEl.value = "";
if (productPriceEl) productPriceEl.value = "";
if (productImageEl) productImageEl.value = "";
if (fileNameEl) fileNameEl.textContent = "Файл не выбран";

// ✅ ПОКАЗ УСПЕШНОГО УВЕДОМЛЕНИЯ
showProductToast("Препарат загружен");

// обновим список
loadProducts();


  } catch {
    alert("Ошибка сети");
  }
}

/* ================= edit modal ================= */
function openEditModal(p) {
  editId = p.id;
  editCurrentImage = p.image || null;

  if (editNameEl) editNameEl.value = p.name || "";
  if (editTypeEl) editTypeEl.value = p.type || "";
  if (editPriceEl) editPriceEl.value = String(p.price ?? "");
  if (editImageEl) editImageEl.value = "";
  if (editFileNameEl) editFileNameEl.textContent = "Файл не выбран";

  if (editPreviewEl) {
    if (p.image) {
      editPreviewEl.src = "/" + String(p.image).replace(/^\/+/, "");
      editPreviewEl.style.display = "block";
    } else {
      editPreviewEl.removeAttribute("src");
      editPreviewEl.style.display = "none";
    }
  }

  if (editModal) editModal.classList.remove("hidden");
}

function closeEditModal() {
  editId = null;
  editCurrentImage = null;
  if (editModal) editModal.classList.add("hidden");
}

async function saveEdit() {
  if (!editId) return;

  const name = editNameEl?.value.trim();
  const type = editTypeEl?.value.trim();
  const price = toNum(editPriceEl?.value);

  if (!name) { alert("Введите название"); return; }
  if (!type) { alert("Выберите тип"); return; }
  if (!price || price < 0) { alert("Введите цену"); return; }

  const fd = new FormData();
  fd.append("name", name);
  fd.append("type", type);
  fd.append("price", String(price));

  if (editImageEl && editImageEl.files && editImageEl.files[0]) {
    fd.append("image", editImageEl.files[0]);
  }

  try {
    const res = await fetch(`/api/admin/products/${editId}`, {
      method: "PUT",
      credentials: "same-origin",
      body: fd
    });

    if (res.status === 401) {
      window.location.href = "admin-login.html";
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.message || "Ошибка сохранения");
      return;
    }

    closeEditModal();
    loadProducts();

  } catch {
    alert("Ошибка сети");
  }
}

/* ================= delete ================= */
async function deleteProduct(id) {
  if (!confirm("Удалить препарат?")) return;

  try {
    const res = await fetch(`/api/admin/products/${id}`, {
      method: "DELETE",
      credentials: "same-origin"
    });

    if (res.status === 401) {
      window.location.href = "admin-login.html";
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.message || "Ошибка удаления");
      return;
    }

    loadProducts();

  } catch {
    alert("Ошибка сети");
  }
}

/* ================= file labels ================= */
if (productImageEl && fileNameEl) {
  productImageEl.addEventListener("change", () => {
    const f = productImageEl.files && productImageEl.files[0];
    fileNameEl.textContent = f ? f.name : "Файл не выбран";
  });
}

if (editImageEl && editFileNameEl) {
  editImageEl.addEventListener("change", () => {
    const f = editImageEl.files && editImageEl.files[0];
    editFileNameEl.textContent = f ? f.name : "Файл не выбран";
  });
}

/* ================= expose глобально (HTML onclick) ================= */
window.loadProducts = loadProducts;
window.addProduct = addProduct;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.saveEdit = saveEdit;
window.deleteProduct = deleteProduct;

/* ================= init ================= */
// Если админ сразу открывает вкладку "Препараты -> Список" (или вы хотите автозагрузку) — можно включить:
// loadProducts();
