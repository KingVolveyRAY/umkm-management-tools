import { createHash, timingSafeEqual } from 'node:crypto';

export class GatewayError extends Error {
  constructor() {
    super('Payment gateway belum merespons. Periksa status atau coba lagi dengan transaksi yang sama.');
  }
}

export function midtransGateway(key, production, request = fetch) {
  if (!key) return null;
  const origin = production ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
  const authorization = 'Basic ' + Buffer.from(key + ':').toString('base64');

  async function call(path, body) {
    let response;
    let data;
    try {
      response = await request(origin + path, {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: authorization, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(8000),
        redirect: 'error',
      });
      data = await response.json();
    } catch {
      throw new GatewayError();
    }
    const code = Number(data.status_code);
    if (response.status === 404 || code === 404) return null;
    if (!response.ok || !(code >= 200 && code < 300) && !data.transaction_status) throw new GatewayError();
    return data;
  }

  function safeQRUrl(value) {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value);
      if (url.origin !== origin || url.username || url.password || !/^\/v[24]\/qris\/[a-zA-Z0-9_-]+\/qr-code\/?$/.test(url.pathname)) return null;
      return url.href;
    } catch {
      return null;
    }
  }

  return {
    production,
    async charge(id, amount) {
      return call('/v2/charge', {
        payment_type: 'qris',
        transaction_details: { order_id: id, gross_amount: amount },
        qris: { acquirer: 'gopay' },
      });
    },
    status(id) {
      return call('/v2/' + encodeURIComponent(id) + '/status');
    },
    qr(data) {
      const value = typeof data.qr_string === 'string' && data.qr_string.length <= 1000 ? data.qr_string : null;
      const actions = Array.isArray(data.actions) ? data.actions : [];
      const qrUrl = name => safeQRUrl(actions.find(item => item.name === name)?.url);
      const recoveredUrl = data.transaction_status === 'pending' && typeof data.transaction_id === 'string'
        ? safeQRUrl(origin + '/v2/qris/' + encodeURIComponent(data.transaction_id) + '/qr-code') : null;
      return { value, url: qrUrl('generate-qr-code-v2') ?? qrUrl('generate-qr-code') ?? recoveredUrl };
    },
    async image(value) {
      const url = safeQRUrl(value);
      if (!url) return null;
      try {
        const response = await request(url, {
          headers: { Authorization: authorization, Accept: 'image/png, image/jpeg' },
          signal: AbortSignal.timeout(8000), redirect: 'error',
        });
        const type = response.headers.get('content-type')?.split(';')[0];
        if (!response.ok || !['image/png', 'image/jpeg'].includes(type)) return null;
        const image = Buffer.from(await response.arrayBuffer());
        return image.length <= 512 * 1024 ? { type, image } : null;
      } catch {
        return null;
      }
    },
    verifies(body) {
      if (!['order_id', 'status_code', 'gross_amount', 'signature_key'].every(field => typeof body[field] === 'string')) return false;
      if (!/^[a-f0-9]{128}$/i.test(body.signature_key)) return false;
      const digest = createHash('sha512')
        .update(body.order_id + body.status_code + body.gross_amount + key).digest();
      return timingSafeEqual(digest, Buffer.from(body.signature_key, 'hex'));
    },
  };
}

export function validStaticQris(value) {
  if (typeof value !== 'string' || value.length > 1000 || !/^[\x20-\x7e]+$/.test(value)) return false;
  if (!value.startsWith('000201') || !/6304[0-9A-F]{4}$/i.test(value)) return false;
  const fields = new Map();
  for (let index = 0; index < value.length;) {
    const id = value.slice(index, index + 2);
    const size = value.slice(index + 2, index + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(size) || fields.has(id)) return false;
    const end = index + 4 + Number(size);
    if (end > value.length) return false;
    fields.set(id, value.slice(index + 4, end));
    index = end;
  }
  if ((fields.has('01') && fields.get('01') !== '11') || fields.get('53') !== '360' || fields.get('58') !== 'ID'
      || ![...fields.keys()].some(id => Number(id) >= 26 && Number(id) <= 51)
      || fields.has('54')) return false;

  let crc = 0xffff;
  for (const character of value.slice(0, -4)) {
    crc ^= character.charCodeAt(0) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff;
    }
  }
  return crc.toString(16).padStart(4, '0').toUpperCase() === value.slice(-4).toUpperCase();
}
