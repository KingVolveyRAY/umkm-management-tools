import { localDay, shiftDay } from './store.mjs';

export class RequestError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function fail(status, message, code) {
  throw new RequestError(status, message, code);
}

export function requiredText(value, limit, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > limit) fail(400, label + ' belum valid.');
  return value.trim();
}

export function dayParam(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(400, 'Tanggal belum valid.');
  const date = new Date(value + 'T12:00:00+07:00');
  if (Number.isNaN(date.getTime()) || localDay(date) !== value) fail(400, 'Tanggal belum valid.');
  return value;
}

export function reportRange(query) {
  const today = localDay();
  const from = dayParam(query.from, shiftDay(today, -6));
  const to = dayParam(query.to, today);
  if (from > to || Date.parse(to) - Date.parse(from) > 366 * 86400000) fail(400, 'Pilih rentang hingga 366 hari.');
  return { from, to };
}

export function coordinate(value, bound) {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= bound;
}

export function recordId(value) {
  const id = Number(value);
  if (!/^\d+$/.test(value) || id < 1 || id > 2147483647) fail(404, 'Data tidak ditemukan.');
  return id;
}
