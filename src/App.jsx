import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import StaffLayout from './components/StaffLayout';
import AdminLayout from './components/AdminLayout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import TrackReport from './pages/TrackReport';
import StaffDashboard from './pages/staff/Dashboard';
import Profile from './pages/staff/Profile';
import MyRoster from './pages/staff/MyRoster';
import MyAttendance from './pages/staff/MyAttendance';
import Certificates from './pages/staff/Certificates';
import Requests from './pages/staff/Requests';
import Notes from './pages/staff/Notes';
import Inbox from './pages/staff/Inbox';
import AnonymousReport from './pages/staff/AnonymousReport';
import AdminDashboard from './pages/admin/AdminDashboard';
import StaffList from './pages/admin/StaffList';
import StaffReport from './pages/admin/StaffReport';
import Rosters from './pages/admin/Rosters';
import RosterDetail from './pages/admin/RosterDetail';
import AdminAttendance from './pages/admin/AdminAttendance';
import AdminCertificates from './pages/admin/AdminCertificates';
import AdminRequests from './pages/admin/AdminRequests';
import Announcements from './pages/admin/Announcements';
import AdminNotes from './pages/admin/AdminNotes';
import AnonymousInbox from './pages/admin/AnonymousInbox';
import CheckInDesk from './pages/admin/CheckInDesk';
import CheckIn from './pages/staff/CheckIn';
import Policies from './pages/staff/Policies';
import PolicyView from './pages/staff/PolicyView';
import MyTeam from './pages/staff/MyTeam';
import Organisation from './pages/admin/Organisation';
import WorkforcePlan from './pages/admin/WorkforcePlan';
import AdminPolicies from './pages/admin/AdminPolicies';
import Compliance from './pages/admin/Compliance';
import AuditTrail from './pages/admin/AuditTrail';
import Recruitment from './pages/admin/Recruitment';
import RecruitmentPipeline from './pages/admin/RecruitmentPipeline';
import AdminOnboarding from './pages/admin/Onboarding';
import Jobs from './pages/staff/Jobs';
import Interviews from './pages/staff/Interviews';
import MyOnboarding from './pages/staff/MyOnboarding';
import CareersLayout from './pages/careers/CareersLayout';
import Careers from './pages/careers/Careers';
import CareerJob from './pages/careers/CareerJob';
import CareerStatus from './pages/careers/CareerStatus';
import AdminTraining from './pages/admin/Training';
import AdminPerformance from './pages/admin/Performance';
import ReviewView from './pages/performance/ReviewView';
import Learning from './pages/staff/Learning';
import MyPerformance from './pages/staff/Performance';
import Pay from './pages/staff/Pay';
import Payroll from './pages/admin/Payroll';
import PayrollRun from './pages/admin/PayrollRun';
import Relations from './pages/admin/Relations';
import CaseDetail from './pages/admin/CaseDetail';
import Engagement from './pages/admin/Engagement';
import SurveyResults from './pages/admin/SurveyResults';
import Analytics from './pages/admin/Analytics';
import MyCases from './pages/staff/MyCases';
import Surveys from './pages/staff/Surveys';
import Leaving from './pages/staff/Leaving';
import ResetPassword from './pages/ResetPassword';
import SetNewPassword from './components/SetNewPassword';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner className="h-screen items-center" />;
  // Remember where they were going (e.g. a scanned kiosk link) so login can send them back.
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return user.mustChangePassword ? <SetNewPassword /> : children;
}

function RequireAdmin({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/track" element={<TrackReport />} />
      <Route path="/careers" element={<CareersLayout />}>
        <Route index element={<Careers />} />
        <Route path="status" element={<CareerStatus />} />
        <Route path=":id" element={<CareerJob />} />
      </Route>
      <Route element={<RequireAuth><StaffLayout /></RequireAuth>}>
        <Route index element={<StaffDashboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="my-roster" element={<MyRoster />} />
        <Route path="attendance" element={<MyAttendance />} />
        <Route path="check-in" element={<CheckIn />} />
        <Route path="certificates" element={<Certificates />} />
        <Route path="requests" element={<Requests />} />
        <Route path="notes" element={<Notes />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="anonymous" element={<AnonymousReport />} />
        <Route path="policies" element={<Policies />} />
        <Route path="policies/:id" element={<PolicyView />} />
        <Route path="my-team" element={<MyTeam />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="interviews" element={<Interviews />} />
        <Route path="onboarding" element={<MyOnboarding />} />
        <Route path="learning" element={<Learning />} />
        <Route path="performance" element={<MyPerformance />} />
        <Route path="performance/reviews/:id" element={<ReviewView />} />
        <Route path="pay" element={<Pay />} />
        <Route path="surveys" element={<Surveys />} />
        <Route path="surveys/:id" element={<Surveys />} />
        <Route path="relations" element={<MyCases />} />
        <Route path="relations/:id" element={<MyCases />} />
        <Route path="leaving" element={<Leaving />} />
      </Route>
      <Route element={<RequireAuth><RequireAdmin><AdminLayout /></RequireAdmin></RequireAuth>}>
        <Route path="admin" element={<AdminDashboard />} />
        <Route path="admin/staff" element={<StaffList />} />
        <Route path="admin/staff/:id" element={<StaffReport />} />
        <Route path="admin/rosters" element={<Rosters />} />
        <Route path="admin/rosters/:id" element={<RosterDetail />} />
        <Route path="admin/attendance" element={<AdminAttendance />} />
        <Route path="admin/certificates" element={<AdminCertificates />} />
        <Route path="admin/requests" element={<AdminRequests />} />
        <Route path="admin/announcements" element={<Announcements />} />
        <Route path="admin/notes" element={<AdminNotes />} />
        <Route path="admin/anonymous" element={<AnonymousInbox />} />
        <Route path="admin/check-in-desk" element={<CheckInDesk />} />
        <Route path="admin/organisation" element={<Organisation />} />
        <Route path="admin/workforce" element={<WorkforcePlan />} />
        <Route path="admin/policies" element={<AdminPolicies />} />
        <Route path="admin/compliance" element={<Compliance />} />
        <Route path="admin/audit" element={<AuditTrail />} />
        <Route path="admin/recruitment" element={<Recruitment />} />
        <Route path="admin/recruitment/:id" element={<RecruitmentPipeline />} />
        <Route path="admin/onboarding" element={<AdminOnboarding />} />
        <Route path="admin/training" element={<AdminTraining />} />
        <Route path="admin/performance" element={<AdminPerformance />} />
        <Route path="admin/performance/reviews/:id" element={<ReviewView />} />
        <Route path="admin/payroll" element={<Payroll />} />
        <Route path="admin/payroll/runs/:id" element={<PayrollRun />} />
        <Route path="admin/relations" element={<Relations />} />
        <Route path="admin/relations/:id" element={<CaseDetail />} />
        <Route path="admin/engagement" element={<Engagement />} />
        <Route path="admin/engagement/surveys/:id" element={<SurveyResults />} />
        <Route path="admin/analytics" element={<Analytics />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
