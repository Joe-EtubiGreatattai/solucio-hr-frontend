// Labels shared by the HR and staff views of employee relations cases.
export const CASE_TYPE_LABEL = { grievance: 'Grievance', disciplinary: 'Disciplinary', investigation: 'Investigation' };
export const CASE_STATUS = {
  open: ['Open', 'blue'], investigating: ['Investigating', 'purple'], hearing: ['Hearing', 'amber'],
  awaiting_outcome: ['Awaiting decision', 'amber'], appeal: ['Appeal', 'red'], closed: ['Closed', 'slate'],
};
export const OUTCOME_LABEL = {
  no_case: 'No case to answer', resolved_informally: 'Resolved informally', upheld: 'Upheld', partially_upheld: 'Partially upheld', not_upheld: 'Not upheld',
  verbal_warning: 'Verbal warning', written_warning: 'Written warning', final_warning: 'Final written warning', suspension: 'Suspension',
  demotion: 'Demotion', dismissal: 'Dismissal', withdrawn: 'Withdrawn',
};
export const GRIEVANCE_OUTCOMES = ['upheld', 'partially_upheld', 'not_upheld', 'resolved_informally', 'withdrawn'];
export const DISCIPLINARY_OUTCOMES = ['no_case', 'resolved_informally', 'verbal_warning', 'written_warning', 'final_warning', 'suspension', 'demotion', 'dismissal'];
export const CASE_CATEGORIES = ['harassment', 'bullying', 'discrimination', 'pay', 'workload', 'working_conditions', 'safety', 'patient_care',
  'attendance', 'conduct', 'performance', 'fraud', 'policy_breach', 'other'];
export const SEVERITY_COLOR = { low: 'slate', medium: 'blue', high: 'amber', critical: 'red' };
export const EVENT_LABEL = { created: 'Opened', note: 'Note', status: 'Status', meeting: 'Meeting', statement: 'Statement', outcome: 'Decision', appeal: 'Appeal', assigned: 'Assigned' };
