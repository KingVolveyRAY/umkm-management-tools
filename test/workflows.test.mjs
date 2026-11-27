import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import ExcelJS from 'exceljs';
import jpeg from 'jpeg-js';
import { createApp } from '../server/app.mjs';
import { midtransGateway, validStaticQris } from '../server/qris.mjs';
import { databaseSchema, initialRows, localDay, openStore } from '../server/store.mjs';

async function serve(t, { demo = true, gateway, db = openStore(':memory:', { demo }) } = {}) {
  const server = createApp(db, { demo, gateway }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
  });
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  return function client() {
    let cookie = '';
    return async (path, body, method = body === undefined ? 'GET' : 'POST') => {
      const response = await fetch(base + path, {
        method,
        headers: { Cookie: cookie, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const session = response.headers.get('set-cookie');
      if (session) cookie = session.split(';')[0];
      const type = response.headers.get('content-type') ?? '';
      const data = type.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer());
      return { status: response.status, type, data };
    };
  };
}

const basket = [{ id: 1, quantity: 2 }];
const staticPayload = '00020101021126160012ID.TEST.QRIS5204581253033605802ID5910KOPI SUDUT6007JAKARTA630444B6';

async function challengeProof(staff, kind) {
  const { status, data } = await staff('/attendance/challenge', { kind });
  assert.equal(status, 201);
  return { id: data.id, steps: data.steps.map((action, index) => ({ action, elapsed: 300 * (index + 1) })) };
}

test('cash, static QRIS, and simulated dynamic QRIS update owner reports once each', async t => {
  const client = await serve(t);
  const owner = client();
  const cashier = client();
  assert.equal((await owner('/owner/overview')).status, 401);
  assert.equal((await owner('/demo', { role: 'owner' })).status, 200);
  assert.equal((await cashier('/demo', { role: 'employee' })).status, 200);
  assert.equal((await cashier('/owner/overview')).status, 403);
  const baseline = (await owner('/owner/overview')).data.current;

  const cash = { method: 'cash', requestId: randomUUID(), items: basket, cashReceived: 60000 };
  const [first, simultaneous] = await Promise.all([cashier('/sales', cash), cashier('/sales', cash)]);
  assert.equal(first.status, 201);
  assert.equal(first.data.status, 'paid');
  assert.equal(first.data.amount, 56000);
  assert.equal(simultaneous.status, 201);
  assert.equal(simultaneous.data.id, first.data.id);
  assert.equal((await cashier('/sales', cash)).data.id, first.data.id);
  assert.equal((await cashier('/sales', { ...cash, cashReceived: 70000 })).status, 409);
  assert.equal((await owner('/sales', cash)).status, 403);

  assert.equal(validStaticQris(staticPayload), true);
  assert.equal(validStaticQris(staticPayload.slice(0, -1) + '9'), false);
  const settings = (await owner('/owner/settings')).data;
  assert.equal((await owner('/owner/settings', { ...settings, staticQris: 'invalid' }, 'PUT')).status, 400);
  assert.equal((await owner('/owner/settings', { ...settings, staticQris: staticPayload }, 'PUT')).status, 200);
  for (const [method, provider] of [['qris_static', 'merchant'], ['qris_dynamic', 'demo']]) {
    const result = await cashier('/sales', { method, requestId: randomUUID(), items: basket });
    const order = result.data;
    assert.equal(result.status, 201);
    assert.equal(order.status, 'pending');
    assert.equal(order.provider, provider);
    const qr = await cashier('/sales/' + order.id + '/qr');
    assert.equal(qr.type, 'image/png');
    assert.equal(qr.data.subarray(1, 4).toString('ascii'), 'PNG');
    assert.equal((await cashier('/sales/' + order.id + '/confirm', {})).data.status, 'paid');
    assert.equal((await cashier('/sales/' + order.id + '/confirm', {})).data.status, 'paid');
  }

  const summary = (await owner('/owner/overview')).data.current;
  assert.equal(summary.revenue - baseline.revenue, 168000);
  assert.equal(summary.count - baseline.count, 3);
  const notices = (await owner('/owner/notices')).data;
  assert.equal(notices.count, 7);
  assert.ok(notices.rows.some(row => row.title === 'QRIS statis dikonfirmasi kasir'));
  const sales = await owner('/owner/sales?format=csv&method=qris_dynamic');
  assert.match(sales.type, /text\/csv/);
  assert.match(sales.data.toString(), /qris_dynamic/);
  assert.doesNotMatch(sales.data.toString(), /qris_static/);
});

test('operational payment uses the gateway for settlement and verifies signed notifications', async t => {
  const demo = false;
  const db = openStore(':memory:', { demo, ownerUsername: 'pemilik', ownerPassword: 'example-only-owner-password' });
  const key = 'test-signing-key';
  const origin = 'https://api.sandbox.midtrans.com';
  let amount;
  let orderId;
  let providerStatus = 'pending';
  let paidAmount;
  const gateway = midtransGateway(key, false, async (url, options) => {
    assert.equal(options.headers.Authorization, 'Basic ' + Buffer.from(key + ':').toString('base64'));
    if (url === origin + '/v2/charge') {
      const body = JSON.parse(options.body);
      assert.equal(body.payment_type, 'qris');
      assert.equal(body.qris.acquirer, 'gopay');
      ({ gross_amount: amount, order_id: orderId } = body.transaction_details);
      paidAmount = amount;
      return Response.json({
        status_code: '201', order_id: orderId, gross_amount: amount + '.00', currency: 'IDR',
        payment_type: 'qris', transaction_status: 'pending',
        actions: [
          { name: 'generate-qr-code-v2', url: 'https://example.invalid/v4/qris/not-trusted/qr-code' },
          { name: 'generate-qr-code', url: origin + '/v2/qris/verified-transaction/qr-code' },
        ],
      });
    }
    assert.equal(url, origin + '/v2/' + orderId + '/status');
    return Response.json({
      status_code: '200', order_id: orderId, gross_amount: paidAmount + '.00', currency: 'IDR',
      payment_type: 'qris', transaction_status: providerStatus,
    });
  });
  assert.equal(gateway.qr({
    transaction_id: 'verified-transaction', transaction_status: 'pending',
  }).url, origin + '/v2/qris/verified-transaction/qr-code');
  assert.equal(gateway.qr({
    actions: [{ name: 'generate-qr-code-v2', url: origin + '/v4/qris/new-format/qr-code' }],
  }).url, origin + '/v4/qris/new-format/qr-code');
  const client = await serve(t, { demo, gateway, db });
  const owner = client();
  const cashier = client();
  assert.equal((await owner('/demo', { role: 'owner' })).status, 404);
  assert.equal((await owner('/login', { username: 'pemilik', password: 'example-only-owner-password' })).status, 200);
  assert.equal((await owner('/owner/employees', { name: 'Kasir Satu', username: 'kasir1', password: 'example-only-staff-password' })).status, 201);
  assert.equal((await owner('/owner/products', { name: 'Kopi', category: 'Minuman', price: 12000 })).status, 201);
  assert.equal((await cashier('/login', { username: 'kasir1', password: 'example-only-staff-password' })).status, 200);
  const order = (await cashier('/sales', { method: 'qris_dynamic', requestId: randomUUID(), items: basket })).data;
  assert.equal(order.status, 'pending');
  assert.equal(order.qr, true);
  assert.equal(amount, 24000);
  assert.equal((await cashier('/sales/' + order.id + '/confirm', {})).status, 403);

  const webhook = { order_id: order.id, status_code: '200', gross_amount: amount + '.00', transaction_status: 'settlement' };
  assert.equal((await client()('/payments/midtrans/notification', webhook)).status, 401);
  webhook.signature_key = createHash('sha512').update(order.id + webhook.status_code + webhook.gross_amount + key).digest('hex');
  assert.equal((await client()('/payments/midtrans/notification', webhook)).status, 200);
  assert.equal((await cashier('/sales/' + order.id)).data.status, 'pending');
  providerStatus = 'settlement';
  paidAmount = 1;
  assert.equal((await client()('/payments/midtrans/notification', webhook)).status, 200);
  assert.equal((await cashier('/sales/' + order.id)).data.status, 'pending');
  paidAmount = amount;
  assert.equal((await client()('/payments/midtrans/notification', webhook)).status, 200);
  assert.equal((await client()('/payments/midtrans/notification', webhook)).status, 200);
  assert.equal((await cashier('/sales/' + order.id)).data.status, 'paid');
  assert.equal((await owner('/owner/notices')).data.count, 1);
});

test('attendance requires a selfie and one-use liveness challenge, and preserves the GPS result', async t => {
  const client = await serve(t);
  const owner = client();
  const staff = client();
  await owner('/demo', { role: 'owner' });
  await staff('/demo', { role: 'employee' });
  const location = { latitude: -6.2, longitude: 106.81, accuracy: 12 };
  assert.equal((await staff('/attendance', { ...location, kind: 'in' })).status, 400);
  const image = jpeg.encode({ data: Buffer.alloc(16 * 16 * 4, 255), width: 16, height: 16 }, 80).data;
  const selfie = 'data:image/jpeg;base64,' + image.toString('base64');
  assert.equal((await staff('/attendance', { ...location, selfie, kind: 'in' })).status, 400);
  const departure = await challengeProof(staff, 'out');
  assert.equal((await staff('/attendance', { ...location, selfie, kind: 'out', proof: departure })).status, 409);
  const proof = await challengeProof(staff, 'in');
  assert.equal((await staff('/attendance', { ...location, selfie, kind: 'in', proof: {
    id: proof.id, steps: [...proof.steps].reverse(),
  } })).status, 409);
  const result = await staff('/attendance', { ...location, selfie, kind: 'in', proof });
  assert.equal(result.status, 201);
  const entered = result.data.rows[0];
  assert.equal(entered.venueStatus, 'outside');
  assert.ok(entered.distance > 5000);
  assert.ok(entered.hasPhoto);
  assert.equal(entered.livenessVerified, 1);
  assert.equal((await staff('/attendance', { ...location, selfie, kind: 'in', proof })).status, 409);
  const checkOut = await staff('/attendance', { latitude: -6.2608, longitude: 106.8106, accuracy: 155, selfie, kind: 'out', proof: departure });
  assert.ok(checkOut.data.rows.some(row => row.kind === 'out' && row.venueStatus === 'uncertain'));
  const list = await owner('/owner/attendance?day=' + localDay());
  assert.equal(list.status, 200);
  assert.ok(list.data.rows.some(row => row.id === entered.id && row.name === 'Naya Putri'));
  assert.deepEqual((await owner('/attendance/' + entered.id + '/photo')).data, image);
  assert.equal((await client()('/attendance/' + entered.id + '/photo')).status, 401);
});

test('owners can manage another outlet and export scoped sales, and staff stay in their assigned outlet', async t => {
  const client = await serve(t);
  const owner = client();
  const staff = client();
  await owner('/demo', { role: 'owner' });
  const baseline = (await owner('/owner/overview')).data.current;
  const created = await owner('/owner/outlets', { name: 'Nasi Goreng Nusantara', outlet: 'Cikini' });
  assert.equal(created.status, 201);
  const outletId = created.data.store.id;
  assert.equal(created.data.outlets.length, 2);
  const scope = '?outletId=' + outletId;
  assert.equal((await owner('/owner/overview' + scope)).data.current.revenue, 0);

  const product = {
    name: 'Nasi Goreng Ayam', category: 'Makanan', price: 25000,
    costComponents: [{ name: 'Beras', amount: 3500 }, { name: 'Ayam', amount: 5000 }],
  };
  const added = await owner('/owner/products' + scope, product);
  assert.equal(added.status, 201);
  const productId = added.data.id;
  assert.equal((await owner('/products' + scope)).data.rows[0].costTotal, 8500);
  assert.equal((await owner('/owner/products/' + productId, product, 'PUT')).status, 404);
  assert.equal((await owner('/owner/products/' + productId + scope, { ...product, costComponents: undefined }, 'PUT')).status, 200);
  assert.equal((await owner('/products' + scope)).data.rows[0].costTotal, 8500);

  const account = await owner('/owner/employees' + scope, {
    name: 'Kasir Cikini', username: 'kasir-cikini', password: 'kasir-demo-123456',
  });
  assert.equal(account.status, 201);
  assert.equal((await staff('/login', { username: 'kasir-cikini', password: 'kasir-demo-123456' })).data.store.id, outletId);
  const catalog = await staff('/products?outletId=1');
  assert.equal(catalog.data.rows.length, 1);
  assert.equal(catalog.data.rows[0].id, productId);
  assert.equal('costTotal' in catalog.data.rows[0], false);
  const checkout = { method: 'cash', requestId: randomUUID(), items: basket, cashReceived: 55000 };
  assert.equal((await staff('/sales', checkout)).status, 409);
  const sale = await staff('/sales', { ...checkout, items: [{ id: productId, quantity: 2 }] });
  assert.equal(sale.data.status, 'paid');
  assert.equal(sale.data.amount, 50000);
  assert.deepEqual((await owner('/owner/overview')).data.current, baseline);
  assert.equal((await owner('/owner/overview' + scope)).data.current.revenue, 50000);
  assert.equal((await owner('/owner/notices' + scope)).data.count, 1);

  const targetUrl = '/owner/targets/' + localDay().slice(0, 7);
  assert.equal((await staff(targetUrl, { amount: 100000 }, 'PUT')).status, 403);
  const target = await owner(targetUrl + scope, { amount: 100000 }, 'PUT');
  assert.equal(target.data.revenue, 50000);
  assert.equal(target.data.amount, 100000);
  assert.equal((await owner(targetUrl)).data.amount, 0);
  const entries = (await owner('/owner/outlets/summary')).data.rows;
  assert.equal(entries.find(row => row.id === outletId).today, 50000);

  const csv = await owner('/owner/sales' + scope + '&format=csv');
  assert.ok(csv.data.toString().includes(sale.data.id));
  assert.equal(csv.data.toString().trim().split('\n').length, 2);
  const pdf = await owner('/owner/sales' + scope + '&format=pdf');
  assert.match(pdf.type, /application\/pdf/);
  assert.equal(pdf.data.subarray(0, 5).toString(), '%PDF-');
  const xlsx = await owner('/owner/sales' + scope + '&format=xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(xlsx.data);
  const sheet = workbook.getWorksheet('Penjualan');
  assert.equal(sheet.getCell('A6').value, sale.data.id);
  assert.equal(sheet.getCell('E6').value, 50000);
  assert.equal(sheet.rowCount, 6);
});

test('the operational database retains users and rejects opening under demo mode', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'kelola-test-'));
  const path = join(folder, 'live.sqlite');
  try {
    const legacy = new DatabaseSync(path);
    legacy.exec(databaseSchema());
    for (const [sql, args] of initialRows({ demo: false, ownerUsername: 'pemilik', ownerPassword: 'test-password-1234' })) {
      legacy.prepare(sql).run(...args);
    }
    legacy.prepare('UPDATE store SET name=?,latitude=?,longitude=? WHERE id=1').run('Usaha lama', -6.2, 106.8);
    legacy.prepare('INSERT INTO products (name,category,price) VALUES (?,?,?)').run('Produk lama', 'Makanan', 10000);
    legacy.close();
    assert.throws(() => openStore(path, { demo: true }), /berbeda/);
    const reopened = openStore(path, { demo: false });
    try {
      assert.equal(reopened.prepare('SELECT username FROM users WHERE role = ?').get('owner').username, 'pemilik');
      assert.equal(reopened.prepare('SELECT name FROM outlets WHERE id = 1').get().name, 'Usaha lama');
      const product = reopened.prepare('SELECT outlet_id,cost_total FROM products WHERE name=?').get('Produk lama');
      assert.equal(product.outlet_id, 1);
      assert.equal(product.cost_total, 0);
    } finally {
      reopened.close();
    }
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
