import { BarChart3, Cpu, FileStack, FileText, HardDrive, History, Layers, LayoutDashboard, Settings, Upload } from "lucide-react";

export const navItems = [
  { label: "Дашборд", icon: LayoutDashboard, path: "/results" },
  { label: "Загрузка данных", icon: Upload, path: "/upload" },
  { label: "История загрузок", icon: FileStack, path: "/upload-history" },
  { label: "Обработка", icon: Cpu, path: "/processing" },
  { label: "Кластеризация", icon: Layers, path: "/clustering" },
  { label: "История запусков", icon: History, path: "/cluster-history" },
  { label: "Результаты", icon: BarChart3, path: "/results" },
  { label: "Отчёты", icon: FileText, path: "/reports" },
  { label: "Резервное копирование", icon: HardDrive, path: "/backup" },
  { label: "Настройки", icon: Settings, path: "/settings" },
];
