// Shared wording for shift swap requests.
export const SWAP_STATUS = {
  pending_colleague: ['Waiting for colleague', 'amber'], pending_hr: ['Waiting for HR', 'blue'], approved: ['Approved', 'green'],
  declined: ['Colleague declined', 'slate'], rejected: ['HR declined', 'red'], cancelled: ['Cancelled', 'slate'], expired: ['Expired', 'slate'],
};
export const shiftText = (i) => (i?.date ? `${new Date(`${i.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${i.shiftType.replace('_', ' ')} ${i.startTime}–${i.endTime}` : '');
