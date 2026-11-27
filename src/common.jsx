import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowDownRight, ArrowUpRight, Banknote, Bell, CalendarDays, Check, CircleAlert,
  Clock3, Coffee, CreditCard, LoaderCircle, MapPin, Printer, QrCode, X,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const zone = 'Asia/Jakarta';
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
});
const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: zone, day: 'numeric', month: 'short', year: 'numeric',
});
const longFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: zone, weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
});
const shortFormatter = new Intl.DateTimeFormat('id-ID', { timeZone: zone, day: 'numeric', month: 'short' });
const timeFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const exactTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const moneyFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const toDate = value => new Date(value?.length === 10 ? value + 'T12:00:00+07:00' : value);
export const money = amount => (amount < 0 ? '-Rp' : 'Rp') + moneyFormatter.format(Math.abs(amount ?? 0));
export const number = value => moneyFormatter.format(value ?? 0);
export const dateLabel = (value, style = 'short') => (style === 'long' ? longFormatter : style === 'year' ? dateFormatter : shortFormatter).format(toDate(value));
export const timeLabel = (value, seconds = false) => (seconds ? exactTimeFormatter : timeFormatter).format(toDate(value)).replaceAll('.', ':');
export const today = () => dayFormatter.format(new Date());
export const monthLabel = month => new Intl.DateTimeFormat('id-ID', { timeZone: zone, month: 'long', year: 'numeric' }).format(toDate(month + '-01'));
export const shift = (value, days) => dayFormatter.format(new Date(toDate(value).getTime() + days * 86400000));
export const initials = name => name.trim().split(/\s+/).slice(0, 2).map(word => word[0]?.toUpperCase()).join('');
export const methodLabels = { cash: 'Tunai', qris_static: 'QRIS Statis', qris_dynamic: 'QRIS Dinamis' };
export const saleStates = { paid: ['Lunas', 'green'], pending: ['Menunggu', 'amber'], failed: ['Gagal', 'red'] };
export const locationStates = {
  onsite: ['Di area outlet', 'green'], uncertain: ['Perlu ditinjau', 'amber'], outside: ['Di luar area', 'red'],
};

export function relativeTime(timestamp) {
  const minutes = Math.floor((Date.now() - toDate(timestamp).getTime()) / 60000);
  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return minutes + ' mnt lalu';
  if (minutes < 1440) return Math.floor(minutes / 60) + ' jam lalu';
  return dateLabel(timestamp);
}

export const OutletContext = createContext(null);
export const useOutletId = () => useContext(OutletContext);

export function useOutletApi() {
  const outletId = useOutletId();
  return useCallback((url, options) => api(url, { ...options, outletId }), [outletId]);
}

export async function api(url, { method = 'GET', body, signal, outletId } = {}) {
  const response = await fetch('/api' + url, {
    method, signal,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(outletId == null ? {} : { 'X-Kelola-Outlet': String(outletId) }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('API Kelola belum dapat diakses (HTTP ' + response.status + ').');
  }
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && url !== '/login') {
      window.dispatchEvent(new Event('kelola:expired'));
    }
    throw Object.assign(new Error(data.error || 'Permintaan tidak berhasil.'), { code: data.code });
  }
  return data;
}

export function useResource(url, interval = 0, outletOverride) {
  const contextOutlet = useOutletId();
  const outletId = outletOverride ?? contextOutlet;
  const key = (outletId ?? '') + ':' + url;
  const [result, setResult] = useState({ key: null, data: null, error: '' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!url) return undefined;
    const controller = new AbortController();
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const data = await api(url, { signal: controller.signal, outletId });
        if (!controller.signal.aborted) setResult({ key, data, error: '' });
      } catch (error) {
        if (!controller.signal.aborted) setResult(previous => ({
          key, data: previous.key === key ? previous.data : null, error: error.message,
        }));
      } finally {
        pending = false;
      }
    };
    load();
    const timer = interval ? setInterval(() => { if (!document.hidden) load(); }, interval) : null;
    if (interval) window.addEventListener('focus', load);
    return () => {
      controller.abort();
      clearInterval(timer);
      if (interval) window.removeEventListener('focus', load);
    };
  }, [url, outletId, key, interval, revision]);
  return {
    data: result.key === key ? result.data : null,
    error: result.key === key ? result.error : '',
    reload: () => setRevision(value => value + 1),
  };
}

export function WordTitle({ as: Tag = 'h2', children, className = '' }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const context = gsap.context(() => {
      gsap.fromTo('.word-inner', { yPercent: 108, opacity: 0 }, {
        yPercent: 0, opacity: 1, duration: 0.55, stagger: 0.05, ease: 'power3.out',
        scrollTrigger: { trigger: ref.current, start: 'top 99%', once: true },
      });
    }, ref);
    return () => context.revert();
  }, [children]);
  return <Tag ref={ref} className={'word-title ' + className} aria-label={children}>
    {children.split(' ').map((word, index) => (
      <span className="word" key={index} aria-hidden="true">
        <span className="word-inner">{word}</span>
      </span>
    ))}
  </Tag>;
}

export function SectionHeading({ title, description, children }) {
  return <header className="page-heading">
    <div>
      <WordTitle as="h1">{title}</WordTitle>
      {description && <p>{description}</p>}
    </div>
    {children && <div className="heading-actions">{children}</div>}
  </header>;
}

export function Card({ children, className = '', index = 0, lift = false, as = 'section', ...props }) {
  const reduce = useReducedMotion();
  const Component = motion[as];
  return <Component
    className={'card ' + className}
    initial={reduce ? false : { opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={lift && !reduce ? { y: -3 } : undefined}
    transition={{ duration: 0.26, delay: Math.min(index * 0.045, 0.2), ease: 'easeOut' }}
    {...props}
  >{children}</Component>;
}

export function Button({ kind = 'secondary', icon: Icon, children, className = '', ...props }) {
  return <button type="button" className={'button button-' + kind + ' ' + className} {...props}>
    {Icon && <Icon size={16} strokeWidth={1.8} />}
    {children}
  </button>;
}

export function Badge({ color = 'neutral', children, dot = true }) {
  return <span className={'badge badge-' + color}>{dot && <i />}{children}</span>;
}

export function Avatar({ name, color = 'green', size = 'normal' }) {
  return <span className={'avatar avatar-' + color + ' avatar-' + size} aria-hidden="true">{initials(name)}</span>;
}

export function IconTile({ icon: Icon, color = 'green', className = '' }) {
  return <span aria-hidden="true" className={'icon-tile tint-' + color + ' ' + className}>
    <Icon size={19} strokeWidth={1.75} />
  </span>;
}

export function Brand() {
  return <div className="brand" aria-label="Kelola">
    <img className="brand-mark" src="/kelola-icon.png" alt="" width="41" height="41" />
    <span>kelola<span className="brand-period">.</span></span>
  </div>;
}

export function DateControl({ value, onChange, max = today(), label = 'Pilih tanggal' }) {
  const input = useRef(null);
  return <div className="date-control">
    <Button icon={CalendarDays} onClick={() => {
      try { input.current.showPicker(); } catch { input.current.focus(); }
    }} aria-label={label + ', ' + dateLabel(value, 'long')}>
      {dateLabel(value, 'long')}
    </Button>
    <input ref={input} type="date" value={value} max={max} onChange={event => event.target.value && onChange(event.target.value)} aria-label={label} tabIndex={-1} />
  </div>;
}

export function Empty({ icon = Coffee, title, children }) {
  return <div className="empty">
    <IconTile icon={icon} />
    <strong>{title}</strong>
    {children && <p>{children}</p>}
  </div>;
}

export function Pending({ label = 'Memuat data…' }) {
  return <div className="pending" role="status"><LoaderCircle className="spin" size={18} />{label}</div>;
}

export function ErrorText({ text }) {
  return text ? <div className="error-text" role="alert"><CircleAlert size={17} />{text}</div> : null;
}

export function ResourceState({ error, reload }) {
  if (!error) return <Pending />;
  return <div className="resource-error"><ErrorText text={error} /><Button onClick={reload}>Coba lagi</Button></div>;
}

export function Trend({ value }) {
  if (!Number.isFinite(value)) return <span className="trend trend-neutral">—</span>;
  const Icon = value < 0 ? ArrowDownRight : ArrowUpRight;
  return <span className={'trend ' + (value < 0 ? 'trend-down' : 'trend-up')}>
    <Icon size={13} strokeWidth={2} />
    {value > 0 ? '+' : ''}{value.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%
  </span>;
}

export const change = (a, b) => b ? (a - b) / b * 100 : NaN;

export function Dialog({ title, description, onClose, children, className = '', busy = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className={'dialog ' + className} data-lenis-prevent
    aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="dialog-inner">
      <header className="dialog-header">
        <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
        <button type="button" className="icon-button" aria-label="Tutup" onClick={onClose} disabled={busy}><X size={19} /></button>
      </header>
      {children}
    </div>
  </dialog>;
}

export function PriceBreakdown({ sale }) {
  return <div className="price-breakdown">
    {sale.discount > 0 && <div className="price-original">
      <div><span>Harga asli</span><strong>{money(sale.subtotal)}</strong></div>
      <div className="price-discount"><span>{sale.promo?.name ? 'Diskon · ' + sale.promo.name : 'Diskon'}</span><strong>{money(-sale.discount)}</strong></div>
    </div>}
    <div className="payment-summary"><span>Total pembayaran</span><strong>{money(sale.amount)}</strong></div>
  </div>;
}

export function Receipt({ sale, onClose }) {
  const [label, color] = saleStates[sale.status];
  const sheet = useRef(null);
  const timestamp = sale.paidAt ?? sale.createdAt;

  function printReceipt() {
    document.getElementById('kelola-print-root')?.remove();
    const printRoot = document.createElement('div');
    printRoot.id = 'kelola-print-root';
    printRoot.append(sheet.current.cloneNode(true));
    document.body.append(printRoot);
    window.addEventListener('afterprint', () => printRoot.remove(), { once: true });
    window.print();
  }

  return <Dialog title="Detail transaksi" onClose={onClose}>
    <article className="receipt-sheet" ref={sheet}>
      <header className="receipt-brand"><strong>{sale.storeName ?? 'Kelola'}</strong>
        {sale.outletName && <span>{sale.outletName}</span>}<small>{sale.id}</small>
      </header>
      <div className="receipt-meta">
        <div><span>Kasir</span><strong>{sale.employee ?? 'Anda'}</strong></div>
        {sale.customerName && <div><span>Pelanggan</span><strong>{sale.customerName}</strong></div>}
        <div><span>Metode</span><strong>{sale.amount === 0 ? 'Promo gratis' : methodLabels[sale.method]}</strong></div>
        <div><span>Waktu</span><strong>{dateLabel(timestamp, 'year')} · {timeLabel(timestamp)} WIB</strong></div>
        <div><span>Status</span><Badge color={color}>{label}</Badge></div>
      </div>
      <div className="receipt-items">{sale.items.map((item, index) => <div key={item.id + ':' + index}>
        <div><strong>{item.name}</strong><span>{item.quantity} × {money(item.price)}</span></div>
        <strong>{money(item.price * item.quantity)}</strong>
      </div>)}</div>
      <PriceBreakdown sale={sale} />
      {sale.method === 'cash' && sale.amount > 0 && sale.cashReceived != null && <div className="receipt-meta receipt-cash">
        <div><span>Uang diterima</span><strong>{money(sale.cashReceived)}</strong></div>
        <div><span>Kembalian</span><strong>{money(sale.cashReceived - sale.amount)}</strong></div>
      </div>}
    </article>
    <div className="dialog-actions">
      {sale.status === 'paid' && <Button icon={Printer} onClick={printReceipt}>Cetak struk</Button>}
      <Button kind="primary" onClick={onClose}>Selesai</Button>
    </div>
  </Dialog>;
}

export function PaymentIcon({ method, className }) {
  const Icon = method === 'cash' ? Banknote : QrCode;
  return <Icon size={17} strokeWidth={1.8} className={className} />;
}

export function NoticeList({ rows, full = false }) {
  if (!rows.length) return <Empty icon={Bell} title="Belum ada aktivitas">Transaksi dan absensi baru akan muncul di sini.</Empty>;
  return <ul className={'notice-list ' + (full ? 'notice-list-full' : '')}>
    {rows.map(row => <li key={row.id}>
      <IconTile icon={row.kind === 'attendance' ? MapPin : CreditCard} color={row.kind === 'attendance' ? 'blue' : 'green'} />
      <div className="notice-copy"><strong>{row.title}</strong><span>{row.detail}</span></div>
      <span className="notice-time">{relativeTime(row.created_at)}{full && !row.is_read && <i title="Belum dibaca" />}</span>
    </li>)}
  </ul>;
}

export function Toast({ toast }) {
  if (!toast) return null;
  const Icon = toast.type === 'error' ? CircleAlert : Check;
  return <motion.div className={'toast toast-' + (toast.type ?? 'success')} role="status"
    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
    <Icon size={18} />{toast.text}
  </motion.div>;
}

export function TimeChip({ timestamp }) {
  return <span className="time-chip"><Clock3 size={14} />{timeLabel(timestamp)} WIB</span>;
}

export function SaleTable({ rows, onSelect, short = false }) {
  if (!rows.length) return <Empty icon={CreditCard} title="Belum ada transaksi">Coba pilih tanggal atau filter yang lain.</Empty>;
  return <div className="table-overflow"><table>
    <thead><tr><th>Transaksi</th><th>Waktu</th><th>Kasir</th><th>Pembayaran</th><th>Status</th><th className="align-right">Total</th></tr></thead>
    <tbody>{rows.map(sale => {
      const [label, color] = saleStates[sale.status];
      const timestamp = sale.paidAt ?? sale.createdAt;
      return <tr key={sale.id}>
        <td><button type="button" className="table-link" onClick={() => onSelect(sale)}>{sale.id}</button></td>
        <td>{short ? timeLabel(timestamp) + ' WIB' : dateLabel(timestamp) + ' · ' + timeLabel(timestamp)}</td>
        <td>{sale.employee ?? 'Anda'}</td>
        <td><span className="method-cell"><PaymentIcon method={sale.method} />{methodLabels[sale.method]}</span></td>
        <td><Badge color={color}>{label}</Badge></td>
        <td className="align-right amount-cell">{money(sale.amount)}</td>
      </tr>;
    })}</tbody>
  </table></div>;
}

export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [toast, (text, type) => {
    clearTimeout(timer.current);
    setToast({ text, type });
    timer.current = setTimeout(() => setToast(null), 4200);
  }];
}
