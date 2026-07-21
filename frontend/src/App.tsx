import { Routes, Route, Navigate } from 'react-router-dom';
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

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
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
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
      </Route>
      {/* Public form route — no auth */}
      <Route path="/forms/:token" element={<PublicForm />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
