import { useDeferredValue, useState } from 'react';
import { Calculator, ChevronLeft, ChevronRight, Pencil, Plus, Search, Tags, UserRound, Wallet } from 'lucide-react';
import {
  Badge, Button, Card, Dialog, Empty, ErrorText, IconTile, dateLabel,
  money, number, ResourceState, SectionHeading, shift, timeLabel, today, useOutletApi, useResource, WordTitle,
} from './common.jsx';

export function ProfitPage() {
  const [from, setFrom] = useState(() => shift(today(), -6));
  const [to, setTo] = useState(today);
  const query = new URLSearchParams({ from, to }).toString();
  const report = useResource('/owner/profit?' + query, 12000);
  const total = report.data?.total;
  const stats = total && [
    { label: 'Pendapatan lunas', value: money(total.revenue), icon: Wallet, color: 'green', detail: total.count + ' transaksi' },
    { label: 'Total diskon', value: money(total.discount), icon: Tags, color: 'blue', detail: 'Potongan pada transaksi lunas' },
    { label: 'Total HPP tercatat', value: total.covered ? money(total.hpp) : '—', icon: Calculator, color: 'amber', detail: total.covered + ' transaksi dengan HPP lengkap' },
    { label: total.gross < 0 ? 'Rugi kotor' : 'Laba kotor', value: total.gross == null ? '—' : money(total.gross),
      icon: Wallet, color: 'purple', detail: 'Pendapatan tercakup ' + money(total.coveredRevenue), loss: total.gross < 0 },
  ];
  return <>
    <SectionHeading title="Laba rugi" description="Pantau selisih pendapatan setelah diskon dan HPP transaksi per outlet." />
    <Card className="panel">
      <div className="filters business-filters">
        <label>Dari<input type="date" value={from} max={to} onChange={event => event.target.value && setFrom(event.target.value)} /></label>
        <label>Sampai<input type="date" value={to} min={from} max={today()} onChange={event => event.target.value && setTo(event.target.value)} /></label>
      </div>
    </Card>
    {!total ? <ResourceState error={report.error} reload={report.reload} /> : <>
      <div className="metric-grid">
        {stats.map(({ label, value, icon, color, detail, loss }, index) => <Card className="metric" key={label} index={index}>
          <div className="metric-top"><IconTile icon={icon} color={color} /></div>
          <span className="metric-label">{label}</span>
          <strong className={'metric-value' + (loss ? ' negative-value' : '')}>{value}</strong>
          <div className="metric-foot"><span>{detail}</span></div>
        </Card>)}
      </div>
      <Card className="panel">
        <header className="panel-header">
          <div><WordTitle>Laba rugi harian</WordTitle><p>HPP diambil saat transaksi dicatat.</p></div>
          {total.missing > 0 && <Badge color="amber">{number(total.missing)} transaksi belum punya HPP lengkap</Badge>}
        </header>
        {!report.data.rows.length ? <Empty icon={Calculator} title="Belum ada transaksi lunas" /> :
          <div className="table-overflow"><table>
            <thead><tr><th>Tanggal</th><th>Pendapatan</th><th>Diskon</th><th>HPP tercatat</th><th>Laba/rugi kotor</th><th>HPP belum lengkap</th></tr></thead>
            <tbody>{report.data.rows.map(row => <tr key={row.day}>
              <td>{dateLabel(row.day, 'year')}</td><td>{money(row.revenue)}</td><td>{money(row.discount)}</td>
              <td>{row.covered ? money(row.hpp) : '—'}</td>
              <td className={'amount-cell' + (row.gross < 0 ? ' negative-value' : '')}>{row.gross == null ? '—' : money(row.gross)}</td>
              <td>{number(row.missing)} transaksi</td>
            </tr>)}</tbody>
          </table></div>}
      </Card>
    </>}
  </>;
}

export function CustomersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const term = useDeferredValue(search);
  const resource = useResource('/owner/customers?' + new URLSearchParams({ q: term, page }), 12000);
  return <>
    <SectionHeading title="Pelanggan" description="Nama dan nomor telepon yang dicatat kasir di outlet ini." />
    <Card className="panel">
      <header className="panel-header business-header">
        <div><WordTitle>Data pelanggan</WordTitle><p>{resource.data ? number(resource.data.total) + ' pelanggan' : 'Riwayat pelanggan outlet'}</p></div>
        <div className="search-field business-search"><Search size={17} />
          <input aria-label="Cari pelanggan" placeholder="Cari nama atau nomor telepon" maxLength={70} value={search}
            onChange={event => { setSearch(event.target.value); setPage(1); }} />
        </div>
      </header>
      {!resource.data ? <ResourceState error={resource.error} reload={resource.reload} /> : !resource.data.rows.length
        ? <Empty icon={UserRound} title={term ? 'Pelanggan tidak ditemukan' : 'Belum ada pelanggan'} />
        : <div className="table-overflow"><table>
          <thead><tr><th>Nama</th><th>Nomor telepon</th><th>Transaksi lunas</th><th>Terakhir belanja</th><th className="align-right">Total belanja</th></tr></thead>
          <tbody>{resource.data.rows.map(row => <tr key={row.id}>
            <td><strong>{row.name}</strong></td><td>{row.phone ?? '—'}</td><td>{number(row.visits)}</td>
            <td>{row.lastVisit ? dateLabel(row.lastVisit, 'year') : '—'}</td><td className="align-right amount-cell">{money(row.spent)}</td>
          </tr>)}</tbody>
        </table></div>}
      {resource.data?.total > resource.data?.size && <div className="pagination">
        <span>Halaman {page} dari {Math.ceil(resource.data.total / resource.data.size)}</span>
        <Button icon={ChevronLeft} aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => setPage(page - 1)} />
        <Button icon={ChevronRight} aria-label="Halaman berikutnya" disabled={page * resource.data.size >= resource.data.total} onClick={() => setPage(page + 1)} />
      </div>}
    </Card>
  </>;
}

const promoStatuses = {
  active: ['Aktif', 'green'], inactive: ['Nonaktif', 'neutral'], upcoming: ['Terjadwal', 'blue'], ended: ['Berakhir', 'neutral'],
};
const localInput = timestamp => new Date(new Date(timestamp).getTime() + 7 * 3600000).toISOString().slice(0, 16);
const displayTime = value => dateLabel(value, 'year') + ' · ' + timeLabel(value) + ' WIB';

function PromoEditor({ row, close, save }) {
  const [form, setForm] = useState(() => row
    ? { ...row, startsAt: localInput(row.startsAt), endsAt: localInput(row.endsAt) }
    : { name: '', type: 'percent', value: '', startsAt: localInput(Date.now()), endsAt: localInput(Date.now() + 86400000), active: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function set(key, value) { setForm(previous => ({ ...previous, [key]: value })); }
  return <Dialog title={row ? 'Edit promo' : 'Tambah promo'} onClose={close} busy={busy}>
    <form className="form" onSubmit={async event => {
      event.preventDefault();
      setBusy(true);
      setError('');
      try { await save({ ...form, value: Number(form.value) }); }
      catch (problem) { setError(problem.message); }
      finally { setBusy(false); }
    }}>
      <label>Nama promo<input autoFocus required maxLength={70} value={form.name} onChange={event => set('name', event.target.value)} /></label>
      <div className="form-pair">
        <label>Jenis potongan<select value={form.type} onChange={event => setForm(previous => ({ ...previous, type: event.target.value, value: '' }))}>
          <option value="percent">Persentase (%)</option><option value="fixed">Nominal (Rp)</option>
        </select></label>
        <label>Nilai potongan ({form.type === 'percent' ? '%' : 'Rp'})<input required type="number" inputMode="numeric" min="1" step="1"
          max={form.type === 'percent' ? 100 : 100000000} value={form.value} onChange={event => set('value', event.target.value)} /></label>
      </div>
      <div className="form-pair promo-dates">
        <label>Mulai (WIB)<input required type="datetime-local" value={form.startsAt} onChange={event => set('startsAt', event.target.value)} /></label>
        <label>Berakhir (WIB)<input required type="datetime-local" value={form.endsAt} onChange={event => set('endsAt', event.target.value)} /></label>
      </div>
      <label className="checkbox"><input type="checkbox" checked={form.active} onChange={event => set('active', event.target.checked)} />Aktifkan sesuai jadwal</label>
      <ErrorText text={error} />
      <div className="dialog-actions">
        <Button onClick={close} disabled={busy}>Batal</Button>
        <Button kind="primary" type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan promo'}</Button>
      </div>
    </form>
  </Dialog>;
}

export function PromotionsPage({ notify }) {
  const api = useOutletApi();
  const resource = useResource('/owner/promotions', 12000);
  const [editor, setEditor] = useState(null);
  return <>
    <SectionHeading title="Promo" description="Kasir otomatis memakai potongan terbesar dari promo outlet yang sedang aktif.">
      <Button kind="primary" icon={Plus} onClick={() => setEditor({ row: null })}>Tambah promo</Button>
    </SectionHeading>
    <Card className="panel">
      <header className="panel-header"><div><WordTitle>Jadwal promo</WordTitle><p>Waktu mulai dan berakhir memakai WIB.</p></div></header>
      {!resource.data ? <ResourceState error={resource.error} reload={resource.reload} /> : !resource.data.rows.length
        ? <Empty icon={Tags} title="Belum ada promo" />
        : <div className="table-overflow"><table>
          <thead><tr><th>Nama promo</th><th>Potongan</th><th>Mulai</th><th>Berakhir</th><th>Status</th><th className="align-right">Aksi</th></tr></thead>
          <tbody>{resource.data.rows.map(row => {
            const [status, color] = promoStatuses[row.status];
            return <tr key={row.id}>
              <td><strong>{row.name}</strong></td><td className="amount-cell">{row.type === 'percent' ? number(row.value) + '%' : money(row.value)}</td>
              <td>{displayTime(row.startsAt)}</td><td>{displayTime(row.endsAt)}</td><td><Badge color={color}>{status}</Badge></td>
              <td className="align-right"><Button icon={Pencil} aria-label={'Edit ' + row.name} onClick={() => setEditor({ row })}>Edit</Button></td>
            </tr>;
          })}</tbody>
        </table></div>}
    </Card>
    {editor && <PromoEditor row={editor.row} close={() => setEditor(null)} save={async form => {
      await api('/owner/promotions' + (editor.row ? '/' + editor.row.id : ''), { method: editor.row ? 'PUT' : 'POST', body: form });
      resource.reload();
      setEditor(null);
      notify('Promo berhasil disimpan.');
    }} />}
  </>;
}
