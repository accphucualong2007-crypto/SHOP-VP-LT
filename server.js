const express = require("express");
const session = require("express-session");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(ROOT, "public", "uploads");

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

const db = {
  products: path.join(DATA, "products.json"),
  orders: path.join(DATA, "orders.json"),
  settings: path.join(DATA, "settings.json")
};

const DEFAULT_PRODUCTS = [{"id": "SP001", "name": "Võ phục Karate trắng", "price": 250000, "category": "Karate", "sizes": ["S", "M", "L", "XL"], "description": "Võ phục Karate màu trắng, phù hợp tập luyện và thi đấu.", "image": "/uploads/karate.svg", "active": true}, {"id": "SP002", "name": "Võ phục Taekwondo", "price": 280000, "category": "Taekwondo", "sizes": ["S", "M", "L", "XL"], "description": "Võ phục Taekwondo thoải mái, chắc chắn.", "image": "/uploads/taekwondo.svg", "active": true}, {"id": "SP003", "name": "Đai võ thuật", "price": 70000, "category": "Phụ kiện", "sizes": ["S", "M", "L"], "description": "Đai võ thuật nhiều màu.", "image": "/uploads/belt.svg", "active": true}];
const DEFAULT_SETTINGS = {"shopName": "SHOP VÕ PHỤC LT", "bankId": "MB", "accountNumber": "0389744881", "accountName": "SHOP VO PHUC LT", "contactPhone": "", "contactAddress": "", "adminPassword": "admin123"};

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) {
      writeJson(file, fallback);
      return fallback;
    }
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error("READ JSON ERROR:", file, err.message);
    return fallback;
  }
}
function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}
function makeId(prefix) {
  return prefix + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString("hex").toUpperCase();
}
function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "").replace(/^84/, "0");
}
function adminOnly(req, res, next) {
  if (!req.session.isAdmin) return res.status(401).json({ error: "Chưa đăng nhập Admin." });
  next();
}

let products = readJson(db.products, DEFAULT_PRODUCTS);
let orders = readJson(db.orders, []);
let settings = readJson(db.settings, DEFAULT_SETTINGS);

app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "LT_V3_CHANGE_THIS_SECRET",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(ROOT, "public")));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, Date.now() + "-" + crypto.randomBytes(5).toString("hex") + ext);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg","image/png","image/webp","image/gif","image/svg+xml"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Chỉ cho phép JPG, PNG, WEBP, GIF hoặc SVG."));
  }
});

function vietQrUrl(amount, orderId) {
  if (!settings.bankId || !settings.accountNumber || settings.accountNumber === "0000000000") return null;
  return "https://img.vietqr.io/image/" +
    encodeURIComponent(settings.bankId.trim()) + "-" +
    encodeURIComponent(settings.accountNumber.trim()) +
    "-compact2.png?amount=" + Math.round(Number(amount) || 0) +
    "&addInfo=" + encodeURIComponent("Thanh toan " + orderId) +
    "&accountName=" + encodeURIComponent(settings.accountName || "");
}

/* PUBLIC */
app.get("/api/products", (_req, res) => {
  products = readJson(db.products, products);
  res.json(products.filter(p => p.active !== false));
});

app.get("/api/settings", (_req, res) => {
  settings = readJson(db.settings, settings);
  res.json({
    shopName: settings.shopName,
    bankId: settings.bankId,
    accountNumber: settings.accountNumber,
    accountName: settings.accountName,
    contactPhone: settings.contactPhone,
    contactAddress: settings.contactAddress
  });
});

app.post("/api/orders", (req, res) => {
  try {
    const b = req.body || {};
    const customer = b.customer || {};
    if (!customer.name || !customer.phone || !customer.address || !Array.isArray(b.items) || !b.items.length) {
      return res.status(400).json({ error: "Vui lòng nhập đủ họ tên, số điện thoại, địa chỉ và giỏ hàng." });
    }

    products = readJson(db.products, products);
    const items = [];
    let total = 0;

    for (const cartItem of b.items) {
      const p = products.find(x => String(x.id) === String(cartItem.productId) && x.active !== false);
      if (!p) continue;
      const quantity = Math.max(1, Math.min(99, Number(cartItem.quantity) || 1));
      const size = String(cartItem.size || "");
      if (Array.isArray(p.sizes) && p.sizes.length && !p.sizes.includes(size)) {
        return res.status(400).json({ error: `Size không hợp lệ cho sản phẩm: ${p.name}` });
      }
      const lineTotal = Number(p.price) * quantity;
      total += lineTotal;
      items.push({
        productId: p.id, name: p.name, price: Number(p.price),
        quantity, size, lineTotal
      });
    }

    if (!items.length) return res.status(400).json({ error: "Giỏ hàng không hợp lệ." });

    const order = {
      id: makeId("DH"),
      createdAt: new Date().toISOString(),
      status: "Chờ xác nhận",
      paymentMethod: b.paymentMethod === "qr" ? "VietQR" : "COD",
      paymentStatus: b.paymentMethod === "qr" ? "Chưa thanh toán" : "COD",
      customer: {
        name: String(customer.name).trim(),
        phone: String(customer.phone).trim(),
        address: String(customer.address).trim(),
        note: String(customer.note || "").trim()
      },
      items,
      total,
      qrUrl: b.paymentMethod === "qr" ? vietQrUrl(total, makeId("TMP")) : null
    };
    // Keep the QR transfer note tied to the real order ID.
    if (order.paymentMethod === "VietQR") order.qrUrl = vietQrUrl(order.total, order.id);

    orders = readJson(db.orders, orders);
    orders.unshift(order);
    writeJson(db.orders, orders);

    return res.status(201).json({
      ok: true,
      order,
      payment: {
        bankId: settings.bankId,
        accountNumber: settings.accountNumber,
        accountName: settings.accountName,
        amount: order.total
      }
    });
  } catch (err) {
    console.error("POST /api/orders ERROR:", err);
    return res.status(500).json({ error: "Không thể tạo đơn hàng: " + err.message });
  }
});

app.get("/api/orders/:id", (req, res) => {
  const orderId = String(req.params.id || "").trim();
  const phone = normalizePhone(req.query.phone);
  if (!orderId || !phone) return res.status(400).json({ error: "Vui lòng nhập mã đơn và số điện thoại." });
  orders = readJson(db.orders, orders);
  const order = orders.find(o => String(o.id) === orderId && normalizePhone(o.customer?.phone) === phone);
  if (!order) return res.status(404).json({ error: "Không tìm thấy đơn. Hãy kiểm tra mã đơn và số điện thoại." });
  res.json({ order });
});

app.post("/api/orders/:id/payment-confirm", (req, res) => {
  orders = readJson(db.orders, orders);
  const order = orders.find(o => String(o.id) === String(req.params.id));
  if (!order) return res.status(404).json({ error: "Không tìm thấy đơn." });
  order.paymentStatus = "Khách báo đã thanh toán";
  order.paymentConfirmedAt = new Date().toISOString();
  writeJson(db.orders, orders);
  res.json({ ok: true, order });
});

/* ADMIN AUTH */
app.post("/api/admin/login", (req, res) => {
  settings = readJson(db.settings, settings);
  if (String(req.body.password || "") !== String(settings.adminPassword)) {
    return res.status(401).json({ error: "Sai mật khẩu Admin." });
  }
  req.session.isAdmin = true;
  res.json({ ok: true });
});
app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});
app.get("/api/admin/me", (req, res) => res.json({ isAdmin: !!req.session.isAdmin }));

/* ADMIN PRODUCTS */
app.get("/api/admin/products", adminOnly, (_req, res) => {
  products = readJson(db.products, products);
  res.json(products);
});

app.post("/api/admin/products", adminOnly, upload.single("image"), (req, res) => {
  const p = {
    id: makeId("SP"),
    name: String(req.body.name || "").trim(),
    price: Number(req.body.price) || 0,
    category: String(req.body.category || "Khác").trim(),
    sizes: String(req.body.sizes || "").split(",").map(x => x.trim()).filter(Boolean),
    description: String(req.body.description || "").trim(),
    image: req.file ? "/uploads/" + req.file.filename : String(req.body.imageUrl || "/uploads/placeholder.svg").trim(),
    active: true,
    createdAt: new Date().toISOString()
  };
  if (!p.name) return res.status(400).json({ error: "Tên sản phẩm không được trống." });
  products = readJson(db.products, products);
  products.unshift(p);
  writeJson(db.products, products);
  res.status(201).json(p);
});

app.put("/api/admin/products/:id", adminOnly, upload.single("image"), (req, res) => {
  products = readJson(db.products, products);
  const p = products.find(x => String(x.id) === String(req.params.id));
  if (!p) return res.status(404).json({ error: "Không tìm thấy sản phẩm." });

  if (req.body.name !== undefined) p.name = String(req.body.name).trim();
  if (req.body.price !== undefined) p.price = Number(req.body.price) || 0;
  if (req.body.category !== undefined) p.category = String(req.body.category).trim();
  if (req.body.sizes !== undefined) p.sizes = String(req.body.sizes).split(",").map(x => x.trim()).filter(Boolean);
  if (req.body.description !== undefined) p.description = String(req.body.description).trim();
  if (req.body.imageUrl) p.image = String(req.body.imageUrl).trim();
  if (req.file) p.image = "/uploads/" + req.file.filename;
  if (req.body.active !== undefined) p.active = String(req.body.active) !== "false";

  writeJson(db.products, products);
  res.json(p);
});

app.delete("/api/admin/products/:id", adminOnly, (req, res) => {
  products = readJson(db.products, products);
  const p = products.find(x => String(x.id) === String(req.params.id));
  if (!p) return res.status(404).json({ error: "Không tìm thấy sản phẩm." });
  p.active = false;
  writeJson(db.products, products);
  res.json({ ok: true });
});

/* ADMIN ORDERS */
app.get("/api/admin/orders", adminOnly, (_req, res) => {
  orders = readJson(db.orders, orders);
  res.json(orders);
});
app.put("/api/admin/orders/:id", adminOnly, (req, res) => {
  orders = readJson(db.orders, orders);
  const order = orders.find(o => String(o.id) === String(req.params.id));
  if (!order) return res.status(404).json({ error: "Không tìm thấy đơn." });
  if (req.body.status) order.status = String(req.body.status);
  if (req.body.paymentStatus) order.paymentStatus = String(req.body.paymentStatus);
  order.updatedAt = new Date().toISOString();
  writeJson(db.orders, orders);
  res.json(order);
});

/* ADMIN SETTINGS */
app.get("/api/admin/settings", adminOnly, (_req, res) => {
  settings = readJson(db.settings, settings);
  res.json(settings);
});
app.put("/api/admin/settings", adminOnly, (req, res) => {
  settings = readJson(db.settings, settings);
  const allowed = ["shopName","bankId","accountNumber","accountName","contactPhone","contactAddress"];
  for (const key of allowed) {
    if (req.body[key] !== undefined) settings[key] = String(req.body[key]);
  }
  if (req.body.adminPassword) settings.adminPassword = String(req.body.adminPassword);
  writeJson(db.settings, settings);
  res.json(settings);
});

/* Multer / generic errors must return JSON for API requests. */
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);
  if (req.path.startsWith("/api/")) {
    return res.status(500).json({ error: err.message || "Server error." });
  }
  next(err);
});

/* Express 5-safe fallback: no app.get("*"). */
app.use((req, res) => {
  if (req.method === "GET" && !req.path.startsWith("/api/")) {
    return res.sendFile(path.join(ROOT, "public", "index.html"));
  }
  res.status(404).json({ error: "Không tìm thấy API." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("========================================");
  console.log(" SHOP VÕ PHỤC LT V3");
  console.log(` http://localhost:${PORT}`);
  console.log(` Admin: http://localhost:${PORT}/admin.html`);
  console.log(" VietQR: READY");
  console.log(" Tra cứu đơn: /track.html");
  console.log("========================================");
});
