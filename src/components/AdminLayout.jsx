import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, Search, UserRound, X } from 'lucide-react';
import { ADMIN_NAV } from '../lib/navigation';
import { useAuth } from '../context/AuthContext';
import useFetch from '../lib/useFetch';
import { Avatar } from './ui';
import NotificationBell from './NotificationBell';
import Logo from './Logo';
import { useExit } from '../lib/motion';

function NavItem({ item, badges }) {
  const { to, label, icon: Icon, end, badge } = item;
  const count = badge ? badges?.[badge] : 0;
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) => `group relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] transition ${
        isActive ? 'font-semibold text-slate-900' : 'text-slate-500 hover:bg-white hover:text-slate-800'
      }`}>
      {({ isActive }) => (
        <>
          {/* Active marker on the sidebar edge, as in the reference layout */}
          {isActive && <span className="absolute -left-3 top-1/2 h-8 w-1.5 -translate-y-1/2 animate-[grow-y_0.3s_ease-out_both] rounded-r-full bg-brand-700" />}
          <Icon className={`h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-brand-700' : ''}`} />
          <span className="flex-1">{label}</span>
          {count > 0 && (
            <span key={count} className="animate-pop-in rounded-md bg-brand-800 px-1.5 py-0.5 text-xs font-semibold text-white" aria-label={`${count} waiting`}>
              {count > 99 ? '99+' : count}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

// Collapsible group. Opens automatically when it contains the current page; otherwise
// remembers whether the admin left it open or closed.
function NavGroup({ group, badges }) {
  const { pathname } = useLocation();
  const containsActive = group.items.some((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)));
  const storageKey = `nav:${group.title}`;
  const [open, setOpen] = useState(() => {
    try { const v = localStorage.getItem(storageKey); return v == null ? containsActive : v === '1'; } catch { return containsActive; }
  });
  const shown = open || containsActive;
  const waiting = group.items.reduce((n, i) => n + (i.badge ? badges?.[i.badge] || 0 : 0), 0);
  const toggle = () => {
    const next = !shown;
    setOpen(next);
    try { localStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* storage unavailable */ }
  };
  // The top links are always needed, so they sit at the top without a collapsible heading.
  if (group.title === 'Overview') {
    return <div className="mb-3 space-y-0.5">{group.items.map((i) => <NavItem key={i.to} item={i} badges={badges} />)}</div>;
  }
  return (
    <div className="mb-1">
      <button type="button" onClick={toggle} aria-expanded={shown}
        className="flex min-h-9 w-full items-center gap-2 rounded-lg px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700">
        <span className="flex-1">{group.title}</span>
        {!shown && waiting > 0 && <span className="rounded-md bg-brand-800 px-1.5 text-[11px] font-semibold normal-case text-white">{waiting}</span>}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${shown ? '' : '-rotate-90'}`} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${shown ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="space-y-0.5 overflow-hidden" inert={!shown}>
          {group.items.map((i) => <NavItem key={i.to} item={i} badges={badges} />)}
        </div>
      </div>
    </div>
  );
}

function Sidebar({ badges, onLogout }) {
  return (
    <div className="flex h-full flex-col rounded-3xl bg-slate-100/80 px-3 py-6">
      <Link to="/admin" className="mb-8 flex items-center gap-2.5 px-4">
        <Logo className="h-10 w-10" />
        <span className="text-xl font-semibold tracking-tight">Solucio HR</span>
      </Link>
      <nav aria-label="Admin" className="-mx-1 flex-1 overflow-y-auto overscroll-contain px-1">
        {ADMIN_NAV.map((g) => <NavGroup key={g.title} group={g} badges={badges} />)}
        <p className="mb-2 mt-5 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">General</p>
        <div className="space-y-0.5">
          <NavItem item={{ to: '/', label: 'My staff portal', icon: UserRound, end: true }} />
          <button type="button" onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] text-slate-500 transition hover:bg-white hover:text-slate-800">
            <LogOut className="h-5 w-5" /> Sign out
          </button>
        </div>
      </nav>
    </div>
  );
}

// Search box with a ⌘K / Ctrl+K shortcut that jumps to a staff member's report.
function StaffSearch() {
  const { data: staff, loading } = useFetch('/users/directory', { initial: [] });
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef();
  const navigate = useNavigate();
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); setOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return staff.filter((s) => `${s.firstName} ${s.lastName} ${s.staffId} ${s.department} ${s.jobTitle}`.toLowerCase().includes(term)).slice(0, 6);
  }, [q, staff]);

  const go = (s) => { setQ(''); setOpen(false); input.current?.blur(); navigate(`/admin/staff/${s._id}`); };

  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input ref={input} value={q} placeholder="Search staff" aria-label="Search staff" role="combobox" aria-autocomplete="list"
        aria-expanded={open && Boolean(q.trim())} aria-controls={open && results.length ? 'staff-search-results' : undefined}
        aria-activedescendant={open && results[active] ? `staff-result-${results[active]._id}` : undefined}
        className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-11 pr-16 text-base outline-none desk:text-sm transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter' && results[active]) go(results[active]);
          if (e.key === 'Escape') { setQ(''); setOpen(false); input.current.blur(); }
        }} />
      <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{isMac ? '⌘' : 'Ctrl'} K</kbd>
      {open && q.trim() && results.length > 0 && (
        <ul id="staff-search-results" role="listbox" aria-label="Staff search results" className="card absolute left-0 right-0 z-40 mt-2 origin-top animate-scale-in overflow-hidden py-1 shadow-xl">
          {results.map((s, i) => (
            <li key={s._id} id={`staff-result-${s._id}`} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={() => go(s)} onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${i === active ? 'bg-brand-50' : ''}`}>
                <Avatar user={s} size="sm" />
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{s.firstName} {s.lastName}</span>
                  <span className="block truncate text-xs text-slate-500">{s.jobTitle || '—'} · {s.department || '—'}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && q.trim() && results.length === 0 && (
        <div role="status" className="card absolute left-0 right-0 z-40 mt-2 px-4 py-3 text-sm text-slate-600 shadow-xl">
          {loading ? 'Loading staff…' : `No staff found for “${q.trim()}”. Try a name, staff ID, job title or department.`}
        </div>
      )}
    </div>
  );
}

// Admin shell: light rounded sidebar, top bar with search, and a rounded content panel.
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { data: badges } = useFetch('/reports/badges');
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => setDrawer(false), [location.pathname]);
  const drawerAnim = useExit(drawer, 200);
  const signOut = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-slate-200/60 p-2 sm:p-4">
      <div className="flex min-h-[calc(100vh-1rem)] gap-4 rounded-[2rem] bg-white p-3 sm:min-h-[calc(100vh-2rem)] sm:p-4">
        <aside className="sticky top-4 hidden h-[calc(100vh-4rem)] w-64 shrink-0 lg:block"><Sidebar badges={badges} onLogout={signOut} /></aside>
        {drawerAnim.mounted && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className={`absolute inset-0 bg-slate-900/50 ${drawerAnim.closing ? 'animate-fade-out' : 'animate-fade-in'}`} onClick={() => setDrawer(false)} />
            <aside className={`relative h-full w-72 bg-white p-3 ${drawerAnim.closing ? 'animate-slide-out-left' : 'animate-slide-in-left'}`}><Sidebar badges={badges} onLogout={signOut} /></aside>
            <button type="button" aria-label="Close menu" className="absolute left-[18.5rem] top-4 text-white" onClick={() => setDrawer(false)}><X /></button>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="flex items-center gap-3 rounded-3xl bg-slate-100/80 px-3 py-3 sm:px-5">
            <button type="button" aria-label="Open menu" className="flex h-11 w-11 items-center justify-center rounded-full bg-white lg:hidden" onClick={() => setDrawer(true)}><Menu className="h-5 w-5" /></button>
            <StaffSearch />
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <NotificationBell />
              <Link to="/profile" className="flex items-center gap-3 rounded-full pr-2 hover:bg-white/60">
                <Avatar user={user} size="md" />
                <span className="hidden text-sm font-semibold md:block">{user.firstName} {user.lastName}</span>
              </Link>
            </div>
          </header>
          <main className="flex-1 rounded-3xl bg-slate-100/80 p-4 sm:p-6 lg:p-8">
            {/* Re-keyed per page so each route fades up as it opens. */}
            <div key={location.pathname} className="animate-fade-up"><Outlet /></div>
          </main>
        </div>
      </div>
    </div>
  );
}
