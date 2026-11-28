// Read a duty-roster Word (.docx) file and return the same shape as readRosterPdf:
// { key, month, year, groups, rows }. Two hospital layouts are supported:
//
//  1. Row-per-day (Nurses, Health Assistant): a key like "A=Grace", a month title, and a table whose
//     header row spans shift columns (MORNING / AFTERNOON / EVENING / NIGHT / OFF, each covering several
//     staff slots) with one row per date.
//  2. Weekly grid (Hygienist): rows are weekdays (MONDAY…SUNDAY), columns are WEEK 1–5 each split into
//     AM / PM / OFF, cells hold one or more staff letters (e.g. "AC"), and the key/hours sit below the table.
//
// A .docx is a ZIP; we read just word/document.xml and inflate it with the built-in DecompressionStream
// (no dependency). The tables are machine-generated, regular XML, parsed by walking the tags directly —
// which also lets this run in Node for verification.

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const WEEKDAY = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?$/i;
const WD3 = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WD_NAME = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };
const GROUP_WORDS = { MORNING: 'morning', AFTERNOON: 'afternoon', EVENING: 'evening', NIGHT: 'night', DAY: 'day', 'ON CALL': 'on_call', OFF: 'off', AM: 'morning', PM: 'evening' };
const HOURS = /(\d{1,2})(?:[.:](\d{2}))?\s*(AM|PM)\s*(?:TO|-|–|—)\s*(\d{1,2})(?:[.:](\d{2}))?\s*(AM|PM)/i;

const to24 = (h, m, ap) => `${String((Number(h) % 12) + (ap.toUpperCase() === 'PM' ? 12 : 0)).padStart(2, '0')}:${m || '00'}`;

// --- ZIP: pull one entry out of the .docx, using the central directory then inflating the data. ---
async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipEntry(file, wanted) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('This file is not a valid Word (.docx) document.');
  let off = dv.getUint32(eocd + 16, true);
  const count = dv.getUint16(eocd + 10, true);
  const dec = new TextDecoder();
  for (let e = 0; e < count; e++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const localOff = dv.getUint32(off + 42, true);
    const fname = dec.decode(buf.subarray(off + 46, off + 46 + nameLen));
    if (fname === wanted) {
      const lNameLen = dv.getUint16(localOff + 26, true);
      const lExtraLen = dv.getUint16(localOff + 28, true);
      const start = localOff + 30 + lNameLen + lExtraLen;
      const comp = buf.subarray(start, start + compSize);
      return dec.decode(method === 0 ? comp : await inflateRaw(comp));
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('Could not find the document content inside the .docx file.');
}

// --- XML helpers (Word's document.xml is regular, machine-written markup). ---
const unescapeXml = (s) => s
  .replace(/<w:tab\b[^>]*\/?>/g, ' ').replace(/<w:br\b[^>]*\/?>/g, ' ')
  .replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

const blocks = (xml, tag) => xml.match(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, 'g')) || [];

function cellsOf(rowXml) {
  return blocks(rowXml, 'w:tc').map((tc) => {
    const gs = tc.match(/<w:gridSpan\s+w:val="(\d+)"/);
    return { text: unescapeXml(tc), span: gs ? Number(gs[1]) : 1 };
  });
}

// Expand a row's cells onto the grid: a cell of span s occupies s columns, text at its start column.
function rowColumns(cells) {
  const out = [];
  for (const c of cells) { out.push(c.text); for (let i = 1; i < c.span; i++) out.push(''); }
  return out;
}

const paragraphText = (xml) => blocks(xml, 'w:p').map(unescapeXml);

// The staff key ("A=Grace, B=Mariam") — scanned across the whole document, since some rosters put it
// below the table rather than above it.
function parseKey(xml) {
  const key = [];
  const seen = new Set();
  const keyRe = /([A-Za-z])\s*=\s*([A-Za-z][A-Za-z.'\- ]*?)\s*(?=,|;|$|\n|[A-Za-z]\s*=)/g;
  for (const line of paragraphText(xml)) {
    let km;
    keyRe.lastIndex = 0;
    while ((km = keyRe.exec(line))) {
      const letter = km[1].toUpperCase();
      const name = km[2].trim();
      if (name && !seen.has(letter)) { seen.add(letter); key.push({ letter, name }); }
    }
  }
  return key;
}

function parseMonthYear(xml) {
  const text = paragraphText(xml).join('\n').toUpperCase();
  const my = text.match(new RegExp(`(${MONTHS.join('|')})\\s+(\\d{4})`));
  return { month: my ? MONTHS.indexOf(my[1]) : null, year: my ? Number(my[2]) : null };
}

// Hours written as "AM = 7.00 AM TO 3.00 PM" / "PM = 3.00 PM TO 7.30 PM".
function hoursForLabel(xml, label) {
  const text = paragraphText(xml).join('\n');
  const m = text.match(new RegExp(`\\b${label}\\s*=\\s*([^\\n]*)`, 'i'));
  const h = m && HOURS.exec(m[1]);
  return h ? { start: to24(h[1], h[2], h[3]), end: to24(h[4], h[5], h[6]), hoursText: h[0].toUpperCase() } : null;
}

// --- Layout 1: one row per day, shift columns spanned across the header. ---
function parseRowPerDay(table, key) {
  const keyLetters = new Set(key.map((k) => k.letter));
  const trs = blocks(table, 'w:tr');
  let groups = null;
  let dateCol = 0;
  let dayCol = 1;
  const rows = [];
  const seenDays = new Set(); // some sheets repeat 1,2… at the end as next-month overflow — keep the first

  for (const tr of trs) {
    const cols = rowColumns(cellsOf(tr));
    const cells = cellsOf(tr);
    const dayVal = Number(cols[dateCol]);
    const isDataRow = groups && Number.isInteger(dayVal) && dayVal >= 1 && dayVal <= 31 && WEEKDAY.test(cols[dayCol] || '');

    if (!groups) {
      if (!cells.some((c) => GROUP_WORDS[c.text.trim().toUpperCase()])) continue;
      groups = [];
      let col = 0;
      for (const c of cells) {
        const label = c.text.trim();
        const up = label.toUpperCase();
        if (/DATE/.test(up)) dateCol = col;
        else if (/^DAY\b/.test(up) || up === 'DAY') dayCol = col;
        else if (GROUP_WORDS[up]) groups.push({ label, type: GROUP_WORDS[up], colStart: col, span: c.span, start: '', end: '', hoursText: '' });
        col += c.span;
      }
      if (!groups.length) { groups = null; }
      continue;
    }

    if (isDataRow) {
      if (seenDays.has(dayVal)) continue;
      seenDays.add(dayVal);
      const byGroup = groups.map((g) => cols.slice(g.colStart, g.colStart + g.span)
        .flatMap((t) => t.split(/\s+/)).filter((t) => keyLetters.has(t.toUpperCase())).map((t) => t.toUpperCase()));
      rows.push({ day: dayVal, weekday: cols[dayCol], byGroup });
    } else if (HOURS.test(cols.join(' '))) {
      for (const g of groups) {
        const m = HOURS.exec(cols[g.colStart] || '');
        if (m) { g.start = to24(m[1], m[2], m[3]); g.end = to24(m[4], m[5], m[6]); g.hoursText = m[0].toUpperCase(); }
      }
    }
  }

  if (!groups) throw new Error('Could not find the shift headings (MORNING, NIGHT, OFF…) in the table.');
  if (!rows.length) throw new Error('Could not find any day rows (a date number and a weekday on each line).');
  return groups ? { groups, rows } : null;
}

// --- Layout 2: weekday rows × week columns, each week split into AM / PM / OFF. ---
function parseWeeklyGrid(xml, table, key, month, year) {
  if (month == null || year == null) throw new Error('Could not read the month and year from this weekly roster.');
  const keyLetters = new Set(key.map((k) => k.letter));
  const grid = blocks(table, 'w:tr').map((tr) => rowColumns(cellsOf(tr)));

  // The row of AM / PM / OFF sub-headers defines the week columns (each week is an AM,PM,OFF triple).
  const shiftIdx = grid.findIndex((cols) => cols.filter((c) => /^(AM|PM|OFF)$/i.test(c.trim())).length >= 6);
  if (shiftIdx < 0) throw new Error('Could not find the AM / PM / OFF columns in this weekly roster.');
  const shiftCols = grid[shiftIdx];
  const weeks = shiftCols.map((c, i) => (/^AM$/i.test(c.trim()) ? { am: i, pm: i + 1, off: i + 2 } : null)).filter(Boolean);

  // The week date-ranges ("1ST - 6TH", "7TH – 13TH"…) give each week's first day of the month.
  const rangeRow = grid.slice(0, shiftIdx).reverse().find((cols) => cols.some((c) => /\d+\s*(st|nd|rd|th)/i.test(c)));
  const startDay = weeks.map((w) => {
    const m = (rangeRow && rangeRow[w.am] || '').match(/(\d{1,2})/);
    return m ? Number(m[1]) : null;
  });

  // Weekday rows, keyed by the first three letters of the first cell (handles "FRIDAYS" etc.).
  const dayRows = {};
  for (const cols of grid.slice(shiftIdx + 1)) {
    const n3 = (cols[0] || '').trim().toLowerCase().slice(0, 3);
    if (WD3.includes(n3) && !dayRows[n3]) dayRows[n3] = cols;
  }

  const letters = (t) => (t || '').toUpperCase().replace(/[^A-Z]/g, '').split('').filter((c) => keyLetters.has(c));
  const groups = [
    { label: 'AM', type: 'morning', start: '', end: '', hoursText: '', ...(hoursForLabel(xml, 'AM') || {}) },
    { label: 'PM', type: 'evening', start: '', end: '', hoursText: '', ...(hoursForLabel(xml, 'PM') || {}) },
    { label: 'OFF', type: 'off', start: '', end: '', hoursText: '' },
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rows = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const n3 = WD3[new Date(year, month, d).getDay()];
    const cols = dayRows[n3];
    if (!cols) continue;
    let wi = 0;
    for (let i = 0; i < weeks.length; i++) { if (startDay[i] != null && startDay[i] <= d) wi = i; }
    const w = weeks[wi];
    rows.push({ day: d, weekday: WD_NAME[n3], byGroup: [letters(cols[w.am]), letters(cols[w.pm]), letters(cols[w.off])] });
  }
  if (!rows.length) throw new Error('Could not place any days in this weekly roster.');
  return { groups, rows };
}

export async function readRosterDocx(file) {
  const xml = await readZipEntry(file, 'word/document.xml');
  const tableMatch = xml.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/);
  if (!tableMatch) throw new Error('No roster table was found in this document.');
  const table = tableMatch[0];

  const key = parseKey(xml);
  if (!key.length) throw new Error('Could not find the staff key (e.g. "A=Grace, B=Mariam") in this document.');
  const { month, year } = parseMonthYear(xml);

  const weekly = /\bWEEK\s*1\b/i.test(table) && /\bWEEK\s*2\b/i.test(table);
  const { groups, rows } = weekly ? parseWeeklyGrid(xml, table, key, month, year) : parseRowPerDay(table, key);
  return { key, month, year, groups, rows };
}
