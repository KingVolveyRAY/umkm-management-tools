import { lazy, Suspense, useId, useState } from 'react';
import {
  ArrowDownToLine, ArrowRight, ArrowUpRight, Bell, CalendarDays,
  Camera, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Coffee, Crosshair, ImagePlus,
  MapPin, Package, Pencil, Plus, QrCode, ReceiptText, Search, Store, Target, Trash2, UserRoundCheck, Users, Wallet,
} from 'lucide-react';
import {
  Avatar, Badge, Button, Card, change, DateControl, dateLabel, Dialog, Empty, ErrorText,
  IconTile, locationStates, methodLabels, money, monthLabel, NoticeList, number, Pending, Receipt, ResourceState,
  SaleTable, SectionHeading, shift, timeLabel, today, Trend, useOutletApi, useOutletId, useResource, WordTitle,
} from './common.jsx';

const OutletMap = lazy(() => import('./outlet-map.jsx'));

function Metric({ icon, color, label, value, trend, note, index, onClick }) {
  return <Card className="metric" index={index} lift as={onClick ? 'button' : 'article'} type={onClick ? 'button' : undefined} onClick={onClick}>
    <div className="metric-top">
      <IconTile icon={icon} color={color} />
      {onClick && <ArrowUpRight size={17} className="metric-arrow" />}
    </div>
    <span className="metric-label">{label}</span>
    <strong className="metric-value">{value}</strong>
    <div className="metric-foot">{trend !== undefined && <Trend value={trend} />}<span>{note}</span></div>
  </Card>;
}

function SalesChart({ entries, days, setDays }) {
  const id = useId().replace(/[^a-z0-9]/gi, '');
  const [hover, setHover] = useState(null);
  const [focused, setFocused] = useState(false);
  const sum = entries.reduce((total, entry) => total + entry.revenue, 0);
  const maxValue = Math.max(400000, ...entries.map(entry => entry.revenue));
  const unit = maxValue < 1000000 ? 250000 : maxValue < 8000000 ? 500000 : 2500000;
  const scaleMax = Math.ceil(maxValue / (unit * 4)) * unit * 4;
  const width = 640;
  const floor = 176;
  const ceiling = 7;
  const coords = entries.map(({ revenue }, index) => ({
    x: 7 + index / (entries.length - 1) * (width - 14),
    y: floor - revenue / scaleMax * (floor - ceiling),
  }));
  const path = coords.map(({ x, y }, index) => {
    if (index === 0) return 'M ' + x + ' ' + y;
    const prev = coords[index - 1];
    const middle = (prev.x + x) / 2;
    return 'C ' + middle + ' ' + prev.y + ' ' + middle + ' ' + y + ' ' + x + ' ' + y;
  }).join(' ');
  const fill = path + ' L ' + coords.at(-1).x + ' ' + floor + ' L ' + coords[0].x + ' ' + floor + ' Z';
  const active = hover == null ? null : coords[hover];
  const ticks = [1, 0.75, 0.5, 0.25, 0];
  const compact = value => value === 0 ? 'Rp0' : value >= 1000000
    ? 'Rp' + (value / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' jt'
    : 'Rp' + number(value / 1000) + ' rb';
  const labelPositions = days === 7 ? entries : entries.filter((_, index) => index % 5 === 0 || index === entries.length - 1);
  return <Card className="sales-chart panel" index={1}>
    <header className="panel-header">
      <div><WordTitle>Tren penjualan</WordTitle><p>Pendapatan dari transaksi lunas</p></div>
      <select className="compact-select" aria-label="Periode tren penjualan" value={days} onChange={event => { setHover(null); setDays(Number(event.target.value)); }}>
        <option value={7}>7 hari terakhir</option>
        <option value={30}>30 hari terakhir</option>
      </select>
    </header>
    <div className="chart-summary"><strong>{money(sum)}</strong><span className="chart-legend"><i />Pendapatan</span></div>
    <div className="chart-layout">
      <div className="chart-y" aria-hidden="true">{ticks.map(tick => <span key={tick}>{compact(scaleMax * tick)}</span>)}</div>
      <div className="chart-plot">
        <div className="chart-interactive"
          tabIndex={0} role="group" aria-label="Grafik pendapatan. Gunakan panah kiri dan kanan untuk melihat setiap hari."
          onFocus={() => { setFocused(true); setHover(prev => prev ?? entries.length - 1); }}
          onBlur={() => { setFocused(false); setHover(null); }}
          onPointerMove={event => {
            const bounds = event.currentTarget.getBoundingClientRect();
            const value = (event.clientX - bounds.left) / bounds.width;
            setHover(Math.round(Math.max(0, Math.min(1, value)) * (entries.length - 1)));
          }}
          onPointerLeave={() => { if (!focused) setHover(null); }}
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            event.preventDefault();
            setHover(prev => Math.min(entries.length - 1, Math.max(0, (prev ?? 0) + (event.key === 'ArrowLeft' ? -1 : 1))));
          }}>
          <svg viewBox={'0 0 ' + width + ' 184'} preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-fill-top, #c9e2bf)" stopOpacity=".8" />
              <stop offset="100%" stopColor="var(--chart-fill-bottom, #e9f3e5)" stopOpacity=".26" />
            </linearGradient></defs>
            {ticks.map(tick => {
              const y = floor - tick * (floor - ceiling);
              return <line key={tick} x1="0" y1={y} x2={width} y2={y} stroke="var(--chart-grid, #ebefe8)" strokeDasharray={tick ? '4 4' : undefined} vectorEffect="non-scaling-stroke" />;
            })}
            <path d={fill} fill={'url(#' + id + ')'} />
            <path d={path} fill="none" stroke="var(--chart-line, #43814e)" strokeWidth="2.7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {active && <line x1={active.x} y1={ceiling} x2={active.x} y2={floor} stroke="var(--chart-cursor, #a6bd9b)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
          </svg>
          {active && <>
            <span className="chart-point" style={{ left: active.x / width * 100 + '%', top: active.y / 184 * 100 + '%' }} />
            <div className="chart-tooltip" style={{ left: Math.max(16, Math.min(84, active.x / width * 100)) + '%' }} aria-live={focused ? 'polite' : 'off'}>
              <small>{dateLabel(entries[hover].day)}</small><strong>{money(entries[hover].revenue)}</strong>
            </div>
          </>}
        </div>
        <div className="chart-x" aria-hidden="true">{labelPositions.map(entry => <span key={entry.day}>{dateLabel(entry.day)}</span>)}</div>
      </div>
    </div>
  </Card>;
}

export function Overview({ session, navigate, openNotices }) {
  const [day, setDay] = useState(today);
  const [days, setDays] = useState(7);
  const [receipt, setReceipt] = useState(null);
  const { data, error, reload } = useResource('/owner/overview?end=' + day + '&days=' + days, 10000);
  const current = day === today();
  const compare = 'dari hari sebelumnya';
  const metrics = data && [
    { label: current ? 'Pendapatan hari ini' : 'Pendapatan', value: money(data.current.revenue), icon: Wallet, color: 'green', trend: change(data.current.revenue, data.previous.revenue), note: compare, page: 'penjualan' },
    { label: current ? 'Transaksi hari ini' : 'Transaksi', value: number(data.current.count), icon: ReceiptText, color: 'blue', trend: change(data.current.count, data.previous.count), note: compare, page: 'penjualan' },
    { label: 'Karyawan hadir', value: data.present + ' / ' + data.employees, icon: Users, color: 'amber', note: data.review ? data.review + ' lokasi perlu ditinjau' : 'Sudah absen masuk', page: 'absensi' },
    { label: 'Rata-rata transaksi', value: money(data.current.count ? data.current.revenue / data.current.count : 0), icon: Target, color: 'purple',
      trend: change(data.current.revenue / (data.current.count || 1), data.previous.revenue / (data.previous.count || 1)), note: compare, page: 'penjualan' },
  ];

  return <>
    <SectionHeading title="Ringkasan usaha" description={'Pantau aktivitas dan performa ' + session.store.name + ' dalam satu tempat.'}>
      <DateControl value={day} onChange={setDay} />
    </SectionHeading>
    <Card className="welcome-banner">
      <div className="hero-rings" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <img className="hero-avatar" src="/kelola-icon.png" alt="" aria-hidden="true" />
      <div className="welcome-copy">
        <span className="welcome-kicker"><i />Outlet {session.store.outlet}</span>
        <WordTitle>{'Selamat datang, ' + session.user.name.split(' ')[0] + '!'}</WordTitle>
        <p>Lihat perkembangan penjualan dan aktivitas tim Anda.</p>
      </div>
      <Button icon={ArrowUpRight} className="welcome-action" onClick={() => navigate('penjualan')}>Lihat laporan</Button>
    </Card>
    {!data ? <ResourceState error={error} reload={reload} /> : <>
      <div className="metric-grid">
        {metrics.map(({ page, ...metric }, index) => <Metric key={metric.label} {...metric} index={index} onClick={() => navigate(page)} />)}
      </div>
      <MonthlyTarget key={day.slice(0, 7)} initialMonth={day.slice(0, 7)} />
      <div className="dashboard-grid">
        <SalesChart entries={data.series} days={days} setDays={setDays} />
        <Card className="panel activity-panel" index={2}>
          <header className="panel-header">
            <div><WordTitle>Aktivitas terbaru</WordTitle><p>Update dari kasir dan tim Anda</p></div>
            <button type="button" className="icon-button panel-icon" onClick={openNotices} aria-label="Buka notifikasi"><Bell size={18} /></button>
          </header>
          <NoticeList rows={data.notices} />
          <button type="button" className="text-button activity-link" onClick={openNotices}>Lihat semua aktivitas <ArrowRight size={16} /></button>
        </Card>
      </div>
      <Card className="panel transactions" index={3}>
        <header className="panel-header">
          <div><WordTitle>Transaksi terbaru</WordTitle><p>Transaksi lunas pada {dateLabel(data.end, 'year')}</p></div>
          <Button onClick={() => navigate('penjualan')}>Semua transaksi <ArrowRight size={15} /></Button>
        </header>
        <SaleTable rows={data.recent} onSelect={setReceipt} short />
      </Card>
    </>}
    {receipt && <Receipt sale={receipt} onClose={() => setReceipt(null)} />}
  </>;
}

function MonthlyTarget({ initialMonth }) {
  const api = useOutletApi();
  const [month, setMonth] = useState(initialMonth);
  const resource = useResource('/owner/targets/' + month, 12000);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const target = resource.data;
  const progress = target?.amount ? Math.round(target.revenue / target.amount * 100) : 0;
  return <>
    <Card className="panel target-panel" index={2}>
      <header className="panel-header">
        <div className="target-heading">
          <IconTile icon={Target} color="purple" />
          <div><WordTitle>Target pendapatan</WordTitle><p>{monthLabel(month)}</p></div>
        </div>
        <div className="target-actions">
          <input type="month" aria-label="Bulan target pendapatan" value={month} onChange={event => {
            if (/^\d{4}-\d{2}$/.test(event.target.value)) setMonth(event.target.value);
          }} />
          <Button icon={Pencil} disabled={!target} onClick={() => { setAmount(String(target.amount)); setError(''); setEditing(true); }}>
            Atur target
          </Button>
        </div>
      </header>
      {!target ? <ResourceState error={resource.error} reload={resource.reload} /> : <>
        <div className="target-totals">
          <div><strong>{money(target.revenue)}</strong><span>{target.amount ? ' dari ' + money(target.amount) : ' bulan ini'}</span></div>
          {target.amount > 0 && <Badge color={progress >= 100 ? 'green' : 'purple'} dot={false}>{number(progress)}%</Badge>}
        </div>
        {target.amount > 0 ? <>
          <progress className="target-progress" aria-label="Pencapaian target pendapatan" max="100" value={Math.min(progress, 100)} />
          <p className="field-note">{target.revenue >= target.amount ? 'Target tercapai' : 'Sisa target ' + money(target.amount - target.revenue)}</p>
        </> : <p className="field-note">Target bulan ini belum diatur.</p>}
      </>}
    </Card>
    {editing && <Dialog title="Atur target pendapatan" description={monthLabel(month)} onClose={() => setEditing(false)} busy={busy}>
      <form className="form" onSubmit={async event => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
          await api('/owner/targets/' + month, { method: 'PUT', body: { amount: Number(amount) } });
          resource.reload();
          setEditing(false);
        } catch (problem) { setError(problem.message); }
        finally { setBusy(false); }
      }}>
        <label>Target bulan ini (Rp)<input autoFocus required type="number" inputMode="numeric" min="0" max="1000000000000"
          step="1" value={amount} onChange={event => setAmount(event.target.value)} /></label>
        <p className="field-note">Masukkan 0 untuk melepas target bulan ini.</p>
        <ErrorText text={error} />
        <div className="dialog-actions">
          <Button onClick={() => setEditing(false)} disabled={busy}>Batal</Button>
          <Button kind="primary" type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan target'}</Button>
        </div>
      </form>
    </Dialog>}
  </>;
}

export function OutletOverview({ onSelect, onAdd }) {
  const [day, setDay] = useState(today);
  const { data, error, reload } = useResource('/owner/outlets/summary?day=' + day, 12000);
  return <>
    <SectionHeading title="Semua outlet" description="Lihat penjualan dan kehadiran di setiap usaha.">
      <DateControl value={day} onChange={setDay} />
      <Button kind="primary" icon={Plus} onClick={onAdd}>Tambah outlet</Button>
    </SectionHeading>
    {!data ? <ResourceState error={error} reload={reload} /> : <div className="outlet-grid">
      {data.rows.map((outlet, index) => <Card key={outlet.id} className="panel outlet-summary" index={index} lift>
        <header className="panel-header">
          <div className="target-heading"><IconTile icon={Store} color={['green', 'amber', 'purple', 'blue'][index % 4]} />
            <div><h2>{outlet.name}</h2><p>{outlet.outlet}</p></div>
          </div>
        </header>
        <p className="outlet-sales-label">Pendapatan {dateLabel(day)}</p>
        <strong className="metric-value">{money(outlet.today)}</strong>
        <div className="outlet-summary-line"><span>{number(outlet.transactions)} transaksi</span><span>{number(outlet.present)} hadir</span></div>
        <div className="outlet-month-line">
          <span>{monthLabel(data.month)}</span><strong>{money(outlet.revenue)}{outlet.target > 0 && ' / ' + money(outlet.target)}</strong>
        </div>
        {outlet.target > 0 && <progress aria-label={'Target ' + outlet.name} className="target-progress" max="100" value={Math.min(outlet.revenue / outlet.target * 100, 100)} />}
        <Button icon={ArrowUpRight} onClick={() => onSelect(outlet.id, 'ringkasan')}>Buka outlet</Button>
      </Card>)}
    </div>}
  </>;
}

export function SalesPage() {
  const outletId = useOutletId();
  const [from, setFrom] = useState(() => shift(today(), -6));
  const [to, setTo] = useState(today);
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [receipt, setReceipt] = useState(null);
  const query = new URLSearchParams({ from, to, method, status }).toString();
  const { data, error, reload } = useResource('/owner/sales?' + query + '&page=' + page, 12000);
  return <>
    <SectionHeading title="Penjualan" description="Lihat riwayat transaksi, metode pembayaran, dan pendapatan usaha.">
      <details className="export-picker">
        <summary className="button button-secondary"><ArrowDownToLine size={16} />Ekspor laporan<ChevronDown size={15} /></summary>
        <div className="export-options">
          {[['csv', 'CSV'], ['pdf', 'PDF'], ['xlsx', 'Excel (.xlsx)']].map(([format, label]) => <a key={format}
            href={'/api/owner/sales?' + query + '&outletId=' + outletId + '&format=' + format} download>{label}</a>)}
        </div>
      </details>
    </SectionHeading>
    <div className="metric-grid metric-grid-three">
      <Metric icon={Wallet} color="green" label="Pendapatan" value={data ? money(data.revenue) : '—'} note="Dari transaksi lunas" />
      <Metric icon={ReceiptText} color="blue" label="Transaksi lunas" value={data ? number(data.paid) : '—'} note="Dalam rentang terpilih" index={1} />
      <Metric icon={QrCode} color="amber" label="Menunggu pembayaran" value={data ? number(data.pending) : '—'} note="Transaksi QRIS belum selesai" index={2} />
    </div>
    <Card className="panel">
      <header className="panel-header"><div><WordTitle>Riwayat transaksi</WordTitle><p>{data ? number(data.total) + ' transaksi' : 'Filter transaksi berdasarkan kebutuhan Anda'}</p></div></header>
      <div className="filters">
        <label>Dari<input type="date" value={from} max={to} onChange={event => { if (event.target.value) { setFrom(event.target.value); setPage(1); } }} /></label>
        <label>Sampai<input type="date" value={to} min={from} max={today()} onChange={event => { if (event.target.value) { setTo(event.target.value); setPage(1); } }} /></label>
        <label>Metode<select aria-label="Metode" value={method} onChange={event => { setMethod(event.target.value); setPage(1); }}>
          <option value="">Semua metode</option>{Object.entries(methodLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Status<select aria-label="Status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
          <option value="">Semua status</option><option value="paid">Lunas</option><option value="pending">Menunggu</option><option value="failed">Gagal</option>
        </select></label>
      </div>
      {data ? <>
        <SaleTable rows={data.rows} onSelect={setReceipt} />
        {data.total > data.size && <div className="pagination">
          <span>Halaman {data.page} dari {Math.ceil(data.total / data.size)}</span>
          <Button icon={ChevronLeft} aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => setPage(page - 1)} />
          <Button icon={ChevronRight} aria-label="Halaman berikutnya" disabled={page * data.size >= data.total} onClick={() => setPage(page + 1)} />
        </div>}
      </> : <ResourceState error={error} reload={reload} />}
    </Card>
    {receipt && <Receipt sale={receipt} onClose={() => setReceipt(null)} />}
  </>;
}

function AttendanceDetail({ record, outlet, onClose }) {
  const [label, color] = locationStates[record.venueStatus];
  const outletId = useOutletId();
  return <Dialog title={record.name} description={(record.kind === 'in' ? 'Absen masuk' : 'Absen pulang') + ' · ' + dateLabel(record.timestamp, 'year')} onClose={onClose}>
    {record.hasPhoto
      ? <img className="attendance-photo" src={'/api/attendance/' + record.id + '/photo?outletId=' + outletId} alt={'Selfie absensi ' + record.name} />
      : <div className="photo-placeholder"><Camera size={24} /><span>Selfie tidak tersedia untuk catatan ini</span></div>}
    <div className="receipt-meta">
      <div><span>Waktu tercatat</span><strong>{timeLabel(record.timestamp, true)} WIB</strong></div>
      <div><span>Lokasi</span><Badge color={color}>{label}</Badge></div>
      <div><span>Jarak dari {outlet}</span><strong>{record.distance} m</strong></div>
      <div><span>Akurasi GPS</span><strong>±{Math.round(record.accuracy)} m</strong></div>
      {Boolean(record.livenessVerified) && <div><span>Gerakan wajah</span><Badge color="green">Kedip dan senyum</Badge></div>}
    </div>
    <Suspense fallback={<Pending label="Memuat peta…" />}>
      <OutletMap latitude={record.latitude} longitude={record.longitude} />
    </Suspense>
    <div className="map-link">
      <MapPin size={17} /><span>Pin lokasi absensi</span>
      <a className="text-button" target="_blank" rel="noreferrer" href={'https://www.google.com/maps/search/?api=1&query=' + record.latitude + ',' + record.longitude}>Buka peta <ArrowUpRight size={15} /></a>
    </div>
  </Dialog>;
}

export function AttendancePage({ session }) {
  const [day, setDay] = useState(today);
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);
  const { data, error, reload } = useResource('/owner/attendance?day=' + day, 10000);
  const roster = data?.roster.filter(user => user.active || data.rows.some(row => row.employeeId === user.id)) ?? [];
  const ins = data?.rows.filter(row => row.kind === 'in') ?? [];
  const outs = data?.rows.filter(row => row.kind === 'out') ?? [];
  const review = data?.rows.filter(row => row.venueStatus !== 'onsite') ?? [];
  const visible = roster.filter(user => filter === 'all' || (filter === 'review'
    ? review.some(row => row.employeeId === user.id) : !ins.some(row => row.employeeId === user.id)));
  return <>
    <SectionHeading title="Absensi karyawan" description="Tinjau jam kerja, selfie, dan posisi GPS setiap absensi.">
      <DateControl value={day} onChange={setDay} />
    </SectionHeading>
    <div className="metric-grid metric-grid-three">
      <Metric icon={UserRoundCheck} color="green" label="Absen masuk" value={data ? ins.length : '—'} note="Karyawan sudah check-in" />
      <Metric icon={ClipboardList} color="blue" label="Absen pulang" value={data ? outs.length : '—'} note="Karyawan sudah check-out" index={1} />
      <Metric icon={MapPin} color="amber" label="Lokasi perlu ditinjau" value={data ? review.length : '—'} note="Di luar radius atau GPS kurang akurat" index={2} />
    </div>
    <Card className="panel">
      <header className="panel-header">
        <div><WordTitle>Daftar absensi</WordTitle><p>{dateLabel(day, 'long')}</p></div>
        <select className="compact-select" aria-label="Filter absensi" value={filter} onChange={event => setFilter(event.target.value)}>
          <option value="all">Semua karyawan</option><option value="review">Perlu ditinjau</option><option value="missing">Belum masuk</option>
        </select>
      </header>
      {!data ? <ResourceState error={error} reload={reload} /> : !visible.length
        ? <Empty icon={CalendarDays} title="Tidak ada catatan">Ganti tanggal atau filter untuk melihat catatan lain.</Empty>
        : <div className="table-overflow"><table>
          <thead><tr><th>Karyawan</th><th>Masuk</th><th>Pulang</th><th>Lokasi terakhir</th></tr></thead>
          <tbody>{visible.map((user, index) => {
            const arrival = ins.find(row => row.employeeId === user.id);
            const departure = outs.find(row => row.employeeId === user.id);
            const last = departure ?? arrival;
            const point = locationStates[last?.venueStatus];
            const cell = record => record ? <button type="button" className="text-button table-time" onClick={() => setDetail(record)}>{timeLabel(record.timestamp)} WIB {record.hasPhoto && <Camera size={15} />}</button> : <span className="muted">—</span>;
            return <tr key={user.id}>
              <td><div className="person-cell"><Avatar name={user.name} color={['green', 'blue', 'amber', 'purple'][index % 4]} /><strong>{user.name}</strong></div></td>
              <td>{cell(arrival)}</td><td>{cell(departure)}</td>
              <td>{point ? <Badge color={point[1]}>{point[0]}</Badge> : <Badge>Belum absen</Badge>}</td>
            </tr>;
          })}</tbody>
        </table></div>}
    </Card>
    {detail && <AttendanceDetail record={detail} outlet={session.store.outlet} onClose={() => setDetail(null)} />}
  </>;
}

export function CatalogPage({ employees = false, notify }) {
  const api = useOutletApi();
  const endpoint = employees ? '/owner/employees' : '/owner/products';
  const { data, error, reload } = useResource(employees ? endpoint : '/products');
  const [editor, setEditor] = useState(null);
  const noun = employees ? 'karyawan' : 'produk';
  const openForm = row => setEditor({
    id: row?.id, name: row?.name ?? '', category: row?.category ?? '', price: row?.price ?? '',
    username: row?.username ?? '', password: '', active: row ? Boolean(row.active) : true,
    costComponents: (row?.costComponents ?? []).map((component, index) => ({ ...component, key: 'saved-' + index })),
  });
  return <>
    <SectionHeading title={employees ? 'Karyawan' : 'Produk'} description={employees
      ? 'Kelola akun dan akses kasir untuk tim Anda.' : 'Kelola barang dan menu yang tersedia di kasir.'}>
      <Button kind="primary" icon={Plus} onClick={() => openForm()}>Tambah {noun}</Button>
    </SectionHeading>
    <Card className="panel">
      <header className="panel-header"><div><WordTitle>{'Daftar ' + noun}</WordTitle><p>{data ? data.rows.length + ' ' + noun : 'Memuat daftar'}</p></div></header>
      {!data ? <ResourceState error={error} reload={reload} /> : !data.rows.length
        ? <Empty icon={employees ? Users : Package} title={'Belum ada ' + noun}>Tambahkan {noun} untuk mulai menggunakan kasir.</Empty>
        : <div className="table-overflow"><table>
          <thead><tr><th>Nama</th><th>{employees ? 'Nama pengguna' : 'Kategori'}</th>
            {!employees && <><th>Harga</th><th>HPP per produk</th><th>Laba/rugi per unit</th></>}<th>Status</th><th className="align-right">Aksi</th></tr></thead>
          <tbody>{data.rows.map((row, index) => <tr key={row.id}>
            <td><div className="person-cell">{employees ? <Avatar name={row.name} color={['green', 'blue', 'amber', 'purple'][index % 4]} /> : <IconTile icon={Coffee} color="amber" />}<strong>{row.name}</strong></div></td>
            <td>{employees ? row.username : row.category}</td>
            {!employees && <><td className="amount-cell">{money(row.price)}</td>
              <td className="amount-cell">{row.costComponents.length ? money(row.costTotal) : '—'}</td>
              <td className={'amount-cell' + (row.costTotal > row.price ? ' negative-value' : '')}>
                {row.costComponents.length ? money(row.price - row.costTotal) : '—'}
              </td></>}
            <td><Badge color={row.active ? 'green' : 'neutral'}>{row.active ? 'Aktif' : 'Nonaktif'}</Badge></td>
            <td className="align-right"><Button icon={Pencil} onClick={() => openForm(row)} aria-label={'Edit ' + row.name}>Edit</Button></td>
          </tr>)}</tbody>
        </table></div>}
    </Card>
    {editor && <CatalogEditor employees={employees} noun={noun} editor={editor} close={() => setEditor(null)} save={async fields => {
      await api(endpoint + (editor.id ? '/' + editor.id : ''), { method: editor.id ? 'PUT' : 'POST', body: fields });
      setEditor(null);
      reload();
      notify((employees ? 'Karyawan' : 'Produk') + ' berhasil disimpan.');
    }} />}
  </>;
}

function CatalogEditor({ employees, noun, editor, close, save }) {
  const [form, setForm] = useState(editor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function edit(key, value) { setForm(prev => ({ ...prev, [key]: value })); }
  function editCost(key, field, value) {
    setForm(prev => ({ ...prev, costComponents: prev.costComponents.map(cost => cost.key === key ? { ...cost, [field]: value } : cost) }));
  }
  const totalCost = form.costComponents.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  return <Dialog title={(editor.id ? 'Edit ' : 'Tambah ') + noun} onClose={close} busy={busy}>
    <form className="form" onSubmit={async event => {
      event.preventDefault();
      setBusy(true);
      setError('');
      try {
        await save(employees ? form : {
          ...form, price: Number(form.price),
          costComponents: form.costComponents.map(({ name, amount }) => ({ name, amount: Number(amount) })),
        });
      }
      catch (problem) { setError(problem.message); }
      finally { setBusy(false); }
    }}>
      <label>Nama<input autoFocus required maxLength={70} value={form.name} onChange={event => edit('name', event.target.value)} /></label>
      {employees ? <>
        <label>Nama pengguna<input required pattern={String.raw`[a-zA-Z0-9._\-]{3,40}`} value={form.username} onChange={event => edit('username', event.target.value)} /></label>
        <label>Kata sandi{editor.id ? ' baru (opsional)' : ''}<input required={!editor.id} type="password" minLength={12} maxLength={128} autoComplete="new-password" value={form.password} onChange={event => edit('password', event.target.value)} /></label>
      </> : <>
        <label>Kategori<input required maxLength={40} value={form.category} onChange={event => edit('category', event.target.value)} /></label>
        <label>Harga (Rp)<input required type="number" min={100} max={100000000} value={form.price} onChange={event => edit('price', event.target.value)} /></label>
        <fieldset className="hpp-fields">
          <legend>Harga pokok produk (HPP)</legend>
          <p className="field-note">Isi biaya tiap komponen untuk satu produk.</p>
          {form.costComponents.map((cost, index) => <div className="hpp-line" key={cost.key}>
            <label>Komponen {index + 1}<input required maxLength={70} value={cost.name} onChange={event => editCost(cost.key, 'name', event.target.value)} /></label>
            <label>Biaya (Rp)<input required type="number" inputMode="numeric" min="0" max="100000000" step="1"
              value={cost.amount} onChange={event => editCost(cost.key, 'amount', event.target.value)} /></label>
            <button type="button" className="icon-button" aria-label={'Hapus komponen ' + (index + 1)}
              onClick={() => setForm(prev => ({ ...prev, costComponents: prev.costComponents.filter(row => row.key !== cost.key) }))}>
              <Trash2 size={16} />
            </button>
          </div>)}
          <Button icon={Plus} disabled={form.costComponents.length >= 24} onClick={() => setForm(prev => ({
            ...prev, costComponents: [...prev.costComponents, { key: crypto.randomUUID(), name: '', amount: '' }],
          }))}>Tambah komponen</Button>
          <div className="hpp-total"><span>Total HPP per produk</span><strong>{money(totalCost)}</strong></div>
        </fieldset>
      </>}
      <label className="checkbox"><input type="checkbox" checked={form.active} onChange={event => edit('active', event.target.checked)} />{employees ? 'Izinkan masuk ke panel karyawan' : 'Tampilkan di kasir'}</label>
      <ErrorText text={error} />
      <div className="dialog-actions"><Button onClick={close} disabled={busy}>Batal</Button><Button kind="primary" type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button></div>
    </form>
  </Dialog>;
}

export function SettingsPage({ updateSession, notify }) {
  const settings = useResource('/owner/settings');
  return <>
    <SectionHeading title="Pengaturan outlet" description="Atur profil usaha, area absensi, dan pembayaran QRIS." />
    {settings.data ? <SettingsForm defaults={settings.data} updateSession={updateSession} notify={notify} />
      : <ResourceState error={settings.error} reload={settings.reload} />}
  </>;
}

function SettingsForm({ defaults, updateSession, notify }) {
  const api = useOutletApi();
  const [form, setForm] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [addressQuery, setAddressQuery] = useState(() => (defaults.address ?? '').slice(0, 170));
  const [matches, setMatches] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const edit = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  function setPin(latitude, longitude, address = '') {
    setForm(prev => ({ ...prev, latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)), address }));
    setMatches(null);
  }
  const labels = { sandbox: 'Midtrans sandbox', live: 'Midtrans aktif', off: 'Belum terhubung' };
  async function findAddress() {
    const query = addressQuery.trim();
    if (searching || query.length < 3) return;
    setSearchError('');
    setMatches(null);
    setSearching(true);
    try {
      const result = await api('/owner/address-search?' + new URLSearchParams({ q: query }));
      setMatches(result.rows);
    } catch (problem) { setSearchError(problem.message); }
    finally { setSearching(false); }
  }
  async function readQr(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      if (file.size > 10_000_000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Pilih gambar PNG, JPG, atau WebP hingga 10 MB.');
      const [{ default: decode }, bitmap] = await Promise.all([import('jsqr'), createImageBitmap(file)]);
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const drawing = canvas.getContext('2d', { willReadFrequently: true });
      drawing.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const pixels = drawing.getImageData(0, 0, canvas.width, canvas.height);
      const code = decode(pixels.data, canvas.width, canvas.height);
      if (!code) throw new Error('Kode QR tidak terbaca. Gunakan gambar yang lebih jelas.');
      edit('staticQris', code.data);
      notify('Kode QR terbaca. Simpan untuk mengaktifkannya.');
    } catch (problem) {
      setError(problem.message);
    }
  }

  function locate() {
    if (!navigator.geolocation) { setError('Perangkat ini tidak menyediakan GPS. Tentukan pin di peta.'); return; }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setPin(coords.latitude, coords.longitude);
      setLocating(false);
    }, () => {
      setError('Lokasi belum terbaca. Periksa izin perangkat atau tentukan pin di peta.');
      setLocating(false);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  }

  return <form className="settings-grid" onSubmit={async event => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const session = await api('/owner/settings', {
        method: 'PUT',
        body: {
          ...form, radius: Number(form.radius), staticQris: form.staticQris.trim(),
        },
      });
      updateSession(session);
      notify('Pengaturan berhasil disimpan.');
    } catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  }}>
    <Card className="panel settings-card">
      <header className="panel-header"><div><WordTitle>Profil usaha</WordTitle><p>Nama yang muncul di seluruh panel.</p></div><IconTile icon={Coffee} /></header>
      <div className="form"><label>Nama usaha<input required maxLength={70} value={form.name} onChange={event => edit('name', event.target.value)} /></label>
        <label>Nama outlet<input required maxLength={70} value={form.outlet} onChange={event => edit('outlet', event.target.value)} /></label></div>
    </Card>
    <Card className="panel settings-card" index={1}>
      <header className="panel-header"><div><WordTitle>Area absensi</WordTitle><p>Lokasi ini menjadi titik acuan jarak GPS.</p></div><IconTile icon={MapPin} color="blue" /></header>
      <div className="form">
        <div className="address-search">
          <label>Cari berdasarkan alamat<input value={addressQuery} maxLength={170} disabled={searching}
            placeholder="Nama jalan, gedung, atau kota" onChange={event => {
              setAddressQuery(event.target.value); setMatches(null); setSearchError('');
            }} onKeyDown={event => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); findAddress(); }
            }} /></label>
          <Button icon={Search} disabled={searching || addressQuery.trim().length < 3} onClick={findAddress}>{searching ? 'Mencari…' : 'Cari alamat'}</Button>
        </div>
        <ErrorText text={searchError} />
        {matches?.length === 0 && <p className="field-note">Alamat belum ditemukan. Tambahkan nama kecamatan atau kota.</p>}
        {!!matches?.length && <ul className="address-results" aria-label="Hasil pencarian alamat">
          {matches.map(match => <li key={match.latitude + ':' + match.longitude}>
            <button type="button" onClick={() => { setPin(match.latitude, match.longitude, match.label); setAddressQuery(match.label.slice(0, 170)); }}>
              <MapPin size={16} />{match.label}
            </button>
          </li>)}
        </ul>}
        <Suspense fallback={<Pending label="Memuat peta…" />}>
          <OutletMap latitude={form.latitude} longitude={form.longitude} radius={Number(form.radius)} onSelect={setPin} />
        </Suspense>
        {form.address && <p className="field-note address-label">{form.address}</p>}
        <label>Radius (meter)<input required type="number" min={25} max={5000} value={form.radius} onChange={event => edit('radius', event.target.value)} /></label>
        <div className="pin-actions">
          <Button icon={Crosshair} onClick={locate} disabled={locating}>{locating ? 'Membaca GPS…' : 'Gunakan lokasi saya'}</Button>
          {form.latitude != null && <Badge color="green">Pin terpasang</Badge>}
        </div>
      </div>
    </Card>
    <Card className="panel settings-card settings-wide" index={2}>
      <header className="panel-header"><div><WordTitle>Pembayaran QRIS</WordTitle><p>Hubungkan QRIS dari penyedia layanan pembayaran Anda.</p></div><IconTile icon={QrCode} color="purple" /></header>
      <div className="form">
        <label>Kode QRIS statis<textarea rows={3} maxLength={1000} value={form.staticQris} onChange={event => edit('staticQris', event.target.value)} placeholder="Tempel kode merchant atau baca dari gambar QR." /></label>
        <label className="button button-secondary upload-button"><ImagePlus size={16} />Baca gambar QR<input type="file" accept="image/png,image/jpeg,image/webp" onChange={readQr} /></label>
        <p className="field-note">Kasir mengonfirmasi QRIS statis setelah dana terlihat di aplikasi merchant.</p>
        <div className="setting-status"><div><strong>QRIS dinamis</strong><p>Status pembayaran ditarik dari Midtrans.</p></div><Badge color={defaults.dynamic === 'off' ? 'neutral' : 'green'}>{labels[defaults.dynamic]}</Badge></div>
      </div>
    </Card>
    <div className="settings-wide form-footer"><ErrorText text={error} /><Button kind="primary" type="submit" disabled={busy || locating}>{busy ? 'Menyimpan…' : 'Simpan pengaturan'}</Button></div>
  </form>;
}
