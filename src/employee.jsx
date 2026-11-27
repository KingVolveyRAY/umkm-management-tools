import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Banknote, Camera, Check, ChevronRight, Clock3, Coffee, Crosshair,
  Croissant, CupSoda, History, LogIn, LogOut, MapPin, Minus, Plus, QrCode, ReceiptText,
  RefreshCw, ScanFace, Search, ShoppingBag, Trash2, Video,
} from 'lucide-react';
import {
  api, Badge, Button, Card, dateLabel, Dialog, Empty, ErrorText, IconTile, locationStates, methodLabels,
  money, Pending, Receipt, ResourceState, saleStates, SectionHeading, TimeChip,
  timeLabel, today, useResource, WordTitle,
} from './common.jsx';
import { livenessLabels } from './liveness.js';
import { useFaceVerification } from './use-face-verification.js';

const productIcon = category => /makanan|roti|snack/i.test(category) ? [Croissant, 'amber']
  : /^(non|minum)/i.test(category) ? [CupSoda, 'purple'] : [Coffee, 'green'];

export function PointOfSale({ session, notify }) {
  const { data, error, reload } = useResource('/products', 18000);
  const history = useResource('/sales');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [cart, setCart] = useState({});
  const [payment, setPayment] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const cartRef = useRef(null);
  const products = data?.rows ?? [];
  const categories = [...new Set(products.map(product => product.category))];
  const visible = products.filter(product => (!category || product.category === category)
    && (product.name + ' ' + product.category).toLowerCase().includes(search.trim().toLowerCase()));
  const cartItems = products.filter(product => cart[product.id]).map(product => ({ ...product, quantity: cart[product.id] }));
  const amount = cartItems.reduce((sum, product) => sum + product.price * product.quantity, 0);
  const count = cartItems.reduce((sum, product) => sum + product.quantity, 0);
  const adjust = (id, amount) => setCart(current => {
    const next = { ...current };
    const quantity = (next[id] ?? 0) + amount;
    if (quantity < 1) delete next[id];
    else next[id] = Math.min(99, quantity);
    return next;
  });
  return <>
    <SectionHeading title="Kasir" description="Pilih produk, buat transaksi, dan terima pembayaran di outlet.">
      <Button icon={History} onClick={() => { history.reload(); setShowHistory(true); }}>Riwayat kasir</Button>
      {!!count && <Button className="cart-jump" icon={ShoppingBag} onClick={() => cartRef.current?.focus()}>Keranjang ({count})</Button>}
    </SectionHeading>
    <div className="pos-layout">
      <section className="pos-catalog">
        <div className="search-field">
          <Search size={19} aria-hidden="true" />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari nama produk…" aria-label="Cari produk" />
        </div>
        {data && <div className="category-list" aria-label="Kategori produk">
          {['', ...categories].map(name => <button type="button" key={name} aria-pressed={category === name}
            className={'category-button ' + (category === name ? 'selected' : '')} onClick={() => setCategory(name)}>{name || 'Semua produk'}</button>)}
        </div>}
        {!data ? <ResourceState error={error} reload={reload} /> : visible.length ? <div className="product-grid">
          {visible.map((product, index) => {
            const [Icon, color] = productIcon(product.category);
            return <Card as="button" type="button" lift index={index} className="product-card" key={product.id} aria-label={'Tambah ' + product.name} onClick={() => adjust(product.id, 1)}>
              <div className={'product-art tint-' + color}><Icon aria-hidden="true" strokeWidth={1.5} size={30} /><span className="product-plus"><Plus size={16} /></span></div>
              <div className="product-copy"><span>{product.category}</span><strong>{product.name}</strong><b>{money(product.price)}</b></div>
            </Card>;
          })}
        </div> : <Card><Empty icon={Search} title="Produk tidak ditemukan">Coba kata kunci atau kategori yang lain.</Empty></Card>}
      </section>
      <Card className="panel cart-panel" index={1} ref={cartRef} tabIndex={-1} data-lenis-prevent>
        <header className="panel-header">
          <div><WordTitle>Keranjang</WordTitle><p>{count} item</p></div>
          {count > 0 && <button type="button" className="icon-button" aria-label="Kosongkan keranjang" onClick={() => setCart({})}><Trash2 size={18} /></button>}
        </header>
        {cartItems.length ? <div className="cart-items">{cartItems.map(product => <div className="cart-row" key={product.id}>
          <div><strong>{product.name}</strong><span>{money(product.price)}</span></div>
          <div className="stepper">
            <button type="button" aria-label={'Kurangi ' + product.name} onClick={() => adjust(product.id, -1)}><Minus size={14} /></button>
            <span>{product.quantity}</span>
            <button type="button" aria-label={'Tambah lagi ' + product.name} disabled={product.quantity >= 99} onClick={() => adjust(product.id, 1)}><Plus size={14} /></button>
          </div>
        </div>)}</div> : <Empty icon={ShoppingBag} title="Keranjang masih kosong">Pilih produk untuk memulai transaksi.</Empty>}
        <div className="cart-footer">
          <div><span>Total pembayaran</span><strong>{money(amount)}</strong></div>
          <Button kind="primary" disabled={!count} onClick={() => setPayment({ items: cartItems, total: amount })}>Lanjut bayar <ArrowRight size={17} /></Button>
        </div>
      </Card>
    </div>
    {showHistory && <Dialog title="Riwayat kasir" description="Transaksi terakhir dari akun Anda." onClose={() => setShowHistory(false)}>
      {!history.data ? <ResourceState error={history.error} reload={history.reload} /> : !history.data.rows.length
        ? <Empty icon={ReceiptText} title="Belum ada transaksi" /> : <div className="history-list">
          {history.data.rows.map(sale => {
            const [label, color] = saleStates[sale.status];
            return <button type="button" className="history-row" key={sale.id} onClick={() => {
              setShowHistory(false);
              if (sale.status === 'pending') setPayment({ sale, total: sale.amount });
              else setReceipt(sale);
            }}>
              <IconTile icon={sale.method === 'cash' ? Banknote : QrCode} />
              <span><strong>{money(sale.amount)}</strong><small>{methodLabels[sale.method]} · {dateLabel(sale.createdAt)} {timeLabel(sale.createdAt)}</small></span>
              <Badge color={color}>{label}</Badge><ChevronRight size={16} />
            </button>;
          })}
        </div>}
    </Dialog>}
    {payment && <PaymentDialog session={session} draft={payment}
      close={() => { setPayment(null); history.reload(); }} notify={notify}
      onCreated={() => { setCart({}); history.reload(); }} />}
    {receipt && <Receipt sale={receipt} onClose={() => setReceipt(null)} />}
  </>;
}

function PaymentDialog({ session, draft, onCreated, close, notify }) {
  const [sale, setSale] = useState(draft.sale ?? null);
  const [method, setMethod] = useState('cash');
  const [cash, setCash] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [qrVersion, setQrVersion] = useState(0);
  const [imageError, setImageError] = useState(false);
  const request = useRef(null);
  const paidToast = useRef(false);
  const pendingDynamic = sale?.status === 'pending' && sale.provider === 'midtrans';
  const saleId = sale?.id;
  const methods = [
    { key: 'cash', icon: Banknote, enabled: true, copy: 'Terima uang tunai' },
    { key: 'qris_static', icon: QrCode, enabled: session.payments.static, copy: 'Konfirmasi di kasir' },
    { key: 'qris_dynamic', icon: QrCode, enabled: session.payments.dynamic, copy: 'Nominal otomatis' },
  ];
  useEffect(() => {
    if (!pendingDynamic) return undefined;
    const controller = new AbortController();
    let checking = false;
    const poll = async () => {
      if (checking) return;
      checking = true;
      try {
        const updated = await api('/sales/' + saleId, { signal: controller.signal });
        if (!controller.signal.aborted) setSale(previous => previous.status === 'pending' ? updated : previous);
      } catch { /* The manual status button offers a retry if polling fails. */ }
      finally { checking = false; }
    };
    poll();
    const timer = setInterval(() => { if (!document.hidden) poll(); }, 7000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [pendingDynamic, saleId]);

  useEffect(() => {
    if (sale?.status === 'paid' && !paidToast.current) {
      paidToast.current = true;
      notify('Pembayaran tercatat.');
    }
  }, [sale?.status, notify]);

  async function perform(action, after) {
    setError('');
    setBusy(true);
    try {
      const result = await action();
      setSale(previous => previous?.status === 'paid' ? previous : result);
      after?.();
    } catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  }

  function create(event) {
    event.preventDefault();
    const body = {
      method, items: draft.items.map(({ id, quantity }) => ({ id, quantity })),
      cashReceived: method === 'cash' ? Number(cash) : undefined,
    };
    const fingerprint = JSON.stringify(body);
    if (request.current?.fingerprint !== fingerprint) {
      request.current = { fingerprint, id: crypto.randomUUID() };
    }
    perform(() => api('/sales', { method: 'POST', body: { ...body, requestId: request.current.id } }), onCreated);
  }

  if (sale?.status === 'paid') return <Receipt sale={sale} onClose={close} />;
  if (sale?.status === 'failed') return <Dialog title="Pembayaran berakhir" description={sale.id} onClose={close}>
    <ErrorText text="Payment gateway melaporkan transaksi gagal, dibatalkan, atau kedaluwarsa." />
    <div className="dialog-actions"><Button kind="primary" onClick={close}>Tutup</Button></div>
  </Dialog>;
  if (sale) {
    const demo = sale.provider === 'demo';
    const manual = sale.provider === 'merchant';
    return <Dialog title={methodLabels[sale.method]} description={sale.id} onClose={close} busy={busy}>
      <div className="payment-summary"><span>Total pembayaran</span><strong>{money(sale.amount)}</strong></div>
      <div className="qr-box">
        {sale.qr && !imageError ? <img src={'/api/sales/' + sale.id + '/qr?v=' + qrVersion} alt={demo ? 'Kode QR simulasi' : 'Kode QRIS transaksi'}
          onError={() => setImageError(true)} /> : <span><QrCode size={36} /><small>{imageError ? 'QR belum bisa dimuat' : 'QR belum tersedia'}</small></span>}
      </div>
      <div className="qr-note">
        <Badge color={demo || session.payments.sandbox && !manual ? 'purple' : 'amber'}>
          {demo ? 'Simulasi' : session.payments.sandbox && !manual ? 'Sandbox' : 'Menunggu pembayaran'}
        </Badge>
        <p>{demo ? 'Kode ini untuk pengujian alur kasir dan tidak menerima dana.'
          : manual ? 'Minta pelanggan memasukkan nominal di aplikasi pembayaran. Pastikan dana sesuai sebelum mengonfirmasi.'
          : session.payments.sandbox ? 'Uji transaksi dengan fasilitas sandbox Midtrans.'
          : 'Minta pelanggan memindai. Status diperbarui setelah Midtrans mengonfirmasi pembayaran.'}</p>
      </div>
      <ErrorText text={error || (sale.paymentCheckUnavailable ? 'Pemeriksaan gateway sedang tertunda. Anda dapat mencoba lagi pada transaksi ini.' : '')} />
      <div className="dialog-actions">
        {sale.qr && imageError && <Button icon={RefreshCw} onClick={() => { setQrVersion(value => value + 1); setImageError(false); }}>Muat ulang QR</Button>}
        {demo || manual
          ? <Button kind="primary" icon={Check} disabled={busy} onClick={() => perform(() => api('/sales/' + sale.id + '/confirm', { method: 'POST', body: {} }))}>
            {busy ? 'Memproses…' : demo ? 'Simulasikan pembayaran' : 'Dana sudah diterima'}
          </Button>
          : <Button kind="primary" icon={RefreshCw} disabled={busy} onClick={() => perform(() => api('/sales/' + sale.id + (sale.qr ? '' : '/retry'),
            sale.qr ? undefined : { method: 'POST', body: {} }))}>{busy ? 'Memeriksa…' : sale.qr ? 'Cek status' : 'Coba buat QR lagi'}</Button>}
      </div>
    </Dialog>;
  }
  return <Dialog title="Pembayaran" description="Pilih cara pelanggan membayar." onClose={close} busy={busy}>
    <form className="form" onSubmit={create}>
      <div className="payment-summary"><span>Total pembayaran</span><strong>{money(draft.total)}</strong></div>
      <div className="payment-options" aria-label="Metode pembayaran">
        {methods.map(option => <button type="button" key={option.key} disabled={!option.enabled || busy}
          aria-pressed={method === option.key} className={'payment-option ' + (method === option.key ? 'selected' : '')}
          onClick={() => { setMethod(option.key); setError(''); }}>
          <option.icon size={19} /><strong>{methodLabels[option.key]}</strong><small>{option.enabled ? option.copy : 'Belum diatur'}</small>
        </button>)}
      </div>
      {method === 'cash' && <>
        <label>Uang diterima (Rp)<input required autoFocus inputMode="numeric" type="number" min={draft.total} value={cash} onChange={event => setCash(event.target.value)} /></label>
        <div className="cash-line"><button type="button" className="text-button" onClick={() => setCash(String(draft.total))}>Uang pas</button><span>Kembalian <strong>{money(Math.max(0, Number(cash) - draft.total))}</strong></span></div>
      </>}
      <ErrorText text={error} />
      <div className="dialog-actions">
        <Button icon={ArrowLeft} onClick={close} disabled={busy}>Kembali</Button>
        <Button kind="primary" type="submit" disabled={busy || method === 'cash' && Number(cash) < draft.total}>{busy ? 'Memproses…' : method === 'cash' ? 'Catat pembayaran' : 'Tampilkan QR'}</Button>
      </div>
    </form>
  </Dialog>;
}

export function EmployeeAttendance({ session, notify }) {
  const { data, error, reload } = useResource('/attendance', 12000);
  const [dialog, setDialog] = useState(null);
  const [updated, setUpdated] = useState(null);
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date().toISOString()), 1000);
    return () => clearInterval(interval);
  }, []);
  const records = updated?.day === today() && updated.rows.length > (data?.rows.length || 0) ? updated.rows : data?.rows ?? [];
  const arrival = records.find(row => row.kind === 'in');
  const departure = records.find(row => row.kind === 'out');
  return <>
    <SectionHeading title="Absensi saya" description="Catat waktu masuk dan pulang di lokasi kerja Anda." />
    <div className="attendance-layout">
      <Card className="panel clock-panel">
        <header className="panel-header"><div><WordTitle>Absensi hari ini</WordTitle><p>{dateLabel(now, 'long')}</p></div><IconTile icon={Clock3} /></header>
        <div className="clock-display"><strong>{timeLabel(now)}</strong><span>WIB</span></div>
        <div className="clock-location"><MapPin size={16} />{session.store.name} · {session.store.outlet}</div>
        <div className="attendance-buttons">
          <Button icon={LogIn} kind="primary" disabled={!data || !!arrival || !session.store.venueConfigured} onClick={() => setDialog('in')}>Absen masuk</Button>
          <Button icon={LogOut} disabled={!data || !arrival || !!departure || !session.store.venueConfigured} onClick={() => setDialog('out')}>Absen pulang</Button>
        </div>
        {!session.store.venueConfigured && <p className="field-note">Minta pemilik mengatur lokasi outlet sebelum absen.</p>}
      </Card>
      <Card className="panel attendance-history" index={1}>
        <header className="panel-header"><div><WordTitle>Catatan hari ini</WordTitle><p>Riwayat masuk dan pulang dari akun Anda</p></div></header>
        {!data && !updated ? <ResourceState error={error} reload={reload} /> : !records.length
          ? <Empty icon={Clock3} title="Belum ada absensi">Mulai dengan absen masuk saat tiba di outlet.</Empty>
          : <div className="attendance-records">{records.map(record => {
            const [label, color] = locationStates[record.venueStatus];
            return <div key={record.id} className="attendance-record">
              <IconTile icon={record.kind === 'in' ? LogIn : LogOut} />
              <div><strong>{record.kind === 'in' ? 'Absen masuk' : 'Absen pulang'}</strong><span>{record.distance} m dari outlet</span></div>
              <div><TimeChip timestamp={record.timestamp} /><Badge color={color}>{label}</Badge></div>
            </div>;
          })}</div>}
      </Card>
    </div>
    {dialog && <CaptureAttendance kind={dialog} session={session} close={() => setDialog(null)} complete={result => {
      setUpdated(result);
      setDialog(null);
      reload();
      notify('Absensi berhasil dicatat.');
    }} />}
  </>;
}

function CaptureAttendance({ kind, session, close, complete }) {
  const video = useRef(null);
  const stream = useRef(null);
  const active = useRef(true);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [geo, setGeo] = useState(null);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [photo, setPhoto] = useState('');
  const [capturedAt, setCapturedAt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const face = useFaceVerification(video, kind);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      stream.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Kamera memerlukan perangkat yang mendukung dan koneksi HTTPS.');
      return;
    }
    setCameraError('');
    setStarting(true);
    try {
      const camera = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false,
      });
      if (!active.current) { camera.getTracks().forEach(track => track.stop()); return; }
      stream.current?.getTracks().forEach(track => track.stop());
      stream.current = camera;
      video.current.srcObject = camera;
      await video.current.play();
      if (active.current) {
        setReady(true);
        face.start();
      }
    } catch (problem) {
      if (active.current) setCameraError(problem.name === 'NotAllowedError'
        ? 'Izin kamera ditolak. Izinkan kamera di pengaturan browser.' : 'Kamera tidak dapat dibuka. Periksa apakah kamera tersedia.');
    } finally {
      if (active.current) setStarting(false);
    }
  }

  function locate() {
    if (!navigator.geolocation) { setGpsError('Browser tidak menyediakan akses GPS.'); return; }
    setLocating(true);
    setGeo(null);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(result => {
      if (!active.current) return;
      setGeo({ latitude: result.coords.latitude, longitude: result.coords.longitude, accuracy: result.coords.accuracy, timestamp: result.timestamp });
      setLocating(false);
    }, problem => {
      if (!active.current) return;
      setGpsError(problem.code === 1 ? 'Izin lokasi ditolak. Izinkan lokasi di pengaturan browser.'
        : 'Lokasi belum terbaca. Coba lagi di area dengan sinyal GPS lebih baik.');
      setLocating(false);
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  }

  function takePhoto() {
    const source = video.current;
    if (!face.proof()) { setCameraError('Pastikan wajah masih terlihat setelah verifikasi.'); return; }
    if (!source.videoWidth) { setCameraError('Kamera belum siap. Tunggu sebentar lalu coba lagi.'); return; }
    const result = document.createElement('canvas');
    const scale = Math.min(1, 900 / Math.max(source.videoWidth, source.videoHeight));
    result.width = Math.round(source.videoWidth * scale);
    result.height = Math.round(source.videoHeight * scale);
    const canvas = result.getContext('2d');
    canvas.drawImage(source, 0, 0, result.width, result.height);
    const stamp = new Date().toISOString();
    const size = Math.max(12, Math.round(result.width / 30));
    canvas.fillStyle = 'rgba(10, 24, 16, 0.78)';
    canvas.fillRect(0, result.height - size * 2.45, result.width, size * 2.45);
    canvas.fillStyle = '#fff';
    canvas.font = '600 ' + size + 'px system-ui';
    canvas.textBaseline = 'middle';
    canvas.fillText(dateLabel(stamp, 'year') + '  •  ' + timeLabel(stamp, true) + ' WIB', size, result.height - size * 1.2, result.width - size * 2);
    setCameraError('');
    face.pause();
    setCapturedAt(stamp);
    setPhoto(result.toDataURL('image/jpeg', 0.78));
  }

  async function submit() {
    setError('');
    const proof = face.proof();
    if (!proof || Date.now() >= proof.expiresAt) { setError('Verifikasi kedaluwarsa. Ambil ulang selfie dan verifikasi wajah.'); return; }
    if (Date.now() - geo.timestamp > 120000) { setError('Lokasi sudah lewat dua menit. Ambil lokasi lagi.'); return; }
    if (Date.now() - Date.parse(capturedAt) > 120000) { setError('Selfie sudah lewat dua menit. Ambil ulang foto.'); return; }
    setBusy(true);
    try {
      const result = await api('/attendance', { method: 'POST', body: { kind, selfie: photo, ...geo, proof: { id: proof.id, steps: proof.steps } } });
      complete(result);
    } catch (problem) { setError(problem.message); }
    finally { if (active.current) setBusy(false); }
  }

  function retry() {
    setPhoto('');
    setCapturedAt(null);
    setCameraError('');
    setError('');
    face.start();
  }

  const { actions, count, cue, error: faceError } = face.state;
  const messages = {
    missing: 'Arahkan wajah ke kamera.',
    multiple: 'Pastikan hanya kamu yang terlihat.',
    position: 'Dekatkan wajah ke tengah kamera.',
    neutral: 'Rilekskan wajah dan lihat kamera.',
    action: livenessLabels[actions[count]],
    complete: 'Kedip dan senyum terverifikasi.',
  };
  return <Dialog title={kind === 'in' ? 'Absen masuk' : 'Absen pulang'} description="Verifikasi wajah, ambil selfie, lalu sertakan lokasi GPS." onClose={close} busy={busy}>
    <div className="capture-area">
      <video ref={video} autoPlay playsInline muted aria-label="Pratinjau kamera" hidden={!ready || !!photo} />
      {ready && !photo && <span className="face-guide" aria-hidden="true" />}
      {photo ? <img src={photo} alt="Selfie absensi dengan tanggal dan waktu pengambilan" /> : !ready && <div className="capture-placeholder">
        <IconTile icon={Video} /><span>{starting ? 'Membuka kamera…' : 'Kamera belum aktif'}</span>
      </div>}
    </div>
    {ready && <section className="face-check" aria-label="Verifikasi gerakan wajah">
      {cue === 'loading' ? <Pending label="Menyiapkan verifikasi wajah…" /> : <>
        <div className="face-note"><ScanFace size={18} /><strong role="status">{messages[cue] ?? 'Verifikasi wajah'}</strong></div>
        {!!actions.length && <ol className="face-steps">
          {actions.map((action, index) => <li key={action} data-done={count > index} aria-current={count === index ? 'step' : undefined}>
            {count > index && <Check size={13} />}{action === 'blink' ? 'Kedip' : 'Senyum'}
          </li>)}
        </ol>}
      </>}
      <ErrorText text={faceError} />
      {cue === 'error' && <Button icon={RefreshCw} onClick={retry}>Ulangi verifikasi</Button>}
    </section>}
    <div className="capture-actions">
      <Button icon={Camera} disabled={starting || busy || (ready && !photo && cue !== 'complete')}
        onClick={() => photo ? retry() : ready ? takePhoto() : startCamera()}>
        {photo ? 'Ambil ulang' : ready ? 'Ambil selfie' : 'Aktifkan kamera'}
      </Button>
      {capturedAt && photo && <TimeChip timestamp={capturedAt} />}
    </div>
    <ErrorText text={cameraError} />
    <div className="gps-card">
      <IconTile icon={MapPin} color="blue" />
      <div><strong>{geo ? 'Lokasi GPS tercatat' : session.store.outlet}</strong><span>{geo ? 'Akurasi ±' + Math.round(geo.accuracy) + ' m · radius outlet ' + session.store.radius + ' m' : 'Aktifkan izin lokasi di perangkat.'}</span></div>
      <Button icon={Crosshair} disabled={locating || busy} onClick={locate}>{locating ? 'Mencari…' : geo ? 'Perbarui' : 'Ambil lokasi'}</Button>
    </div>
    <ErrorText text={gpsError || error} />
    <div className="dialog-actions"><Button kind="primary" icon={Check} disabled={!photo || !geo || busy || locating} onClick={submit}>{busy ? 'Mengirim…' : 'Kirim absensi'}</Button></div>
  </Dialog>;
}
