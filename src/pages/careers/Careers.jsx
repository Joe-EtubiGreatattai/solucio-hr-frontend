import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, CalendarClock, MapPin, Search } from 'lucide-react';
import useFetch from '../../lib/useFetch';
import { Badge, Empty, Spinner } from '../../components/ui';
import { fmtDate, fmtMoney, titleCase } from '../../lib/format';
import api from '../../lib/api';

export const employmentLabel = (t) => ({ full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', locum: 'Locum', intern: 'Internship' }[t] || titleCase(t));

export default function Careers() {
  const { data: jobs, loading } = useFetch('/careers/jobs', { initial: [], live: false });
  useEffect(() => { api.post('/careers/visit', { page: 'listing' }, { anonymous: true }).catch(() => {}); }, []);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const departments = useMemo(() => [...new Set(jobs.map((j) => j.department))].sort(), [jobs]);
  const shown = jobs.filter((j) => (!dept || j.department === dept) && `${j.title} ${j.department} ${j.summary}`.toLowerCase().includes(q.toLowerCase()));

  return (
    // Desktop: a full-height intro panel on the left, the roles filling the right. Phones: stacked.
    <div className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section className="flex flex-col justify-center bg-gradient-to-br from-slate-950 via-brand-900 to-brand-700 px-4 py-10 text-white sm:px-8 lg:px-12 lg:py-16">
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand-100">Careers at Solucio</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl xl:text-6xl">Do work that matters.</h1>
        <p className="mt-4 max-w-md text-lg text-brand-100">Join our doctors, nurses, scientists and support teams delivering compassionate care.</p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input className="input pl-11 text-slate-900" placeholder="Search roles" aria-label="Search roles" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input text-slate-900 sm:w-56 lg:w-full xl:w-56" aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>{departments.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      </section>

      <section className="flex flex-col px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">{shown.length} open role{shown.length === 1 ? '' : 's'}</h2>
        {loading ? <Spinner /> : shown.length === 0 ? <Empty icon={Briefcase} title="No open roles match">Check back soon. New roles are posted regularly.</Empty> : (
          <ul className="stagger mt-4 divide-y divide-slate-100 border-y border-slate-100">
            {shown.map((j) => (
              <li key={j._id}>
                <Link to={`/careers/${j._id}`} className="group -mx-4 flex items-center gap-4 rounded-xl px-4 py-6 transition hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <p className="text-xl font-semibold group-hover:text-brand-700">{j.title}</p>
                      {j.openings > 1 && <Badge color="teal">{`${j.openings} positions`}</Badge>}
                    </div>
                    {j.summary && <p className="mt-1 text-slate-600">{j.summary}</p>}
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4" />{j.department} · {employmentLabel(j.employmentType)}</span>
                      <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{j.location}</span>
                      {j.closingDate && <span className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4" />Closes {fmtDate(j.closingDate)}</span>}
                      {j.showSalary && j.salaryMin && <span className="font-medium text-brand-800">{fmtMoney(j.salaryMin)}–{fmtMoney(j.salaryMax)} / month</span>}
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-brand-700" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
