import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { entityConfigs } from "../entities/config";
import type { FilterField } from "../entities/types";
import { printable } from "../entities/types";
import { useUrlFilters } from "../features/filtering/useUrlFilters";
import { api, buildQuery } from "../shared/api/client";
import { filterParamKeys } from "../shared/lib/filterFields";
import { FilterPanel } from "../shared/ui/FilterPanel";

type StatisticsEntity = "users" | "universities" | "uploads" | "students" | "events" | "sessions" | "runs" | "audit";

type StatisticsField = {
  key: string;
  label: string;
};

type StatisticsResponse = {
  entity: StatisticsEntity;
  x: string;
  y: string;
  rows: Array<{ x: unknown; y: unknown; count: number }>;
  total: number;
};

const colors = ["#4b63f4", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#64748b"];

const statisticsConfig: Record<
  StatisticsEntity,
  {
    title: string;
    description: string;
    filters: FilterField[];
    fields: StatisticsField[];
    defaultX: string;
    defaultY: string;
  }
> = {
  users: {
    title: "Пользователи",
    description: "Анализ пользователей по роли, email, ФИО и дате создания.",
    filters: entityConfigs.users.filters,
    defaultX: "role",
    defaultY: "createdAt",
    fields: [
      { key: "fullName", label: "ФИО" },
      { key: "email", label: "Email" },
      { key: "role", label: "Роль" },
      { key: "createdAt", label: "Дата/время создания" },
    ],
  },
  universities: {
    title: "Вузы",
    description: "Анализ справочника вузов по названию, краткому имени и внешнему коду.",
    filters: entityConfigs.universities.filters,
    defaultX: "shortName",
    defaultY: "externalCode",
    fields: [
      { key: "name", label: "Название" },
      { key: "shortName", label: "Кратко" },
      { key: "externalCode", label: "Код" },
    ],
  },
  uploads: {
    title: "История загрузок",
    description: "Анализ загрузок по статусам, объёму файлов, строкам и сопоставленным студентам.",
    filters: entityConfigs.uploads.filters,
    defaultX: "status",
    defaultY: "createdAt",
    fields: [
      { key: "status", label: "Статус" },
      { key: "filesCount", label: "Файлов" },
      { key: "totalRows", label: "Строк" },
      { key: "matchedStudents", label: "Студентов" },
      { key: "createdAt", label: "Создана" },
    ],
  },
  sessions: {
    title: "Сессии",
    description: "Анализ экзаменационных сессий с фильтрами по студенту, риску, длительности и датам.",
    filters: entityConfigs.sessions.filters,
    defaultX: "student.group",
    defaultY: "metrics.combined.riskLevel",
    fields: [
      { key: "examName", label: "Экзамен" },
      { key: "durationMinutes", label: "Длительность" },
      { key: "metrics.combined.riskLevel", label: "Уровень риска" },
      { key: "metrics.combined.anomalyScore", label: "Балл аномальности" },
      { key: "student.group", label: "Группа студента" },
      { key: "student.program", label: "Программа студента" },
      { key: "student.educationLevel", label: "Уровень обучения" },
    ],
  },
  students: {
    title: "Студенты",
    description: "Анализ контингента студентов по программе, группе, уровню обучения и факультету.",
    filters: entityConfigs.students.filters,
    defaultX: "group",
    defaultY: "educationLevel",
    fields: [
      { key: "faculty", label: "Факультет" },
      { key: "program", label: "Программа" },
      { key: "educationLevel", label: "Уровень обучения" },
      { key: "group", label: "Группа" },
    ],
  },
  events: {
    title: "Таймлайн событий",
    description: "Анализ событий по типу, файлу, Moodle-атрибутам и связанным данным студента.",
    filters: entityConfigs.events.filters,
    defaultX: "eventType",
    defaultY: "student.group",
    fields: [
      { key: "eventType", label: "Тип" },
      { key: "sourceFileKey", label: "Файл" },
      { key: "moodle.action", label: "Действие Moodle" },
      { key: "moodle.courseName", label: "Имя курса" },
      { key: "moodle.target", label: "Цель Moodle" },
      { key: "moodle.timeSpent", label: "Время на вопрос" },
      { key: "student.group", label: "Группа студента" },
      { key: "student.program", label: "Программа студента" },
      { key: "student.educationLevel", label: "Уровень обучения" },
    ],
  },
  runs: {
    title: "История запусков кластеризации",
    description: "Анализ запусков кластеризации по алгоритму, статусу и итоговым метрикам.",
    filters: entityConfigs.runs.filters,
    defaultX: "algorithm",
    defaultY: "status",
    fields: [
      { key: "algorithm", label: "Алгоритм" },
      { key: "status", label: "Статус" },
      { key: "results.totalSessions", label: "Сессий" },
      { key: "results.clusterCount", label: "Кластеров" },
      { key: "results.anomalyCount", label: "Аномалий" },
      { key: "results.anomalyRate", label: "Доля аномалий" },
    ],
  },
  audit: {
    title: "Аудит действий",
    description: "Анализ аудита по субъектам, действиям, сущностям, IP и User-Agent.",
    filters: entityConfigs.audit.filters,
    defaultX: "actorType",
    defaultY: "entityType",
    fields: [
      { key: "actorType", label: "Субъект" },
      { key: "action", label: "Действие" },
      { key: "entityType", label: "Сущность" },
      { key: "ip", label: "IP" },
      { key: "userAgent", label: "User-Agent" },
      { key: "occurredAt", label: "Время" },
    ],
  },
};

const statisticsEntities = Object.keys(statisticsConfig) as StatisticsEntity[];

function statisticsEntity(value: string | null): StatisticsEntity {
  return value && value in statisticsConfig ? (value as StatisticsEntity) : "sessions";
}

function fieldLabel(fields: StatisticsField[], key: string) {
  return fields.find((field) => field.key === key)?.label ?? key;
}

function safeField(fields: StatisticsField[], value: string | null, fallback: string) {
  return value && fields.some((field) => field.key === value) ? value : fallback;
}

export function StatisticsPage() {
  const [params, setParams] = useSearchParams();
  const entity = statisticsEntity(params.get("entity"));
  const config = statisticsConfig[entity];
  const x = safeField(config.fields, params.get("x"), config.defaultX);
  const y = safeField(config.fields, params.get("y"), config.defaultY);
  const filters = useUrlFilters(config.filters);
  const [data, setData] = useState<StatisticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const query = useMemo(() => {
    const next = new URLSearchParams(params);
    next.set("entity", entity);
    next.set("x", x);
    next.set("y", y);
    return buildQuery(next);
  }, [entity, params, x, y]);

  useEffect(() => {
    setLoading(true);
    setError("");
    void api<StatisticsResponse>(`/statistics${query}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Ошибка загрузки статистики"))
      .finally(() => setLoading(false));
  }, [query]);

  const chart = useMemo(() => {
    const rows = data?.rows ?? [];
    const yLabels = [...new Set(rows.map((row) => printable(row.y) || "Не задано"))];
    const keyByLabel = new Map(yLabels.map((label, index) => [label, `series_${index}`]));
    const grouped = new Map<string, Record<string, string | number>>();

    for (const row of rows) {
      const xLabel = printable(row.x) || "Не задано";
      const yLabel = printable(row.y) || "Не задано";
      const key = keyByLabel.get(yLabel);
      if (!key) continue;

      const current = grouped.get(xLabel) ?? { x: xLabel };
      current[key] = Number(current[key] ?? 0) + row.count;
      grouped.set(xLabel, current);
    }

    return {
      yLabels,
      keyByLabel,
      rows: [...grouped.values()],
    };
  }, [data]);

  function updateParam(key: "x" | "y", value: string) {
    const next = new URLSearchParams(params);
    next.set("entity", entity);
    next.set(key, value);
    setParams(next);
  }

  function updateEntity(value: StatisticsEntity) {
    const next = new URLSearchParams(params);
    for (const key of statisticsEntities.flatMap((item) => statisticsConfig[item].filters).flatMap(filterParamKeys)) {
      next.delete(key);
    }
    next.set("entity", value);
    next.set("x", statisticsConfig[value].defaultX);
    next.set("y", statisticsConfig[value].defaultY);
    setParams(next);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px]" style={{ fontWeight: 600 }}>Кастомная статистика</h1>
        <p className="text-muted-foreground text-[14px] mt-1">Выберите подмножество данных, атрибуты по осям и получите количественную диаграмму.</p>
      </div>

      <section className="bg-card rounded-xl border border-border p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="space-y-1.5">
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 600 }}>Набор данных</span>
            <select className="w-full h-[40px]" value={entity} onChange={(event) => updateEntity(event.target.value as StatisticsEntity)}>
              {statisticsEntities.map((item) => (
                <option key={item} value={item}>{statisticsConfig[item].title}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 600 }}>Ось X</span>
            <select className="w-full h-[40px]" value={x} onChange={(event) => updateParam("x", event.target.value)}>
              {config.fields.map((field) => (
                <option key={field.key} value={field.key}>{field.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 600 }}>Ось Y</span>
            <select className="w-full h-[40px]" value={y} onChange={(event) => updateParam("y", event.target.value)}>
              {config.fields.map((field) => (
                <option key={field.key} value={field.key}>{field.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="text-[13px] text-muted-foreground">{config.description}</div>
      </section>

      <FilterPanel fields={config.filters} draft={filters.draft} setDraft={filters.setDraft} onSubmit={filters.submit} onReset={filters.reset} />

      <section className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-[18px]" style={{ fontWeight: 600 }}>Диаграмма распределения</h2>
            <p className="text-muted-foreground text-[13px] mt-1">
              X: {fieldLabel(config.fields, x)} · Y: {fieldLabel(config.fields, y)}
            </p>
          </div>
          <div className="text-[13px] text-muted-foreground">
            В выборке: <span className="text-foreground" style={{ fontWeight: 500 }}>{data?.total ?? 0}</span>
          </div>
        </div>

        {loading && <div className="notice">Загрузка статистики...</div>}
        {error && <div className="error">{error}</div>}
        {!loading && !error && chart.rows.length === 0 && <div className="notice">По заданным условиям данных не найдено.</div>}
        {!loading && !error && chart.rows.length > 0 && (
          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart.rows} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="x" angle={-30} textAnchor="end" interval={0} height={80} tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip />
                <Legend formatter={(value) => chart.yLabels[Number(String(value).replace("series_", ""))] ?? value} />
                {chart.yLabels.map((label, index) => {
                  const key = chart.keyByLabel.get(label);
                  return key ? <Bar key={key} dataKey={key} stackId="count" name={label} fill={colors[index % colors.length]} /> : null;
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
