import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const timezone = 'Asia/Jakarta';
const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
});

export function localDay(date = new Date()) {
  return dayFormat.format(date);
}

export function shiftDay(day, offset) {
  const date = new Date(day + 'T12:00:00+07:00');
  date.setUTCDate(date.getUTCDate() + offset);
  return localDay(date);
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}

export function matchesPassword(password, stored) {
  const [salt, digest] = stored.split(':');
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(digest, 'hex'));
}

export function transaction(db, action) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = action();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function addNotice(db, kind, title, detail, timestamp = new Date().toISOString()) {
  db.prepare('INSERT INTO notices (kind,title,detail,created_at) VALUES (?,?,?,?)')
    .run(kind, title, detail, timestamp);
}

export function openStore(path, { demo, ownerUsername, ownerPassword }) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS store (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL, outlet TEXT NOT NULL, latitude REAL, longitude REAL,
      radius INTEGER NOT NULL DEFAULT 150, static_qris TEXT,
      mode TEXT NOT NULL CHECK (mode IN ('demo','live'))
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner','employee')),
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
      price INTEGER NOT NULL CHECK (price > 0), active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY, request_id TEXT NOT NULL, employee_id INTEGER NOT NULL REFERENCES users(id),
      method TEXT NOT NULL CHECK (method IN ('cash','qris_static','qris_dynamic')),
      status TEXT NOT NULL CHECK (status IN ('pending','paid','failed')),
      provider TEXT NOT NULL, items TEXT NOT NULL, amount INTEGER NOT NULL CHECK (amount > 0),
      cash_received INTEGER, qr_value TEXT, qr_url TEXT, provider_status TEXT,
      created_at TEXT NOT NULL, paid_at TEXT, paid_day TEXT,
      UNIQUE (employee_id, request_id)
    );
    CREATE INDEX IF NOT EXISTS sales_paid_day ON sales (paid_day,status);
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY, employee_id INTEGER NOT NULL REFERENCES users(id),
      kind TEXT NOT NULL CHECK (kind IN ('in','out')), day TEXT NOT NULL,
      timestamp TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL,
      accuracy REAL NOT NULL, distance INTEGER NOT NULL,
      venue_status TEXT NOT NULL CHECK (venue_status IN ('onsite','uncertain','outside')),
      photo BLOB, UNIQUE (employee_id,day,kind)
    );
    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL,
      created_at TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0
    );
  `);
  const existing = db.prepare('SELECT mode FROM store WHERE id = 1').get();
  if (existing && existing.mode !== (demo ? 'demo' : 'live')) {
    db.close();
    throw new Error('Gunakan DB_PATH yang berbeda untuk basis data demo dan operasional.');
  }
  if (!existing) {
    if (!demo && (!/^[a-z0-9._-]{3,40}$/i.test(ownerUsername ?? '') || (ownerPassword ?? '').length < 12 || ownerPassword.length > 128)) {
      db.close();
      throw new Error('Inisialisasi operasional membutuhkan OWNER_USERNAME dan OWNER_PASSWORD (12–128 karakter).');
    }
    transaction(db, () => {
      if (demo) seedDemo(db);
      else {
        db.prepare('INSERT INTO store (id,name,outlet,mode) VALUES (1,?,?,?)')
          .run('Usaha saya', 'Outlet utama', 'live');
        db.prepare('INSERT INTO users (name,username,password_hash,role) VALUES (?,?,?,?)')
          .run('Pemilik', ownerUsername, hashPassword(ownerPassword), 'owner');
      }
    });
  }
  return db;
}

const menu = [
  ['Kopi Susu Gula Aren', 'Kopi', 28000],
  ['Americano', 'Kopi', 22000],
  ['Cappuccino', 'Kopi', 30000],
  ['Oat Latte', 'Kopi', 36000],
  ['Matcha Latte', 'Non-kopi', 32000],
  ['Cokelat Dingin', 'Non-kopi', 29000],
  ['Butter Croissant', 'Makanan', 26000],
  ['Banana Bread', 'Makanan', 24000],
  ['Es Teh Lemon', 'Non-kopi', 23000],
  ['Kopi Manual Brew', 'Kopi', 34000],
  ['Cookies Cokelat', 'Makanan', 19000],
  ['Paket Seduh Kopi', 'Kopi', 85000],
];

function seedDemo(db) {
  db.prepare('INSERT INTO store (id,name,outlet,latitude,longitude,radius,mode) VALUES (1,?,?,?,?,?,?)')
    .run('Kopi Sudut', 'Jakarta Selatan', -6.2608, 106.8106, 150, 'demo');
  const insertUser = db.prepare('INSERT INTO users (id,name,username,password_hash,role) VALUES (?,?,?,?,?)');
  const demoPassword = hashPassword(randomBytes(24).toString('hex'));
  const names = ['Raka Pratama', 'Naya Putri', 'Dimas Saputra', 'Alya Rahman', 'Fajar Wirawan'];
  names.forEach((name, index) => {
    insertUser.run(index + 1, name, name.split(' ')[0].toLowerCase(), demoPassword, index ? 'employee' : 'owner');
  });
  const insertProduct = db.prepare('INSERT INTO products (name,category,price) VALUES (?,?,?)');
  for (const product of menu) insertProduct.run(...product);

  const insertSale = db.prepare(`
    INSERT INTO sales (id,request_id,employee_id,method,status,provider,items,amount,created_at,paid_at,paid_day)
    VALUES (?,?,?,?,'paid','demo',?,?,?,?,?)
  `);
  const today = localDay();
  const counts = [16, 21, 19, 26, 22, 30, 27];
  for (let offset = -29; offset <= 0; offset += 1) {
    const day = shiftDay(today, offset);
    const count = counts[(offset + 35) % 7] + (offset === 0 ? 14 : 0);
    for (let index = 0; index < count; index += 1) {
      const cashier = 3 + index % 3;
      const first = (index + 30 + offset) % menu.length;
      const second = (index * 3 + 2) % menu.length;
      const items = [
        { id: first + 1, name: menu[first][0], price: menu[first][2], quantity: 1 + index % 2 },
        { id: second + 1, name: menu[second][0], price: menu[second][2], quantity: 1 },
      ];
      const amount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const clock = offset === 0
        ? new Date(Math.max(Date.parse(day + 'T00:00:00+07:00'), Date.now() - (count - index) * 4 * 60000)).toISOString()
        : new Date(Date.parse(day + 'T08:00:00+07:00') + index * 15 * 60000).toISOString();
      const id = 'KL-' + day.slice(5).replace('-', '') + String(index + 1).padStart(3, '0');
      insertSale.run(id, id, cashier, ['cash', 'qris_dynamic', 'qris_static'][index % 3],
        JSON.stringify(items), amount, clock, clock, day);
    }
  }

  const insertAttendance = db.prepare(`
    INSERT INTO attendance (employee_id,kind,day,timestamp,latitude,longitude,accuracy,distance,venue_status)
    VALUES (?,'in',?,?,?,?,?,?,'onsite')
  `);
  [3, 4, 5].forEach((id, index) => {
    const timestamp = new Date(Math.min(Date.parse(today + 'T07:45:00+07:00') + index * 6 * 60000, Date.now() - 1000)).toISOString();
    insertAttendance.run(id, today, timestamp, -6.2608, 106.81062, 14 + index * 3, 2);
  });
  const lastSale = db.prepare('SELECT * FROM sales WHERE paid_day = ? ORDER BY paid_at DESC LIMIT 3').all(today);
  addNotice(db, 'sale', 'Pembayaran QRIS diterima', 'Transaksi kasir • Rp' + lastSale[0].amount.toLocaleString('id-ID'), lastSale[0].paid_at);
  addNotice(db, 'attendance', 'Alya Rahman absen masuk', 'Di area outlet', new Date(Date.now() - 26 * 60000).toISOString());
  addNotice(db, 'sale', 'Penjualan tunai tercatat', 'Transaksi kasir • Rp' + lastSale[1].amount.toLocaleString('id-ID'), new Date(Date.now() - 52 * 60000).toISOString());
  addNotice(db, 'attendance', 'Dimas Saputra absen masuk', 'Di area outlet', new Date(Date.now() - 82 * 60000).toISOString());
}

export function venueLocation(store, latitude, longitude, accuracy) {
  const rad = Math.PI / 180;
  const north = (latitude - store.latitude) * rad;
  const east = (longitude - store.longitude) * rad;
  const haversine = Math.sin(north / 2) ** 2
    + Math.cos(store.latitude * rad) * Math.cos(latitude * rad) * Math.sin(east / 2) ** 2;
  const meters = 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
  const venue_status = meters + accuracy <= store.radius ? 'onsite'
    : meters - accuracy > store.radius ? 'outside' : 'uncertain';
  return { distance: Math.round(meters), venue_status };
}
