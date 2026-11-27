import { coordinate, fail } from './request.mjs';

const cache = new Map();

export async function searchAddress(query, outlet) {
  const latitude = outlet.latitude ?? -6.2088;
  const longitude = outlet.longitude ?? 106.8456;
  const cacheKey = query.toLowerCase() + ':' + latitude.toFixed(2) + ':' + longitude.toFixed(2);
  const saved = cache.get(cacheKey);
  if (saved && saved.until > Date.now()) return saved.rows;

  const url = new URL('https://photon.komoot.io/api/');
  url.search = new URLSearchParams({ q: query, limit: '6', lat: String(latitude), lon: String(longitude) });
  let response;
  try {
    const result = await fetch(url, { signal: AbortSignal.timeout(7500),
      headers: { Accept: 'application/json', 'User-Agent': 'Kelola Address Search (umkm-management-tools.vercel.app)' } });
    if (result.ok) response = await result.json();
  } catch {}
  if (!Array.isArray(response?.features)) fail(503, 'Pencarian alamat sedang tidak bisa diakses. Coba lagi atau gunakan peta.');

  const rows = [];
  const markers = new Set();
  for (const item of response.features.slice(0, 6)) {
    if (!Array.isArray(item?.geometry?.coordinates)) continue;
    const [longitude, latitude] = item.geometry.coordinates;
    if (!coordinate(latitude, 90) || !coordinate(longitude, 180)) continue;
    const data = item.properties ?? {};
    const street = [data.street, data.housenumber].filter(Boolean).join(' ');
    const label = [...new Set([data.name, street, data.district, data.city || data.county, data.state, data.postcode, data.country]
      .filter(value => typeof value === 'string' && value.trim()))].join(', ');
    const marker = latitude.toFixed(5) + ':' + longitude.toFixed(5);
    if (!label || markers.has(marker)) continue;
    markers.add(marker);
    rows.push({ label: label.slice(0, 320), latitude, longitude });
  }
  if (cache.size >= 100) cache.delete(cache.keys().next().value);
  cache.set(cacheKey, { rows, until: Date.now() + 30 * 60 * 1000 });
  return rows;
}
