const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "database.sqlite");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("������ ����������� � ��:", err.message);
  else console.log("SQLite ����������");
});

console.log("DB PATH:", dbPath);

function ensureColumn(table, column, ddl, cb) {
  db.all(`PRAGMA table_info(${table})`, (err, rows) => {
    if (err) return cb && cb(err);

    const exists = Array.isArray(rows) && rows.some(r => r.name === column);
    if (exists) return cb && cb(null, false);

    db.run(ddl, (e2) => {
      if (e2) return cb && cb(e2);
      console.log(`��������: ��������� ������� ${table}.${column}`);
      cb && cb(null, true);
    });
  });
}

db.serialize(() => {
  // === CREATE TABLES ===
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      address TEXT NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      manufacturer TEXT,
      expiry_from TEXT,
      expiry_to TEXT,
      expiry_date TEXT,
      price INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      image TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      total INTEGER NOT NULL,
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      qty INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  // === MIGRATIONS (�����) ===
  // customers.pharmacy_name (����� �� ����� /api/customers/:id)
  ensureColumn(
    "customers",
    "pharmacy_name",
    `ALTER TABLE customers ADD COLUMN pharmacy_name TEXT NOT NULL DEFAULT ''`,
    () => {}
  );

  ensureColumn(
    "customers",
    "discount",
    `ALTER TABLE customers ADD COLUMN discount REAL NOT NULL DEFAULT 0`,
    () => {}
  );

  ensureColumn(
    "customers",
    "photo",
    `ALTER TABLE customers ADD COLUMN photo TEXT`,
    () => {}
  );

  // products.manufacturer � products.expiry_date (�.�. server.js �� SELECT'��)
  ensureColumn(
    "products",
    "manufacturer",
    `ALTER TABLE products ADD COLUMN manufacturer TEXT`,
    () => {}
  );

  

  ensureColumn(
    "products",
    "expiry_date",
    `ALTER TABLE products ADD COLUMN expiry_date TEXT`,
    () => {}
  );

  ensureColumn(
    "products",
    "expiry_from",
    `ALTER TABLE products ADD COLUMN expiry_from TEXT`,
    () => {}
  );

  ensureColumn(
    "products",
    "expiry_to",
    `ALTER TABLE products ADD COLUMN expiry_to TEXT`,
    () => {}
  );

  ensureColumn(
    "products",
    "stock",
    `ALTER TABLE products ADD COLUMN stock INTEGER NOT NULL DEFAULT 0`,
    () => {}
  );

  ensureColumn(
    "products",
    "base_price",
    `ALTER TABLE products ADD COLUMN base_price REAL`,
    () => {}
  );

  ensureColumn(
    "products",
    "price_raise_percent",
    `ALTER TABLE products ADD COLUMN price_raise_percent REAL NOT NULL DEFAULT 0`,
    () => {}
  );

  ensureColumn(
    "orders",
    "order_discount",
    `ALTER TABLE orders ADD COLUMN order_discount REAL`,
    () => {}
  );

  ensureColumn(
    "orders",
    "payment_status",
    `ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'`,
    () => {}
  );

  ensureColumn(
    "orders",
    "paid_at",
    `ALTER TABLE orders ADD COLUMN paid_at DATETIME`,
    () => {}
  );

  ensureColumn(
    "orders",
    "paid_amount",
    `ALTER TABLE orders ADD COLUMN paid_amount REAL NOT NULL DEFAULT 0`,
    () => {}
  );

  // === ADMIN SEED ===
  db.get("SELECT * FROM admin LIMIT 1", (err, row) => {
    if (err) return console.error("������ admin:", err.message);
    if (!row) {
      db.run("INSERT INTO admin (login, password) VALUES (?, ?)", ["admin", "1234"]);
      console.log("������������� ������: admin / 1234");
    }
  });
});

module.exports = db;

