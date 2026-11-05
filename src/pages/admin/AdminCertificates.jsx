import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bell, BellRing, Check, Plus, Search, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { toastError } from '../../lib/api';
import useFetch from '../../lib/useFetch';
import { Avatar, Badge, Button, Card, Empty, IconButton, PageHeader, Spinner, StatCard, Tabs } from '../../components/ui';
import { CertRequestModal } from '../../components/AdminModals';
import { useConfirm } from '../../components/Confirm';
import { CertStatus, CertThumb, ExpiryCell, KIND_LABEL } from '../../components/CertificateFile';
import { fmtDate, fullName } from '../../lib/format';
import useDebounced from '../../lib/useDebounced';
import { AlertTriangle, Clock, FileClock, FileQuestion } from 'lucide-react';
import { Term } from '../../components/InfoTip';

export default function AdminCertificates() {
  const [params, setParams] = useSearchParams();
  const title = params.get('title') || '';
  const department = params.get('department') || '';
  const missingMode = !!title && params.get('holders') === 'missing';
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const filters = { status: params.get('status') || '', verification: params.get('verification') || '', kind: params.get('kind') || '', title, department, q };
  const view = params.get('view') || 'certificates';
  const { data: summary, reload: reloadSummary } = useFetch('/certificates/summary');
  const { data: titles } = useFetch('/certificates/titles', { initial: [] });
  const { data: meta } = useFetch('/users/meta', { initial: { departments: [] } });
  const { data: certs, loading, refreshing, reload } = useFetch(missingMode ? null : '/certificates', { params: filters, initial: [] });
  const { data: missing, loading: missingLoading, reload: reloadMissing } = useFetch(missingMode ? '/certificates/missing' : null, { params: { title, department, q }, initial: [] });
  const [requestFor, setRequestFor] = useState(null); // staff ids to ask for the selected certificate
  const { data: requests, reload: reloadReqs } = useFetch('/certificates/requests', { initial: [] });
  const [requestOpen, setRequestOpen] = useState(false);
  const [running, setRunning] = useState(false);

  const setFilter = (k, v) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p);
  };
  const refresh = () => { if (missingMode) reloadMissing(); else reload(); reloadSummary(); reloadReqs(); };
  const notYetRequested = missing.filter((m) => !m.request);
  const selectedTitle = titles.find((t) => t.title.toLowerCase() === title.toLowerCase());

  const ask = useConfirm();
  const verify = async (c, verification) => {
    let verificationNote = '';
    if (verification === 'rejected') {
      // Cancelling here must leave the certificate untouched.
      const reason = await ask({
        title: `Don't approve "${c.title}"?`,
        message: `It won't count on ${c.user.firstName}'s record. They'll be told why and asked to upload it again.`,
        input: { label: 'Reason (shown to the staff member)', placeholder: 'e.g. Photo is blurry; expiry date not visible', required: true },
        confirmLabel: 'Not approved',
        tone: 'danger',
      });
      if (reason === false) return;
      verificationNote = reason;
    }
    try { await api.put(`/certificates/${c._id}/verify`, { verification, verificationNote }); toast.success(verification === 'verified' ? `Approved. It now counts on ${c.user.firstName}'s record` : `${c.user.firstName} has been told why`); refresh(); } catch (e) { toastError(e); }
  };
  const remind = async (c) => {
    try { await api.post(`/certificates/${c._id}/remind`); toast.success(`Reminder sent to ${c.user.firstName}`); } catch (e) { toastError(e); }
  };
  const runAll = async () => {
    setRunning(true);
    try { const { data } = await api.post('/certificates/run-reminders'); toast.success(`${data.reminded} reminder(s) sent`); } catch (e) { toastError(e); } finally { setRunning(false); }
  };
  const cancelReq = async (r) => {
    try { await api.put(`/certificates/requests/${r._id}`, { status: 'cancelled' }); refresh(); } catch (e) { toastError(e); }
  };

  return (
    <div>
      <PageHeader title="Certificates & licences" subtitle="Approve uploads before they count, chase licence renewals, and request new ones."
        actions={<>
          <Button variant="secondary" loading={running} onClick={runAll}><BellRing className="h-4 w-4" /> Remind expiring licences</Button>
          <Button onClick={() => setRequestOpen(true)}><Plus className="h-4 w-4" /> Request certificate</Button>
        </>} />

      {summary && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Awaiting approval" value={summary.pending} icon={FileClock} tone="blue" onClick={() => setParams({ verification: 'pending' })} />
          <StatCard label="Expired licences" value={summary.expired} icon={AlertTriangle} tone="red" onClick={() => setParams({ status: 'expired' })} />
          <StatCard label="Licences expiring soon" value={summary.expiringSoon} icon={Clock} tone="amber" onClick={() => setParams({ status: 'expiring_soon' })} />
          <StatCard label="Open requests" value={summary.openRequests} icon={FileQuestion} tone="purple" onClick={() => setParams({ view: 'requests' })} />
        </div>
      )}

      <Tabs value={view} onChange={(v) => setParams({ view: v })} tabs={[
        { value: 'certificates', label: 'Uploads', count: summary?.pending || undefined },
        { value: 'requests', label: 'Certificate requests', count: requests.filter((r) => r.status === 'open').length },
      ]} />

      {view === 'certificates' ? (
        <Card bodyClass="p-0">
          <div className="space-y-3 border-b border-slate-100 p-3">
            <div className="flex flex-wrap gap-2">
              <select className="input w-full sm:w-72" aria-label="Certificate" value={title}
                onChange={(e) => { const p = new URLSearchParams(params); if (e.target.value) p.set('title', e.target.value); else { p.delete('title'); p.delete('holders'); } setParams(p); }}>
                <option value="">All certificates & licences</option>
                {titles.map((t) => <option key={t.title} value={t.title}>{t.title} ({t.holders} staff)</option>)}
              </select>
              <div className="relative w-full flex-1 sm:w-auto sm:min-w-48">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input className="input pl-9" placeholder="Search staff by name or ID" aria-label="Search staff" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <select className="input w-full sm:w-44" aria-label="Department" value={department} onChange={(e) => setFilter('department', e.target.value)}>
                <option value="">All departments</option>
                {meta.departments.map((d) => <option key={d}>{d}</option>)}
              </select>
              {!missingMode && <>
                <select className="input w-full sm:w-40" aria-label="Type" value={filters.kind} onChange={(e) => setFilter('kind', e.target.value)}>
                  <option value="">Certificates & licences</option><option value="certificate">Certificates</option><option value="licence">Licences</option>
                </select>
                <select className="input w-full sm:w-44" aria-label="Approval" value={filters.verification} onChange={(e) => setFilter('verification', e.target.value)}>
                  <option value="">Any approval</option><option value="pending">Awaiting approval</option><option value="verified">Approved</option><option value="rejected">Not approved</option>
                </select>
                <select className="input w-full sm:w-44" aria-label="Licence expiry" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
                  <option value="">Any expiry</option><option value="expired">Expired licences</option><option value="expiring_soon">Licences expiring soon</option><option value="valid">Approved and in date</option>
                </select>
              </>}
            </div>
            {title && (
              <div className="flex flex-wrap items-center gap-2">
                <div role="group" aria-label="Show staff" className="inline-flex rounded-lg border border-slate-300 p-0.5">
                  {[['', 'Has it'], ['missing', 'Without a valid one']].map(([v, label]) => (
                    <button key={v} type="button" aria-pressed={(v === 'missing') === missingMode} onClick={() => setFilter('holders', v)}
                      className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${(v === 'missing') === missingMode ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>
                  ))}
                </div>
                {selectedTitle && <span className="text-sm text-slate-500">{selectedTitle.holders} hold it{selectedTitle.expiring ? ` · ${selectedTitle.expiring} expiring soon` : ''}{selectedTitle.expired ? ` · ${selectedTitle.expired} expired` : ''}</span>}
                {missingMode && notYetRequested.length > 0 && (
                  <Button size="sm" className="ml-auto" onClick={() => setRequestFor(notYetRequested.map((m) => m.user._id))}>
                    <Send className="h-4 w-4" /> Request from all {notYetRequested.length}
                  </Button>
                )}
              </div>
            )}
          </div>
          {missingMode ? (
            missingLoading ? <Spinner /> : missing.length === 0 ? <Empty title={`Everyone holds a valid ${title}`}>No staff in this selection are missing it.</Empty> : (
              <div className="overflow-x-auto"><table className="table">
                <thead><tr><th><Term>Staff</Term></th><th><Term>Department</Term></th><th>{title}</th><th><Term>Request</Term></th><th /></tr></thead>
                <tbody>{missing.map(({ user, expiredOn, request, awaitingApproval }) => (
                  <tr key={user._id}>
                    <td><Link to={`/admin/staff/${user._id}`} className="flex items-center gap-2 hover:text-brand-700"><Avatar user={user} size="sm" /><span><span className="block font-medium">{fullName(user)}</span><span className="text-xs text-slate-500">{user.jobTitle || '—'}</span></span></Link></td>
                    <td>{user.department || '—'}</td>
                    <td>{awaitingApproval ? <Badge status="pending">Uploaded · awaiting approval</Badge> : expiredOn ? <Badge status="expired">{`Expired ${fmtDate(expiredOn)}`}</Badge> : <Badge color="slate">Never uploaded</Badge>}</td>
                    <td>{request ? <Badge color="blue">{`Requested${request.dueDate ? ` · due ${fmtDate(request.dueDate)}` : ''}`}</Badge> : <span className="text-sm text-slate-500">Not requested</span>}</td>
                    <td className="text-right">{!request && <Button size="sm" variant="secondary" onClick={() => setRequestFor([user._id])}><Send className="h-3.5 w-3.5" /> Request</Button>}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )
          ) : loading ? <Spinner /> : certs.length === 0 ? <Empty title="No certificates match" /> : (
            <div className={`overflow-x-auto transition-opacity ${refreshing ? 'opacity-60' : ''}`} aria-busy={refreshing}><table className="table">
              <thead><tr><th><Term>Staff</Term></th><th>Name</th><th><Term>Type</Term></th><th><Term>Expires</Term></th><th><Term>Status</Term></th><th /></tr></thead>
              <tbody>{certs.map((c) => (
                <tr key={c._id}>
                  <td><Link to={`/admin/staff/${c.user?._id}`} className="flex items-center gap-2 hover:text-brand-700"><Avatar user={c.user} size="sm" /><span><span className="block font-medium">{fullName(c.user)}</span><span className="text-xs text-slate-500">{c.user?.department}</span></span></Link></td>
                  <td><div className="flex items-center gap-3"><CertThumb cert={c} /><div><p className="font-medium">{c.title}</p><p className="text-xs text-slate-500">{[c.issuer, c.certificateNumber].filter(Boolean).join(' · ')}</p></div></div></td>
                  <td><Badge color={c.kind === 'licence' ? 'blue' : 'slate'}>{KIND_LABEL[c.kind] || 'Certificate'}</Badge></td>
                  <td><ExpiryCell cert={c} /></td>
                  <td><CertStatus cert={c} />{c.lastReminderAt && c.kind === 'licence' && <p className="mt-1 text-xs text-slate-500">Reminded {fmtDate(c.lastReminderAt)}</p>}</td>
                  <td className="whitespace-nowrap text-right">
                    {c.verification === 'pending' ? <span className="inline-flex gap-2">
                      <Button size="sm" onClick={() => verify(c, 'verified')}><Check className="h-4 w-4" /> Approve</Button>
                      <Button size="sm" variant="secondary" onClick={() => verify(c, 'rejected')}><X className="h-4 w-4" /> Reject</Button>
                    </span> : <>
                      {c.verification !== 'verified' && <IconButton icon={Check} tone="success" label={`Approve ${c.title}`} onClick={() => verify(c, 'verified')} />}
                      {c.verification !== 'rejected' && <IconButton icon={X} tone="danger" label={`Withdraw approval of ${c.title}`} onClick={() => verify(c, 'rejected')} />}
                    </>}
                    {c.verification === 'verified' && ['expired', 'expiring_soon'].includes(c.expiryStatus) && <IconButton icon={Bell} tone="warn" label={`Send ${c.user?.firstName} a renewal reminder`} onClick={() => remind(c)} />}
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      ) : (
        <Card bodyClass="p-0">
          {requests.length === 0 ? <Empty title="No certificate requests" /> : (
            <div className="overflow-x-auto"><table className="table">
              <thead><tr><th><Term>Staff</Term></th><th><Term>Certificate</Term></th><th><Term>Due</Term></th><th><Term>Requested</Term></th><th><Term>Status</Term></th><th /></tr></thead>
              <tbody>{requests.map((r) => (
                <tr key={r._id}>
                  <td className="font-medium">{fullName(r.user)}<p className="text-xs font-normal text-slate-500">{r.user?.department}</p></td>
                  <td>{r.title}{r.message && <p className="text-xs text-slate-500">{r.message}</p>}</td>
                  <td>{fmtDate(r.dueDate)}</td><td>{fmtDate(r.createdAt)}</td>
                  <td><Badge status={r.status} /></td>
                  <td className="text-right">{r.status === 'open' && <Button variant="ghost" size="sm" onClick={() => cancelReq(r)}>Cancel</Button>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      )}
      <CertRequestModal open={requestOpen} onClose={() => setRequestOpen(false)} onSaved={refresh} />
      <CertRequestModal open={!!requestFor} users={requestFor || undefined} initialTitle={title} onClose={() => setRequestFor(null)} onSaved={refresh} />
    </div>
  );
}
