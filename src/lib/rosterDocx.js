// Read a duty-roster Word (.docx) file laid out like the printed one: a key such as "A=Grace, B=Mariam",
// a title with the month ("NURSES OCTOBER 2026"), and a table whose header row spans shift columns
// (MORNING / AFTERNOON / NIGHT / OFF, each covering several staff slots) with one row per day.
// Returns the same shape as readRosterPdf: { key, month, year, groups, rows }.
//
// A .docx is a ZIP; we read just word/document.xml and inflate it with the built-in DecompressionStream
// (no dependency). The table is machine-generated, regular XML, so it is parsed by walking the w:tbl /
// w:tr / w:tc tags directly — which also lets this run in Node for verification.

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const WEEKDAY = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?$/i;
const GROUP_WORDS = { MORNING: 'morning', AFTERNOON: 'afternoon', EVENING: 'afternoon', NIGHT: 'night', DAY: 'day', 'ON CALL': 'on_call', OFF: 'off' };
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

export async function readRosterDocx(file) {
  const xml = await readZipEntry(file, 'word/document.xml');

  const tableMatch = xml.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/);
  if (!tableMatch) throw new Error('No roster table was found in this document.');
  const table = tableMatch[0];
  const preamble = xml.slice(0, tableMatch.index);

  // Key and title come from the paragraphs above the table.
  const preText = blocks(preamble, 'w:p').map(unescapeXml).filter(Boolean).join('\n');
  const key = [];
  const seen = new Set();
  const keyRe = /([A-Za-z])\s*=\s*([A-Za-z][A-Za-z.'\- ]*?)\s*(?=,|;|$|\n|[A-Za-z]\s*=)/g;
  let km;
  while ((km = keyRe.exec(preText))) {
    const letter = km[1].toUpperCase();
    const name = km[2].trim();
    if (name && !seen.has(letter)) { seen.add(letter); key.push({ letter, name }); }
  }
  if (!key.length) throw new Error('Could not find the staff key (e.g. "A=Grace, B=Mariam") above the table.');
  const keyLetters = new Set(key.map((k) => k.letter));

  const my = preText.toUpperCase().match(new RegExp(`(${MONTHS.join('|')})\\s+(\\d{4})`));
  const month = my ? MONTHS.indexOf(my[1]) : null;
  const year = my ? Number(my[2]) : null;

  // Walk the table rows: first the header (spanned shift columns), then an optional hours row, then days.
  const trs = blocks(table, 'w:tr');
  let groups = null;
  let dateCol = 0;
  let dayCol = 1;
  const rows = [];

  for (const tr of trs) {
    const cells = cellsOf(tr);
    const cols = rowColumns(cells);

    const dayVal = Number(cols[dateCol]);
    const isDataRow = groups && Number.isInteger(dayVal) && dayVal >= 1 && dayVal <= 31 && WEEKDAY.test(cols[dayCol] || '');

    if (!groups) {
      // Header row: the first row that names a shift group. Record each group's column range.
      const hasGroup = cells.some((c) => GROUP_WORDS[c.text.trim().toUpperCase()]);
      if (!hasGroup) continue;
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
      if (!groups.length) { groups = null; continue; }
      continue;
    }

    if (isDataRow) {
      const byGroup = groups.map((g) => cols.slice(g.colStart, g.colStart + g.span)
        .flatMap((t) => t.split(/\s+/)).filter((t) => keyLetters.has(t.toUpperCase()))
        .map((t) => t.toUpperCase()));
      rows.push({ day: dayVal, weekday: cols[dayCol], byGroup });
    } else if (HOURS.test(cols.join(' '))) {
      // Hours row: the hours sit in the cell under each group's start column.
      for (const g of groups) {
        const m = HOURS.exec(cols[g.colStart] || '');
        if (m) { g.start = to24(m[1], m[2], m[3]); g.end = to24(m[4], m[5], m[6]); g.hoursText = m[0].toUpperCase(); }
      }
    }
  }

  if (!groups) throw new Error('Could not find the shift headings (MORNING, NIGHT, OFF…) in the table.');
  if (!rows.length) throw new Error('Could not find any day rows (a date number and a weekday on each line).');

  return { key, month, year, groups, rows };
}
