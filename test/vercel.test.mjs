import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import handler, { createHandler } from '../api/index.mjs';
import { createApp } from '../server/app.mjs';
import { openStore } from '../server/store.mjs';

test('the Vercel Function requires DATABASE_URL and serves routed API requests', async t => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  t.after(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  const unconfigured = createServer(handler).listen(0, '127.0.0.1');
  await once(unconfigured, 'listening');
  t.after(() => new Promise(resolve => unconfigured.close(resolve)));
  const missingDb = await fetch('http://127.0.0.1:' + unconfigured.address().port + '/api/index?__kelola_route=session');
  assert.equal(missingDb.status, 503);
  assert.match((await missingDb.json()).error, /DATABASE_URL/);

  const credentials = { username: 'pemilik', password: 'example-only-owner-password' };
  const db = openStore(':memory:', { ownerUsername: credentials.username, ownerPassword: credentials.password });
  t.after(() => db.close());
  const routed = createServer(createHandler(async () => createApp(db))).listen(0, '127.0.0.1');
  await once(routed, 'listening');
  t.after(() => new Promise(resolve => routed.close(resolve)));
  const base = 'http://127.0.0.1:' + routed.address().port;

  const session = await fetch(base + '/api/index?__kelola_route=session');
  assert.equal(session.status, 200);
  assert.deepEqual(await session.json(), { user: null });

  const login = await fetch(base + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const trend = await fetch(base + '/api/index?__kelola_route=owner%2Foverview&days=30', { headers: { Cookie: cookie } });
  assert.equal(trend.status, 200);
  assert.equal((await trend.json()).series.length, 30);

  const missing = await fetch(base + '/api/missing');
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get('content-type'), /application\/json/);
});
