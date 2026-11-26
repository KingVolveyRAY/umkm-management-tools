import { useId, useState } from 'react';
import {
  ArrowDownToLine, ArrowRight, ArrowUpRight, Bell, CalendarDays,
  Camera, ChevronLeft, ChevronRight, ClipboardList, Coffee, Crosshair, ImagePlus,
  MapPin, Package, Pencil, Plus, QrCode, ReceiptText, Target, UserRoundCheck, Users, Wallet,
} from 'lucide-react';
import {
  api, Avatar, Badge, Button, Card, change, DateControl, dateLabel, Dialog, Empty, ErrorText,
  IconTile, locationStates, methodLabels, money, NoticeList, number, Receipt, ResourceState,
  SaleTable, SectionHeading, shift, timeLabel, today, Trend, useResource, WordTitle,
} from './common.jsx';

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
              <stop offset="0%" stopColor="#c9e2bf" stopOpacity=".8" /><stop offset="100%" stopColor="#e9f3e5" stopOpacity=".26" />
            </linearGradient></defs>
            {ticks.map(tick => {
              const y = floor - tick * (floor - ceiling);
              return <line key={tick} x1="0" y1={y} x2={width} y2={y} stroke="#ebefe8" strokeDasharray={tick ? '4 4' : undefined} vectorEffect="non-scaling-stroke" />;
            })}
            <path d={fill} fill={'url(#' + id + ')'} />
            <path d={path} fill="none" stroke="#43814e" strokeWidth="2.7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {active && <line x1={active.x} y1={ceiling} x2={active.x} y2={floor} stroke="#a6bd9b" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
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

export function SalesPage() {
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
      <a className="button button-secondary" href={'/api/owner/sales?' + query + '&format=csv'} download><ArrowDownToLine size={16} />Ekspor CSV</a>
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
  return <Dialog title={record.name} description={(record.kind === 'in' ? 'Absen masuk' : 'Absen pulang') + ' · ' + dateLabel(record.timestamp, 'year')} onClose={onClose}>
    {record.hasPhoto
      ? <img className="attendance-photo" src={'/api/attendance/' + record.id + '/photo'} alt={'Selfie absensi ' + record.name} />
      : <div className="photo-placeholder"><Camera size={24} /><span>Selfie tidak tersedia untuk catatan ini</span></div>}
    <div className="receipt-meta">
      <div><span>Waktu tercatat</span><strong>{timeLabel(record.timestamp, true)} WIB</strong></div>
      <div><span>Lokasi</span><Badge color={color}>{label}</Badge></div>
      <div><span>Jarak dari {outlet}</span><strong>{record.distance} m</strong></div>
      <div><span>Akurasi GPS</span><strong>±{Math.round(record.accuracy)} m</strong></div>
    </div>
    <div className="map-link">
      <MapPin size={17} /><span>{record.latitude.toFixed(6)}, {record.longitude.toFixed(6)}</span>
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
  const endpoint = employees ? '/owner/employees' : '/owner/products';
  const { data, error, reload } = useResource(employees ? endpoint : '/products');
  const [editor, setEditor] = useState(null);
  const noun = employees ? 'karyawan' : 'produk';
  const openForm = row => setEditor({
    id: row?.id, name: row?.name ?? '', category: row?.category ?? '', price: row?.price ?? '',
    username: row?.username ?? '', password: '', active: row ? Boolean(row.active) : true,
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
          <thead><tr><th>Nama</th><th>{employees ? 'Nama pengguna' : 'Kategori'}</th>{!employees && <th>Harga</th>}<th>Status</th><th className="align-right">Aksi</th></tr></thead>
          <tbody>{data.rows.map((row, index) => <tr key={row.id}>
            <td><div className="person-cell">{employees ? <Avatar name={row.name} color={['green', 'blue', 'amber', 'purple'][index % 4]} /> : <IconTile icon={Coffee} color="amber" />}<strong>{row.name}</strong></div></td>
            <td>{employees ? row.username : row.category}</td>
            {!employees && <td className="amount-cell">{money(row.price)}</td>}
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
  return <Dialog title={(editor.id ? 'Edit ' : 'Tambah ') + noun} onClose={close} busy={busy}>
    <form className="form" onSubmit={async event => {
      event.preventDefault();
      setBusy(true);
      setError('');
      try { await save(employees ? form : { ...form, price: Number(form.price) }); }
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
  const [form, setForm] = useState({
    ...defaults, latitude: defaults.latitude ?? '', longitude: defaults.longitude ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const edit = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const labels = { demo: 'Mode demo', sandbox: 'Midtrans sandbox', live: 'Midtrans aktif', off: 'Belum terhubung' };
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
    if (!navigator.geolocation) { setError('Perangkat ini tidak menyediakan GPS. Isi koordinat secara manual.'); return; }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setForm(prev => ({ ...prev, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) }));
      setLocating(false);
    }, () => {
      setError('Lokasi tidak dapat dibaca. Periksa izin lokasi atau isi koordinat secara manual.');
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
          ...form, radius: Number(form.radius), latitude: form.latitude === '' ? null : Number(form.latitude),
          longitude: form.longitude === '' ? null : Number(form.longitude), staticQris: form.staticQris.trim(),
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
        <div className="form-pair">
          <label>Latitude<input type="number" step="any" min={-90} max={90} value={form.latitude} onChange={event => edit('latitude', event.target.value)} /></label>
          <label>Longitude<input type="number" step="any" min={-180} max={180} value={form.longitude} onChange={event => edit('longitude', event.target.value)} /></label>
        </div>
        <label>Radius (meter)<input required type="number" min={25} max={5000} value={form.radius} onChange={event => edit('radius', event.target.value)} /></label>
        <Button icon={Crosshair} onClick={locate} disabled={locating}>{locating ? 'Membaca GPS…' : 'Gunakan lokasi saya'}</Button>
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
