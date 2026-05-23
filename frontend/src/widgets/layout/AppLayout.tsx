import { Link, Outlet, useLocation } from "react-router-dom";
import { BarChart3, LogOut, Plus } from "lucide-react";
import { Avatar, Button } from "@gravity-ui/uikit";
import { navItems } from "../../shared/config/navigation";
import { useAuth } from "../../app/providers/AuthProvider";

export function AppLayout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const initials = user?.fullName
    ? user.fullName.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase()
    : "U";

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <aside className="w-[248px] min-w-[248px] bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[14px] text-white" style={{ fontWeight: 600 }}>АСЭ</div>
              <div className="text-[11px] text-sidebar-foreground/60">Аналитика сессий экзаменов</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path === "/results" && location.pathname === "/") ||
              (item.path === "/upload" && location.pathname === "/uploads") ||
              (item.path === "/cluster-history" && location.pathname === "/clustering-runs");
            return (
              <Link
                key={item.label}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-white"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-white"
                }`}
              >
                <item.icon className="w-[18px] h-[18px]" />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="flex items-center gap-2 px-3 py-2">
            <Avatar text={initials} size="s" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-white truncate">{user?.fullName ?? "Пользователь"}</div>
              <div className="text-[11px] text-sidebar-foreground/50 truncate">{user?.role ?? "роль"}</div>
            </div>
          </div>
          <button
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[13px] text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-white transition-colors"
            onClick={() => void logout()}
          >
            <LogOut className="w-4 h-4" />
            <span>Выйти</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 min-h-[64px] bg-card border-b border-border flex items-center px-6 gap-4">
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <Avatar text={initials} size="s" />
            <Link to="/upload">
              <Button view="action" size="s">
                <span className="flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Новая загрузка
                </span>
              </Button>
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 lg:p-8">
          <div className="max-w-[1360px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
