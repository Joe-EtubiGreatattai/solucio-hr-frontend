// How a payroll's total cost splits up: take-home pay, deductions passed on, and the hospital's extras.
export const PARTS = [
  { key: 'net', label: 'Take-home pay to staff', color: 'bg-brand-600', hex: '#129d8f', hint: 'Paid into staff bank accounts' },
  { key: 'deductions', label: 'Taken from staff pay', color: 'bg-amber-400', hex: '#fbbf24', hint: 'Tax, staff pension, NHF and loan repayments, sent on to the tax office, pension companies and so on' },
  { key: 'extras', label: 'Hospital’s extras on top', color: 'bg-brand-900', hex: '#0b3b38', hint: 'Hospital pension (10%), NSITF, ITF and benefits like health insurance. Never comes out of staff pay' },
];

export const splitCost = (t) => ({ net: t.net || 0, deductions: Math.max(0, (t.gross || 0) - (t.net || 0)), extras: Math.max(0, (t.employerCost || 0) - (t.gross || 0)) });
