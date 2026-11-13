// Access levels, mirroring backend/src/utils/access.js (the server enforces them; this decides
// which menus and buttons to show).
export const ACCESS_OPTIONS = [
  { value: 'staff', label: 'Staff', hint: 'Their own staff portal' },
  { value: 'front_desk', label: 'Front desk', hint: 'Staff portal, plus the check-in screen: show the QR code, check people in by hand and review face checks' },
  { value: 'hr_officer', label: 'HR officer', hint: 'Day-to-day HR: staff, rosters, attendance, leave, recruitment, training. No pay, cases, anonymous reports or audit trail' },
  { value: 'hr_manager', label: 'HR manager', hint: 'All HR work, including pay, cases and the audit trail. Cannot manage admins or system settings' },
  { value: 'super_admin', label: 'Super admin', hint: 'Everything, including creating admins and changing system settings' },
];
export const ACCESS_LABEL = Object.fromEntries(ACCESS_OPTIONS.map((o) => [o.value, o.label]));
export const ADMIN_LEVELS = ['hr_officer', 'hr_manager', 'super_admin'];

const ALL_ADMINS = ['hr_officer', 'hr_manager', 'super_admin'];
const AREAS = {
  hr: ALL_ADMINS,
  checkin: ['front_desk', ...ALL_ADMINS],
  pay: ['hr_manager', 'super_admin'],
  cases: ['hr_manager', 'super_admin'],
  audit: ['hr_manager', 'super_admin'],
  settings: ['super_admin'],
  admins: ['super_admin'],
};

export function accessOf(user) {
  if (!user) return null;
  if (user.access) return user.access;
  if (user.role === 'admin') return ADMIN_LEVELS.includes(user.adminLevel) ? user.adminLevel : 'super_admin';
  return user.frontDesk ? 'front_desk' : 'staff';
}

export const canAccess = (user, area = 'hr') => !!AREAS[area]?.includes(accessOf(user));
