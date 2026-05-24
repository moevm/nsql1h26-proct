import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen">Проверка авторизации...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen">Загрузка...</div>;
  return <Navigate to={user ? "/results" : "/login"} replace />;
}
