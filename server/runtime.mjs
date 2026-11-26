import { resolve } from 'node:path';
import { createApp } from './app.mjs';
import { openPostgres } from './database.mjs';
import { midtransGateway } from './qris.mjs';
import { openStore } from './store.mjs';

export async function createRuntimeApp({ serverless = false } = {}) {
  const demo = process.env.DEMO_MODE !== '0';
  const databaseUrl = process.env.DATABASE_URL;
  if (serverless && !demo && !databaseUrl) {
    throw Object.assign(new Error('Mode operasional di Vercel memerlukan DATABASE_URL.'), { code: 'DATABASE_REQUIRED' });
  }

  const settings = { demo, ownerUsername: process.env.OWNER_USERNAME, ownerPassword: process.env.OWNER_PASSWORD };
  const database = databaseUrl
    ? await openPostgres(databaseUrl, settings)
    : openStore(serverless ? ':memory:' : resolve(process.env.DB_PATH || (demo ? 'data/demo.sqlite' : 'data/kelola.sqlite')), settings);
  return createApp(database, {
    demo,
    gateway: demo ? null : midtransGateway(process.env.MIDTRANS_SERVER_KEY, process.env.MIDTRANS_PRODUCTION === '1'),
    secureCookie: process.env.COOKIE_SECURE === '1' || (serverless && Boolean(process.env.VERCEL)),
    trustProxy: process.env.TRUST_PROXY === '1' || (serverless && Boolean(process.env.VERCEL)),
  });
}
