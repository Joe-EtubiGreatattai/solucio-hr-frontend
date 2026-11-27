// Read a duty-roster PDF laid out like the printed one (lib/rosterPdf.js): a key such as
// "A=Grace, B=Mariam", column groups headed MORNING / NIGHT / OFF with their hours, and one row per day.
// Works on PDFs that contain text (typed rosters, or ones downloaded from Solucio HR), not scans or photos.

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const WEEKDAY = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?$/i;
const GROUP_WORDS = { MORNING: 'morning', AFTERNOON: 'afternoon', EVENING: 'afternoon', NIGHT: 'night', DAY: 'day', 'ON CALL': 'on_call', OFF: 'off' };
const HOURS = /(\d{1,2})(?:[.:](\d{2}))?\s*(AM|PM)\s*(?:TO|-|–)\s*(\d{1,2})(?:[.:](\d{2}))?\s*(AM|PM)/i;

let pdfjs;
async function loadPdfjs() {
  if (!pdfjs) {
    pdfjs = await import('pdfjs-dist');
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }
  return pdfjs;
}

const to24 = (h, m, ap) => `${String((Number(h) % 12) + (ap.toUpperCase() === 'PM' ? 12 : 0)).padStart(2, '0')}:${m || '00'}`;

// Text pieces with positions (x from the left, y from the top), page by page.
async function textItems(file) {
  const lib = await loadPdfjs();
  const pdf = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const { height } = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    pages.push(content.items.filter((i) => i.str?.trim()).map((i) => ({
      text: i.str.trim(), x: i.transform[4], w: i.width, y: height - i.transform[5],
    })));
  }
  return pages;
}

// Items close together vertically form one line.
function linesOf(items) {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  for (const it of sorted) {
    const line = lines.find((l) => Math.abs(l.y - it.y) < 3);
    if (line) line.items.push(it); else lines.push({ y: it.y, items: [it] });
  }
  lines.forEach((l) => l.items.sort((a, b) => a.x - b.x));
  return lines;
}

// Split the sorted letter columns into one run per heading. Two clues, whatever the alignment:
// a heading sits somewhere above its own columns, and staff fill each group from the left, so a new
// group starts where a column is used more often than the one before it.
function assignColumns(cols, counts, groups) {
  const n = cols.length;
  const g = groups.length;
  const gaps = cols.slice(1).map((c, i) => c - cols[i]).sort((a, b) => a - b);
  const half = Math.max(5, (gaps[Math.floor(gaps.length / 2)] || 20) / 2);
  const cost = (from, to, k) => {
    if (from === to) return 40; // a heading with nothing under it
    const h = groups[k];
    const left = cols[from] - half;
    const right = cols[to - 1] + half;
    const apart = Math.max(0, h.x - right, left - (h.x + h.w)); // heading not over these columns
    let rises = 0;
    for (let c = from; c < to - 1; c++) rises += Math.max(0, counts[c + 1] - counts[c]);
    return apart * 10 + rises * 2 + Math.abs((left + right) / 2 - h.center) * 0.05;
  };
  const best = Array.from({ length: g + 1 }, () => Array(n + 1).fill(Infinity));
  const cut = Array.from({ length: g + 1 }, () => Array(n + 1).fill(0));
  best[0][0] = 0;
  for (let k = 1; k <= g; k++) {
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= j; i++) {
        const c = best[k - 1][i] + cost(i, j, k - 1);
        if (c < best[k][j]) { best[k][j] = c; cut[k][j] = i; }
      }
    }
  }
  const owner = Array(n);
  let j = n;
  for (let k = g; k >= 1; k--) {
    const i = cut[k][j];
    for (let c = i; c < j; c++) owner[c] = k - 1;
    j = i;
  }
  return owner;
}

export async function readRosterPdf(file) {
  const pages = await textItems(file);
  const allLines = pages.flatMap((items) => linesOf(items));
  const fullText = allLines.map((l) => l.items.map((i) => i.text).join(' ')).join('\n');
  if (!fullText.trim()) throw new Error("This PDF has no readable text. It may be a scan or photo; use the typed roster saved as a PDF.");

  // Key: A=Grace, B= Mariam C=Faith …
  const key = [];
  // Names start with a capital, and shift words (OFF, DAY…) are never letters.
  for (const m of fullText.matchAll(/\b([A-Z]{1,3})\s*=\s*([A-Z][A-Za-z'’.-]*(?:\s+[A-Z]\.)?)/g)) {
    if (GROUP_WORDS[m[1]] || key.some((k) => k.letter === m[1])) continue;
    key.push({ letter: m[1], name: m[2].replace(/[,.]$/, '') });
  }
  if (!key.length) throw new Error('Could not find the staff key (like "A=Grace, B=Mariam") in this PDF.');

  // Month and year from the title, e.g. "NURSES OCTOBER 2026".
  const my = fullText.toUpperCase().match(new RegExp(`(${MONTHS.join('|')})\\s+(\\d{4})`));
  const month = my ? MONTHS.indexOf(my[1]) : null;
  const year = my ? Number(my[2]) : null;

  const rows = [];
  const groupsByPage = [];
  for (const items of pages) {
    const lines = linesOf(items);
    // Day rows: start with a date number and include a weekday.
    const dayRows = lines.filter((l) => /^\d{1,2}$/.test(l.items[0]?.text) && l.items.some((i) => WEEKDAY.test(i.text)));
    if (!dayRows.length) continue;
    const top = dayRows[0].y;

    // Group headings above the rows (all capitals, so the "Day" column heading isn't mistaken for DAY).
    const headings = [];
    for (const l of lines.filter((ln) => ln.y < top)) {
      const text = l.items.map((i) => i.text).join(' ');
      for (const it of l.items) {
        const word = it.text.toUpperCase();
        if (it.text === word && GROUP_WORDS[word]) headings.push({ label: word, type: GROUP_WORDS[word], x: it.x, w: it.w, center: it.x + it.w / 2, y: l.y });
      }
      if (/ON CALL/.test(text) && !headings.some((h) => h.type === 'on_call')) {
        const it = l.items.find((i) => /ON/.test(i.text));
        if (it) headings.push({ label: 'ON CALL', type: 'on_call', x: it.x, w: it.w * 2.2, center: it.x + it.w, y: l.y });
      }
    }
    headings.sort((a, b) => a.center - b.center);
    // Hours under each heading: "7.30 AM TO 5 PM".
    const hourItems = lines.filter((l) => l.y < top).flatMap((l) => {
      const joined = [];
      // Hours can be split across pieces; join neighbours on the line.
      for (let i = 0; i < l.items.length; i++) {
        let text = '';
        let j = i;
        for (; j < Math.min(l.items.length, i + 6); j++) {
          text += `${text ? ' ' : ''}${l.items[j].text}`;
          if (HOURS.test(text)) break;
        }
        const m = text.match(HOURS);
        if (m) { joined.push({ m, center: (l.items[i].x + l.items[Math.min(j, l.items.length - 1)].x + l.items[Math.min(j, l.items.length - 1)].w) / 2 }); i = j; }
      }
      return joined;
    });
    for (const h of headings) {
      const near = hourItems.sort((a, b) => Math.abs(a.center - h.center) - Math.abs(b.center - h.center))[0];
      if (near && h.type !== 'off' && Math.abs(near.center - h.center) < 120) {
        const [, h1, m1, a1, h2, m2, a2] = near.m;
        h.start = to24(h1, m1, a1);
        h.end = to24(h2, m2, a2);
        h.hoursText = near.m[0].toUpperCase();
      }
    }
    if (!headings.length) throw new Error('Could not find the shift headings (MORNING, NIGHT, OFF…) above the table.');

    // Letter columns: every staff letter's position across all rows.
    const keyLetters = new Set(key.map((k) => k.letter));
    const cells = [];
    dayRows.forEach((l) => {
      const dayIdx = l.items.findIndex((i) => WEEKDAY.test(i.text));
      l.items.slice(dayIdx + 1).forEach((it) => {
        it.text.split(/\s+/).filter((t) => keyLetters.has(t)).forEach((t) => cells.push({ row: l, letter: t, x: it.x + it.w / 2 }));
      });
    });
    const xs = [...cells.map((c) => c.x)].sort((a, b) => a - b);
    const cols = [];
    xs.forEach((x) => { if (!cols.length || x - cols.at(-1).max > 6) cols.push({ min: x, max: x }); else cols.at(-1).max = x; });
    const centers = cols.map((c) => (c.min + c.max) / 2);
    const counts = centers.map((c) => cells.filter((cell) => Math.abs(cell.x - c) <= 6).length);
    const owner = assignColumns(centers, counts, headings);
    const groupOf = (x) => owner[centers.reduce((best, c, i) => (Math.abs(c - x) < Math.abs(centers[best] - x) ? i : best), 0)];

    for (const l of dayRows) {
      const day = Number(l.items[0].text);
      const weekday = l.items.find((i) => WEEKDAY.test(i.text)).text;
      const byGroup = headings.map(() => []);
      cells.filter((c) => c.row === l).forEach((c) => byGroup[groupOf(c.x)].push(c.letter));
      rows.push({ day, weekday, byGroup });
    }
    groupsByPage.push(headings);
  }
  if (!rows.length) throw new Error('Could not find the day rows (a date number and a weekday on each line).');

  const groups = groupsByPage[0].map((h) => ({ label: h.label, type: h.type, start: h.start || '', end: h.end || '', hoursText: h.hoursText || '' }));
  return { key, month, year, groups, rows };
}

// Match key names ("Grace", "Favour N.") to staff in the directory.
export function matchStaff(key, staff, department) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
  return key.map((k) => {
    const [first, initial] = k.name.split(/\s+/);
    let found = staff.filter((p) => norm(p.firstName.split(/\s+/)[0]) === norm(first) || norm(p.firstName) === norm(first));
    if (initial) found = found.filter((p) => norm(p.lastName).startsWith(norm(initial)));
    if (found.length > 1 && department) {
      const inDept = found.filter((p) => p.department === department);
      if (inDept.length) found = inDept;
    }
    return { ...k, user: found.length === 1 ? found[0]._id : '', candidates: found.length };
  });
}

// Read a roster from either a PDF (above) or a Word .docx with the same layout, picking by file type.
// The .docx reader is loaded on demand so PDF-only imports don't carry it.
export async function readRoster(file) {
  const name = (file?.name || '').toLowerCase();
  const isDocx = name.endsWith('.docx') || file?.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (isDocx) { const { readRosterDocx } = await import('./rosterDocx'); return readRosterDocx(file); }
  return readRosterPdf(file);
}
