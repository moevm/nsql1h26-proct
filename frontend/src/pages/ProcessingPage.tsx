import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  AlertTriangle,
  Filter,
  Search,
  X,
} from "lucide-react";
import { Label, Select, TextInput } from "@gravity-ui/uikit";
import { useLatestUpload, useUploadLog } from "../entities/upload/model/hooks";
import type { ProcessingLogRow } from "../entities/upload/model/types";
import { useSessionsSummary, useStudentsSummary } from "../entities/summary/model/hooks";
import { useClusteringRuns } from "../entities/clustering/model/hooks";
import { formatNumber } from "../shared/lib/format";
import { dateFilterValue, matchesDateRange, matchesNumberRange } from "../shared/lib/clientFilters";
import { DateTimeIsoInput } from "../shared/ui/DateTimeIsoInput";

const levelConfig = {
  info: { theme: "info" as const, label: "info" },
  warn: { theme: "warning" as const, label: "warn" },
  error: { theme: "danger" as const, label: "error" },
};

const entityLabels: Record<ProcessingLogRow["entityType"], string> = {
  student: "Студент",
  moodle: "Строка Moodle",
  camera: "Запись камеры",
};

export function ProcessingPage() {
  const navigate = useNavigate();
  const { upload, batch, loading } = useLatestUpload();
  const { logEntries, loading: logLoading } = useUploadLog(String(upload?._id ?? ""));
  const sessions = useSessionsSummary();
  const students = useStudentsSummary();
  const { runs } = useClusteringRuns(1);
  const latestRun = runs[0];
  const [logTimeFrom, setLogTimeFrom] = useState("");
  const [logTimeTo, setLogTimeTo] = useState("");
  const [logLevelFilter, setLogLevelFilter] = useState("all");
  const [logFileFilter, setLogFileFilter] = useState("all");
  const [logLineMin, setLogLineMin] = useState("");
  const [logLineMax, setLogLineMax] = useState("");
  const [logEntityFilter, setLogEntityFilter] = useState("all");
  const [logSearch, setLogSearch] = useState("");

  const summary = (upload?.summary ?? {}) as { errorCount?: number };
  const warningCount = Number(upload?.errorCount ?? summary.errorCount ?? (upload?.unresolvedStudents as unknown[] | undefined)?.length ?? 0);
  const uploadStatus = String(upload?.status ?? "");
  const statusTheme = uploadStatus === "failed" || uploadStatus === "error" ? "danger" : uploadStatus.includes("warning") ? "warning" : uploadStatus ? "success" : "normal";
  const statusText =
    uploadStatus === "done" ? "Завершено" :
      uploadStatus === "done_with_warnings" ? "Завершено с предупреждениями" :
        uploadStatus === "failed" || uploadStatus === "error" ? "Ошибка" :
          uploadStatus || "Загрузок пока нет";

  const kpis = [
    { label: "Строк обработано", value: batch?.rows ?? "0" },
    { label: "Сессий построено", value: formatNumber(sessions.total) },
    { label: "Студентов сопоставлено", value: formatNumber(students.total) },
    { label: "Предупреждения", value: formatNumber(warningCount) },
  ];
  const logFiles = [...new Set(logEntries.map((entry) => entry.file))];
  const logTimeFromValue = dateFilterValue(logTimeFrom);
  const logTimeToValue = dateFilterValue(logTimeTo);
  const hasLogFilters =
    logTimeFrom ||
    logTimeTo ||
    logLevelFilter !== "all" ||
    logFileFilter !== "all" ||
    logLineMin ||
    logLineMax ||
    logEntityFilter !== "all" ||
    logSearch;
  const resetLogFilters = () => {
    setLogTimeFrom("");
    setLogTimeTo("");
    setLogLevelFilter("all");
    setLogFileFilter("all");
    setLogLineMin("");
    setLogLineMax("");
    setLogEntityFilter("all");
    setLogSearch("");
  };
  const filteredLogEntries = logEntries.filter((entry) => {
    if (!matchesDateRange(entry.timestampRaw, logTimeFromValue, logTimeToValue)) return false;
    if (logLevelFilter !== "all" && entry.level !== logLevelFilter) return false;
    if (logFileFilter !== "all" && entry.file !== logFileFilter) return false;
    if (!matchesNumberRange(entry.line, logLineMin, logLineMax)) return false;
    if (logEntityFilter !== "all" && entry.entityType !== logEntityFilter) return false;
    if (logSearch && !entry.message.toLowerCase().includes(logSearch.toLowerCase())) return false;
    return true;
  });
  const uploadId = String(upload?._id ?? "");
  const openLogEntry = (entry: ProcessingLogRow) => {
    if (!uploadId) return;
    navigate(`/processing/log/${uploadId}/${entry.id - 1}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px]" style={{ fontWeight: 600 }}>Обработка данных</h1>
        <p className="text-muted-foreground text-[14px] mt-1">
          Построение сессий и вычисление поведенческих метрик
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] text-muted-foreground mb-1">Последняя загрузка из БД</p>
            <p className="text-[15px]" style={{ fontWeight: 500 }}>
              {upload?._id ? String(upload._id) : "Данные ещё не загружались"}
            </p>
          </div>
          <Label theme={statusTheme}>{statusText}</Label>
        </div>
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          {latestRun ? `Последний запуск кластеризации: ${latestRun.id}` : "Запусков кластеризации пока нет"}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-card rounded-xl border border-border p-4">
            <div className="text-[12px] text-muted-foreground mb-1">{k.label}</div>
            <div className="text-[22px]" style={{ fontWeight: 600 }}>{k.value}</div>
          </div>
        ))}
      </div>
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="text-[12px] text-muted-foreground mb-1">ID последней кластеризации</div>
        <div className="text-[13px] font-mono break-all" style={{ fontWeight: 600 }}>{latestRun?.id ?? "Запусков пока нет"}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-[15px] mb-4" style={{ fontWeight: 600 }}>Состояние данных</h3>
          <div className="space-y-3 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Пачка загрузки</span>
              <span className="font-mono text-[12px] break-all text-right">{batch?.id ?? "Нет данных"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Файлов в последней пачке</span>
              <span style={{ fontWeight: 500 }}>{batch?.files ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Типы файлов</span>
              <span className="text-right">{batch?.fileTypes ?? "Нет данных"}</span>
            </div>
            {warningCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-warning/5 px-3 py-2 text-warning">
                <AlertTriangle className="w-4 h-4" />
                <span>В последней загрузке есть предупреждения: {formatNumber(warningCount)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-[15px]" style={{ fontWeight: 600 }}>Журнал обработки</h3>
            <p className="text-[12px] text-muted-foreground mt-1">Клик по строке открывает атрибуты записи журнала</p>
          </div>
          <span className="text-[13px] text-muted-foreground">
            Найдено записей: <span className="text-foreground" style={{ fontWeight: 500 }}>{filteredLogEntries.length}</span>
          </span>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-[13px]" style={{ fontWeight: 500 }}>Фильтр записей</span>
            {hasLogFilters && (
              <button onClick={resetLogFilters} className="ml-auto flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
                Сбросить
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="grid grid-cols-2 gap-2 xl:col-span-2">
              <DateTimeIsoInput label="Время от" value={logTimeFrom} onUpdate={setLogTimeFrom} />
              <DateTimeIsoInput label="Время до" value={logTimeTo} onUpdate={setLogTimeTo} />
            </div>
            <Select
              value={[logLevelFilter]}
              onUpdate={(value) => setLogLevelFilter(value[0] ?? "all")}
              options={[
                { value: "all", content: "Все уровни" },
                { value: "info", content: "info" },
                { value: "warn", content: "warn" },
                { value: "error", content: "error" },
              ]}
              size="m"
            />
            <Select
              value={[logFileFilter]}
              onUpdate={(value) => setLogFileFilter(value[0] ?? "all")}
              options={[{ value: "all", content: "Все файлы" }, ...logFiles.map((file) => ({ value: file, content: file }))]}
              size="m"
            />
            <div className="grid grid-cols-2 gap-2">
              <input className="w-full h-10" type="number" placeholder="Строка от" value={logLineMin} onChange={(event) => setLogLineMin(event.target.value)} />
              <input className="w-full h-10" type="number" placeholder="Строка до" value={logLineMax} onChange={(event) => setLogLineMax(event.target.value)} />
            </div>
            <Select
              value={[logEntityFilter]}
              onUpdate={(value) => setLogEntityFilter(value[0] ?? "all")}
              options={[
                { value: "all", content: "Все сущности" },
                { value: "student", content: "Студент" },
                { value: "moodle", content: "Строка Moodle" },
                { value: "camera", content: "Запись камеры" },
              ]}
              size="m"
            />
            <TextInput
              placeholder="Поиск в сообщениях"
              size="l"
              value={logSearch}
              onUpdate={setLogSearch}
              startContent={<Search className="w-3.5 h-3.5 text-muted-foreground" />}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-left">
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Время</th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Уровень</th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Файл</th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Строка</th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Сущность</th>
                <th className="pb-3" style={{ fontWeight: 500 }}>Сообщение</th>
              </tr>
            </thead>
            <tbody>
              {logLoading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">Загрузка журнала...</td>
                </tr>
              ) : filteredLogEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">Записей по заданным условиям не найдено</td>
                </tr>
              ) : (
                filteredLogEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className={`border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer ${entry.level === "error" ? "bg-destructive/3" : entry.level === "warn" ? "bg-warning/3" : ""}`}
                    onClick={() => openLogEntry(entry)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      openLogEntry(entry);
                    }}
                    tabIndex={0}
                    role="link"
                    title="Открыть запись журнала"
                    aria-label="Открыть запись журнала"
                  >
                    <td className="py-2.5 pr-4 font-mono text-muted-foreground whitespace-nowrap">{entry.time}</td>
                    <td className="py-2.5 pr-4"><Label theme={levelConfig[entry.level].theme}>{levelConfig[entry.level].label}</Label></td>
                    <td className="py-2.5 pr-4 text-muted-foreground"><code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{entry.file}</code></td>
                    <td className="py-2.5 pr-4 font-mono text-muted-foreground">{entry.line || "—"}</td>
                    <td className="py-2.5 pr-4"><span className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{entityLabels[entry.entityType]}</span></td>
                    <td className="py-2.5">{entry.message}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
