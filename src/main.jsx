import { createRoot } from 'react-dom/client';
import { useEffect, useRef, useState } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/manrope';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowLeftRight, ArrowRight, Bell, Box, ChartNoAxesCombined, Check, ChevronDown, ChevronRight, ChevronsUpDown,
  Coffee, LayoutDashboard, LogOut, Menu, Plus, Settings, ShoppingCart, Store, Users, X,
  CalendarCheck,
} from 'lucide-react';
import {
  api, Avatar, Brand, Button, Dialog, ErrorText, NoticeList, OutletContext, Pending, ResourceState, Toast, useOutletApi, useResource, useToast,
} from './common.jsx';
import { AttendancePage, CatalogPage, OutletOverview, Overview, SalesPage, SettingsPage } from './owner.jsx';
import { EmployeeAttendance, PointOfSale } from './employee.jsx';
import './style.css';

const ownerMenus = [
  { label: 'Ruang kerja', entries: [
    { id: 'ringkasan', label: 'Ringkasan', icon: LayoutDashboard },
    { id: 'semua-outlet', label: 'Semua outlet', icon: Store },
    { id: 'penjualan', label: 'Penjualan', icon: ChartNoAxesCombined },
    { id: 'absensi', label: 'Absensi', icon: CalendarCheck },
  ] },
  { label: 'Manajemen', entries: [
    { id: 'produk', label: 'Produk', icon: Box },
    { id: 'karyawan', label: 'Karyawan', icon: Users },
    { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
  ] },
];
const staffMenus = [{ label: 'Ruang kerja', entries: [
  { id: 'kasir', label: 'Kasir (POS)', icon: ShoppingCart },
  { id: 'absensi-saya', label: 'Absensi saya', icon: CalendarCheck },
] }];

function useSmoothScroll() {
  const lenis = useRef(null);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    let cleanup;
    const sync = () => {
      cleanup?.();
      if (preference.matches) return;
      const scroller = new Lenis({ autoRaf: false, smoothWheel: true, lerp: 0.12 });
      lenis.current = scroller;
      const scroll = () => ScrollTrigger.update();
      const raf = time => scroller.raf(time * 1000);
      scroller.on('scroll', scroll);
      gsap.ticker.add(raf);
      cleanup = () => { gsap.ticker.remove(raf); scroller.destroy(); lenis.current = null; };
    };
    sync();
    preference.addEventListener('change', sync);
    return () => { preference.removeEventListener('change', sync); cleanup?.(); };
  }, []);
  return lenis;
}

function App() {
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [toast, notify] = useToast();
  const lenis = useSmoothScroll();
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        let current = await api('/session');
        if (!active) return;
        if (current.demo && !current.user && !sessionStorage.getItem('kelola:logged-out')) {
          const role = ['kasir', 'absensi-saya'].includes(location.hash.slice(1)) ? 'employee' : 'owner';
          current = await api('/demo', { method: 'POST', body: { role } });
        }
        if (active) setSession(current);
      } catch (problem) {
        if (active) setError(problem.message);
      }
    };
    load();
    const reset = () => {
      sessionStorage.setItem('kelola:logged-out', '1');
      setSession(previous => ({ user: null, demo: previous?.demo }));
    };
    window.addEventListener('kelola:expired', reset);
    return () => { active = false; window.removeEventListener('kelola:expired', reset); };
  }, [revision]);

  async function login(fields) {
    const response = await api('/login', { method: 'POST', body: fields });
    sessionStorage.removeItem('kelola:logged-out');
    setSession(response);
  }

  async function demoAs(role) {
    const response = await api('/demo', { method: 'POST', body: { role } });
    sessionStorage.removeItem('kelola:logged-out');
    const hash = role === 'owner' ? '#ringkasan' : '#kasir';
    window.history.replaceState(null, '', hash);
    setSession(response);
  }

  async function logout() {
    await api('/logout', { method: 'POST', body: {} });
    sessionStorage.setItem('kelola:logged-out', '1');
    window.history.replaceState(null, '', location.pathname + location.search);
    setSession(previous => ({ user: null, demo: previous.demo }));
  }

  if (!session) return <div className="boot"><Brand />{error ? <ResourceState error={error} reload={() => { setError(''); setRevision(value => value + 1); }} /> : <Pending label="Membuka ruang kerja…" />}</div>;
  return <>
    {session.user
      ? <Workspace key={session.user.id} session={session} updateSession={setSession} demoAs={demoAs} logout={logout} notify={notify} lenis={lenis} />
      : <LoginPage demo={session.demo} login={login} demoAs={demoAs} />}
    <Toast toast={toast} />
  </>;
}

function Workspace({ session, updateSession, demoAs, logout, notify, lenis }) {
  const isOwner = session.user.role === 'owner';
  const menus = isOwner ? ownerMenus : staffMenus;
  const entries = menus.flatMap(group => group.entries);
  const [hash, setHash] = useState(() => window.location.hash.slice(1));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [addingOutlet, setAddingOutlet] = useState(false);
  const outlets = session.outlets;
  const outletPreference = 'kelola:outlet:' + session.user.id;
  const [preferredOutlet, setPreferredOutlet] = useState(() => Number(localStorage.getItem(outletPreference)));
  const activeOutlet = isOwner ? outlets.find(entry => entry.id === preferredOutlet) ?? session.store : session.store;
  const outletSession = { ...session, store: activeOutlet };
  const profile = useRef(null);
  const outletMenu = useRef(null);
  const current = entries.find(entry => entry.id === hash) ?? entries[0];
  const notices = useResource(isOwner ? '/owner/notices' : null, 8000, activeOutlet.id);
  const roleName = isOwner ? 'Pemilik' : 'Karyawan';
  const switchName = isOwner ? 'Panel karyawan' : 'Panel pemilik';

  useEffect(() => {
    const update = () => setHash(location.hash.slice(1));
    window.addEventListener('hashchange', update);
    window.addEventListener('popstate', update);
    return () => {
      window.removeEventListener('hashchange', update);
      window.removeEventListener('popstate', update);
    };
  }, []);
  useEffect(() => {
    if (lenis.current) lenis.current.scrollTo(0, { immediate: true });
    else window.scrollTo({ top: 0, behavior: 'instant' });
    const timer = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(timer);
  }, [current.id, activeOutlet.id, lenis]);
  useEffect(() => {
    if (!profileOpen && !mobileOpen) return undefined;
    const dismiss = event => { if (!profile.current?.contains(event.target)) setProfileOpen(false); };
    const keyboard = event => { if (event.key === 'Escape') { setProfileOpen(false); setMobileOpen(false); } };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', keyboard);
    };
  }, [profileOpen, mobileOpen]);

  function navigate(id) {
    if (id !== hash) window.history.pushState(null, '', '#' + id);
    setHash(id);
    setMobileOpen(false);
  }
  function link(event, page) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(page);
  }
  async function accountAction(action) {
    setSwitching(true);
    try { await action(); }
    catch (problem) { notify(problem.message, 'error'); }
    finally { setSwitching(false); }
  }
  function openNotices() { setNoticesOpen(true); notices.reload(); }
  function selectOutlet(id, page) {
    localStorage.setItem(outletPreference, String(id));
    setPreferredOutlet(id);
    setNoticesOpen(false);
    if (outletMenu.current) outletMenu.current.open = false;
    if (page) navigate(page);
    else if (current.id === 'semua-outlet') navigate('ringkasan');
    else setMobileOpen(false);
  }
  function addOutlet() {
    if (outletMenu.current) outletMenu.current.open = false;
    setMobileOpen(false);
    setAddingOutlet(true);
  }
  const switchRole = () => accountAction(() => demoAs(isOwner ? 'employee' : 'owner'));

  let content;
  switch (current.id) {
    case 'ringkasan':
      content = <Overview session={outletSession} navigate={navigate} openNotices={openNotices} />;
      break;
    case 'semua-outlet':
      content = <OutletOverview onSelect={selectOutlet} onAdd={addOutlet} />;
      break;
    case 'penjualan':
      content = <SalesPage />;
      break;
    case 'absensi':
      content = <AttendancePage session={outletSession} />;
      break;
    case 'produk':
      content = <CatalogPage notify={notify} />;
      break;
    case 'karyawan':
      content = <CatalogPage employees notify={notify} />;
      break;
    case 'pengaturan':
      content = <SettingsPage updateSession={updateSession} notify={notify} />;
      break;
    case 'absensi-saya':
      content = <EmployeeAttendance session={session} notify={notify} />;
      break;
    default:
      content = <PointOfSale session={session} notify={notify} />;
  }

  return <OutletContext.Provider value={isOwner ? activeOutlet.id : null}><div className="workspace">
    <a className="skip-link" href="#main-content" onClick={event => {
      event.preventDefault();
      document.getElementById('main-content')?.focus();
    }}>Langsung ke konten</a>
    {mobileOpen && <button type="button" className="mobile-scrim" aria-label="Tutup navigasi" onClick={() => setMobileOpen(false)} />}
    <aside className={'sidebar ' + (mobileOpen ? 'sidebar-open' : '')} aria-label="Navigasi utama">
      <header className="sidebar-header">
        <a href={'#' + entries[0].id} onClick={event => link(event, entries[0].id)}><Brand /></a>
        <button type="button" className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Tutup menu"><X size={20} /></button>
      </header>
      {isOwner ? <details className="outlet-picker" ref={outletMenu}>
        <summary className="store-card" aria-label={'Pilih outlet, aktif ' + activeOutlet.name}>
          <span className="store-icon"><Store size={19} strokeWidth={1.75} /></span>
          <span className="store-copy"><strong>{activeOutlet.name}</strong><small>{activeOutlet.outlet}</small></span>
          <ChevronsUpDown size={15} className="store-chevron" />
        </summary>
        <div className="outlet-options">
          {outlets.map(outlet => <button type="button" key={outlet.id} className="outlet-option" onClick={() => selectOutlet(outlet.id)}>
            <span className="store-copy"><strong>{outlet.name}</strong><small>{outlet.outlet}</small></span>
            {outlet.id === activeOutlet.id && <Check size={16} aria-label="Aktif" />}
          </button>)}
          <button type="button" className="outlet-option outlet-add" onClick={addOutlet}><Plus size={17} />Tambah outlet</button>
        </div>
      </details> : <div className="store-card">
        <span className="store-icon"><Coffee size={19} strokeWidth={1.75} /></span>
        <span className="store-copy"><strong>{session.store.name}</strong><small>{session.store.outlet}</small></span>
      </div>}
      <nav className="nav">
        {menus.map(group => <div className="nav-group" key={group.label}>
          <h2>{group.label}</h2>
          {group.entries.map(entry => <a href={'#' + entry.id} key={entry.id} onClick={event => link(event, entry.id)}
            className={'nav-item ' + (entry.id === current.id ? 'current' : '')}
            aria-current={entry.id === current.id ? 'page' : undefined}>
            <entry.icon size={18} strokeWidth={1.8} />{entry.label}
          </a>)}
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        {session.demo && <div className="demo-block">
          <span><i />Mode demo</span>
          <button type="button" onClick={switchRole} disabled={switching}><ArrowLeftRight size={16} />{switchName}<ArrowRight size={15} /></button>
        </div>}
        <div className="sidebar-role"><span className="role-dot" />Panel {roleName.toLowerCase()}</div>
      </div>
    </aside>
    <div className="workspace-content">
      <header className="topbar">
        <button type="button" className="icon-button mobile-menu" aria-label="Buka menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}><Menu size={21} /></button>
        <div className="breadcrumbs"><span>Ruang kerja</span><ChevronRight size={14} /><strong>{current.label}</strong></div>
        <div className="top-actions">
          {isOwner && <button type="button" className="icon-button bell-button" aria-label={notices.data?.count ? 'Notifikasi, ' + notices.data.count + ' belum dibaca' : 'Notifikasi'} onClick={openNotices}>
            <Bell size={19} strokeWidth={1.8} />{notices.data?.count > 0 && <i />}
          </button>}
          <div className="profile" ref={profile}>
            <button type="button" className="profile-button" aria-label={'Akun ' + session.user.name} aria-expanded={profileOpen} onClick={() => setProfileOpen(!profileOpen)}>
              <Avatar name={session.user.name} color={isOwner ? 'amber' : 'green'} />
              <span className="profile-copy"><strong>{session.user.name}</strong><small>{roleName}</small></span>
              <ChevronDown size={15} className="profile-chevron" />
            </button>
            {profileOpen && <div className="profile-menu">
              {session.demo && <button type="button" disabled={switching} onClick={switchRole}><ArrowLeftRight size={16} />{switchName}</button>}
              <button type="button" disabled={switching} onClick={() => accountAction(logout)}><LogOut size={16} />Keluar</button>
            </div>}
          </div>
        </div>
      </header>
      <main id="main-content" className="main" tabIndex={-1} key={current.id + ':' + activeOutlet.id}>{content}</main>
    </div>
    {noticesOpen && isOwner && <NoticeDialog notices={notices} onClose={() => setNoticesOpen(false)} />}
    {addingOutlet && <AddOutlet close={() => setAddingOutlet(false)} onCreated={next => {
      updateSession(next);
      setAddingOutlet(false);
      selectOutlet(next.store.id, 'pengaturan');
      notify('Outlet berhasil ditambahkan.');
    }} />}
  </div></OutletContext.Provider>;
}

function AddOutlet({ close, onCreated }) {
  const scopedApi = useOutletApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <Dialog title="Tambah outlet" description="Buat ruang kerja untuk usaha atau cabang baru." onClose={close} busy={busy}>
    <form className="form" onSubmit={async event => {
      event.preventDefault();
      const body = Object.fromEntries(new FormData(event.currentTarget));
      setError('');
      setBusy(true);
      try { onCreated(await scopedApi('/owner/outlets', { method: 'POST', body })); }
      catch (problem) { setError(problem.message); }
      finally { setBusy(false); }
    }}>
      <label>Nama usaha<input autoFocus required name="name" maxLength={70} placeholder="Misalnya Nasi Goreng Nusantara" /></label>
      <label>Nama outlet<input required name="outlet" maxLength={70} placeholder="Misalnya Cabang Cikini" /></label>
      <ErrorText text={error} />
      <div className="dialog-actions">
        <Button onClick={close} disabled={busy}>Batal</Button>
        <Button kind="primary" icon={Plus} type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Buat outlet'}</Button>
      </div>
    </form>
  </Dialog>;
}

function NoticeDialog({ notices, onClose }) {
  const scopedApi = useOutletApi();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <Dialog title="Notifikasi" description={notices.data?.count ? notices.data.count + ' belum dibaca' : 'Aktivitas penjualan dan absensi'} onClose={onClose}>
    {notices.data ? <NoticeList rows={notices.data.rows} full /> : <ResourceState error={notices.error} reload={notices.reload} />}
    <ErrorText text={error} />
    <div className="dialog-actions">
      <Button disabled={busy || !notices.data?.count} onClick={async () => {
        setBusy(true);
        setError('');
        try { await scopedApi('/owner/notices/read', { method: 'POST', body: {} }); notices.reload(); }
        catch (problem) { setError(problem.message); }
        finally { setBusy(false); }
      }}>Tandai semua dibaca</Button>
      <Button kind="primary" onClick={onClose}>Selesai</Button>
    </div>
  </Dialog>;
}

function LoginPage({ demo, login, demoAs }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function enter(action) {
    setBusy(true);
    setError('');
    try { await action(); }
    catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  }
  return <main className="login-layout">
    <section className="login-brand">
      <Brand />
      <div className="hero-rings" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <h1>Ruang kerja untuk usaha Anda.</h1>
      <p>Penjualan, kasir, dan absensi dalam satu tempat.</p>
    </section>
    <section className="login-content">
      <h2>Masuk ke Kelola</h2>
      <p>Gunakan akun pemilik atau karyawan.</p>
      <form className="form" onSubmit={event => {
        event.preventDefault();
        const fields = Object.fromEntries(new FormData(event.currentTarget));
        enter(() => login(fields));
      }}>
        <label>Nama pengguna<input name="username" autoComplete="username" required /></label>
        <label>Kata sandi<input name="password" type="password" autoComplete="current-password" required /></label>
        <ErrorText text={error} />
        <Button type="submit" kind="primary" disabled={busy}>{busy ? 'Memeriksa…' : 'Masuk'} <ArrowRight size={17} /></Button>
      </form>
      {demo && <div className="demo-login">
        <Button disabled={busy} onClick={() => enter(() => demoAs('owner'))}>Demo pemilik</Button>
        <Button disabled={busy} onClick={() => enter(() => demoAs('employee'))}>Demo karyawan</Button>
      </div>}
    </section>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
