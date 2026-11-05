import { MailWarning } from 'lucide-react';
import useFetch from '../lib/useFetch';

// Shown when no mail server is set up: applicant emails are written and saved, but not delivered.
export default function EmailStatusNote({ className = '' }) {
  const { data } = useFetch('/recruitment/email-status', { live: false });
  if (!data || data.configured) return null;
  return (
    <p className={`flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ${className}`}>
      <MailWarning className="mt-0.5 h-4 w-4 shrink-0" />
      <span>Applicant emails are saved in each candidate’s <b>Emails</b> tab but <b>not delivered yet</b>: no mail server is set up. Add the SMTP details to <code>backend/.env</code> to start sending them.</span>
    </p>
  );
}
