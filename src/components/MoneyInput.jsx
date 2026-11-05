import { useLayoutEffect, useRef, useState } from 'react';

// Digits (and a decimal point, or a leading minus when allowed) from whatever was typed or pasted.
function clean(text, allowNegative) {
  const neg = allowNegative && /^\s*-/.test(text);
  let [int = '', ...rest] = text.replace(/[^\d.]/g, '').split('.');
  int = int.replace(/^0+(?=\d)/, '');
  const dec = rest.length ? `.${rest.join('').slice(0, 2)}` : '';
  return `${neg ? '-' : ''}${int}${dec}`;
}
// 1234567.5 -> "1,234,567.5" (keeps a trailing "." or "-" while the person is still typing)
function withCommas(raw) {
  const neg = raw.startsWith('-');
  const [int, dec] = raw.replace('-', '').split('.');
  const grouped = int ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : (dec !== undefined ? '0' : '');
  return `${neg ? '-' : ''}${grouped}${dec !== undefined ? `.${dec}` : ''}`;
}
const toRaw = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? '' : String(v));

// Text box for amounts of money that shows thousands separators as you type (1,250,000).
// Drop-in for <input type="number">: onChange receives { target: { value, type: 'number', name } },
// where value is the plain number as a string ("1250000"), so existing handlers keep working.
export default function MoneyInput({ value, onChange, allowNegative = false, className = 'input', min: _min, max: _max, step: _step, ...rest }) {
  // min/max/step only make sense on number inputs, so they're accepted and dropped.
  const ref = useRef(null);
  const caret = useRef(null);
  const [text, setText] = useState(() => withCommas(toRaw(value)));
  const [emitted, setEmitted] = useState(toRaw(value));
  const [prev, setPrev] = useState(value);
  // Follow changes made from outside (form reset, template picked), but not the echo of what was just typed.
  const same = (a, b) => (a === '' || b === '' ? a === b : Number(a) === Number(b));
  if (value !== prev) {
    setPrev(value);
    if (!same(toRaw(value), emitted)) { setEmitted(toRaw(value)); setText(withCommas(toRaw(value))); }
  }

  // Put the caret back after the same number of digits it was after before commas moved around.
  useLayoutEffect(() => {
    if (caret.current == null || !ref.current) return;
    let digits = caret.current, pos = 0;
    while (pos < text.length && digits > 0) { if (/[\d.-]/.test(text[pos])) digits--; pos++; }
    ref.current.setSelectionRange(pos, pos);
    caret.current = null;
  }, [text]);

  const handle = (e) => {
    const typed = e.target.value;
    caret.current = typed.slice(0, e.target.selectionStart).replace(/[^\d.-]/g, '').length;
    const next = clean(typed, allowNegative);
    setText(withCommas(next));
    const numeric = next === '-' || next === '' ? '' : next.endsWith('.') ? next.slice(0, -1) : next;
    setEmitted(numeric);
    onChange?.({ target: { value: numeric, type: 'number', name: rest.name } });
  };

  return <input ref={ref} type="text" inputMode={allowNegative ? 'text' : 'decimal'} autoComplete="off" className={className} value={text} onChange={handle} {...rest} />;
}
