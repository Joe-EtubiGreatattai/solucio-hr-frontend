import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutGrid, LogOut, Menu, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLive } from '../context/LiveContext';
import api from '../lib/api';
import { Avatar, Modal } from './ui';
import NotificationBell from './NotificationBell';
import Logo from './Logo';
import { useExit } from '../lib/motion';
import { STAFF_NAV_MAIN, STAFF_NAV_MORE, STAFF_TABS } from '../lib/navigation';
import useFetch from '../lib/useFetch';

const pill = ({ isActive }) =>
  `whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
    isActive ? 'bg-brand-800 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'
  }`;

function ProfileMenu() {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const navigate = useNavigate();
  const menu = useExit(open, 150);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const item = 'flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50';
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Account menu"
        className="flex h-11 items-center gap-1 rounded-full border border-slate-200 bg-white p-1 pr-2 shadow-sm hover:bg-slate-50">
        <Avatar user={user} size="sm" />
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {menu.mounted && (
        <div className={`card absolute right-0 z-40 mt-2 w-60 origin-top-right overflow-hidden py-1 shadow-xl ${menu.closing ? 'animate-scale-out' : 'animate-scale-in'}`}>
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="font-semibold">{user.firstName} {user.lastName}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <Link to="/profile" className={item} onClick={() => setOpen(false)}><User className="h-4 w-4" /> My profile</Link>
          {isAdmin && <Link to="/admin" className={item} onClick={() => setOpen(false)}><ShieldCheck className="h-4 w-4" /> Admin portal</Link>}
          <button type="button" className={item} onClick={() => { logout(); navigate('/login'); }}><LogOut className="h-4 w-4" /> Sign out</button>
        </div>
      )}
    </div>
  );
}

// "More" dropdown holding the less-used pages, so the bar stays readable.
function MoreMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const menu = useExit(open, 150);
  const { pathname } = useLocation();
  const active = items.some((i) => pathname.startsWith(i.to));
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={`${pill({ isActive: active })} flex items-center gap-1`}>
        More <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {menu.mounted && (
        <div className={`card absolute right-0 z-40 mt-2 w-56 origin-top-right overflow-hidden py-1 shadow-xl ${menu.closing ? 'animate-scale-out' : 'animate-scale-in'}`}>
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} className={({ isActive }) => `block px-4 py-2.5 text-sm transition-colors hover:bg-slate-50 ${isActive ? 'font-semibold text-brand-800' : 'text-slate-700'}`}>{i.label}</NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

// Phones and tablets: a tab bar along the bottom edge, within reach of the thumb.
// Everything that isn't a tab lives in the "More" sheet.
function TabBar({ onMore, moreActive }) {
  const tab = ({ isActive }) => `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${isActive ? 'text-brand-800' : 'text-slate-500'}`;
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur-md xl:hidden">
      <div className="mx-auto flex max-w-xl items-stretch px-1">
        {STAFF_TABS.map(({ to, label, icon: Icon, end, primary }) => (
          <NavLink key={to} to={to} end={end} className={tab}>
            {({ isActive }) => primary ? (
              <>
                {/* Check in is the one thing staff do every shift, so it stands out. */}
                <span className={`-mt-5 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg ring-4 ring-white transition-transform active:scale-90 ${isActive ? 'bg-brand-800' : 'bg-brand-700'}`}><Icon className="h-5 w-5" /></span>
                <span>{label}</span>
              </>
            ) : (
              <>
                <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-brand-100' : ''}`}><Icon className="h-5 w-5" /></span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button type="button" onClick={onMore} className={tab({ isActive: moreActive })} aria-haspopup="dialog">
          <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${moreActive ? 'bg-brand-100' : ''}`}><Menu className="h-5 w-5" /></span>
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}

function MoreSheet({ open, onClose, items }) {
  const { isAdmin } = useAuth();
  const tile = ({ isActive }) => `flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center text-xs font-semibold leading-tight transition active:scale-95 ${isActive ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`;
  return (
    <Modal open={open} onClose={onClose} title="All pages" size="sm" guardChanges={false}>
      <div className="grid grid-cols-3 gap-2">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={tile} onClick={onClose}>
            {Icon && <Icon className="h-5 w-5 text-brand-700" />}
            <span>{label}</span>
          </NavLink>
        ))}
        <NavLink to="/profile" className={tile} onClick={onClose}><User className="h-5 w-5 text-brand-700" /><span>My profile</span></NavLink>
        {isAdmin && <NavLink to="/admin" className={tile} onClick={onClose}><LayoutGrid className="h-5 w-5 text-brand-700" /><span>Admin portal</span></NavLink>}
      </div>
    </Modal>
  );
}

// Staff portal shell: no sidebar, a pill navigation bar on top, soft brand-tinted background.
export default function StaffLayout() {
  const { setUser, isAdmin } = useAuth();
  // Keep the signed-in profile (leave balance, role, status) current when an admin changes it.
  useLive(['users', 'requests'], () => api.get('/auth/me').then((r) => setUser(r.data)).catch(() => {}));
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMenuOpen(false), [location.pathname]);
  // Line managers (anyone with direct reports) also get "My team".
  const { data: team } = useFetch('/users/my-team', { initial: [] });
  // Interview panellists and people onboarding get their extra pages too.
  const { data: panel } = useFetch('/recruitment/my-interviews', { initial: { interviews: [] } });
  const { data: onboarding } = useFetch('/onboarding/mine');
  const more = STAFF_NAV_MORE.filter((i) => (!i.managersOnly || team.length > 0)
    && (!i.interviewersOnly || panel.interviews.length > 0)
    && (!i.onboardingOnly || onboarding?.status === 'active'));
  const tabPaths = STAFF_TABS.map((t) => t.to);
  const sheetItems = [...STAFF_NAV_MAIN.filter((n) => !tabPaths.includes(n.to)), ...more];

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-slate-50 to-sky-50/60">
      <div className="mx-auto max-w-[1400px] px-3 py-3 sm:px-5 sm:py-5">
        <header className="sticky top-2 z-30 flex items-center gap-2 rounded-full border border-white/80 bg-white/70 p-1.5 shadow-sm backdrop-blur-md sm:top-3 sm:gap-3 sm:p-2">
          <Link to="/" className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-4 max-[359px]:pr-1">
            <Logo className="h-8 w-8" />
            <span className="font-semibold tracking-tight max-[359px]:sr-only">Solucio</span>
          </Link>
          <nav aria-label="Main" className="ml-auto hidden items-center gap-1 xl:flex">
            {STAFF_NAV_MAIN.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={pill}>{n.label}</NavLink>)}
            <MoreMenu items={more} />
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2 xl:ml-2">
            {isAdmin && (
              <Link to="/admin" className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 md:flex">
                <LayoutGrid className="h-4 w-4" /> Admin
              </Link>
            )}
            <NotificationBell />
            <ProfileMenu />
          </div>
        </header>
        {/* Re-keyed per page so each route fades up as it opens. Bottom padding clears the tab bar on phones. */}
        <main key={location.pathname} className="animate-fade-up px-1 pb-28 pt-5 sm:px-2 sm:pt-8 xl:pb-10">
          <Outlet />
        </main>
        <TabBar onMore={() => setMenuOpen(true)} moreActive={menuOpen || !tabPaths.some((p) => (p === '/' ? location.pathname === '/' : location.pathname.startsWith(p)))} />
        <MoreSheet open={menuOpen} onClose={() => setMenuOpen(false)} items={sheetItems} />
      </div>
    </div>
  );
}
