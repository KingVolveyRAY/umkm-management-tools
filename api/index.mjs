import { createApp } from '../server/app.mjs';
import { openStore } from '../server/store.mjs';

let app;

export default function handler(req, res) {
  if (!app) {
    if (process.env.DEMO_MODE === '0') {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'Mode operasional di Vercel memerlukan database persisten.' }));
      return;
    }
    app = createApp(openStore(':memory:', { demo: true }), {
      demo: true, secureCookie: Boolean(process.env.VERCEL), trustProxy: Boolean(process.env.VERCEL),
    });
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
