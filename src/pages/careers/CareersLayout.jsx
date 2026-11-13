import { Link, Outlet, useLocation } from 'react-router-dom';
import Logo from '../../components/Logo';
import useFetch from '../../lib/useFetch';

// Public layout for the careers site (no sign-in). Full width; each page sets its own padding.
export default function CareersLayout() {
  const { data: info } = useFetch('/careers/info', { live: false });
  const { pathname } = useLocation();
  const link = (to, active) => `flex min-h-10 items-center rounded-full px-4 transition ${active ? 'bg-slate-900 font-semibold text-white' : 'text-slate-600 hover:bg-slate-100'}`;
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-white">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-100 px-4 sm:px-8 lg:px-12">
        <Link to="/careers" className="flex min-w-0 items-center gap-2.5"><Logo className="h-9 w-9" />
          <span className="min-w-0 leading-tight"><span className="block truncate font-semibold">{info?.organisationName || 'Solucio Hospital'}</span><span className="block text-xs text-slate-500">Careers</span></span></Link>
        <nav className="ml-auto flex shrink-0 items-center gap-1 text-sm">
          <Link to="/careers/status" className={link('/careers/status', pathname === '/careers/status')}><span className="sm:hidden">Track application</span><span className="hidden sm:inline">Check an application</span></Link>
          <Link to="/login" className={`${link('/login', false)} hidden sm:flex`}>Staff sign in</Link>
        </nav>
      </header>
      <main key={pathname} className="flex w-full flex-1 animate-fade-in flex-col">
        <Outlet />
      </main>
      <footer className="shrink-0 border-t border-slate-100 px-4 py-4 text-xs text-slate-500 sm:px-8 lg:px-12">
        We process applicant data under the Nigeria Data Protection Act 2023, only to assess your application.
      </footer>
    </div>
  );
}
