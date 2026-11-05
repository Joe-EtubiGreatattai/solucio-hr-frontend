import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, CalendarClock, MapPin, Search } from 'lucide-react';
import useFetch from '../../lib/useFetch';
import { Badge, Empty, Spinner } from '../../components/ui';
import { fmtDate, fmtMoney, titleCase } from '../../lib/format';

export const employmentLabel = (t) => ({ full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', locum: 'Locum', intern: 'Internship' }[t] || titleCase(t));

export default function Careers() {
  const { data: jobs, loading } = useFetch('/careers/jobs', { initial: [], live: false });
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const departments = useMemo(() => [...new Set(jobs.map((j) => j.department))].sort(), [jobs]);
  const shown = jobs.filter((j) => (!dept || j.department === dept) && `${j.title} ${j.department} ${j.summary}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <section className="rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 px-6 py-10 text-white shadow-sm sm:px-10 sm:py-14">
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">Care for Lagos with us.</h1>
        <p className="mt-3 max-w-xl text-brand-100">Join our doctors, nurses, scientists and support teams delivering compassionate care around the clock.</p>
        <div className="mt-6 flex max-w-xl flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input className="input pl-11 text-slate-900" placeholder="Search roles" aria-label="Search roles" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input text-slate-900 sm:w-48" aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>{departments.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      </section>

      <h2 className="mb-3 mt-8 text-lg font-semibold">{shown.length} open role{shown.length === 1 ? '' : 's'}</h2>
      {loading ? <Spinner /> : shown.length === 0 ? <div className="card"><Empty icon={Briefcase} title="No open roles match">Check back soon. New roles are posted regularly.</Empty></div> : (
        <ul className="stagger space-y-3">
          {shown.map((j) => (
            <li key={j._id}>
              <Link to={`/careers/${j._id}`} className="lift card block p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold">{j.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{j.summary}</p>
                  </div>
                  {j.showSalary && j.salaryMin && <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-800">{fmtMoney(j.salaryMin)}–{fmtMoney(j.salaryMax)} / month</span>}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                  <span className="flex items-center gap-1"><Briefcase className="h-4 w-4" />{j.department} · {employmentLabel(j.employmentType)}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{j.location}</span>
                  {j.closingDate && <span className="flex items-center gap-1"><CalendarClock className="h-4 w-4" />Closes {fmtDate(j.closingDate)}</span>}
                  {j.openings > 1 && <Badge color="teal">{`${j.openings} positions`}</Badge>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
