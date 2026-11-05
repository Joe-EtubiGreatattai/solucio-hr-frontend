import {
  Award, Banknote, BarChart3, Briefcase, HeartHandshake, Scale, Building2, ClipboardList, GraduationCap, Target, CalendarRange, ClipboardCheck, FileCheck2, History, Inbox, LayoutDashboard, Megaphone,
  MessageSquareWarning, NotebookPen, QrCode, ShieldCheck, TrendingUp, Users,
  BookOpen, CalendarCheck, DoorOpen, Home, Mail, MessagesSquare, Rocket, Search,
} from 'lucide-react';

// Admin sidebar, grouped by HR function. Each module adds its entries here.
// `badge` keys come from GET /reports/badges.
export const ADMIN_NAV = [
  { title: 'Overview', items: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/analytics', label: 'HR analytics', icon: BarChart3 },
  ] },
  { title: 'People & planning', items: [
    { to: '/admin/staff', label: 'Staff', icon: Users },
    { to: '/admin/organisation', label: 'Organisation', icon: Building2 },
    { to: '/admin/workforce', label: 'Workforce plan', icon: TrendingUp },
  ] },
  { title: 'Hiring', items: [
    { to: '/admin/recruitment', label: 'Recruitment', icon: Briefcase, badge: 'applicants' },
    { to: '/admin/onboarding', label: 'Onboarding', icon: ClipboardList },
  ] },
  { title: 'Development', items: [
    { to: '/admin/training', label: 'Training', icon: GraduationCap, badge: 'trainingRequests' },
    { to: '/admin/performance', label: 'Performance', icon: Target, badge: 'calibration' },
  ] },
  { title: 'Pay & benefits', items: [
    { to: '/admin/payroll', label: 'Payroll', icon: Banknote },
  ] },
  { title: 'Time & attendance', items: [
    { to: '/admin/rosters', label: 'Rosters', icon: CalendarRange },
    { to: '/admin/attendance', label: 'Attendance', icon: ClipboardCheck },
    { to: '/admin/check-in-desk', label: 'Check-in desk', icon: QrCode, badge: 'desk' },
    { to: '/admin/requests', label: 'Requests', icon: Inbox, badge: 'requests' },
  ] },
  { title: 'Engagement & relations', items: [
    { to: '/admin/engagement', label: 'Engagement', icon: HeartHandshake, badge: 'exits' },
    { to: '/admin/relations', label: 'Cases', icon: Scale, badge: 'relations' },
  ] },
  { title: 'Communication', items: [
    { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
    { to: '/admin/notes', label: 'Staff reports', icon: NotebookPen, badge: 'notes' },
    { to: '/admin/anonymous', label: 'Anonymous', icon: MessageSquareWarning, badge: 'anonymous' },
  ] },
  { title: 'Policies & compliance', items: [
    { to: '/admin/compliance', label: 'Compliance', icon: ShieldCheck },
    { to: '/admin/policies', label: 'Policies', icon: FileCheck2 },
    { to: '/admin/certificates', label: 'Certificates', icon: Award, badge: 'certificates' },
    { to: '/admin/audit', label: 'Audit trail', icon: History },
  ] },
];

// Staff portal: the main pills, then everything else under "More".
export const STAFF_NAV_MAIN = [
  { to: '/', label: 'Dashboard', icon: Home, end: true },
  { to: '/check-in', label: 'Check in', icon: QrCode },
  { to: '/my-roster', label: 'Roster', icon: CalendarRange },
  { to: '/requests', label: 'Requests', icon: Inbox },
  { to: '/learning', label: 'Learning', icon: GraduationCap },
  { to: '/performance', label: 'Performance', icon: Target },
];

export const STAFF_NAV_MORE = [
  { to: '/onboarding', label: 'My onboarding', icon: Rocket, onboardingOnly: true },
  { to: '/pay', label: 'My pay', icon: Banknote },
  { to: '/certificates', label: 'Certificates', icon: Award },
  { to: '/attendance', label: 'My attendance', icon: CalendarCheck },
  { to: '/jobs', label: 'Internal jobs', icon: Search },
  { to: '/interviews', label: 'My interviews', icon: Briefcase, interviewersOnly: true },
  { to: '/policies', label: 'Policies', icon: BookOpen },
  { to: '/notes', label: 'Notes & reports', icon: NotebookPen },
  { to: '/inbox', label: 'Inbox', icon: Mail },
  { to: '/my-team', label: 'My team', icon: Users, managersOnly: true },
  { to: '/surveys', label: 'Surveys', icon: MessagesSquare },
  { to: '/relations', label: 'My cases', icon: Scale },
  { to: '/anonymous', label: 'Speak up (anonymous)', icon: MessageSquareWarning },
  { to: '/leaving', label: 'Leaving', icon: DoorOpen },
];

// Phones: the bottom tab bar. Check in sits in the middle, where the thumb rests.
export const STAFF_TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/my-roster', label: 'Roster', icon: CalendarRange },
  { to: '/check-in', label: 'Check in', icon: QrCode, primary: true },
  { to: '/requests', label: 'Requests', icon: Inbox },
];
