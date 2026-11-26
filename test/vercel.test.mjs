import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import handler from '../api/index.mjs';

test('the Vercel Function serves the Express API and preserves query parameters', async t => {
  const server = createServer(handler).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const session = await fetch(base + '/api/index?__kelola_route=session');
  assert.equal(session.status, 200);
  assert.deepEqual(await session.json(), { user: null, demo: true });
  const login = await fetch(base + '/api/demo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"role":"owner"}',
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
