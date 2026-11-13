// Duty roster as a printable PDF, laid out like the paper rosters wards pin up: one row per day,
// a column group per shift (with its hours) and an OFF group, staff shown by letter with a key.
import { ymd } from './format';

// Colours of the paper version: blue mornings, beige nights, green off-duty.
const FILL = {
  morning: [221, 233, 241], afternoon: [250, 229, 211], day: [252, 243, 207], night: [239, 233, 214],
  on_call: [233, 226, 245], custom: [226, 232, 240], off: [227, 237, 205],
};
const LEAVE = [253, 224, 71];
const ORDER = ['morning', 'day', 'afternoon', 'night', 'on_call'];
const LABEL = { morning: 'MORNING', afternoon: 'AFTERNOON', day: 'DAY', night: 'NIGHT', on_call: 'ON CALL' };
const MAX_SPLIT = 8; // more people than this in a group share one wide column

// "07:30" -> "7.30 AM", "17:00" -> "5 PM"
function clock(t) {
  const [h, m] = t.split(':').map(Number);
  const hour = h % 12 || 12;
  return `${hour}${m ? `.${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

// A, B, … Z, AA, AB, …
const letterFor = (i) => (i < 26 ? String.fromCharCode(65 + i) : letterFor(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));

const mostCommon = (list) => {
  const counts = new Map();
  list.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};

function eachDay(from, to) {
  const out = [];
  const d = new Date(`${ymd(from)}T00:00:00`);
  const end = new Date(`${ymd(to)}T00:00:00`);
  while (d <= end) { out.push(ymd(d)); d.setDate(d.getDate() + 1); }
  return out;
}

function periodTitle(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const month = (d) => d.toLocaleString('en-GB', { month: 'long' }).toUpperCase();
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) return `${month(s)} ${s.getFullYear()}`;
  return s.getFullYear() === e.getFullYear() ? `${month(s)} – ${month(e)} ${e.getFullYear()}` : `${month(s)} ${s.getFullYear()} – ${month(e)} ${e.getFullYear()}`;
}

// roster: { title, department, startDate, endDate }; shifts: populated with user; leave: approved leave requests.
export async function downloadRosterPdf(roster, shifts, leave = []) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const days = eachDay(roster.startDate, roster.endDate);

  // Everyone on the roster gets a letter, in first-name order.
  const people = [...new Map(shifts.filter((s) => s.user).map((s) => [s.user._id, s.user])).values()]
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  const firstNames = people.map((p) => p.firstName.trim().split(/\s+/)[0]);
  const letters = new Map(people.map((p, i) => [p._id, letterFor(i)]));
  const names = people.map((p, i) => (firstNames.filter((f) => f === firstNames[i]).length > 1 ? `${firstNames[i]} ${p.lastName[0]}.` : firstNames[i]));

  // Column groups: one per kind of shift used (custom hours each get their own), then OFF.
  const groupKey = (s) => (s.shiftType === 'custom' ? `custom:${s.startTime}-${s.endTime}` : s.shiftType);
  const groups = new Map();
  for (const s of shifts) {
    if (!s.user) continue;
    const key = groupKey(s);
    if (!groups.has(key)) groups.set(key, { key, type: s.shiftType, times: [], byDate: {} });
    const g = groups.get(key);
    g.times.push(`${s.startTime}-${s.endTime}`);
    (g.byDate[s.date] ||= []).push(s.user._id);
  }
  const shiftGroups = [...groups.values()].sort((a, b) => {
    const ia = ORDER.indexOf(a.type); const ib = ORDER.indexOf(b.type);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.key.localeCompare(b.key);
  });
  for (const g of shiftGroups) {
    const [start, end] = mostCommon(g.times).split('-');
    g.label = LABEL[g.type] || 'SHIFT';
    g.hours = `${clock(start)} TO ${clock(end)}`;
  }

  // On approved leave that day (highlighted in the OFF columns).
  const onLeave = (userId, date) => leave.some((r) => (r.user?._id || r.user) === userId
    && ymd(r.startDate) <= date && date <= ymd(r.endDate || r.startDate));
  const off = { key: 'off', type: 'off', label: 'OFF', hours: '', byDate: {} };
  for (const date of days) {
    const working = new Set(shiftGroups.flatMap((g) => g.byDate[date] || []));
    off.byDate[date] = people.map((p) => p._id).filter((id) => !working.has(id));
  }
  const all = [...shiftGroups, off];
  for (const g of all) {
    const most = Math.max(0, ...days.map((d) => (g.byDate[d] || []).length));
    g.split = most > MAX_SPLIT ? 1 : Math.max(most, 3); // a few spare boxes, like the paper version
  }

  // Page: portrait A4 unless the columns need landscape.
  const letterCols = all.reduce((n, g) => n + g.split, 0);
  const wideCols = all.filter((g) => g.split === 1 && Math.max(...days.map((d) => (g.byDate[d] || []).length)) > MAX_SPLIT);
  const landscape = letterCols + wideCols.length * 6 > 26;
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const margin = 28;

  // Title and key
  let y = 40;
  doc.setTextColor(20).setFont('helvetica', 'bold').setFontSize(13).text(roster.title.toUpperCase(), W / 2, y, { align: 'center' });
  y += 20;
  doc.setFontSize(12).text(`${roster.department ? `${roster.department.toUpperCase()} ` : ''}${periodTitle(roster.startDate, roster.endDate)}`, W / 2, y, { align: 'center' });
  y += 20;
  doc.setFontSize(9.5);
  const items = people.map((p, i) => ({ letter: letters.get(p._id), name: names[i] }));
  const lines = [[]];
  const widthOf = (it) => doc.setFont('helvetica', 'bold').getTextWidth(it.letter) + doc.setFont('helvetica', 'normal').getTextWidth(`=${it.name}, `);
  let lineW = 0;
  for (const it of items) {
    const w = widthOf(it);
    if (lineW + w > W - margin * 2 && lines.at(-1).length) { lines.push([]); lineW = 0; }
    lines.at(-1).push(it);
    lineW += w;
  }
  for (const line of lines) {
    const total = line.reduce((n, it) => n + widthOf(it), 0);
    let x = (W - total) / 2;
    line.forEach((it, i) => {
      doc.setFont('helvetica', 'bold').text(it.letter, x, y);
      x += doc.getTextWidth(it.letter);
      const rest = `=${it.name}${i < line.length - 1 || line !== lines.at(-1) ? ', ' : ''}`;
      doc.setFont('helvetica', 'normal').text(rest, x, y);
      x += doc.getTextWidth(rest);
    });
    y += 13;
  }

  // Table
  const head = [
    [{ content: 'Date', rowSpan: 2 }, { content: 'Day', rowSpan: 2 }, ...all.map((g) => ({ content: g.label, colSpan: g.split }))],
    all.map((g) => ({ content: g.hours, colSpan: g.split })),
  ];
  const groupOfCol = [];
  all.forEach((g) => { for (let i = 0; i < g.split; i++) groupOfCol.push({ g, i }); });
  const leaveCells = new Set();
  const body = days.map((date, r) => {
    const d = new Date(`${date}T00:00:00`);
    const cells = [String(d.getDate()), d.toLocaleDateString('en-GB', { weekday: 'long' })];
    for (const { g, i } of groupOfCol) {
      const ids = g.byDate[date] || [];
      const text = g.split === 1 ? ids.map((id) => letters.get(id)).join(' ') : (ids[i] ? letters.get(ids[i]) : '');
      if (g.type === 'off' && g.split > 1 && ids[i] && onLeave(ids[i], date)) leaveCells.add(`${r}:${cells.length}`);
      cells.push(text);
    }
    return cells;
  });

  const available = W - margin * 2 - 30 - 64;
  const colW = Math.max(12, available / (letterCols + wideCols.length * 6));
  const columnStyles = { 0: { cellWidth: 30, halign: 'center' }, 1: { cellWidth: 64, fontStyle: 'bolditalic', halign: 'center' } };
  groupOfCol.forEach(({ g }, i) => { columnStyles[i + 2] = { cellWidth: g.split === 1 && wideCols.includes(g) ? colW * 7 : colW, halign: 'center' }; });

  // Rows grow to fill the page, like the paper version (a month fits on one sheet).
  const rowH = Math.max(15, Math.min(24, (doc.internal.pageSize.getHeight() - y - 60) / (days.length + 2)));
  autoTable(doc, {
    head, body, startY: y + 4, margin: { left: margin, right: margin },
    theme: 'grid', showHead: 'everyPage', tableWidth: 'wrap',
    styles: { font: 'helvetica', fontSize: 9, textColor: 20, lineColor: [40, 40, 40], lineWidth: 0.5, cellPadding: 2.2, minCellHeight: rowH, valign: 'middle' },
    headStyles: { fillColor: [255, 255, 255], textColor: 20, fontStyle: 'bold', halign: 'center', fontSize: 9 },
    columnStyles,
    didParseCell: (c) => {
      if (c.column.index < 2) return;
      const { g } = groupOfCol[c.column.index - 2] || {};
      if (!g) return;
      if (c.section === 'head' && c.row.index === 1) c.cell.styles.fontSize = 7.5;
      if (c.section === 'body') {
        c.cell.styles.fillColor = leaveCells.has(`${c.row.index}:${c.column.index}`) ? LEAVE : FILL[g.type] || FILL.custom;
        if (g.split === 1) c.cell.styles.halign = 'left';
      }
    },
  });

  // Footer note
  const endY = doc.lastAutoTable.finalY + 14;
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(100);
  const note = [`${roster.status === 'published' ? 'Published' : 'Draft'} roster`, leaveCells.size ? 'Highlighted in OFF = on approved leave' : '', `Printed ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · Solucio HR`].filter(Boolean).join('  ·  ');
  doc.text(note, margin, Math.min(endY, doc.internal.pageSize.getHeight() - 16));

  doc.save(`${roster.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'roster'}-${periodTitle(roster.startDate, roster.endDate).replace(/\s+/g, '-').toLowerCase()}.pdf`);
}
