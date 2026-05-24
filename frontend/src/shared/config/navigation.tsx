import { BarChart3, Building2, Cpu, FileStack, FileText, GraduationCap, HardDrive, History, Layers, LayoutDashboard, ListTree, Settings, Upload, Users } from "lucide-react";

type Role = "admin" | "teacher";

export type NavItem = {
  label: string;
  icon: typeof LayoutDashboard;
  path: string;
  roles?: Role[];
};

export const navItems: NavItem[] = [
  { label: "Дашборд", icon: LayoutDashboard, path: "/results" },
  { label: "Загрузка данных", icon: Upload, path: "/upload" },
  { label: "История загрузок", icon: FileStack, path: "/upload-history" },
  { label: "Студенты", icon: Users, path: "/students" },
  { label: "Сессии", icon: GraduationCap, path: "/sessions" },
  { label: "События", icon: ListTree, path: "/events" },
  { label: "Обработка", icon: Cpu, path: "/processing" },
  { label: "Кластеризация", icon: Layers, path: "/clustering" },
  { label: "История запусков", icon: History, path: "/cluster-history" },
  { label: "Результаты", icon: BarChart3, path: "/results" },
  { label: "Отчёты", icon: FileText, path: "/reports" },
  { label: "Резервное копирование", icon: HardDrive, path: "/backup" },
  { label: "Пользователи", icon: Users, path: "/users", roles: ["admin"] },
  { label: "Вузы", icon: Building2, path: "/universities", roles: ["admin"] },
  { label: "Аудит", icon: ListTree, path: "/audit", roles: ["admin"] },
  { label: "Настройки", icon: Settings, path: "/settings" },
];
