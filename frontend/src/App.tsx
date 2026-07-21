import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Tables from './pages/Tables';
import TableBuilder from './pages/TableBuilder';
import TableView from './pages/TableView';
import Users from './pages/Users';
import FormBuilder from './pages/FormBuilder';
import PublicForm from './pages/PublicForm';
import FormSubmissions from './pages/FormSubmissions';
import Backups from './pages/Backups';
import Landing from './pages/Landing';
import Documents from './pages/Documents';

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-space-950">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-400" />
    </div>
  );
}

function AppLayout() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <Spinner />;

  if (!user) {
    if (location.pathname !== '/') {
      return <Navigate to="/login" replace />;
    }
    return <Landing />;
  }

  return <Layout />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Spinner />;

  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
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
      </Route>
      <Route path="/forms/:token" element={<PublicForm />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
