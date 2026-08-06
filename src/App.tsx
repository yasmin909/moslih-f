import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider, useStore } from './lib/store';
import { Layout } from './components/Layout';
import type { JSX } from 'react';

// Lazy-load all pages — each page becomes its own chunk
const Login             = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const StudentDashboard  = lazy(() => import('./pages/StudentDashboard').then(m => ({ default: m.StudentDashboard })));
const DaysGrid          = lazy(() => import('./pages/DaysGrid').then(m => ({ default: m.DaysGrid })));
const SupervisorDashboard = lazy(() => import('./pages/SupervisorDashboard').then(m => ({ default: m.SupervisorDashboard })));
const StudentDetail     = lazy(() => import('./pages/StudentDetail').then(m => ({ default: m.StudentDetail })));
const PlanBuilder       = lazy(() => import('./pages/PlanBuilder').then(m => ({ default: m.PlanBuilder })));
const Reports           = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const StudentsList      = lazy(() => import('./pages/StudentsList').then(m => ({ default: m.StudentsList })));
const AdminPanel        = lazy(() => import('./pages/AdminPanel').then(m => ({ default: m.AdminPanel })));
const SettingsPage      = lazy(() => import('./pages/Settings').then(m => ({ default: m.SettingsPage })));
const Analytics         = lazy(() => import('./pages/Analytics').then(m => ({ default: m.Analytics })));

// Minimal inline fallback — no extra components needed
function PageFallback() {
  return (
    <div style={{
      minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{
        width: 28, height: 28, border: '3px solid var(--border)',
        borderTopColor: 'var(--accent)', borderRadius: '50%',
        display: 'inline-block', animation: 'spin 0.7s linear infinite',
      }} />
    </div>
  );
}

function ProtectedRoute({ children, allowRoles }: { children: JSX.Element; allowRoles: string[] }) {
  const { currentUser } = useStore();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!allowRoles.includes(currentUser.role)) {
    if (currentUser.role === 'student') return <Navigate to="/student" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { currentUser } = useStore();

  if (!currentUser) {
    return (
      <Routes>
        <Route path="/login" element={<Suspense fallback={<PageFallback />}><Login /></Suspense>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<Navigate to={currentUser.role === 'student' ? '/student' : '/dashboard'} replace />} />
        <Route path="/student" element={<ProtectedRoute allowRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
        <Route path="/student/days" element={<ProtectedRoute allowRoles={['student']}><DaysGrid /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute allowRoles={['admin', 'supervisor']}><SupervisorDashboard /></ProtectedRoute>} />
        <Route path="/students" element={<ProtectedRoute allowRoles={['admin', 'supervisor']}><StudentsList /></ProtectedRoute>} />
        <Route path="/students/:id" element={<ProtectedRoute allowRoles={['admin', 'supervisor']}><StudentDetail /></ProtectedRoute>} />
        <Route path="/plan" element={<ProtectedRoute allowRoles={['admin', 'supervisor']}><PlanBuilder /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute allowRoles={['admin', 'supervisor']}><Reports /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute allowRoles={['admin']}><AdminPanel /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute allowRoles={['admin', 'supervisor']}><SettingsPage /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute allowRoles={['admin', 'supervisor']}><Analytics /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={currentUser.role === 'student' ? '/student' : '/dashboard'} replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </StoreProvider>
  );
}
