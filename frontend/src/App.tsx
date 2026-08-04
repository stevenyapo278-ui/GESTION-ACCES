import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import { PageTransition, PageLoader } from './components/PageTransition';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Tables = lazy(() => import('./pages/Tables'));
const TableBuilder = lazy(() => import('./pages/TableBuilder'));
const TableView = lazy(() => import('./pages/TableView'));
const Users = lazy(() => import('./pages/Users'));
const FormBuilder = lazy(() => import('./pages/FormBuilder'));
const PublicForm = lazy(() => import('./pages/PublicForm'));
const FormSubmissions = lazy(() => import('./pages/FormSubmissions'));
const Backups = lazy(() => import('./pages/Backups'));
const Landing = lazy(() => import('./pages/Landing'));
const Documents = lazy(() => import('./pages/Documents'));
const Requests = lazy(() => import('./pages/Requests'));
const RequestTypesAdmin = lazy(() => import('./pages/RequestTypesAdmin'));
const ReviewRequest = lazy(() => import('./pages/ReviewRequest'));
const EmailAccounts = lazy(() => import('./pages/EmailAccounts'));

function AppLayout() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <PageLoader />;

  if (!user) {
    if (location.pathname !== '/') {
      return <Navigate to="/login" replace />;
    }
    return <Landing />;
  }

  // Non-ADMIN users are restricted to the requests page
  if (user.role !== 'ADMIN' && location.pathname === '/') {
    return <Navigate to="/requests" replace />;
  }

  return <Layout />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <PageLoader />;

  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <PageTransition>
                <Login />
              </PageTransition>
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <PageTransition>
                <Register />
              </PageTransition>
            </PublicRoute>
          }
        />
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="tables" element={<Tables />} />
          <Route path="tables/new" element={<TableBuilder />} />
          <Route path="tables/:id" element={<TableView />} />
          <Route path="tables/:id/settings" element={<TableBuilder />} />
          <Route path="users" element={<Users />} />
          <Route path="backups" element={<Backups />} />
          <Route path="tables/:tableId/forms/new" element={<FormBuilder />} />
          <Route path="tables/:tableId/forms/:formId" element={<FormBuilder />} />
          <Route path="tables/:tableId/forms/:formId/submissions" element={<FormSubmissions />} />
          <Route path="documents" element={<Documents />} />
          <Route path="requests" element={<Requests />} />
          <Route path="requests/types" element={<RequestTypesAdmin />} />
          <Route path="email-accounts" element={<EmailAccounts />} />
        </Route>
        <Route
          path="/forms/:token"
          element={
            <PageTransition>
              <PublicForm />
            </PageTransition>
          }
        />
        <Route
          path="/requests/review/:token"
          element={
            <PageTransition>
              <ReviewRequest />
            </PageTransition>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
