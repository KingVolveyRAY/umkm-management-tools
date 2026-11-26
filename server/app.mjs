import { createHash, randomBytes } from 'node:crypto';
import express from 'express';
import jpeg from 'jpeg-js';
import QRCode from 'qrcode';
import { addNotice, hashPassword, localDay, matchesPassword, shiftDay, transaction, venueLocation } from './store.mjs';
import { GatewayError, validStaticQris } from './qris.mjs';

const tokenHash = value => createHash('sha256').update(value).digest('hex');
const rupiah = value => 'Rp' + value.toLocaleString('id-ID');
const methods = ['cash', 'qris_static', 'qris_dynamic'];
const usernameRule = /^[a-z0-9._-]{3,40}$/i;
const sessionAge = 12 * 60 * 60 * 1000;
const seatStatuses = { onsite: 'Di area outlet', uncertain: 'Lokasi perlu ditinjau', outside: 'Di luar area outlet' };

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function fail(status, message) {
  throw new RequestError(status, message);
}

function requiredText(value, limit, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > limit) fail(400, label + ' belum valid.');
  return value.trim();
}

function dayParam(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(400, 'Tanggal belum valid.');
  const date = new Date(value + 'T12:00:00+07:00');
  if (Number.isNaN(date.getTime()) || localDay(date) !== value) fail(400, 'Tanggal belum valid.');
  return value;
}

function coordinate(value, bound) {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= bound;
}

export function createApp(db, { demo, gateway = null, secureCookie = false, trustProxy = false } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 1);

  const statement = sql => db.prepare(sql);
  const store = () => statement('SELECT * FROM store WHERE id = 1').get();
  const saleById = id => statement('SELECT * FROM sales WHERE id = ?').get(id);
  const safeUser = ({ id, name, username, role }) => ({ id, name, username, role });
  const checkoutJobs = new Map();
  const loginAttempts = new Map();
  const saleJoin = 'SELECT s.*, u.name AS employee FROM sales s JOIN users u ON u.id = s.employee_id ';
  const setCookie = (req, res, value, age) => res.cookie('kelola_session', value, {
    path: '/', httpOnly: true, sameSite: 'strict', secure: secureCookie || req.secure, maxAge: age,
  });

  function activeSession(req) {
    const token = req.headers.cookie?.match(/(?:^|;\s*)kelola_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    if (!token) return null;
    req.sessionHash = tokenHash(token);
    return statement(`
      SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1
    `).get(req.sessionHash, new Date().toISOString());
  }

  function startSession(req, res, user) {
    activeSession(req);
    if (req.sessionHash) statement('DELETE FROM sessions WHERE token_hash = ?').run(req.sessionHash);
    const token = randomBytes(32).toString('hex');
    transaction(db, () => {
      statement('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
      statement('INSERT INTO sessions VALUES (?,?,?)')
        .run(tokenHash(token), user.id, new Date(Date.now() + sessionAge).toISOString());
    });
    setCookie(req, res, token, sessionAge);
    res.json(sessionInfo(user));
  }

  function sessionInfo(user) {
    if (!user) return { user: null, demo };
    const settings = store();
    return {
      user: safeUser(user), demo,
      store: {
        name: settings.name, outlet: settings.outlet, radius: settings.radius,
        venueConfigured: settings.latitude != null && settings.longitude != null,
      },
      payments: { static: !!settings.static_qris || demo, dynamic: !!gateway || demo, sandbox: !!gateway && !gateway.production },
    };
  }

  function auth(role) {
    return (req, res, next) => {
      req.user = activeSession(req);
      if (!req.user) return next(new RequestError(401, 'Silakan masuk kembali.'));
      if (role && req.user.role !== role) return next(new RequestError(403, 'Akun ini tidak memiliki akses.'));
      return next();
    };
  }

  app.use('/api', (req, res, next) => {
    res.set({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      if (!req.is('application/json')) return next(new RequestError(415, 'Gunakan format JSON.'));
      if (['cross-site', 'same-site'].includes(req.get('sec-fetch-site'))) {
        return next(new RequestError(403, 'Permintaan lintas situs ditolak.'));
      }
    }
    next();
  }, express.json({ limit: '1550kb' }));

  app.get('/api/session', (req, res) => res.json(sessionInfo(activeSession(req))));
  app.post('/api/demo', (req, res) => {
    if (!demo) fail(404, 'Mode demo tidak aktif.');
    const role = req.body?.role;
    if (!['owner', 'employee'].includes(role)) fail(400, 'Panel tidak dikenal.');
    const user = statement('SELECT * FROM users WHERE id = ? AND role = ? AND active = 1').get(role === 'owner' ? 1 : 2, role);
    if (!user) fail(404, 'Akun demo tidak aktif.');
    startSession(req, res, user);
  });

  // Compare against a real hash even when the username is unknown.
  const dummyHash = hashPassword(randomBytes(24).toString('hex'));
  app.post('/api/login', (req, res) => {
    const username = req.body?.username;
    const password = req.body?.password;
    const now = Date.now();
    for (const [key, attempt] of loginAttempts) {
      if (attempt.until < now) loginAttempts.delete(key);
    }
    const key = req.ip;
    const attempts = loginAttempts.get(key) ?? { count: 0, until: now + 15 * 60000 };
    if (attempts.count >= 12) fail(429, 'Terlalu banyak percobaan. Tunggu 15 menit sebelum mencoba lagi.');
    if (typeof username !== 'string' || !usernameRule.test(username) || typeof password !== 'string' || password.length > 128) {
      fail(400, 'Nama pengguna atau kata sandi belum valid.');
    }
    const user = statement('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
    if (!matchesPassword(password, user?.password_hash ?? dummyHash) || !user) {
      attempts.count += 1;
      loginAttempts.set(key, attempts);
      fail(401, 'Nama pengguna atau kata sandi salah.');
    }
    loginAttempts.delete(key);
    startSession(req, res, user);
  });

  app.post('/api/logout', (req, res) => {
    activeSession(req);
    if (req.sessionHash) statement('DELETE FROM sessions WHERE token_hash = ?').run(req.sessionHash);
    setCookie(req, res, '', 0);
    res.json({ ok: true });
  });

  function publicSale(sale) {
    return {
      id: sale.id, method: sale.method, status: sale.status, provider: sale.provider,
      items: JSON.parse(sale.items), amount: sale.amount, cashReceived: sale.cash_received,
      employee: sale.employee, createdAt: sale.created_at, paidAt: sale.paid_at,
      qr: sale.status === 'pending' && !!(sale.qr_url || sale.qr_value),
      providerStatus: sale.provider_status,
    };
  }

  function attendanceRows(day, employee) {
    return statement(`
      SELECT a.id, a.kind, a.timestamp, a.latitude, a.longitude, a.accuracy, a.distance,
        a.venue_status AS venueStatus, (a.photo IS NOT NULL) AS hasPhoto, u.name, u.id AS employeeId
      FROM attendance a JOIN users u ON u.id = a.employee_id WHERE a.day = ?
      ${employee ? 'AND u.id = ?' : ''} ORDER BY a.timestamp DESC
    `).all(day, ...(employee ? [employee] : []));
  }

  const owner = auth('owner');
  const employee = auth('employee');

  app.get('/api/owner/overview', owner, (req, res) => {
    const today = localDay();
    const end = dayParam(req.query.end, today);
    const length = req.query.days === '30' ? 30 : 7;
    const start = shiftDay(end, 1 - length);
    const summary = day => statement(`
      SELECT COALESCE(SUM(amount),0) AS revenue, COUNT(*) AS count
      FROM sales WHERE status = 'paid' AND paid_day = ?
    `).get(day);
    const current = summary(end);
    const previous = summary(shiftDay(end, -1));
    const grouped = statement(`
      SELECT paid_day AS day, SUM(amount) AS revenue, COUNT(*) AS count
      FROM sales WHERE status = 'paid' AND paid_day BETWEEN ? AND ? GROUP BY paid_day
    `).all(start, end);
    const series = Array.from({ length }, (_, index) => {
      const day = shiftDay(start, index);
      return grouped.find(entry => entry.day === day) ?? { day, revenue: 0, count: 0 };
    });
    const present = statement(`
      SELECT COUNT(*) AS total FROM attendance a JOIN users u ON u.id = a.employee_id
      WHERE a.day = ? AND a.kind = 'in' AND u.active = 1
    `).get(end).total;
    const employees = statement("SELECT COUNT(*) AS total FROM users WHERE role = 'employee' AND active = 1").get().total;
    const review = statement("SELECT COUNT(*) AS total FROM attendance WHERE day = ? AND venue_status != 'onsite'").get(end).total;
    const recent = statement(saleJoin + "WHERE status = 'paid' AND paid_day = ? ORDER BY paid_at DESC, s.id DESC LIMIT 5").all(end);
    const notices = statement('SELECT * FROM notices ORDER BY created_at DESC, id DESC LIMIT 4').all();
    res.json({ today, end, current, previous, series, present, employees, review, recent: recent.map(publicSale), notices });
  });

  app.get('/api/owner/sales', owner, (req, res) => {
    const from = dayParam(req.query.from, shiftDay(localDay(), -6));
    const to = dayParam(req.query.to, localDay());
    if (from > to || Date.parse(to) - Date.parse(from) > 366 * 86400000) fail(400, 'Pilih rentang hingga 366 hari.');
    const method = req.query.method;
    const status = req.query.status;
    const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
    const size = 20;
    const args = [from, to];
    let where = " WHERE COALESCE(paid_day, date(created_at, '+7 hours')) BETWEEN ? AND ?";
    if (methods.includes(method)) { where += ' AND method = ?'; args.push(method); }
    if (['pending', 'paid', 'failed'].includes(status)) { where += ' AND status = ?'; args.push(status); }
    const { total, revenue, paid, pending } = statement(`
      SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN status = 'paid' THEN amount END),0) AS revenue,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending
      FROM sales${where}
    `).get(...args);
    const order = ' ORDER BY COALESCE(paid_at,created_at) DESC, s.id DESC';
    if (req.query.format === 'csv') {
      const csvCell = value => {
        const raw = String(value ?? '');
        const safe = /^[=+\-@\t\r]/.test(raw) ? "'" + raw : raw;
        return '"' + safe.replaceAll('"', '""') + '"';
      };
      const rows = statement(saleJoin + where + order).iterate(...args);
      res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="penjualan-kelola.csv"' });
      res.write('\uFEFFTransaksi,Kasir,Metode,Status,Total,Dicatat,Dibayar\r\n');
      for (const row of rows) {
        res.write([row.id, row.employee, row.method, row.status, row.amount, row.created_at, row.paid_at].map(csvCell).join(',') + '\r\n');
      }
      return res.end();
    }
    const rows = statement(saleJoin + where + order + ' LIMIT ? OFFSET ?').all(...args, size, (page - 1) * size);
    res.json({ rows: rows.map(publicSale), total, revenue, paid, pending, page, size });
  });

  app.get('/api/owner/notices', owner, (req, res) => {
    const rows = statement('SELECT * FROM notices ORDER BY created_at DESC, id DESC LIMIT 50').all();
    const { count } = statement('SELECT COUNT(*) AS count FROM notices WHERE is_read = 0').get();
    res.json({ rows, count });
  });

  app.post('/api/owner/notices/read', owner, (req, res) => {
    statement('UPDATE notices SET is_read = 1 WHERE is_read = 0').run();
    res.json({ ok: true });
  });

  app.get('/api/owner/attendance', owner, (req, res) => {
    const day = dayParam(req.query.day, localDay());
    const roster = statement("SELECT id,name,active FROM users WHERE role = 'employee' ORDER BY name").all();
    res.json({ day, roster, rows: attendanceRows(day) });
  });

  app.get('/api/attendance/:id/photo', auth(), (req, res) => {
    const row = statement('SELECT photo,employee_id FROM attendance WHERE id = ?').get(req.params.id);
    if (!row?.photo || (req.user.role === 'employee' && req.user.id !== row.employee_id)) fail(404, 'Selfie tidak tersedia.');
    res.type('jpeg').send(Buffer.from(row.photo));
  });

  app.get('/api/attendance', employee, (req, res) => {
    const day = localDay();
    res.json({ day, rows: attendanceRows(day, req.user.id) });
  });

  app.post('/api/attendance', employee, (req, res) => {
    const { latitude, longitude, accuracy, selfie, kind } = req.body ?? {};
    if (!coordinate(latitude, 90) || !coordinate(longitude, 180) || !coordinate(accuracy, 100000) || accuracy <= 0) {
      fail(400, 'Lokasi GPS belum valid.');
    }
    if (!['in', 'out'].includes(kind)) fail(400, 'Jenis absensi tidak dikenal.');
    if (typeof selfie !== 'string' || selfie.length > 1400000 || !/^data:image\/jpeg;base64,[a-z0-9+/]+={0,2}$/i.test(selfie)) {
      fail(400, 'Ambil selfie dengan kamera sebelum mengirim absensi.');
    }
    const image = Buffer.from(selfie.slice('data:image/jpeg;base64,'.length), 'base64');
    if (image.length < 100 || image[0] !== 0xff || image[1] !== 0xd8 || image.at(-2) !== 0xff || image.at(-1) !== 0xd9) {
      fail(400, 'Selfie tidak terbaca. Ambil ulang dengan kamera.');
    }
    try {
      jpeg.decode(image, { maxResolutionInMP: 1, maxMemoryUsageInMB: 24, tolerantDecoding: false });
    } catch {
      fail(400, 'Selfie tidak terbaca. Ambil ulang dengan kamera.');
    }
    const settings = store();
    if (settings.latitude == null || settings.longitude == null) fail(409, 'Pemilik perlu mengatur lokasi outlet terlebih dahulu.');
    const location = venueLocation(settings, latitude, longitude, accuracy);
    const now = new Date();
    const timestamp = now.toISOString();
    const day = localDay(now);
    transaction(db, () => {
      const current = attendanceRows(day, req.user.id);
      if (current.some(record => record.kind === kind)) fail(409, 'Absensi ini sudah tercatat hari ini.');
      if (kind === 'out' && !current.some(record => record.kind === 'in')) fail(409, 'Absen masuk terlebih dahulu.');
      statement(`
        INSERT INTO attendance (employee_id,kind,day,timestamp,latitude,longitude,accuracy,distance,venue_status,photo)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `).run(req.user.id, kind, day, timestamp, latitude, longitude, accuracy, location.distance, location.venue_status, image);
      addNotice(db, 'attendance', req.user.name + (kind === 'in' ? ' absen masuk' : ' absen pulang'),
        seatStatuses[location.venue_status] + ' • ' + location.distance + ' m dari outlet', timestamp);
    });
    res.status(201).json({ day, rows: attendanceRows(day, req.user.id) });
  });

  app.get('/api/products', auth(), (req, res) => {
    const where = req.user.role === 'owner' ? '' : ' WHERE active = 1';
    res.json({ rows: statement('SELECT * FROM products' + where + ' ORDER BY id').all() });
  });

  function productFields(body) {
    const name = requiredText(body?.name, 70, 'Nama produk');
    const category = requiredText(body?.category, 40, 'Kategori');
    const price = body?.price;
    if (!Number.isSafeInteger(price) || price < 100 || price > 100000000) fail(400, 'Harga harus antara Rp100 dan Rp100.000.000.');
    return [name, category, price, body.active === false ? 0 : 1];
  }

  app.post('/api/owner/products', owner, (req, res) => {
    const { lastInsertRowid } = statement('INSERT INTO products (name,category,price,active) VALUES (?,?,?,?)').run(...productFields(req.body));
    res.status(201).json({ id: lastInsertRowid });
  });

  app.put('/api/owner/products/:id', owner, (req, res) => {
    const updated = statement('UPDATE products SET name=?, category=?, price=?, active=? WHERE id=?')
      .run(...productFields(req.body), req.params.id);
    if (!updated.changes) fail(404, 'Produk tidak ditemukan.');
    res.json({ ok: true });
  });

  app.get('/api/owner/employees', owner, (req, res) =>
    res.json({ rows: statement("SELECT id,name,username,active FROM users WHERE role = 'employee' ORDER BY name").all() }));

  function staffFields(body, passwordRequired) {
    const name = requiredText(body?.name, 70, 'Nama karyawan');
    const username = body?.username;
    const password = body?.password;
    if (typeof username !== 'string' || !usernameRule.test(username)) fail(400, 'Gunakan 3–40 huruf, angka, titik, garis bawah, atau tanda hubung untuk nama pengguna.');
    if ((passwordRequired || password) && (typeof password !== 'string' || password.length < 12 || password.length > 128)) {
      fail(400, 'Kata sandi harus berisi 12–128 karakter.');
    }
    return { name, username, password, active: body.active === false ? 0 : 1 };
  }

  app.post('/api/owner/employees', owner, (req, res) => {
    const { name, username, password, active } = staffFields(req.body, true);
    if (statement('SELECT id FROM users WHERE username = ?').get(username)) fail(409, 'Nama pengguna sudah digunakan.');
    const { lastInsertRowid } = statement("INSERT INTO users (name,username,password_hash,role,active) VALUES (?,?,?,'employee',?)")
      .run(name, username, hashPassword(password), active);
    res.status(201).json({ id: lastInsertRowid });
  });

  app.put('/api/owner/employees/:id', owner, (req, res) => {
    const user = statement("SELECT * FROM users WHERE id = ? AND role = 'employee'").get(req.params.id);
    if (!user) fail(404, 'Karyawan tidak ditemukan.');
    const { name, username, password, active } = staffFields(req.body, false);
    if (statement('SELECT id FROM users WHERE username = ? AND id != ?').get(username, user.id)) fail(409, 'Nama pengguna sudah digunakan.');
    transaction(db, () => {
      statement('UPDATE users SET name=?,username=?,password_hash=?,active=? WHERE id=?')
        .run(name, username, password ? hashPassword(password) : user.password_hash, active, user.id);
      if (!active || password) statement('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    });
    res.json({ ok: true });
  });

  app.get('/api/owner/settings', owner, (req, res) => {
    const settings = store();
    res.json({
      name: settings.name, outlet: settings.outlet, latitude: settings.latitude, longitude: settings.longitude,
      radius: settings.radius, staticQris: settings.static_qris ?? '', dynamic: demo ? 'demo' : gateway?.production ? 'live' : gateway ? 'sandbox' : 'off',
    });
  });

  app.put('/api/owner/settings', owner, (req, res) => {
    const { latitude, longitude, radius, staticQris } = req.body ?? {};
    const name = requiredText(req.body?.name, 70, 'Nama usaha');
    const outlet = requiredText(req.body?.outlet, 70, 'Nama outlet');
    if ((latitude != null || longitude != null) && (!coordinate(latitude, 90) || !coordinate(longitude, 180))) {
      fail(400, 'Isi kedua koordinat outlet dengan angka yang valid.');
    }
    if (!Number.isSafeInteger(radius) || radius < 25 || radius > 5000) fail(400, 'Radius harus antara 25 dan 5.000 meter.');
    if (staticQris && !validStaticQris(staticQris)) fail(400, 'Kode QRIS statis tidak valid. Gunakan QRIS merchant resmi dalam rupiah.');
    statement('UPDATE store SET name=?,outlet=?,latitude=?,longitude=?,radius=?,static_qris=? WHERE id=1')
      .run(name, outlet, latitude ?? null, longitude ?? null, radius, staticQris || null);
    res.json(sessionInfo(req.user));
  });

  function settle(sale, providerStatus, date = new Date()) {
    const timestamp = date.toISOString();
    const updated = statement(`
      UPDATE sales SET status='paid', provider_status=?, paid_at=?, paid_day=?
      WHERE id=? AND status='pending'
    `).run(providerStatus, timestamp, localDay(date), sale.id);
    if (updated.changes) {
      const title = sale.method === 'cash' ? 'Penjualan tunai tercatat'
        : sale.provider === 'merchant' ? 'QRIS statis dikonfirmasi kasir'
        : sale.provider === 'demo' ? 'Pembayaran QRIS demo tercatat' : 'Pembayaran QRIS diterima';
      const cashier = statement('SELECT name FROM users WHERE id = ?').get(sale.employee_id);
      addNotice(db, 'sale', title, cashier.name + ' • ' + rupiah(sale.amount));
    }
  }

  function updateFromGateway(sale, data) {
    if (!data || data.order_id !== sale.id || Number(data.gross_amount) !== sale.amount
      || data.payment_type !== 'qris' || (data.currency && data.currency !== 'IDR')) return;
    const status = data.transaction_status;
    const qr = gateway.qr(data);
    transaction(db, () => {
      statement(`
        UPDATE sales SET provider_status=?, qr_value=COALESCE(?,qr_value), qr_url=COALESCE(?,qr_url)
        WHERE id=? AND status='pending'
      `).run(status || null, qr.value, qr.url, sale.id);
      if (status === 'settlement' || (status === 'capture' && data.fraud_status === 'accept')) {
        const serverTime = /^[0-9-]{10} [0-9:]{8}$/.test(data.settlement_time ?? '')
          ? Date.parse(data.settlement_time.replace(' ', 'T') + '+07:00') : NaN;
        const paidTime = serverTime >= Date.parse(sale.created_at) - 60000 && serverTime <= Date.now() + 60000
          ? new Date(serverTime) : new Date();
        settle(sale, status, paidTime);
      } else if (['deny', 'cancel', 'expire', 'failure'].includes(status)) {
        statement("UPDATE sales SET status = 'failed' WHERE id = ? AND status = 'pending'").run(sale.id);
      }
    });
  }

  async function charge(sale) {
    if (!checkoutJobs.has(sale.id)) {
      const job = (async () => {
        try {
          const data = await gateway.charge(sale.id, sale.amount);
          updateFromGateway(sale, data);
        } catch (error) {
          if (!(error instanceof GatewayError)) throw error;
          updateFromGateway(sale, await gateway.status(sale.id));
        }
        const saved = saleById(sale.id);
        if (saved.status === 'pending' && !saved.qr_value && !saved.qr_url) throw new GatewayError();
      })().finally(() => checkoutJobs.delete(sale.id));
      checkoutJobs.set(sale.id, job);
    }
    await checkoutJobs.get(sale.id);
  }

  function checkoutItems(value) {
    if (!Array.isArray(value) || value.length < 1 || value.length > 30) fail(400, 'Keranjang belum valid.');
    const ids = new Set();
    return value.map(item => {
      if (!Number.isSafeInteger(item?.id) || !Number.isSafeInteger(item.quantity)
          || item.quantity < 1 || item.quantity > 99 || ids.has(item.id)) fail(400, 'Jumlah atau produk belum valid.');
      ids.add(item.id);
      return { id: item.id, quantity: item.quantity };
    }).sort((a, b) => a.id - b.id);
  }

  app.get('/api/sales', employee, (req, res) => {
    const rows = statement(saleJoin + 'WHERE s.employee_id = ? ORDER BY created_at DESC LIMIT 20').all(req.user.id);
    res.json({ rows: rows.map(publicSale) });
  });

  app.post('/api/sales', employee, async (req, res) => {
    const { method, requestId, cashReceived } = req.body ?? {};
    if (!methods.includes(method) || typeof requestId !== 'string' || !/^[a-z0-9-]{16,64}$/i.test(requestId)) {
      fail(400, 'Pilih metode pembayaran yang valid.');
    }
    const order = checkoutItems(req.body.items);
    const sale = transaction(db, () => {
      const saved = statement('SELECT * FROM sales WHERE employee_id = ? AND request_id = ?').get(req.user.id, requestId);
      if (saved) {
        const items = JSON.parse(saved.items).map(({ id, quantity }) => ({ id, quantity }));
        if (saved.method !== method || JSON.stringify(order) !== JSON.stringify(items)
          || (method === 'cash' && saved.cash_received !== cashReceived)) fail(409, 'Percobaan pembayaran ini sudah dipakai.');
        return saved;
      }
      const settings = store();
      if (method === 'qris_static' && !demo && !settings.static_qris) fail(409, 'QRIS statis belum diatur oleh pemilik.');
      if (method === 'qris_dynamic' && !demo && !gateway) fail(409, 'Payment gateway QRIS dinamis belum diatur.');
      const items = order.map(({ id, quantity }) => {
        const product = statement('SELECT id,name,price FROM products WHERE id=? AND active=1').get(id);
        if (!product) fail(409, 'Salah satu produk sudah tidak tersedia. Muat ulang katalog.');
        return { ...product, quantity };
      });
      const amount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      if (amount > 100000000) fail(400, 'Total transaksi melebihi Rp100.000.000.');
      if (method === 'cash' && (!Number.isSafeInteger(cashReceived) || cashReceived < amount || cashReceived > 1000000000)) {
        fail(400, 'Uang diterima harus mencukupi total transaksi.');
      }
      const id = 'KL-' + randomBytes(6).toString('hex').toUpperCase();
      const provider = method === 'cash' ? 'cashier'
        : method === 'qris_static' ? settings.static_qris ? 'merchant' : 'demo'
        : gateway ? 'midtrans' : 'demo';
      const qr = method === 'qris_static' && settings.static_qris ? settings.static_qris
        : method !== 'cash' && provider === 'demo' ? 'KELOLA DEMO • ' + id : null;
      const timestamp = new Date().toISOString();
      statement(`
        INSERT INTO sales (id,request_id,employee_id,method,status,provider,items,amount,cash_received,qr_value,created_at)
        VALUES (?,?,?,?,'pending',?,?,?,?,?,?)
      `).run(id, requestId, req.user.id, method, provider, JSON.stringify(items), amount,
        method === 'cash' ? cashReceived : null, qr, timestamp);
      const result = saleById(id);
      if (method === 'cash') settle(result, 'cash_received');
      return saleById(id);
    });
    if (sale.provider === 'midtrans' && sale.status === 'pending' && !sale.qr_value && !sale.qr_url) {
      try {
        await charge(sale);
      } catch (error) {
        if (!(error instanceof GatewayError)) throw error;
        return res.status(202).json({ ...publicSale(saleById(sale.id)), paymentCheckUnavailable: true });
      }
    }
    res.status(201).json(publicSale(saleById(sale.id)));
  });

  function employeeSale(req) {
    const sale = saleById(req.params.id);
    if (!sale || sale.employee_id !== req.user.id) fail(404, 'Transaksi tidak ditemukan.');
    return sale;
  }

  app.get('/api/sales/:id', employee, async (req, res) => {
    const sale = employeeSale(req);
    if (sale.provider === 'midtrans' && sale.status === 'pending' && gateway) {
      try {
        updateFromGateway(sale, await gateway.status(sale.id));
      } catch (error) {
        if (!(error instanceof GatewayError)) throw error;
        return res.json({ ...publicSale(sale), paymentCheckUnavailable: true });
      }
    }
    res.json(publicSale(saleById(sale.id)));
  });

  app.post('/api/sales/:id/retry', employee, async (req, res) => {
    const sale = employeeSale(req);
    if (sale.provider !== 'midtrans' || !gateway) fail(409, 'Percobaan ulang tidak tersedia untuk transaksi ini.');
    if (sale.status === 'pending' && !sale.qr_value && !sale.qr_url) {
      try {
        await charge(sale);
      } catch (error) {
        if (!(error instanceof GatewayError)) throw error;
        return res.status(202).json({ ...publicSale(saleById(sale.id)), paymentCheckUnavailable: true });
      }
    }
    res.json(publicSale(saleById(sale.id)));
  });

  app.get('/api/sales/:id/qr', employee, async (req, res) => {
    const sale = employeeSale(req);
    if (sale.status !== 'pending') fail(404, 'QR tidak tersedia.');
    if (sale.qr_value) {
      const png = await QRCode.toBuffer(sale.qr_value, { width: 300, margin: 3, errorCorrectionLevel: 'M' });
      return res.type('png').send(png);
    }
    if (sale.qr_url && gateway) {
      const result = await gateway.image(sale.qr_url);
      if (result) return res.type(result.type).send(result.image);
      fail(503, 'Gambar dari payment gateway sedang tidak tersedia.');
    }
    fail(404, 'QR belum tersedia.');
  });

  app.post('/api/sales/:id/confirm', employee, (req, res) => {
    const sale = employeeSale(req);
    if (sale.method === 'cash' || sale.provider === 'midtrans' || (sale.provider === 'demo' && !demo)) {
      fail(403, 'Status transaksi ini ditetapkan oleh metode pembayaran.');
    }
    if (sale.status === 'failed') fail(409, 'Transaksi sudah berakhir.');
    transaction(db, () => settle(sale, sale.provider === 'demo' ? 'demo_settlement' : 'merchant_confirmed'));
    res.json(publicSale(saleById(sale.id)));
  });

  app.post('/api/payments/midtrans/notification', async (req, res) => {
    if (!gateway) fail(404, 'Payment gateway belum diatur.');
    if (!gateway.verifies(req.body ?? {})) fail(401, 'Tanda tangan notifikasi tidak valid.');
    const sale = saleById(req.body.order_id);
    if (sale?.provider === 'midtrans' && sale.method === 'qris_dynamic' && sale.status === 'pending') {
      let data;
      try {
        data = await gateway.status(sale.id);
      } catch (error) {
        if (!(error instanceof GatewayError)) throw error;
        fail(503, 'Status gateway belum dapat diverifikasi.');
      }
      if (!data) fail(503, 'Status gateway belum dapat diverifikasi.');
      updateFromGateway(sale, data);
    }
    res.json({ ok: true });
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Halaman API tidak ditemukan.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof RequestError) return res.status(error.status).json({ error: error.message });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Ukuran selfie terlalu besar.' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Permintaan JSON tidak valid.' });
    console.error(error);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server. Coba kembali.' });
  });

  return app;
}
