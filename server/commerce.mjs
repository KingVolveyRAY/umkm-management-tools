import { dayParam, fail, requiredText } from './request.mjs';

export function checkoutItems(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) fail(400, 'Keranjang belum valid.');
  const ids = new Set();
  return value.map(item => {
    if (!Number.isSafeInteger(item?.id) || item.id < 1 || item.id > 2147483647 || !Number.isSafeInteger(item.quantity)
        || item.quantity < 1 || item.quantity > 99 || ids.has(item.id)) fail(400, 'Jumlah atau produk belum valid.');
    ids.add(item.id);
    return { id: item.id, quantity: item.quantity };
  }).sort((a, b) => a.id - b.id);
}

export async function priceOrder(connection, outletId, order, timestamp) {
  const ids = order.map(({ id }) => id);
  const products = await connection.all(`
    SELECT id,name,price,cost_components,cost_total FROM products
    WHERE outlet_id = ? AND active = 1 AND id IN (${ids.map(() => '?').join(',')})
  `, [outletId, ...ids]);
  let hpp = 0;
  let hppKnown = true;
  const items = order.map(({ id, quantity }) => {
    const product = products.find(row => row.id === id);
    if (!product) fail(409, 'Salah satu produk sudah tidak tersedia. Muat ulang katalog.');
    if (!JSON.parse(product.cost_components).length) hppKnown = false;
    hpp += product.cost_total * quantity;
    return { id, name: product.name, price: product.price, quantity };
  });
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (subtotal > 100000000) fail(400, 'Total transaksi melebihi Rp100.000.000.');
  const active = await connection.all(`
    SELECT id,name,discount_type,value FROM promotions
    WHERE outlet_id = ? AND active = 1 AND starts_at <= ? AND ends_at > ? ORDER BY starts_at,id
  `, [outletId, timestamp, timestamp]);
  let promo = null;
  let discount = 0;
  for (const row of active) {
    const reduction = Math.min(subtotal, row.discount_type === 'percent' ? Math.floor(subtotal * row.value / 100) : row.value);
    if (reduction > discount) {
      promo = { id: row.id, name: row.name };
      discount = reduction;
    }
  }
  return { items, subtotal, discount, promo, amount: subtotal - discount, hpp: hppKnown ? hpp : null };
}

export function customerFields(body) {
  const name = requiredText(body?.name, 70, 'Nama pelanggan').replace(/\s+/g, ' ');
  const entered = body?.phone;
  if (entered == null) return { name, phone: null };
  if (typeof entered !== 'string' || entered.length > 35) fail(400, 'Nomor telepon pelanggan belum valid.');
  if (!entered.trim()) return { name, phone: null };
  const compact = entered.trim().replace(/[\s().-]/g, '');
  if (!/^\+?\d{7,15}$/.test(compact)) fail(400, 'Nomor telepon pelanggan harus berisi 7–15 angka.');
  const phone = compact.startsWith('0') ? '+62' + compact.slice(1) : compact.startsWith('+') ? compact : '+' + compact;
  if (phone.length > 16) fail(400, 'Nomor telepon pelanggan belum valid.');
  return { name, phone };
}

export async function rememberCustomer(tx, outletId, { name, phone }, timestamp, saleId) {
  const key = phone ? 'tel:' + phone : 'sale:' + saleId;
  return tx.get(`
    INSERT INTO customers (outlet_id,name,phone,contact_key,created_at) VALUES (?,?,?,?,?)
    ON CONFLICT (outlet_id,contact_key) DO UPDATE SET name = excluded.name RETURNING id
  `, [outletId, name, phone, key, timestamp]);
}

function timeInWib(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    fail(400, 'Tanggal dan jam promo dalam WIB belum valid.');
  }
  dayParam(value.slice(0, 10));
  return new Date(value + ':00+07:00').toISOString();
}

export function promotionFields(body) {
  const name = requiredText(body?.name, 70, 'Nama promo');
  const type = body?.type;
  const value = body?.value;
  if (!['percent', 'fixed'].includes(type)) fail(400, 'Pilih jenis potongan promo.');
  if (!Number.isSafeInteger(value) || value < 1 || value > (type === 'percent' ? 100 : 100000000)) {
    fail(400, type === 'percent' ? 'Persentase promo harus antara 1 dan 100.' : 'Potongan harus antara Rp1 dan Rp100 juta.');
  }
  const start = timeInWib(body.startsAt);
  const end = timeInWib(body.endsAt);
  if (start >= end) fail(400, 'Waktu berakhir harus setelah waktu mulai.');
  return [name, type, value, start, end, body.active === false ? 0 : 1];
}

export function publicPromotion(row, now) {
  const status = !row.active ? 'inactive' : row.starts_at > now ? 'upcoming' : row.ends_at <= now ? 'ended' : 'active';
  return { id: row.id, name: row.name, type: row.discount_type, value: row.value,
    startsAt: row.starts_at, endsAt: row.ends_at, active: Boolean(row.active), status };
}
