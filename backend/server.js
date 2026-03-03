// server.js
const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const crypto = require("crypto");

app.use(cors());
app.use(express.json());

/* ================== COOKIE + СЕССИИ АДМИНА (без библиотек) ================== */
const ADMIN_COOKIE = "admin_token";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 часов
const adminTokens = new Map(); // token -> expiresAt

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;

  header.split(";").forEach(part => {
    const [k, ...v] = part.trim().split("=");
    out[k] = decodeURIComponent(v.join("=") || "");
  });
  return out;
}

function setAdminCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax`
  );
}

function clearAdminCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
  );
}

function isAdminAuthed(req) {
  const cookies = parseCookies(req);
  const token = cookies[ADMIN_COOKIE];
  if (!token) return false;

  const expiresAt = adminTokens.get(token);
  if (!expiresAt) return false;

  if (Date.now() > expiresAt) {
    adminTokens.delete(token);
    return false;
  }
  return true;
}

function requireAdminApi(req, res, next) {
  if (!isAdminAuthed(req)) {
    return res.status(401).json({ message: "Требуется вход администратора" });
  }
  next();
}

function requireAdminPage(req, res, next) {
  if (req.path === "/admin-login.html") {
    return next();
  }

  if (!isAdminAuthed(req)) {
    return res.redirect("/admin/admin-login.html");
  }

  next();
}

function ensureOrderDiscountColumn(cb) {
  db.all("PRAGMA table_info(orders)", (err, rows) => {
    if (err) return cb(err);
    const exists = Array.isArray(rows) && rows.some((r) => r.name === "order_discount");
    if (exists) return cb(null);
    db.run("ALTER TABLE orders ADD COLUMN order_discount REAL", (err2) => cb(err2 || null));
  });
}

function ensureOrderPaymentColumns(cb) {
  db.all("PRAGMA table_info(orders)", (err, rows) => {
    if (err) return cb(err);
    const hasStatus = Array.isArray(rows) && rows.some((r) => r.name === "payment_status");
    const hasPaidAt = Array.isArray(rows) && rows.some((r) => r.name === "paid_at");
    const hasPaidAmount = Array.isArray(rows) && rows.some((r) => r.name === "paid_amount");

    const next = () => cb(null);
    const fail = (e) => cb(e || null);

    if (!hasStatus) {
      return db.run(
        "ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'",
        (e1) => {
          if (e1) return fail(e1);
          if (!hasPaidAt) {
            return db.run("ALTER TABLE orders ADD COLUMN paid_at DATETIME", (e2) => {
              if (e2) return fail(e2);
              if (!hasPaidAmount) {
                return db.run(
                  "ALTER TABLE orders ADD COLUMN paid_amount REAL NOT NULL DEFAULT 0",
                  (e3) => {
                    if (e3) return fail(e3);
                    next();
                  }
                );
              }
              next();
            });
          }
          if (!hasPaidAmount) {
            return db.run(
              "ALTER TABLE orders ADD COLUMN paid_amount REAL NOT NULL DEFAULT 0",
              (e3) => {
                if (e3) return fail(e3);
                next();
              }
            );
          }
          next();
        }
      );
    }

    if (!hasPaidAt || !hasPaidAmount) {
      const addPaidAt = (done) => {
        if (hasPaidAt) return done();
        db.run("ALTER TABLE orders ADD COLUMN paid_at DATETIME", (e2) => {
          if (e2) return fail(e2);
          done();
        });
      };
      const addPaidAmount = () => {
        if (hasPaidAmount) return next();
        db.run("ALTER TABLE orders ADD COLUMN paid_amount REAL NOT NULL DEFAULT 0", (e3) => {
          if (e3) return fail(e3);
          next();
        });
      };
      return addPaidAt(addPaidAmount);
    }

    next();
  });
}


function staticUtf8Headers(res, filePath) {
  const p = String(filePath || "").toLowerCase();
  if (p.endsWith(".html")) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return;
  }
  if (p.endsWith(".css")) {
    res.setHeader("Content-Type", "text/css; charset=utf-8");
    return;
  }
  if (p.endsWith(".js")) {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  }
}

/* ================== ЗАЩИТА ВСЕГО /admin ================== */
app.use(
  "/admin",
  requireAdminPage,
  express.static(path.join(__dirname, "..", "admin"), { setHeaders: staticUtf8Headers })
);

/* ================== СТАТИКА ДЛЯ ВСЕГО ОСТАЛЬНОГО ================== */
app.use(express.static(path.join(__dirname, ".."), { setHeaders: staticUtf8Headers }));


/* ================== ЗАГРУЗКА ФОТО (multer) ================== */
const uploadDir = path.join(__dirname, "..", "img", "products");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const customerUploadDir = path.join(__dirname, "..", "img", "customers");
if (!fs.existsSync(customerUploadDir)) fs.mkdirSync(customerUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);

    let filename = base + ext;
    let counter = 1;

    while (fs.existsSync(path.join(uploadDir, filename))) {
      filename = `${base}_${counter}${ext}`;
      counter++;
    }
    cb(null, filename);
  }
});
const upload = multer({ storage });

const customerStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, customerUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);

    let filename = base + ext;
    let counter = 1;

    while (fs.existsSync(path.join(customerUploadDir, filename))) {
      filename = `${base}_${counter}${ext}`;
      counter++;
    }
    cb(null, filename);
  }
});
const customerUpload = multer({ storage: customerStorage });

function safeRemoveRelativeFile(relPath) {
  const rel = String(relPath || "").trim();
  if (!rel) return;
  const abs = path.join(__dirname, "..", rel);
  if (fs.existsSync(abs)) fs.unlinkSync(abs);
}



/* ================== ТОВАРЫ (ВИТРИНА) ================== */
app.get("/api/products", (req, res) => {
  db.all(
    `SELECT id, name, manufacturer, type, price, image,
            expiry_from, expiry_to,
            COALESCE(expiry_to, expiry_date) AS expiry_date
     FROM products
     ORDER BY name ASC`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Ошибка загрузки товаров" });
      res.json(rows);
    }
  );
});

/* ================== ВХОД КЛИЕНТА ================== */
app.post("/api/auth/login", (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ message: "Телефон и пароль обязательны" });
  }

  db.get(
    `
    SELECT 
      id,
      first_name,
      last_name,
      phone,
      email,
      pharmacy_name,
      address,
      photo,
      discount,
      password,
      created_at
    FROM customers
    WHERE phone = ? AND password = ?
    `,
    [phone, password],
    (err, customer) => {
      if (err) return res.status(500).json({ message: "Ошибка сервера", error: err.message });
      if (!customer) return res.status(401).json({ message: "Неверный телефон или пароль" });
      res.json({ success: true, customer });
    }
  );
});

/* ================== ПРОФИЛЬ КЛИЕНТА ================== */
app.get("/api/customers/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Некорректный id" });

  db.get(
    "SELECT id, first_name, last_name, phone, email, pharmacy_name, address, photo, discount, created_at, password FROM customers WHERE id = ?",
    [id],
    (err, row) => {
      if (err) return res.status(500).json({ message: "DB error", error: err.message });
      if (!row) return res.status(404).json({ message: "Клиент не найден" });

      res.json({ customer: row });
    }
  );
});

/* ================== ОБНОВЛЕНИЕ ПРОФИЛЯ ================== */
app.put("/api/customers/:id", (req, res) => {
  const { id } = req.params;
  const { fullName, phone, email, pharmacyName, photo, discount, password } = req.body;

  if (!fullName || !phone || !email || !pharmacyName) {
    return res.status(400).json({ message: "Заполните все поля" });
  }

  if (!password) return res.status(400).json({ message: "Пароль обязателен" });
  if (password.length < 4 || password.length > 20) {
    return res.status(400).json({ message: "Пароль от 4 до 20 символов" });
  }
  if (!/^[A-Za-z0-9]+$/.test(password)) {
    return res.status(400).json({ message: "Пароль: только буквы и цифры" });
  }

  const discountNum = Number(discount);
  if (!Number.isFinite(discountNum) || discountNum < 0 || discountNum > 100) {
    return res.status(400).json({ message: "Скидка должна быть от 0 до 100" });
  }

  const parts = fullName.trim().split(/\s+/);
  const first_name = parts[0];
  const last_name = parts.slice(1).join(" ");
  const photoNorm = String(photo || "").trim();

  db.get(
    `SELECT id, phone, email FROM customers WHERE (phone = ? OR email = ?) AND id != ?`,
    [phone, email, id],
    (err, existing) => {
      if (err) return res.status(500).json({ message: "Ошибка БД", error: err.message });
      if (existing) {
        if (existing.phone === phone) return res.status(400).json({ message: "Телефон уже используется" });
        if (existing.email === email) return res.status(400).json({ message: "Почта уже используется" });
      }

      db.get(
        "SELECT id FROM customers WHERE password = ? AND id != ?",
        [password, id],
        (errPass, rowPass) => {
          if (errPass) return res.status(500).json({ message: "Ошибка БД", error: errPass.message });
          if (rowPass) return res.status(400).json({ message: "Пароль уже используется" });

          db.get(
            "SELECT photo FROM customers WHERE id = ?",
            [id],
            (errCur, currentRow) => {
              if (errCur) return res.status(500).json({ message: "Ошибка БД", error: errCur.message });

              const prevPhoto = String(currentRow?.photo || "").trim();
              const nextPhoto = photoNorm || prevPhoto || null;

              // ВАЖНО: сохраняем pharmacy_name (и дублируем в address для совместимости)
              db.run(
                `
                UPDATE customers
                SET first_name = ?, last_name = ?, phone = ?, email = ?, pharmacy_name = ?, address = ?, photo = ?, discount = ?, password = ?
                WHERE id = ?
                `,
                [first_name, last_name, phone, email, pharmacyName, pharmacyName, nextPhoto, discountNum, password, id],
                function (err2) {
                  if (err2) return res.status(500).json({ message: "Ошибка обновления", error: err2.message });

                  if (photoNorm && prevPhoto && prevPhoto !== photoNorm) {
                    safeRemoveRelativeFile(prevPhoto);
                  }

                  db.get(
                    `SELECT id, first_name, last_name, phone, email, pharmacy_name, address, photo, discount, password, created_at
                     FROM customers WHERE id = ?`,
                    [id],
                    (err3, customer) => {
                      if (err3 || !customer) {
                        return res.status(500).json({ message: "Ошибка получения профиля", error: err3?.message });
                      }
                      res.json({ success: true, customer });
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});

/* ================== ВХОД/ВЫХОД АДМИНА (COOKIE) ================== */
app.post("/api/admin/login", (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) return res.status(400).json({ message: "Логин и пароль обязательны" });

  db.get("SELECT * FROM admin WHERE login = ? AND password = ?", [login, password], (err, admin) => {
    if (err) return res.status(500).json({ message: "Ошибка сервера", error: err.message });
    if (!admin) return res.status(401).json({ message: "Неверный логин или пароль" });

    const token = crypto.randomBytes(32).toString("hex");
    adminTokens.set(token, Date.now() + TOKEN_TTL_MS);
    setAdminCookie(res, token);

    res.json({ success: true });
  });
});

app.post("/api/admin/logout", (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies[ADMIN_COOKIE];
  if (token) adminTokens.delete(token);
  clearAdminCookie(res);
  res.json({ success: true });
});

/* ================== АДМИН API (ЗАЩИЩЕНО) ================== */
app.get("/api/admin/products", requireAdminApi, (req, res) => {
  db.all("SELECT * FROM products ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ message: "Ошибка БД" });
    res.json(rows);
  });
});

app.patch("/api/admin/products/raise-prices", requireAdminApi, (req, res) => {
  const percent = Number(req.body?.percent);
  if (!Number.isFinite(percent) || percent < 0 || percent > 1000) {
    return res.status(400).json({ message: "Процент должен быть от 0 до 1000" });
  }

  db.run(
    `UPDATE products
     SET
       base_price = COALESCE(base_price, price, 0),
       price_raise_percent = ?,
       price = ROUND(COALESCE(base_price, price, 0) * (1 + (? / 100.0)), 2)
     WHERE COALESCE(base_price, price, 0) >= 0`,
    [percent, percent],
    function (err) {
      if (err) return res.status(500).json({ message: "Ошибка повышения цен" });
      res.json({ success: true, updated: Number(this.changes) || 0, percent });
    }
  );
});

app.post("/api/admin/products", requireAdminApi, upload.single("image"), (req, res) => {
  const { name, type, price, stock, manufacturer, expiry_from, expiry_to, expiry_date } = req.body;
  const image = req.file ? `img/products/${req.file.filename}` : null;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "Введите название" });
  }
  if (!type || !String(type).trim()) {
    return res.status(400).json({ message: "Выберите тип препарата" });
  }
  if (price === undefined || price === null || String(price).trim() === "" || Number(price) <= 0) {
    return res.status(400).json({ message: "Введите цену" });
  }
  const stockNum = Number(stock);
  if (!Number.isFinite(stockNum) || stockNum < 0) {
    return res.status(400).json({ message: "Введите корректный остаток" });
  }

  const expiryFrom = String(expiry_from || "").trim() || null;
  const expiryTo = String(expiry_to || expiry_date || "").trim() || null;

  const priceNum = Number(price);

  db.run(
    "INSERT INTO products (name, manufacturer, type, price, base_price, price_raise_percent, stock, image, expiry_from, expiry_to, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [String(name).trim(), String(manufacturer || "").trim() || null, String(type).trim(), priceNum, priceNum, 0, Math.floor(stockNum), image, expiryFrom, expiryTo, expiryTo],
    function (err) {
      if (err) return res.status(500).json({ message: "Ошибка добавления" });
      res.json({
        id: this.lastID,
        name: String(name).trim(),
        manufacturer: String(manufacturer || "").trim() || null,
        type: String(type).trim(),
        price: priceNum,
        base_price: priceNum,
        price_raise_percent: 0,
        stock: Math.floor(stockNum),
        image,
        expiry_from: expiryFrom,
        expiry_to: expiryTo,
        expiry_date: expiryTo
      });
    }
  );
});

app.put("/api/admin/products/:id", requireAdminApi, upload.single("image"), (req, res) => {
  const { id } = req.params;
  const { name, type, price, stock, manufacturer, expiry_from, expiry_to, expiry_date } = req.body;
  const newImage = req.file ? `img/products/${req.file.filename}` : null;

  if (!name || !type || !price) {
    return res.status(400).json({ message: "Название, тип и цена обязательны" });
  }
  const stockNum = Number(stock);
  if (!Number.isFinite(stockNum) || stockNum < 0) {
    return res.status(400).json({ message: "Введите корректный остаток" });
  }

  const expiryFrom = String(expiry_from || "").trim() || null;
  const expiryTo = String(expiry_to || expiry_date || "").trim() || null;
  const priceNum = Number(price);

  db.get("SELECT image FROM products WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ message: "Ошибка БД" });
    if (!row) return res.status(404).json({ message: "Товар не найден" });

    if (newImage && row.image) {
      const oldPath = path.join(__dirname, "..", row.image);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const finalImage = newImage ? newImage : row.image;

    db.run(
      "UPDATE products SET name = ?, manufacturer = ?, type = ?, price = ?, base_price = ?, price_raise_percent = 0, stock = ?, image = ?, expiry_from = ?, expiry_to = ?, expiry_date = ? WHERE id = ?",
      [String(name).trim(), String(manufacturer || "").trim() || null, String(type).trim(), priceNum, priceNum, Math.floor(stockNum), finalImage, expiryFrom, expiryTo, expiryTo, id],
      function (err2) {
        if (err2) return res.status(500).json({ message: "Ошибка обновления" });
        res.json({ success: true });
      }
    );
  });
});

app.delete("/api/admin/products/:id", requireAdminApi, (req, res) => {
  const { id } = req.params;

  db.get("SELECT image FROM products WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ message: "Ошибка БД" });

    if (row && row.image) {
      const filePath = path.join(__dirname, "..", row.image);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    db.run("DELETE FROM products WHERE id = ?", [id], (err2) => {
      if (err2) return res.status(500).json({ message: "Ошибка удаления" });
      res.json({ success: true });
    });
  });
});

/* ================== КЛИЕНТЫ (АДМИН) ================== */
app.post("/api/admin/customers/upload-photo", requireAdminApi, customerUpload.single("photo"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Файл не выбран" });
  res.json({ success: true, photo: `img/customers/${req.file.filename}` });
});

app.get("/api/admin/customers", requireAdminApi, (req, res) => {
  db.all(
    `SELECT id, first_name, last_name, phone, email, pharmacy_name, address, photo, discount, password, created_at
     FROM customers
     ORDER BY id DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: "DB error", error: err.message });
      res.json(rows || []);
    }
  );
});

app.post("/api/admin/customers", requireAdminApi, (req, res) => {
  const { fullName, phone, email, pharmacyName, photo, discount, password } = req.body || {};

  const name = String(fullName || "").trim();
  const phoneNorm = String(phone || "").trim();
  const emailNorm = String(email || "").trim();
  const pharmacyNorm = String(pharmacyName || "").trim();
  const photoNorm = String(photo || "").trim() || null;
  const discountNum = Number(discount);
  const pass = String(password || "").trim();

  if (!name || !phoneNorm || !emailNorm || !pharmacyNorm || !pass) {
    return res.status(400).json({ message: "Заполните все поля" });
  }
  if (!Number.isFinite(discountNum) || discountNum < 0 || discountNum > 100) {
    return res.status(400).json({ message: "Скидка должна быть от 0 до 100" });
  }

  if (pass.length < 4 || pass.length > 20) {
    return res.status(400).json({ message: "Пароль от 4 до 20 символов" });
  }
  if (!/^[A-Za-z0-9]+$/.test(pass)) {
    return res.status(400).json({ message: "Пароль: только латиница и цифры" });
  }

  const parts = name.split(/\s+/).filter(Boolean);
  const first_name = parts[0] || "";
  const last_name = parts.slice(1).join(" ");

  db.get(
    `SELECT id, phone, email, password FROM customers
     WHERE phone = ? OR email = ? OR password = ?`,
    [phoneNorm, emailNorm, pass],
    (err, existing) => {
      if (err) return res.status(500).json({ message: "DB error", error: err.message });
      if (existing) {
        if (existing.phone === phoneNorm) return res.status(400).json({ message: "Телефон уже используется" });
        if (existing.email === emailNorm) return res.status(400).json({ message: "Почта уже используется" });
        if (existing.password === pass) return res.status(400).json({ message: "Пароль уже используется" });
      }

      db.run(
        `INSERT INTO customers (first_name, last_name, phone, email, pharmacy_name, address, photo, discount, password)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [first_name, last_name, phoneNorm, emailNorm, pharmacyNorm, pharmacyNorm, photoNorm, discountNum, pass],
        function (err2) {
          if (err2) return res.status(500).json({ message: "Ошибка создания клиента", error: err2.message });

          db.get(
            `SELECT id, first_name, last_name, phone, email, pharmacy_name, address, photo, discount, password, created_at
             FROM customers WHERE id = ?`,
            [this.lastID],
            (err3, customer) => {
              if (err3 || !customer) {
                return res.status(500).json({ message: "Ошибка получения клиента", error: err3?.message });
              }
              res.json({ success: true, customer });
            }
          );
        }
      );
    }
  );
});

app.patch("/api/admin/customers/:id/discount", requireAdminApi, (req, res) => {
  const id = Number(req.params.id);
  const discountNum = Number(req.body?.discount);

  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ message: "Некорректный id клиента" });
  }
  if (!Number.isFinite(discountNum) || discountNum < 0 || discountNum > 100) {
    return res.status(400).json({ message: "Скидка должна быть от 0 до 100" });
  }

  db.run(
    "UPDATE customers SET discount = ? WHERE id = ?",
    [discountNum, id],
    function (err) {
      if (err) return res.status(500).json({ message: "Ошибка обновления скидки", error: err.message });
      if (!this.changes) return res.status(404).json({ message: "Клиент не найден" });

      db.get(
        `SELECT id, first_name, last_name, phone, email, pharmacy_name, address, photo, discount, password, created_at
         FROM customers WHERE id = ?`,
        [id],
        (err2, customer) => {
          if (err2 || !customer) {
            return res.status(500).json({ message: "Ошибка получения клиента", error: err2?.message });
          }
          res.json({ success: true, customer });
        }
      );
    }
  );
});

/* Заказы клиента: ?status=new|done + ?year=YYYY&month=MM&day=DD (время Душанбе) */
app.get("/api/admin/customers/:id/orders", requireAdminApi, (req, res) => {
  const { id } = req.params;
  const { status, year, month, day } = req.query;
  ensureOrderDiscountColumn((errCol) => {
    if (errCol) return res.status(500).json({ message: "Ошибка БД (orders)" });
    ensureOrderPaymentColumns((errPay) => {
      if (errPay) return res.status(500).json({ message: "Ошибка БД (orders)" });

      let sql = `
    SELECT
      o.id,
      o.total,
      COALESCE(o.order_discount, c.discount, 0) AS discount,
      o.order_discount AS order_discount,
      ROUND(o.total * (1 - COALESCE(o.order_discount, c.discount, 0) / 100.0), 2) AS total_after_discount,
      o.status,
      COALESCE(o.payment_status, 'unpaid') AS payment_status,
      COALESCE(o.paid_amount, 0) AS paid_amount,
      o.paid_at,
      o.created_at,
      (SELECT COALESCE(SUM(oi.qty), 0) FROM order_items oi WHERE oi.order_id = o.id) AS items_count
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.customer_id = ?
  `;
      const params = [id];

      if (status === "new" || status === "done") {
        sql += ` AND o.status = ?`;
        params.push(status);
      }

      const y = Number(year);
      const m = Number(month);
      const d = Number(day);

      const hasYM =
        Number.isFinite(y) &&
        Number.isFinite(m) &&
        m >= 1 && m <= 12;

      if (hasYM) {
        const mm = String(m).padStart(2, "0");

        sql += `
      AND strftime('%Y', datetime(o.created_at, '+5 hours')) = ?
      AND strftime('%m', datetime(o.created_at, '+5 hours')) = ?
    `;
        params.push(String(y), mm);

        if (Number.isFinite(d) && d >= 1 && d <= 31) {
          const dd = String(d).padStart(2, "0");
          sql += ` AND strftime('%d', datetime(o.created_at, '+5 hours')) = ?`;
          params.push(dd);
        }
      }

      sql += ` ORDER BY o.created_at DESC`;

      db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ message: "Ошибка БД (orders)" });
        res.json(rows || []);
      });
    });
  });
});

/* ================== ЗАКАЗ + ПОЗИЦИИ (АДМИН) ================== */
app.get("/api/admin/orders/:orderId/full", requireAdminApi, (req, res) => {
  const { orderId } = req.params;
  ensureOrderDiscountColumn((errCol) => {
    if (errCol) return res.status(500).json({ message: "Ошибка БД (orders)" });
    ensureOrderPaymentColumns((errPay) => {
      if (errPay) return res.status(500).json({ message: "Ошибка БД (orders)" });
    db.get(
    `SELECT
       o.id,
       o.customer_id,
       o.total,
       COALESCE(o.order_discount, c.discount, 0) AS discount,
       o.order_discount AS order_discount,
       ROUND(o.total * (1 - COALESCE(o.order_discount, c.discount, 0) / 100.0), 2) AS total_after_discount,
       o.status,
       COALESCE(o.payment_status, 'unpaid') AS payment_status,
       COALESCE(o.paid_amount, 0) AS paid_amount,
       o.paid_at,
       o.created_at
     FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     WHERE o.id = ?`,
      [orderId],
      (err, order) => {
      if (err) return res.status(500).json({ message: "Ошибка БД (orders)" });
      if (!order) return res.status(404).json({ message: "Заказ не найден" });

        db.all(
        `
        SELECT
          oi.id,
          oi.order_id,
          oi.product_id,
          oi.qty,

          -- имя/цена можно брать из order_items (как у вас сейчас),
          -- но лучше отдавать актуальные из products:
          p.name AS name,
          p.price AS price,

          p.type AS type,
          p.manufacturer AS manufacturer,
          p.expiry_date AS expiry_date,
          p.image AS image
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ?
        ORDER BY oi.id ASC
        `,
          [orderId],
          (err2, items) => {
          if (err2) return res.status(500).json({ message: "Ошибка БД (order_items)" });
          res.json({ order, items: items || [] });
          }
        );
      }
    );
    });
  });
});

/* ================== ОПЛАТА ЗАКАЗОВ (АДМИН) ================== */
app.get("/api/admin/payments/orders", requireAdminApi, (req, res) => {
  const { year, month, day } = req.query;

  ensureOrderDiscountColumn((errCol) => {
    if (errCol) return res.status(500).json({ message: "Ошибка БД (orders)" });
    ensureOrderPaymentColumns((errPay) => {
      if (errPay) return res.status(500).json({ message: "Ошибка БД (orders)" });

      let sql = `
        SELECT
          o.id,
          o.customer_id,
          o.total,
          COALESCE(o.order_discount, c.discount, 0) AS discount,
          ROUND(o.total * (1 - COALESCE(o.order_discount, c.discount, 0) / 100.0), 2) AS total_after_discount,
          o.status,
          COALESCE(o.payment_status, 'unpaid') AS payment_status,
          COALESCE(o.paid_amount, 0) AS paid_amount,
          o.paid_at,
          o.created_at,
          c.first_name,
          c.last_name
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        WHERE o.status = 'done'
      `;
      const params = [];

      const y = Number(year);
      const m = Number(month);
      const d = Number(day);
      const hasYM = Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12;

      if (hasYM) {
        const mm = String(m).padStart(2, "0");
        sql += `
          AND strftime('%Y', datetime(o.created_at, '+5 hours')) = ?
          AND strftime('%m', datetime(o.created_at, '+5 hours')) = ?
        `;
        params.push(String(y), mm);

        if (Number.isFinite(d) && d >= 1 && d <= 31) {
          const dd = String(d).padStart(2, "0");
          sql += ` AND strftime('%d', datetime(o.created_at, '+5 hours')) = ?`;
          params.push(dd);
        }
      }

      sql += ` ORDER BY o.created_at DESC`;

      db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ message: "Ошибка БД (payments)" });
        res.json(rows || []);
      });
    });
  });
});

app.patch("/api/admin/orders/:orderId/payment", requireAdminApi, (req, res) => {
  const orderId = Number(req.params.orderId);
  const paymentStatus = String(req.body?.payment_status || "").trim().toLowerCase();

  if (!orderId) return res.status(400).json({ message: "Некорректный id заказа" });
  if (paymentStatus !== "paid" && paymentStatus !== "unpaid") {
    return res.status(400).json({ message: "payment_status должен быть paid или unpaid" });
  }

  ensureOrderPaymentColumns((errPay) => {
    if (errPay) return res.status(500).json({ message: "Ошибка БД (orders)" });
    db.get(
      `SELECT
         o.id,
         o.total,
         COALESCE(o.order_discount, c.discount, 0) AS discount,
         ROUND(o.total * (1 - COALESCE(o.order_discount, c.discount, 0) / 100.0), 2) AS total_after_discount
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.id = ?`,
      [orderId],
      (e0, order) => {
        if (e0) return res.status(500).json({ message: "Ошибка БД (orders)" });
        if (!order) return res.status(404).json({ message: "Заказ не найден" });

        const due = Number(order.total_after_discount) || 0;
        const nextPaidAmount = paymentStatus === "paid" ? due : 0;
        const paidAtExpr = paymentStatus === "paid" ? "datetime('now')" : "NULL";

        db.run(
          `UPDATE orders
           SET payment_status = ?,
               paid_amount = ?,
               paid_at = ${paidAtExpr}
           WHERE id = ?`,
          [paymentStatus, nextPaidAmount, orderId],
          function (err) {
            if (err) return res.status(500).json({ message: "Ошибка обновления оплаты" });
            if (!this.changes) return res.status(404).json({ message: "Заказ не найден" });
            res.json({ success: true, orderId, payment_status: paymentStatus, paid_amount: nextPaidAmount });
          }
        );
      }
    );
  });
});

app.patch("/api/admin/orders/:orderId/payment/add", requireAdminApi, (req, res) => {
  const orderId = Number(req.params.orderId);
  const amount = Number(req.body?.amount);

  if (!orderId) return res.status(400).json({ message: "Некорректный id заказа" });
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: "Сумма должна быть больше 0" });
  }

  ensureOrderPaymentColumns((errPay) => {
    if (errPay) return res.status(500).json({ message: "Ошибка БД (orders)" });
    ensureOrderDiscountColumn((errCol) => {
      if (errCol) return res.status(500).json({ message: "Ошибка БД (orders)" });

      db.get(
        `SELECT
           o.id,
           o.total,
           COALESCE(o.paid_amount, 0) AS paid_amount,
           COALESCE(o.order_discount, c.discount, 0) AS discount,
           ROUND(o.total * (1 - COALESCE(o.order_discount, c.discount, 0) / 100.0), 2) AS total_after_discount
         FROM orders o
         LEFT JOIN customers c ON c.id = o.customer_id
         WHERE o.id = ?`,
        [orderId],
        (e0, order) => {
          if (e0) return res.status(500).json({ message: "Ошибка БД (orders)" });
          if (!order) return res.status(404).json({ message: "Заказ не найден" });

          const due = Number(order.total_after_discount) || 0;
          const paidAmount = Number(order.paid_amount) || 0;
          const remaining = Math.max(0, due - paidAmount);
          const roundedAmount = Math.round(amount * 100) / 100;

          if (roundedAmount > remaining + 1e-9) {
            return res.status(400).json({ message: "Сумма больше остатка по заказу" });
          }

          const nextPaid = Math.round((paidAmount + roundedAmount) * 100) / 100;
          const isPaid = nextPaid >= due - 1e-9;
          const status = isPaid ? "paid" : "unpaid";
          const paidAtExpr = isPaid ? "datetime('now')" : "NULL";

          db.run(
            `UPDATE orders
             SET paid_amount = ?,
                 payment_status = ?,
                 paid_at = ${paidAtExpr}
             WHERE id = ?`,
            [nextPaid, status, orderId],
            function (err) {
              if (err) return res.status(500).json({ message: "Ошибка обновления оплаты" });
              if (!this.changes) return res.status(404).json({ message: "Заказ не найден" });

              res.json({
                success: true,
                orderId,
                paid_amount: nextPaid,
                due_amount: due,
                remaining_amount: Math.max(0, Math.round((due - nextPaid) * 100) / 100),
                payment_status: status
              });
            }
          );
        }
      );
    });
  });
});

app.patch("/api/admin/orders/:orderId/payment/set", requireAdminApi, (req, res) => {
  const orderId = Number(req.params.orderId);
  const paidAmountInput = Number(req.body?.paid_amount);

  if (!orderId) return res.status(400).json({ message: "Некорректный id заказа" });
  if (!Number.isFinite(paidAmountInput) || paidAmountInput < 0) {
    return res.status(400).json({ message: "Оплаченная сумма должна быть >= 0" });
  }

  ensureOrderPaymentColumns((errPay) => {
    if (errPay) return res.status(500).json({ message: "Ошибка БД (orders)" });
    ensureOrderDiscountColumn((errCol) => {
      if (errCol) return res.status(500).json({ message: "Ошибка БД (orders)" });

      db.get(
        `SELECT
           o.id,
           o.total,
           COALESCE(o.order_discount, c.discount, 0) AS discount,
           ROUND(o.total * (1 - COALESCE(o.order_discount, c.discount, 0) / 100.0), 2) AS total_after_discount
         FROM orders o
         LEFT JOIN customers c ON c.id = o.customer_id
         WHERE o.id = ?`,
        [orderId],
        (e0, order) => {
          if (e0) return res.status(500).json({ message: "Ошибка БД (orders)" });
          if (!order) return res.status(404).json({ message: "Заказ не найден" });

          const due = Number(order.total_after_discount) || 0;
          const nextPaid = Math.round(paidAmountInput * 100) / 100;
          if (nextPaid > due + 1e-9) {
            return res.status(400).json({ message: "Оплаченная сумма не может быть больше суммы заказа" });
          }

          const isPaid = nextPaid >= due - 1e-9;
          const status = isPaid ? "paid" : "unpaid";
          const paidAtExpr = isPaid ? "datetime('now')" : "NULL";

          db.run(
            `UPDATE orders
             SET paid_amount = ?,
                 payment_status = ?,
                 paid_at = ${paidAtExpr}
             WHERE id = ?`,
            [nextPaid, status, orderId],
            function (err) {
              if (err) return res.status(500).json({ message: "Ошибка обновления оплаты" });
              if (!this.changes) return res.status(404).json({ message: "Заказ не найден" });

              res.json({
                success: true,
                orderId,
                paid_amount: nextPaid,
                due_amount: due,
                remaining_amount: Math.max(0, Math.round((due - nextPaid) * 100) / 100),
                payment_status: status
              });
            }
          );
        }
      );
    });
  });
});

// ✅ УДАЛИТЬ ЗАКАЗ (и его позиции)
app.delete("/api/admin/orders/:id", requireAdminApi, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: "Некорректный id заказа" });

  db.serialize(() => {
    db.run("BEGIN TRANSACTION", (e0) => {
      if (e0) return res.status(500).json({ message: "Ошибка удаления заказа" });

      // 1) удалить позиции
      db.run("DELETE FROM order_items WHERE order_id = ?", [id], (e1) => {
        if (e1) {
          return db.run("ROLLBACK", () =>
            res.status(500).json({ message: "Ошибка удаления заказа" })
          );
        }

        // 2) удалить заказ
        db.run("DELETE FROM orders WHERE id = ?", [id], function (e2) {
          if (e2) {
            return db.run("ROLLBACK", () =>
              res.status(500).json({ message: "Ошибка удаления заказа" })
            );
          }

          const changes = Number(this.changes || 0);
          if (!changes) {
            return db.run("ROLLBACK", () =>
              res.status(404).json({ message: "Заказ не найден" })
            );
          }

          db.run("COMMIT", (e3) => {
            if (e3) {
              return db.run("ROLLBACK", () =>
                res.status(500).json({ message: "Ошибка удаления заказа" })
              );
            }
            return res.json({ ok: true });
          });
        });
      });
    });
  });
});

function recalcOrderTotal(orderId, cb) {
  db.get(
    `SELECT COALESCE(SUM(price * qty), 0) AS total FROM order_items WHERE order_id = ?`,
    [orderId],
    (err, row) => {
      if (err) return cb(err);

      const total = Number(row?.total) || 0;
      db.run(`UPDATE orders SET total = ? WHERE id = ?`, [total, orderId], (err2) => {
        if (err2) return cb(err2);
        cb(null, total);
      });
    }
  );
}

function consumeProductStock(productId, qty, cb) {
  const pid = Number(productId);
  const q = Number(qty);
  if (!Number.isFinite(pid) || pid <= 0) return cb(new Error("Некорректный товар"));
  if (!Number.isFinite(q) || q < 1) return cb(new Error("Некорректное количество"));

  db.run(
    `UPDATE products
     SET stock = COALESCE(stock, 0) - ?
     WHERE id = ? AND COALESCE(stock, 0) >= ?`,
    [q, pid, q],
    function (err) {
      if (err) return cb(err);
      if (Number(this.changes) > 0) return cb(null);

      db.get(`SELECT id, COALESCE(stock, 0) AS stock FROM products WHERE id = ?`, [pid], (e2, row) => {
        if (e2) return cb(e2);
        if (!row) return cb(new Error("Товар не найден"));
        return cb(new Error(`Недостаточно остатка на складе (доступно: ${Number(row.stock) || 0})`));
      });
    }
  );
}

function restoreProductStock(productId, qty, cb) {
  const pid = Number(productId);
  const q = Number(qty);
  if (!Number.isFinite(pid) || pid <= 0) return cb(new Error("Некорректный товар"));
  if (!Number.isFinite(q) || q < 1) return cb(new Error("Некорректное количество"));
  db.run(
    `UPDATE products SET stock = COALESCE(stock, 0) + ? WHERE id = ?`,
    [q, pid],
    function (err) {
      if (err) return cb(err);
      if (!Number(this.changes)) return cb(new Error("Товар не найден"));
      cb(null);
    }
  );
}

app.get("/api/admin/orders/:orderId/items", requireAdminApi, (req, res) => {
  const { orderId } = req.params;

  db.all(
    `
    SELECT id, order_id, product_id, name, price, qty
    FROM order_items
    WHERE order_id = ?
    ORDER BY id ASC
    `,
    [orderId],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Ошибка БД (order_items)" });
      res.json(rows || []);
    }
  );
});

app.post("/api/admin/orders/:orderId/items", requireAdminApi, (req, res) => {
  const orderId = Number(req.params.orderId);
  const { product_id, qty } = req.body || {};

  const productId = Number(product_id);
  const q = Number(qty);

  if (!orderId) return res.status(400).json({ message: "Некорректный orderId" });
  if (!productId) return res.status(400).json({ message: "Некорректный product_id" });
  if (!Number.isFinite(q) || q < 1) {
    return res.status(400).json({ message: "Количество должно быть >= 1" });
  }

  // берём товар из products
  db.get(
    `SELECT id, name, price FROM products WHERE id = ?`,
    [productId],
    (err, p) => {
      if (err) return res.status(500).json({ message: "Ошибка БД (products)" });
      if (!p) return res.status(404).json({ message: "Товар не найден" });

      const name = String(p.name || "");
      const price = Number(p.price) || 0;

      // если позиция уже есть в заказе — увеличиваем qty
      db.get(
        `SELECT id, qty FROM order_items WHERE order_id = ? AND product_id = ?`,
        [orderId, productId],
        (err2, row) => {
          if (err2) return res.status(500).json({ message: "Ошибка БД (order_items)" });

          const afterWrite = () => {
            recalcOrderTotal(orderId, (e3, newTotal) => {
              if (e3) return res.status(500).json({ message: "Ошибка пересчёта" });
              res.json({ success: true, total: newTotal });
            });
          };

          if (row) {
            const nextQty = (Number(row.qty) || 0) + q;
            db.run(
              `UPDATE order_items SET qty = ? WHERE id = ?`,
              [nextQty, row.id],
              (errU) => {
                if (errU) return res.status(500).json({ message: "Ошибка обновления позиции" });
                afterWrite();
              }
            );
          } else {
            db.run(
              `INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES (?, ?, ?, ?, ?)`,
              [orderId, productId, name, price, q],
              (errI) => {
                if (errI) return res.status(500).json({ message: "Ошибка добавления позиции" });
                afterWrite();
              }
            );
          }
        }
      );
    }
  );
});


/* ================== СОЗДАНИЕ ЗАКАЗА АДМИНОМ (ЗАЩИЩЕНО) ================== */
app.post("/api/admin/orders", requireAdminApi, (req, res) => {
  const { customerId, items } = req.body || {};

  const cid = Number(customerId);
  if (!cid) return res.status(400).json({ message: "Некорректный customerId" });

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Список товаров пуст" });
  }

  // нормализуем items: {productId, qty}
  const normalized = items
    .map(it => ({ productId: Number(it.productId), qty: Number(it.qty) }))
    .filter(it => it.productId && Number.isFinite(it.qty) && it.qty >= 1);

  if (normalized.length === 0) {
    return res.status(400).json({ message: "Некорректные товары" });
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION", (eTx) => {
      if (eTx) return res.status(500).json({ message: "Ошибка БД (tx)" });

      db.get("SELECT id FROM customers WHERE id = ?", [cid], (eC, cRow) => {
        if (eC) {
          return db.run("ROLLBACK", () => res.status(500).json({ message: "Ошибка БД (customers)" }));
        }
        if (!cRow) {
          return db.run("ROLLBACK", () => res.status(404).json({ message: "Клиент не найден" }));
        }

        db.run(
          `INSERT INTO orders (customer_id, total, status) VALUES (?, 0, 'new')`,
          [cid],
          function (eO) {
            if (eO) {
              return db.run("ROLLBACK", () => res.status(500).json({ message: "Ошибка БД (orders)" }));
            }

            const orderId = this.lastID;

            const processItem = (idx) => {
              if (idx >= normalized.length) {
                return recalcOrderTotal(orderId, (eT, total) => {
                  if (eT) {
                    return db.run("ROLLBACK", () => res.status(500).json({ message: "Ошибка пересчёта total" }));
                  }
                  db.run("COMMIT", (eCommit) => {
                    if (eCommit) {
                      return db.run("ROLLBACK", () => res.status(500).json({ message: "Ошибка сохранения заказа" }));
                    }
                    return res.json({ success: true, orderId, total });
                  });
                });
              }

              const { productId, qty } = normalized[idx];
              db.get(
                `SELECT id, name, price FROM products WHERE id = ?`,
                [productId],
                (eP, p) => {
                  if (eP || !p) {
                    return db.run("ROLLBACK", () =>
                      res.status(400).json({ message: "Один из товаров не найден" })
                    );
                  }

                  db.run(
                    `INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES (?, ?, ?, ?, ?)`,
                    [orderId, p.id, String(p.name || ""), Number(p.price) || 0, qty],
                    (eI) => {
                      if (eI) {
                        return db.run("ROLLBACK", () =>
                          res.status(500).json({ message: "Ошибка БД (order_items)" })
                        );
                      }
                      processItem(idx + 1);
                    }
                  );
                }
              );
            };

            processItem(0);
          }
        );
      });
    });
  });
});



app.put("/api/admin/order-items/:itemId", requireAdminApi, (req, res) => {
  const { itemId } = req.params;
  const { qty } = req.body || {};
  const q = Number(qty);

  if (!Number.isFinite(q) || q < 1) {
    return res.status(400).json({ message: "Количество должно быть >= 1" });
  }

  db.get(`SELECT id, order_id FROM order_items WHERE id = ?`, [itemId], (err, row) => {
    if (err) return res.status(500).json({ message: "Ошибка БД" });
    if (!row) return res.status(404).json({ message: "Позиция не найдена" });

    const orderId = row.order_id;

    db.run(`UPDATE order_items SET qty = ? WHERE id = ?`, [q, itemId], (err2) => {
      if (err2) return res.status(500).json({ message: "Ошибка обновления" });

      recalcOrderTotal(orderId, (e3, newTotal) => {
        if (e3) return res.status(500).json({ message: "Ошибка пересчёта" });
        res.json({ success: true, total: newTotal });
      });
    });
  });
});

app.delete("/api/admin/order-items/:itemId", requireAdminApi, (req, res) => {
  const { itemId } = req.params;

  db.get(`SELECT id, order_id FROM order_items WHERE id = ?`, [itemId], (err, row) => {
    if (err) return res.status(500).json({ message: "Ошибка БД" });
    if (!row) return res.status(404).json({ message: "Позиция не найдена" });

    const orderId = row.order_id;

    db.run(`DELETE FROM order_items WHERE id = ?`, [itemId], (err2) => {
      if (err2) return res.status(500).json({ message: "Ошибка удаления позиции" });

      recalcOrderTotal(orderId, (e3, newTotal) => {
        if (e3) return res.status(500).json({ message: "Ошибка пересчёта" });
        res.json({ success: true, total: newTotal });
      });
    });
  });
});

app.put("/api/admin/orders/:orderId/status", requireAdminApi, (req, res) => {
  const orderId = Number(req.params.orderId);
  const { status } = req.body || {};

  if (!Number.isFinite(orderId) || orderId <= 0) {
    return res.status(400).json({ message: "Некорректный id заказа" });
  }
  if (status !== "new" && status !== "done") {
    return res.status(400).json({ message: "Неверный статус" });
  }

  db.get(`SELECT id, status FROM orders WHERE id = ?`, [orderId], (eOrder, orderRow) => {
    if (eOrder) return res.status(500).json({ message: "Ошибка БД (orders)" });
    if (!orderRow) return res.status(404).json({ message: "Заказ не найден" });

    const prevStatus = String(orderRow.status || "new");
    if (prevStatus === status) return res.json({ success: true });

    db.serialize(() => {
      db.run("BEGIN TRANSACTION", (eTx) => {
        if (eTx) return res.status(500).json({ message: "Ошибка БД (tx)" });

        db.all(
          `SELECT product_id, qty
           FROM order_items
           WHERE order_id = ? AND product_id IS NOT NULL`,
          [orderId],
          (eItems, items) => {
            if (eItems) {
              return db.run("ROLLBACK", () => res.status(500).json({ message: "Ошибка БД (order_items)" }));
            }

            const rows = Array.isArray(items) ? items : [];
            const applyRow = (idx) => {
              if (idx >= rows.length) {
                return db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, orderId], (eUpd) => {
                  if (eUpd) {
                    return db.run("ROLLBACK", () => res.status(500).json({ message: "Ошибка обновления статуса" }));
                  }
                  db.run("COMMIT", (eCommit) => {
                    if (eCommit) {
                      return db.run("ROLLBACK", () => res.status(500).json({ message: "Ошибка сохранения" }));
                    }
                    return res.json({ success: true });
                  });
                });
              }

              const row = rows[idx];
              const pid = Number(row.product_id);
              const qty = Number(row.qty);
              if (!Number.isFinite(pid) || pid <= 0 || !Number.isFinite(qty) || qty <= 0) {
                return applyRow(idx + 1);
              }

              const next = () => applyRow(idx + 1);
              if (prevStatus === "new" && status === "done") {
                consumeProductStock(pid, qty, (eStock) => {
                  if (eStock) {
                    return db.run("ROLLBACK", () =>
                      res.status(400).json({ message: eStock.message || "Недостаточно остатка на складе" })
                    );
                  }
                  next();
                });
              } else if (prevStatus === "done" && status === "new") {
                restoreProductStock(pid, qty, (eRest) => {
                  if (eRest) {
                    return db.run("ROLLBACK", () =>
                      res.status(500).json({ message: eRest.message || "Ошибка возврата остатка" })
                    );
                  }
                  next();
                });
              } else {
                next();
              }
            };

            applyRow(0);
          }
        );
      });
    });
  });
});

function handleOrderDiscountUpdate(req, res) {
  const orderId = Number(req.params.orderId);
  const discountNum = Number(req.body?.discount);

  if (!Number.isFinite(orderId) || orderId <= 0) {
    return res.status(400).json({ message: "Некорректный id заказа" });
  }
  if (!Number.isFinite(discountNum) || discountNum < 0 || discountNum > 100) {
    return res.status(400).json({ message: "Скидка должна быть от 0 до 100" });
  }

  ensureOrderDiscountColumn((errCol) => {
    if (errCol) return res.status(500).json({ message: "Ошибка БД (orders)", error: errCol.message });
    db.run(
      "UPDATE orders SET order_discount = ? WHERE id = ?",
      [discountNum, orderId],
      function (err) {
        if (err) return res.status(500).json({ message: "Ошибка обновления скидки заказа", error: err.message });
        if (!this.changes) return res.status(404).json({ message: "Заказ не найден" });
        res.json({ success: true });
      }
    );
  });
}

app.patch("/api/admin/orders/:orderId/discount", requireAdminApi, handleOrderDiscountUpdate);
app.put("/api/admin/orders/:orderId/discount", requireAdminApi, handleOrderDiscountUpdate);

/* ================== СОЗДАНИЕ ЗАКАЗА (КЛИЕНТ) ================== */
app.post("/api/orders", (req, res) => {
  const { customerId, items } = req.body || {};
  const cid = Number(customerId);
  if (!cid) return res.status(400).json({ message: "Нет клиента" });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Корзина пустая" });
  }

  const normalized = items
    .map((it) => ({ productId: Number(it.productId), qty: Number(it.qty) }))
    .filter((it) => it.productId && Number.isFinite(it.qty) && it.qty >= 1);

  if (!normalized.length) {
    return res.status(400).json({ message: "Некорректные товары" });
  }

  db.serialize(() => {
    db.run("BEGIN TRANSACTION", (eTx) => {
      if (eTx) return res.status(500).json({ message: "Ошибка БД (tx)" });

      db.run(
        `INSERT INTO orders (customer_id, total, status) VALUES (?, 0, 'new')`,
        [cid],
        function (err) {
          if (err) {
            return db.run("ROLLBACK", () =>
              res.status(500).json({ message: "Ошибка БД (orders)", error: err.message })
            );
          }

          const orderId = this.lastID;

          const processItem = (idx) => {
            if (idx >= normalized.length) {
              return recalcOrderTotal(orderId, (eT, total) => {
                if (eT) {
                  return db.run("ROLLBACK", () => res.status(500).json({ message: "Ошибка пересчёта total" }));
                }
                db.run("COMMIT", (eCommit) => {
                  if (eCommit) {
                    return db.run("ROLLBACK", () => res.status(500).json({ message: "Ошибка сохранения заказа" }));
                  }
                  return res.json({ success: true, orderId, total });
                });
              });
            }

            const { productId, qty } = normalized[idx];
            db.get(
              `SELECT id, name, price FROM products WHERE id = ?`,
              [productId],
              (eP, p) => {
                if (eP || !p) {
                  return db.run("ROLLBACK", () =>
                    res.status(400).json({ message: "Один из товаров не найден" })
                  );
                }

                db.run(
                  `INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES (?, ?, ?, ?, ?)`,
                  [orderId, p.id, String(p.name || ""), Number(p.price) || 0, qty],
                  (eI) => {
                    if (eI) {
                      return db.run("ROLLBACK", () =>
                        res.status(500).json({ message: "Ошибка БД (order_items)" })
                      );
                    }
                    processItem(idx + 1);
                  }
                );
              }
            );
          };

          processItem(0);
        }
      );
    });
  });
});

app.get("/api/orders/history", (req, res) => {
  const { customerId, year, month, day } = req.query;

  if (!customerId || !year) {
    return res.status(400).json({ message: "Недостаточно параметров" });
  }

  let where = `o.customer_id = ? AND strftime('%Y', o.created_at) = ?`;
  const params = [customerId, String(year)];

  if (month) {
    where += ` AND strftime('%m', o.created_at) = ?`;
    params.push(String(month).padStart(2, "0"));
  }

  if (day) {
    where += ` AND strftime('%d', o.created_at) = ?`;
    params.push(String(day).padStart(2, "0"));
  }

  const sql = `
    SELECT 
      o.id,
      o.total,
      o.created_at,
      json_group_array(
        json_object(
          'name', oi.product_name,
          'price', oi.price,
          'qty', oi.qty
        )
      ) AS items
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE ${where}
    GROUP BY o.id
    ORDER BY o.created_at DESC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Ошибка сервера" });
    }

    rows.forEach(r => {
      r.items = JSON.parse(r.items || "[]");
    });

    res.json(rows);
  });
});
// HISTORY: summary (count + sum)
app.get("/api/history/summary", (req, res) => {
  const customerId = Number(req.query.customerId);
  const year = req.query.year || "";
  const month = req.query.month || "";
  const day = req.query.day || "";

  if (!customerId) return res.status(400).json({ error: "customerId required" });

  // фильтр по дате (подстрой под вашу схему created_at)
  // предполагаем created_at в формате "YYYY-MM-DD ..." или ISO
  let whereDate = "";
  const params = [customerId];

  if (year) { whereDate += " AND strftime('%Y', created_at) = ?"; params.push(String(year)); }
  if (month) { whereDate += " AND strftime('%m', created_at) = ?"; params.push(String(month).padStart(2, "0")); }
  if (day) { whereDate += " AND strftime('%d', created_at) = ?"; params.push(String(day).padStart(2, "0")); }

  const sql = `
    SELECT
      COUNT(*) as ordersCount,
      COALESCE(SUM(total), 0) as totalSum
    FROM orders
    WHERE customer_id = ?
    ${whereDate}
  `;

  db.get(sql, params, (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      ordersCount: row?.ordersCount || 0,
      totalSum: row?.totalSum || 0
    });
  });
});


// HISTORY: list
app.get("/api/history/list", (req, res) => {
  const customerId = Number(req.query.customerId);
  const year = req.query.year || "";
  const month = req.query.month || "";
  const day = req.query.day || "";

  if (!customerId) return res.status(400).json({ error: "customerId required" });

  let whereDate = "";
  const params = [customerId];

  if (year) { whereDate += " AND strftime('%Y', created_at) = ?"; params.push(String(year)); }
  if (month) { whereDate += " AND strftime('%m', created_at) = ?"; params.push(String(month).padStart(2, "0")); }
  if (day) { whereDate += " AND strftime('%d', created_at) = ?"; params.push(String(day).padStart(2, "0")); }

  const sql = `
    SELECT id, total, status, created_at
    FROM orders
    WHERE customer_id = ?
    ${whereDate}
    ORDER BY datetime(created_at) DESC
  `;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ orders: rows || [] });
  });
});


app.listen(3000, () => console.log("Server running on http://localhost:3000"));


