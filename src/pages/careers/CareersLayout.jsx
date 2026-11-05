import { Link, Outlet, useLocation } from 'react-router-dom';
import Logo from '../../components/Logo';
import useFetch from '../../lib/useFetch';

// Public layout for the careers site (no sign-in).
export default function CareersLayout() {
  const { data: info } = useFetch('/careers/info', { live: false });
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-slate-50 to-sky-50/60">
      <header className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
        <Link to="/careers" className="flex items-center gap-2.5"><Logo className="h-10 w-10" />
          <span><span className="block font-semibold leading-tight">{info?.organisationName || 'Solucio Hospital'}</span><span className="block text-xs text-slate-500">Careers</span></span></Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link to="/careers/status" className={`flex min-h-10 items-center rounded-full px-4 ${pathname === '/careers/status' ? 'bg-white font-semibold shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}>Check an application</Link>
          <Link to="/login" className="hidden min-h-10 items-center rounded-full px-4 text-slate-600 hover:bg-white/70 sm:flex">Staff sign in</Link>
        </nav>
      </header>
      <main key={pathname} className="mx-auto max-w-5xl animate-fade-up px-4 pb-16 sm:px-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-slate-500 sm:px-6">
        We process applicant data under the Nigeria Data Protection Act 2023, only to assess your application.
      </footer>
    </div>
  );
}
