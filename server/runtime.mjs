import { resolve } from 'node:path';
import { createApp } from './app.mjs';
import { openPostgres } from './database.mjs';
import { midtransGateway } from './qris.mjs';
import { openStore } from './store.mjs';

export async function createRuntimeApp({ serverless = false } = {}) {
  const databaseUrl = process.env.DATABASE_URL;
  if (serverless && !databaseUrl) {
    throw Object.assign(new Error('Deployment di Vercel memerlukan DATABASE_URL.'), { code: 'DATABASE_REQUIRED' });
  }

  const settings = { ownerUsername: process.env.OWNER_USERNAME, ownerPassword: process.env.OWNER_PASSWORD };
  const database = databaseUrl
    ? await openPostgres(databaseUrl, settings)
    : openStore(resolve(process.env.DB_PATH || 'data/kelola.sqlite'), settings);
  return createApp(database, {
    gateway: midtransGateway(process.env.MIDTRANS_SERVER_KEY, process.env.MIDTRANS_PRODUCTION === '1'),
    secureCookie: process.env.COOKIE_SECURE === '1' || (serverless && Boolean(process.env.VERCEL)),
    trustProxy: process.env.TRUST_PROXY === '1' || (serverless && Boolean(process.env.VERCEL)),
  });
}
