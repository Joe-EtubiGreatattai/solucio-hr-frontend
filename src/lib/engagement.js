// Labels shared by the survey builder, results and staff survey pages.
export const SURVEY_STATUS = { draft: ['Draft', 'slate'], open: ['Open', 'blue'], closed: ['Closed', 'green'] };
export const QUESTION_TYPE_LABEL = { scale: 'Agree / disagree (1–5)', enps: 'Likelihood to recommend (0–10)', yesno: 'Yes / no', choice: 'Multiple choice', text: 'Free text' };
export const THEMES = ['engagement', 'wellbeing', 'management', 'growth', 'workload', 'recognition', 'pay', 'culture', 'safety', 'other'];
export const enpsText = (n) => (n == null ? '—' : n > 0 ? `+${n}` : String(n));
