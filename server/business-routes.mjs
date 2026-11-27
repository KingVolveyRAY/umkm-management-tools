import { promotionFields, publicPromotion } from './commerce.mjs';
import { fail, recordId, reportRange } from './request.mjs';

export function registerBusinessRoutes(app, db, owner) {
  app.get('/api/owner/profit', owner, async (req, res) => {
    const { from, to } = reportRange(req.query);
    const rows = await db.all(`
      SELECT paid_day AS day, COUNT(*) AS count, COUNT(hpp_total) AS covered,
        SUM(amount) AS revenue, SUM(discount_amount) AS discount,
        SUM(CASE WHEN hpp_total IS NOT NULL THEN amount ELSE 0 END) AS covered_revenue,
        COALESCE(SUM(hpp_total),0) AS hpp
      FROM sales WHERE outlet_id = ? AND status = 'paid' AND paid_day BETWEEN ? AND ?
      GROUP BY paid_day ORDER BY paid_day DESC
    `, [req.outlet.id, from, to]);
    const totals = { count: 0, covered: 0, revenue: 0, discount: 0, covered_revenue: 0, hpp: 0 };
    for (const row of rows) {
      for (const key of Object.keys(totals)) totals[key] += row[key];
    }
    const view = ({ covered_revenue: coveredRevenue, covered, count, hpp, ...row }) => ({
      ...row, count, covered, coveredRevenue, hpp,
      missing: count - covered, gross: covered ? coveredRevenue - hpp : null,
    });
    res.json({ from, to, total: view(totals), rows: rows.map(view) });
  });

  app.get('/api/owner/customers', owner, async (req, res) => {
    const query = req.query.q;
    if (query != null && (typeof query !== 'string' || query.length > 70)) fail(400, 'Kata pencarian pelanggan belum valid.');
    const input = query?.trim() ?? '';
    const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
    const size = 25;
    const args = [req.outlet.id];
    let where = ' WHERE c.outlet_id = ?';
    if (input) {
      const pattern = value => '%' + value.toLowerCase().replace(/[!%_]/g, '!$&') + '%';
      const phone = /^[+\d\s().-]+$/.test(input) ? input.replace(/\D/g, '').replace(/^0/, '62') : '';
      where += " AND (LOWER(c.name) LIKE ? ESCAPE '!' OR c.phone LIKE ? ESCAPE '!')";
      args.push(pattern(input), pattern(phone || input));
    }
    const [rows, { total }] = await Promise.all([
      db.all(`
        SELECT c.id,c.name,c.phone,c.created_at AS "createdAt",COUNT(s.id) AS visits,MAX(s.paid_at) AS "lastVisit",
          COALESCE(SUM(s.amount),0) AS spent
        FROM customers c LEFT JOIN sales s ON s.customer_id = c.id AND s.outlet_id = c.outlet_id AND s.status = 'paid'
        ${where} GROUP BY c.id,c.name,c.phone,c.created_at
        ORDER BY COALESCE(MAX(s.paid_at),c.created_at) DESC,c.id DESC LIMIT ? OFFSET ?
      `, [...args, size, (page - 1) * size]),
      db.get('SELECT COUNT(*) AS total FROM customers c' + where, args),
    ]);
    res.json({ rows, total, page, size });
  });

  app.get('/api/owner/promotions', owner, async (req, res) => {
    const now = new Date().toISOString();
    const rows = await db.all('SELECT * FROM promotions WHERE outlet_id=? ORDER BY starts_at DESC,id DESC', [req.outlet.id]);
    res.json({ rows: rows.map(row => publicPromotion(row, now)) });
  });

  app.post('/api/owner/promotions', owner, async (req, res) => {
    const row = await db.get(`
      INSERT INTO promotions (outlet_id,name,discount_type,value,starts_at,ends_at,active)
      VALUES (?,?,?,?,?,?,?) RETURNING *
    `, [req.outlet.id, ...promotionFields(req.body)]);
    res.status(201).json(publicPromotion(row, new Date().toISOString()));
  });

  app.put('/api/owner/promotions/:id', owner, async (req, res) => {
    const row = await db.get(`
      UPDATE promotions SET name=?,discount_type=?,value=?,starts_at=?,ends_at=?,active=?
      WHERE id=? AND outlet_id=? RETURNING *
    `, [...promotionFields(req.body), recordId(req.params.id), req.outlet.id]);
    if (!row) fail(404, 'Promo tidak ditemukan.');
    res.json(publicPromotion(row, new Date().toISOString()));
  });
}
