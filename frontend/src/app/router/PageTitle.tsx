import { useEffect } from "react";
import { matchPath, useLocation } from "react-router-dom";

const appTitle = "Прокторинг";

const pageTitles: { pattern: string; title: string }[] = [
  { pattern: "/login", title: "Авторизация" },
  { pattern: "/uploads/:uploadId/log", title: "Журнал обработки загрузки" },
  { pattern: "/upload-history/:id", title: "Журнал обработки загрузки" },
  { pattern: "/processing/log/:uploadId/:entryIndex", title: "Запись журнала обработки" },
  { pattern: "/students/:id", title: "Карточка студента" },
  { pattern: "/sessions/:id", title: "Карточка сессии" },
  { pattern: "/events/:id", title: "Карточка события" },
  { pattern: "/uploads/:id", title: "Карточка загрузки" },
  { pattern: "/clustering-runs/:id", title: "Карточка запуска кластеризации" },
  { pattern: "/results/:runId", title: "Результаты кластеризации" },
  { pattern: "/users/:id", title: "Карточка пользователя" },
  { pattern: "/universities/:id", title: "Карточка вуза" },
  { pattern: "/audit/:id", title: "Запись аудита" },
  { pattern: "/upload", title: "Загрузка данных" },
  { pattern: "/uploads", title: "Загрузка данных" },
  { pattern: "/upload-history", title: "История загрузок" },
  { pattern: "/students", title: "Студенты" },
  { pattern: "/sessions", title: "Сессии" },
  { pattern: "/events", title: "События" },
  { pattern: "/processing", title: "Обработка данных" },
  { pattern: "/clustering", title: "Кластеризация" },
  { pattern: "/clustering-runs", title: "Запуски кластеризации" },
  { pattern: "/cluster-history", title: "История запусков" },
  { pattern: "/results", title: "Результаты кластеризации" },
  { pattern: "/statistics", title: "Статистика" },
  { pattern: "/reports", title: "Отчёты" },
  { pattern: "/backup", title: "Резервное копирование" },
  { pattern: "/users", title: "Пользователи" },
  { pattern: "/universities", title: "Вузы" },
  { pattern: "/audit", title: "Аудит" },
];

function resolvePageTitle(pathname: string) {
  return pageTitles.find(({ pattern }) => matchPath({ path: pattern, end: true }, pathname))?.title ?? appTitle;
}

export function PageTitle() {
  const location = useLocation();

  useEffect(() => {
    const title = resolvePageTitle(location.pathname);
    document.title = title === appTitle ? appTitle : `${title} | ${appTitle}`;
  }, [location.pathname]);

  return null;
}
