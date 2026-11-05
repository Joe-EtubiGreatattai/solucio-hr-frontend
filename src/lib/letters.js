import { fmtMoney } from './format';

// HR letter templates. Each returns editable text built from the staff record; HR can change any of it before issuing.
const day = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const EMPLOYMENT = { full_time: 'full-time', part_time: 'part-time', contract: 'fixed-term contract', locum: 'locum', intern: 'internship' };
const yearsMonths = (from, to) => {
  const m = Math.max(0, Math.round((new Date(to || Date.now()) - new Date(from)) / (30.44 * 86400000)));
  const y = Math.floor(m / 12), r = m % 12;
  return [y && `${y} year${y > 1 ? 's' : ''}`, r && `${r} month${r > 1 ? 's' : ''}`].filter(Boolean).join(' and ') || 'less than a month';
};

export const LETTER_LABEL = { employment_confirmation: 'Confirmation of employment', service_certificate: 'Certificate of service', reference: 'Reference letter', custom: 'Other letter' };

export function letterTemplate(type, f, { includeSalary } = {}) {
  const name = `${f.firstName} ${f.lastName}`;
  const role = `${f.jobTitle || 'staff member'}${f.department ? ` in the ${f.department} department` : ''}`;
  const salary = includeSalary && f.basicSalary ? ` ${f.firstName}'s current basic salary is ${fmtMoney(f.basicSalary).replace('₦', 'NGN ')} per month, before allowances and deductions.` : '';
  if (type === 'employment_confirmation') return {
    title: 'Confirmation of employment', addressee: 'To whom it may concern',
    body: `This is to confirm that ${name} (staff ID ${f.staffId}) has been employed by ${f.organisation} since ${day(f.dateJoined)} and is currently employed as a ${role} on a ${EMPLOYMENT[f.employmentType] || 'full-time'} basis.${salary}\n\nThis letter is issued at the request of the employee for whatever purpose it may serve.`,
  };
  if (type === 'service_certificate') return {
    title: 'Certificate of service', addressee: 'To whom it may concern',
    body: `This is to certify that ${name} (staff ID ${f.staffId}) was employed by ${f.organisation} from ${day(f.dateJoined)} to ${day(f.exitDate) || '[last day]'}, a period of ${yearsMonths(f.dateJoined, f.exitDate)}.\n\nAt the time of leaving, ${f.firstName} held the position of ${role}.\n\nWe thank ${f.firstName} for their service and wish them every success.`,
  };
  if (type === 'reference') return {
    title: 'Employment reference', addressee: 'Dear Sir/Madam,',
    body: `I am writing in response to your request for a reference for ${name}, who has worked at ${f.organisation} as a ${role} since ${day(f.dateJoined)}${f.exitDate ? ` until ${day(f.exitDate)}` : ''}.\n\n[Describe their main duties.]\n\n[Describe their strengths, reliability and conduct. Only include what you can support from their record.]\n\nPlease contact HR, quoting the reference above, if you would like to confirm any of this information.`,
  };
  return { title: '', addressee: 'To whom it may concern', body: '' };
}

// Letter on hospital letterhead, as an A4 PDF.
export async function downloadLetterPdf(letter, facts) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const brand = [15, 118, 110];
  doc.setFillColor(...brand).rect(0, 0, w, 6, 'F');
  doc.setTextColor(...brand).setFont('helvetica', 'bold').setFontSize(18).text(facts.organisation || 'Solucio Hospital', 56, 56);
  doc.setTextColor(110).setFont('helvetica', 'normal').setFontSize(9).text(['Human Resources', facts.address].filter(Boolean).join(' · '), 56, 72);
  doc.setDrawColor(220).line(56, 86, w - 56, 86);

  doc.setTextColor(60).setFontSize(10).text(`Ref: ${letter.reference}`, 56, 112).text(day(letter.createdAt || Date.now()), w - 56, 112, { align: 'right' });
  let y = 150;
  doc.setTextColor(20).setFontSize(11).text(letter.addressee || 'To whom it may concern', 56, y);
  if (letter.title) { y += 28; doc.setFont('helvetica', 'bold').setFontSize(12).text(letter.title.toUpperCase(), 56, y); doc.setFont('helvetica', 'normal').setFontSize(11); }
  y += 26;
  for (const para of letter.body.replace(/₦/g, 'NGN ').split(/\n{2,}/)) {
    const lines = doc.splitTextToSize(para.replace(/\n/g, ' '), w - 112);
    if (y + lines.length * 16 > h - 160) { doc.addPage(); y = 72; }
    doc.text(lines, 56, y, { lineHeightFactor: 1.45 });
    y += lines.length * 16 + 12;
  }
  y = Math.max(y + 24, 0);
  doc.text('Yours faithfully,', 56, y);
  doc.setDrawColor(150).line(56, y + 46, 236, y + 46);
  doc.setFont('helvetica', 'bold').text(letter.signatory?.name || '', 56, y + 62);
  doc.setFont('helvetica', 'normal').setTextColor(90).text(letter.signatory?.role || 'Human Resources', 56, y + 77);

  doc.setFontSize(8).setTextColor(130).text(`To verify this letter, contact ${facts.organisation || 'the hospital'} HR quoting ${letter.reference}.`, w / 2, h - 36, { align: 'center' });
  doc.save(`${letter.reference.replace(/\//g, '-')} ${facts.firstName} ${facts.lastName}.pdf`);
}
