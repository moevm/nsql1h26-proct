import { ReactNode } from "react";
import { Link, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import type { User } from "../../entities/types";

type Role = User["role"];

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen">Проверка авторизации...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RoleGuard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen">Проверка прав доступа...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <AccessDenied roles={roles} currentRole={user.role} />;
  return <>{children}</>;
}

const roleLabels: Record<Role, string> = {
  admin: "Администратор",
  teacher: "Преподаватель",
};

function AccessDenied({ roles, currentRole }: { roles: Role[]; currentRole: Role }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="bg-card border border-border rounded-xl p-8 max-w-xl text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-warning/10 text-warning flex items-center justify-center text-[22px]" style={{ fontWeight: 600 }}>
          !
        </div>
        <div>
          <h1 className="text-[22px]" style={{ fontWeight: 600 }}>Недостаточно прав</h1>
          <p className="text-[14px] text-muted-foreground mt-2">
            Этот раздел доступен только для роли: {roles.map((role) => roleLabels[role]).join(", ")}.
            Ваша текущая роль: {roleLabels[currentRole]}.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link to="/results" className="px-4 py-2 rounded-lg bg-primary text-white text-[13px]">
            На дашборд
          </Link>
          <Link to="/upload" className="px-4 py-2 rounded-lg border border-border text-[13px] hover:bg-muted">
            К загрузкам
          </Link>
        </div>
      </div>
    </div>
  );
}

export function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen">Загрузка...</div>;
  return <Navigate to={user ? "/results" : "/login"} replace />;
}
