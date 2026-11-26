import { createServer } from 'node:http';
import { resolve } from 'node:path';
import express from 'express';
import { createApp } from './app.mjs';
import { midtransGateway } from './qris.mjs';
import { openStore } from './store.mjs';

const dev = process.argv.includes('--dev');
const demo = process.env.DEMO_MODE !== '0';
const path = resolve(process.env.DB_PATH || (demo ? 'data/demo.sqlite' : 'data/kelola.sqlite'));
const db = openStore(path, {
  demo, ownerUsername: process.env.OWNER_USERNAME, ownerPassword: process.env.OWNER_PASSWORD,
});
const app = createApp(db, {
  demo,
  gateway: demo ? null : midtransGateway(process.env.MIDTRANS_SERVER_KEY, process.env.MIDTRANS_PRODUCTION === '1'),
  secureCookie: process.env.COOKIE_SECURE === '1',
  trustProxy: process.env.TRUST_PROXY === '1',
});
const server = createServer(app);

app.use((req, res, next) => {
  res.set({ 'Permissions-Policy': 'camera=(self), geolocation=(self), microphone=()', 'X-Content-Type-Options': 'nosniff' });
  next();
});

if (dev) {
  const { createServer: createVite } = await import('vite');
  const vite = await createVite({
    appType: 'spa',
    configLoader: 'native',
    server: { middlewareMode: true, hmr: { server } },
  });
  app.use(vite.middlewares);
} else {
  const dist = resolve('dist');
  app.use(express.static(dist));
  app.get('/{*path}', (req, res) => res.sendFile(resolve(dist, 'index.html')));
}

const port = Number(process.env.PORT || 5173);
server.listen(port, process.env.HOST || '0.0.0.0', () => {
  console.log('Kelola berjalan pada port ' + server.address().port + (demo ? ' (demo)' : ''));
});
