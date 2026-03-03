const loginPhone = document.getElementById("loginPhone");
const loginPassword = document.getElementById("loginPassword");

const regFullName = document.getElementById("regFullName");
const regPhone = document.getElementById("regPhone");
const regEmail = document.getElementById("regEmail");
const regAddress = document.getElementById("regAddress");
const regPassword = document.getElementById("regPassword");

const registerBox = document.getElementById("registerBox");

/* ===== ПЕРЕКЛЮЧЕНИЕ ФОРМ ===== */
function showRegister() {
  document.querySelector(".auth-box").classList.add("hidden");
  registerBox.classList.remove("hidden");
}

function showLogin() {
  registerBox.classList.add("hidden");
  document.querySelector(".auth-box").classList.remove("hidden");
}

/* ===== ВХОД ===== */
async function login() {
  const phone = loginPhone.value.trim();
  const password = loginPassword.value.trim();

  if (!phone || !password) {
    alert("Введите телефон и пароль");
    return;
  }

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Ошибка входа");
      return;
    }

    localStorage.setItem("client-auth", "true");
    localStorage.setItem("client", JSON.stringify(data.customer));

    window.location.href = "index.html";
  } catch {
    alert("Сервер недоступен");
  }
}

/* ===== РЕГИСТРАЦИЯ ===== */
async function register() {
  const fullName = regFullName.value.trim();
  const phone = regPhone.value.trim();
  const email = regEmail.value.trim();
  const address = regAddress.value.trim();
  const password = regPassword.value.trim();

  if (!fullName || !phone || !email || !address || !password) {
    alert("Заполните обязательные поля");
    return;
  }

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, phone, email, address, password })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Ошибка регистрации");
      return;
    }

    localStorage.setItem("client-auth", "true");
    localStorage.setItem("client", JSON.stringify(data.customer));

    window.location.href = "index.html";
  } catch {
    alert("Сервер недоступен");
  }
}
