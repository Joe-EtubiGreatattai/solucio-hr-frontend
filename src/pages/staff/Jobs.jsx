import { useState } from 'react';
import { Briefcase, CalendarClock } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, Spinner } from '../../components/ui';
import { fmtDate, fmtDateTime, fmtMoney, titleCase } from '../../lib/format';
import { STAGE_LABEL } from '../admin/Recruitment';
import { employmentLabel } from '../careers/Careers';
import { Term } from '../../components/InfoTip';

// Internal vacancies (career moves within the hospital) and my applications.
export default function Jobs() {
  const { data: jobs, loading, reload } = useFetch('/recruitment/internal-jobs', { initial: [] });
  const { data: mine, reload: reloadMine } = useFetch('/recruitment/my-applications', { initial: [] });
  const [applying, setApplying] = useState(null);
  const [view, setView] = useState(null);
  const [letter, setLetter] = useState('');
  const [cv, setCv] = useState(null);
  const [busy, setBusy] = useState(false);

  const apply = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('coverLetter', letter);
      if (cv) fd.append('cv', cv);
      await api.post(`/recruitment/internal-jobs/${applying._id}/apply`, fd);
      toast.success("Application sent. You'll be notified as it progresses");
      setApplying(null); setLetter(''); setCv(null); reload(); reloadMine();
    } catch (err) { toastError(err); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Internal jobs" subtitle="Grow your career at Solucio: roles open to current staff." />
      {mine.length > 0 && (
        <Card className="mb-6" title="My applications" bodyClass="p-0">
          <ul className="divide-y divide-slate-100">{mine.map((a) => {
            const next = a.interviews?.find((i) => i.status === 'scheduled' && new Date(i.scheduledAt) > new Date());
            return (
              <li key={a._id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1"><span className="block font-medium">{a.opening?.title}</span><span className="text-xs text-slate-500">Applied {fmtDate(a.createdAt)}</span></span>
                {next && <span className="flex items-center gap-1 text-sm text-sky-800"><CalendarClock className="h-4 w-4" />Interview {fmtDateTime(next.scheduledAt)}{next.location && ` · ${next.location}`}</span>}
                <Badge status={a.stage === 'hired' ? 'approved' : a.stage === 'rejected' ? 'rejected' : 'pending'}>{a.stage === 'rejected' ? 'Not progressed' : STAGE_LABEL[a.stage]}</Badge>
              </li>
            );
          })}</ul>
        </Card>
      )}
      {loading ? <Spinner /> : jobs.length === 0 ? <Card><Empty icon={Briefcase} title="No internal vacancies right now">You'll get a notification when one opens.</Empty></Card> : (
        <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2">
          {jobs.map((j) => (
            <Card key={j._id}>
              <div className="flex flex-wrap items-center gap-2"><Badge color="teal">{j.department}</Badge><Badge color="slate">{employmentLabel(j.employmentType)}</Badge>{j.grade && <Badge color="slate">{j.grade.code}</Badge>}</div>
              <h3 className="mt-2 text-lg font-semibold">{j.title}</h3>
              <p className="text-sm text-slate-600">{j.summary}</p>
              <p className="mt-2 text-xs text-slate-500">{j.closingDate ? `Closes ${fmtDate(j.closingDate)}` : 'Open until filled'}{j.showSalary && j.salaryMin ? ` · ${fmtMoney(j.salaryMin)}–${fmtMoney(j.salaryMax)}/month` : ''}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setView(j)}>Details</Button>
                {j.myApplication ? <Badge color="blue">{`Applied · ${STAGE_LABEL[j.myApplication]}`}</Badge> : <Button size="sm" onClick={() => setApplying(j)}>Apply</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {view && (
        <Modal open onClose={() => setView(null)} title={view.title} footer={!view.myApplication && <Button onClick={() => { setApplying(view); setView(null); }}>Apply</Button>}>
          <p className="text-slate-700">{view.description || view.summary}</p>
          {view.responsibilities?.length > 0 && <><p className="label mt-4">Responsibilities</p><ul className="list-disc pl-5 text-sm">{view.responsibilities.map((r) => <li key={r}>{r}</li>)}</ul></>}
          {view.requirements?.length > 0 && <><p className="label mt-4">Requirements</p><ul className="list-disc pl-5 text-sm">{view.requirements.map((r) => <li key={r}>{r}</li>)}</ul></>}
        </Modal>
      )}
      {applying && (
        <Modal open onClose={() => setApplying(null)} title={`Apply: ${applying.title}`} footer={<><Button variant="secondary" onClick={() => setApplying(null)}>Cancel</Button><Button form="apply-form" loading={busy}>Send application</Button></>}>
          <form id="apply-form" onSubmit={apply} className="space-y-4">
            <p className="text-sm text-slate-500"><Term>HR will see your current role and record. Your line manager isn't told unless you reach interview.</Term></p>
            <Field label={`Why ${titleCase(applying.title).toLowerCase()}?`}><textarea rows={5} className="input" required value={letter} onChange={(e) => setLetter(e.target.value)} /></Field>
            <Field label="Updated CV (optional)"><input type="file" accept=".pdf,.doc,.docx" className="input" onChange={(e) => setCv(e.target.files[0])} /></Field>
          </form>
        </Modal>
      )}
    </div>
  );
}
