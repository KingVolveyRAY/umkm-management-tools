import { createRuntimeApp } from '../server/runtime.mjs';

let runtime;

export default async function handler(req, res) {
  runtime ??= createRuntimeApp({ serverless: true }).catch(error => {
    runtime = undefined;
    throw error;
  });
  let app;
  try {
    app = await runtime;
  } catch (error) {
    console.error('Kelola belum dapat membuka database.', error.code ?? error.name);
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: error.code === 'DATABASE_REQUIRED' ? error.message
      : 'Basis data belum dapat dibuka. Periksa koneksi dan pengaturan database Kelola.' }));
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const route = url.searchParams.get('__kelola_route');
  if (route && (url.pathname === '/api/index' || url.pathname === '/api')) {
    url.pathname = '/api/' + route;
  }
  url.searchParams.delete('__kelola_route');
  req.url = url.pathname + url.search;
  return app(req, res);
}
