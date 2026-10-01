import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Compass, BookOpen, LayoutDashboard, Route as RouteIcon, Trophy, Award, CalendarDays, GraduationCap, Users, UsersRound, ClipboardList, FolderOpen, ClipboardCheck, BarChart3, Megaphone, Settings } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Starfield } from '@/components/space/Starfield';
import { Shell, useGradingCount, type NavItem } from '@/components/layout/Shell';
import { CommandPaletteProvider } from '@/components/layout/CommandPalette';
import { Mascot } from '@/components/space/Mascot';
import { AuthPage } from '@/pages/Auth';
import Dashboard from '@/pages/Dashboard';
import Catalog from '@/pages/Catalog';
import CourseDetail from '@/pages/CourseDetail';
import MyLearning from '@/pages/MyLearning';
import { PathsPage, PathDetail } from '@/pages/Paths';
import CalendarPage from '@/pages/Calendar';
import Achievements from '@/pages/Achievements';
import { CertificatesPage, CertificateView, VerifyPage } from '@/pages/Certificates';
import Profile from '@/pages/Profile';
import Player from '@/pages/Player';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminCourses from '@/pages/admin/AdminCourses';
import CourseBuilder from '@/pages/admin/CourseBuilder';
import AdminUsers from '@/pages/admin/AdminUsers';
import { AdminGroups, AdminEnrollments } from '@/pages/admin/AdminPeople';
import { AdminLibrary, AdminGrading, AdminReports, AdminAnnouncements, AdminPaths, AdminSettings } from '@/pages/admin/AdminMisc';
import NotFound from '@/pages/NotFound';

const learnerNav: NavItem[] = [
  { to: '/', label: 'Launchpad', icon: LayoutDashboard, end: true },
  { to: '/catalog', label: 'Explore', icon: Compass },
  { to: '/learning', label: 'My missions', icon: BookOpen },
  { to: '/paths', label: 'Constellations', icon: RouteIcon },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/achievements', label: 'Achievements', icon: Trophy },
  { to: '/certificates', label: 'Certificates', icon: Award },
];

function AdminShell() {
  const { user } = useAuth();
  const pending = useGradingCount();
  const admin = user?.role === 'admin';
  const items: NavItem[] = [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/courses', label: 'Courses', icon: GraduationCap },
    ...(admin ? [{ to: '/admin/paths', label: 'Learning paths', icon: RouteIcon }] : []),
    ...(admin ? [{ to: '/admin/users', label: 'Users', icon: Users }, { to: '/admin/groups', label: 'Groups', icon: UsersRound }] : []),
    { to: '/admin/enrollments', label: 'Enrollments', icon: ClipboardList },
    { to: '/admin/library', label: 'Content library', icon: FolderOpen },
    { to: '/admin/grading', label: 'Grading', icon: ClipboardCheck, badge: pending },
    { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
    ...(admin ? [{ to: '/admin/announcements', label: 'Announcements', icon: Megaphone }, { to: '/admin/settings', label: 'Settings', icon: Settings }] : []),
  ];
  return <Shell items={items} mode="admin" />;
}

function RequireStaff({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user && user.role === 'learner') return <Navigate to="/" replace />;
  return <>{children}</>;
}
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user && user.role !== 'admin') return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

function Splash() {
  return <div className="grid min-h-screen place-items-center"><Mascot mood="wave" size={120} /></div>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname + loc.search }} replace />;
  return <>{children}</>;
}

export default function App() {
  const { loading } = useAuth();
  return (
    <>
      <Starfield />
      <CommandPaletteProvider>
        <Suspense fallback={<Splash />}>
          {loading ? <Splash /> : (
            <Routes>
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/register" element={<AuthPage mode="register" />} />
              <Route element={<RequireAuth><Shell items={learnerNav} mode="learner" /></RequireAuth>}>
                <Route index element={<Dashboard />} />
                <Route path="catalog" element={<Catalog />} />
                <Route path="courses/:id" element={<CourseDetail />} />
                <Route path="learning" element={<MyLearning />} />
                <Route path="paths" element={<PathsPage />} />
                <Route path="paths/:id" element={<PathDetail />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="achievements" element={<Achievements />} />
                <Route path="certificates" element={<CertificatesPage />} />
                <Route path="certificates/:id" element={<CertificateView />} />
                <Route path="profile" element={<Profile />} />
              </Route>
              <Route path="/courses/:id/learn/:lessonId?" element={<RequireAuth><Player /></RequireAuth>} />
              <Route path="/verify/:code" element={<VerifyPage />} />
              <Route path="/admin" element={<RequireAuth><RequireStaff><AdminShell /></RequireStaff></RequireAuth>}>
                <Route index element={<AdminDashboard />} />
                <Route path="courses" element={<AdminCourses />} />
                <Route path="courses/:id" element={<CourseBuilder />} />
                <Route path="paths" element={<RequireAdmin><AdminPaths /></RequireAdmin>} />
                <Route path="users" element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
                <Route path="groups" element={<RequireAdmin><AdminGroups /></RequireAdmin>} />
                <Route path="enrollments" element={<AdminEnrollments />} />
                <Route path="library" element={<AdminLibrary />} />
                <Route path="grading" element={<AdminGrading />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="announcements" element={<RequireAdmin><AdminAnnouncements /></RequireAdmin>} />
                <Route path="settings" element={<RequireAdmin><AdminSettings /></RequireAdmin>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          )}
        </Suspense>
      </CommandPaletteProvider>
    </>
  );
}
void lazy;
