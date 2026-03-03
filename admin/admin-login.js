const loginInput = document.getElementById("login");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const errorBox = document.getElementById("error");

loginBtn.addEventListener("click", async () => {
  const login = loginInput.value.trim();
  const password = passwordInput.value.trim();

  errorBox.textContent = "";

  if (!login || !password) {
    errorBox.textContent = "Введите логин и пароль";
    return;
  }

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password })
    });

    const data = await response.json();

    if (!response.ok) {
      errorBox.textContent = data.message || "Ошибка входа";
      return;
    }

    window.location.href = "admin.html";
  } catch (err) {
    errorBox.textContent = "Сервер недоступен";
  }
});
