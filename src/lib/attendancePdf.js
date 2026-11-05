import { fmtDate, fmtMinutes, fmtTime, fullName, titleCase } from './format';

const BRAND = [15, 118, 110]; // brand-700
const STATUS_LABEL = { on_time: 'On time', late: 'Late', unscheduled: 'Unscheduled' };

// jsPDF is only needed when someone downloads, so load it on demand.
async function loadPdf() {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  return { doc: new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' }), autoTable };
}

function header(doc, title, filters) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, w, 64, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold').setFontSize(18).text('Solucio Hospital', 40, 30);
  doc.setFont('helvetica', 'normal').setFontSize(11).text(title, 40, 48);
  doc.setFontSize(9).text(`Generated ${new Date().toLocaleString()}`, w - 40, 48, { align: 'right' });
  doc.setTextColor(60);
  doc.setFontSize(10).text(filters, 40, 86);
}

function summaryLine(doc, items, y) {
  let x = 40;
  doc.setFontSize(10);
  for (const [label, value] of items) {
    doc.setFont('helvetica', 'normal').setTextColor(110).text(label, x, y);
    doc.setFont('helvetica', 'bold').setTextColor(30).text(String(value), x, y + 15);
    x += Math.max(90, doc.getTextWidth(label) + 30);
  }
}

function footer(doc) {
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(140);
    doc.text('Confidential: Solucio Hospital HR', 40, h - 20);
    doc.text(`Page ${i} of ${pages}`, w - 40, h - 20, { align: 'right' });
  }
}

const tableStyle = {
  startY: 132,
  margin: { left: 40, right: 40, top: 40, bottom: 40 },
  styles: { fontSize: 8.5, cellPadding: 4, textColor: 40 },
  headStyles: { fillColor: BRAND, textColor: 255, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: [245, 248, 248] },
};

const describeFilters = (f) =>
  [`Period: ${fmtDate(f.from)} to ${fmtDate(f.to)}`, `Department: ${f.department || 'All'}`, f.status && `Status: ${STATUS_LABEL[f.status]}`]
    .filter(Boolean).join('   ·   ');

// Detailed log of every check-in in the filtered period.
export async function downloadAttendanceRecordsPdf(records, filters) {
  const { doc, autoTable } = await loadPdf();
  header(doc, 'Attendance records', describeFilters(filters));
  const late = records.filter((r) => r.status === 'late');
  summaryLine(doc, [
    ['Check-ins', records.length],
    ['On time', records.filter((r) => r.status === 'on_time').length],
    ['Late', late.length],
    ['Unscheduled', records.filter((r) => r.status === 'unscheduled').length],
    ['Avg. lateness', late.length ? `${Math.round(late.reduce((a, r) => a + r.lateMinutes, 0) / late.length)} min` : '—'],
    ['Hours worked', fmtMinutes(records.reduce((a, r) => a + (r.workedMinutes || 0), 0))],
    ['Not checked out', records.filter((r) => !r.clockOut).length],
  ], 104);

  autoTable(doc, {
    ...tableStyle,
    head: [['Staff', 'Staff ID', 'Department', 'Date', 'Shift', 'In', 'Out', 'Worked', 'Status', 'Confirmed by']],
    body: records.map((r) => [
      fullName(r.user), r.user?.staffId || '', r.user?.department || '', fmtDate(r.clockIn),
      r.shift ? `${titleCase(r.shift.shiftType)} ${r.shift.startTime}–${r.shift.endTime}` : 'Unscheduled',
      fmtTime(r.clockIn), r.clockOut ? fmtTime(r.clockOut) : 'On duty', fmtMinutes(r.workedMinutes),
      r.status === 'late' ? `Late ${r.lateMinutes}m` : STATUS_LABEL[r.status],
      r.confirmedBy ? `${fullName(r.confirmedBy)}${r.checkInMethod === 'manual' ? ' (manual)' : ''}` : '—',
    ]),
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 8 && String(d.cell.raw).startsWith('Late')) d.cell.styles.textColor = [180, 83, 9];
    },
  });
  footer(doc);
  doc.save(`attendance_${filters.from}_${filters.to}.pdf`);
}

// Per-staff punctuality and attendance summary.
export async function downloadPunctualityPdf(rows, filters) {
  const { doc, autoTable } = await loadPdf();
  header(doc, 'Punctuality & attendance report', describeFilters(filters));
  const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
  const timed = sum('onTime') + sum('late');
  summaryLine(doc, [
    ['Staff', rows.length],
    ['Shifts scheduled', sum('scheduled')],
    ['Absences', sum('absences')],
    ['Late arrivals', sum('late')],
    ['Overall punctuality', timed ? `${Math.round((sum('onTime') / timed) * 100)}%` : '—'],
    ['Overall attendance', sum('scheduled') ? `${Math.round((sum('attendedShifts') / sum('scheduled')) * 100)}%` : '—'],
    ['Hours worked', Math.round(sum('hoursWorked'))],
  ], 104);

  const pct = (v) => (v == null ? '—' : `${v}%`);
  autoTable(doc, {
    ...tableStyle,
    head: [['Staff', 'Staff ID', 'Department', 'Scheduled', 'Attended', 'Absences', 'On time', 'Late', 'Avg late', 'Early leaves', 'Hours', 'Attendance', 'Punctuality']],
    body: rows.map((r) => [
      fullName(r.user), r.user.staffId || '', r.user.department || '', r.scheduled, r.attendedShifts, r.absences, r.onTime, r.late,
      r.avgLateMinutes ? `${r.avgLateMinutes}m` : '—', r.earlyLeaves, r.hoursWorked, pct(r.attendanceRate), pct(r.punctualityRate),
    ]),
    columnStyles: Object.fromEntries([3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => [i, { halign: 'right' }])),
    // Colour the rate columns like the on-screen bars: green ≥85%, amber ≥65%, red below.
    didParseCell: (d) => {
      if (d.section !== 'body' || ![11, 12].includes(d.column.index)) return;
      const v = parseInt(d.cell.raw, 10);
      if (Number.isNaN(v)) return;
      d.cell.styles.textColor = v >= 85 ? [4, 120, 87] : v >= 65 ? [180, 83, 9] : [190, 18, 60];
      d.cell.styles.fontStyle = 'bold';
    },
  });
  footer(doc);
  doc.save(`punctuality_${filters.from}_${filters.to}.pdf`);
}
