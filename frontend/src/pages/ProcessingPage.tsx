import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Clock,
  AlertTriangle,
  Filter,
  Search,
  X,
  CheckCircle2,
  Loader2,
  Play,
  RotateCcw,
  ScrollText,
  Square,
} from "lucide-react";
import { Button, Label, Select, TextInput } from "@gravity-ui/uikit";
import { useLatestUpload, useProcessingStatus, useRetryProcessing, useStartProcessing, useStopProcessing } from "../entities/upload/model/hooks";
import type { ProcessingLogRow, ProcessingStageState, ProcessingState, ProcessingStatus } from "../entities/upload/model/types";
import { useClusteringRuns } from "../entities/clustering/model/hooks";
import { formatDate, formatNumber } from "../shared/lib/format";
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

const statusLabels: Record<ProcessingStatus | string, { theme: "normal" | "info" | "success" | "warning" | "danger"; text: string }> = {
  idle: { theme: "normal", text: "Ожидает обработки" },
  queued: { theme: "info", text: "В очереди" },
  processing: { theme: "info", text: "Обработка" },
  cancelling: { theme: "warning", text: "Остановка" },
  cancelled: { theme: "warning", text: "Остановлено" },
  done: { theme: "success", text: "Завершено" },
  done_with_warnings: { theme: "warning", text: "Завершено с предупреждениями" },
  failed: { theme: "danger", text: "Ошибка" },
  stale: { theme: "danger", text: "Зависло" },
};

const activeStatuses = new Set(["queued", "processing", "cancelling"]);

function stageLabel(stage: ProcessingStageState) {
  if (stage.status === "done") return "Готово";
  if (stage.status === "running") return "Выполняется";
  if (stage.status === "error") return "Ошибка";
  if (stage.status === "cancelled") return "Остановлено";
  return "Ожидает";
}

export function ProcessingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { upload: latestUpload, batch, loading: latestLoading } = useLatestUpload();
  const selectedUploadId = searchParams.get("uploadId") ?? batch?.id ?? String(latestUpload?._id ?? "");
  const processingStatus = useProcessingStatus(selectedUploadId || undefined);
  const startProcessing = useStartProcessing();
  const stopProcessing = useStopProcessing();
  const retryProcessing = useRetryProcessing();
  const upload = processingStatus.upload ?? latestUpload;
  const logEntries = processingStatus.logEntries;
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

  const processingState = upload?.processingState as ProcessingState | undefined;
  const processingStateStatus = String(processingState?.status ?? "idle");
  const uploadStatus = String(upload?.status ?? "");
  const statusConfig = statusLabels[processingStateStatus] ?? statusLabels[String(upload?.status ?? "idle")] ?? { theme: "normal" as const, text: String(upload?.status ?? "Нет данных") };
  const canStop = processingStateStatus === "queued" || processingStateStatus === "processing";
  const canRetry = ["cancelled", "failed", "stale", "done", "done_with_warnings"].includes(processingStateStatus) || (processingStateStatus === "idle" && ["done", "done_with_warnings", "failed"].includes(uploadStatus));
  const canStart = Boolean(selectedUploadId && processingStateStatus === "idle" && !canRetry);
  const isActionLoading = startProcessing.loading || stopProcessing.loading || retryProcessing.loading;
  const actionError = startProcessing.error || stopProcessing.error || retryProcessing.error || processingStatus.error;
  const summary = (upload?.summary ?? {}) as { errorCount?: number };
  const uploadFiles = (upload?.files ?? {}) as Record<string, { rowsCount?: number }>;
  const fileRows = Object.values(uploadFiles).map((file) => Number(file.rowsCount ?? 0));
  const rowsProcessed = fileRows.length ? fileRows.reduce((sum, rows) => sum + rows, 0) : Number(upload?.totalRows ?? 0);
  const sessionsBuilt = Number(uploadFiles.sessions?.rowsCount ?? 0);
  const unresolvedCount = processingStatus.unresolvedStudents.length || Number((upload?.unresolvedStudents as unknown[] | undefined)?.length ?? 0);
  const studentsMatched = Math.max(0, Number(uploadFiles.students?.rowsCount ?? upload?.matchedStudents ?? 0) - unresolvedCount);
  const warningCount = Math.max(
    logEntries.filter((entry) => entry.level === "warn" || entry.level === "error").length,
    unresolvedCount,
    Number(upload?.errorCount ?? summary.errorCount ?? 0),
  );

  const kpis = [
    { label: "Строк обработано", value: formatNumber(rowsProcessed) },
    { label: "Сессий построено", value: formatNumber(sessionsBuilt) },
    { label: "Студентов сопоставлено", value: formatNumber(studentsMatched) },
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
  const uploadId = selectedUploadId || String(upload?._id ?? "");
  const openLogEntry = (entry: ProcessingLogRow) => {
    if (!uploadId) return;
    navigate(`/processing/log/${uploadId}/${entry.id - 1}`);
  };
  const refreshAfterAction = () => {
    processingStatus.refetch();
  };
  const handleStart = async () => {
    if (!selectedUploadId) return;
    try {
      await startProcessing.run(selectedUploadId);
      refreshAfterAction();
    } catch {
      // Inline error is rendered in the status card.
    }
  };
  const handleStop = async () => {
    if (!selectedUploadId) return;
    if (!window.confirm("Остановить обработку? Уже загруженные исходные файлы сохранятся, обработку можно будет перезапустить.")) return;
    try {
      await stopProcessing.run(selectedUploadId);
      refreshAfterAction();
    } catch {
      // Inline error is rendered in the status card.
    }
  };
  const handleRetry = async () => {
    if (!selectedUploadId) return;
    try {
      await retryProcessing.run(selectedUploadId);
      refreshAfterAction();
    } catch {
      // Inline error is rendered in the status card.
    }
  };
  const lastHeartbeatText = processingState?.lastHeartbeatAt ? formatDate(processingState.lastHeartbeatAt) : "Нет данных";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px]" style={{ fontWeight: 600 }}>Обработка данных</h1>
          <p className="text-muted-foreground text-[14px] mt-1">
            Построение сессий и вычисление поведенческих метрик
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {uploadId && (
            <Button view="outlined" className="text-[13px] h-9" onClick={() => navigate(`/uploads/${uploadId}/log`)}>
              <span className="flex items-center gap-1.5">
                <ScrollText className="w-4 h-4" />
                Открыть журнал
              </span>
            </Button>
          )}
          {(processingStateStatus === "done" || processingStateStatus === "done_with_warnings") && (
            <Button view="action" className="text-[13px] h-9" onClick={() => navigate("/clustering")}>
              Кластеризация
            </Button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] text-muted-foreground mb-1">Пачка обработки</p>
            <p className="text-[15px]" style={{ fontWeight: 500 }}>
              {uploadId || "Данные ещё не загружались"}
            </p>
          </div>
          <Label theme={statusConfig.theme}>{statusConfig.text}</Label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[13px]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            Последнее обновление: {lastHeartbeatText}
          </div>
          <div className="text-muted-foreground">Попытка: <span className="text-foreground">{processingState?.attempt ?? 0}</span></div>
          <div className="text-muted-foreground">{latestRun ? `Последний запуск кластеризации: ${latestRun.id}` : "Запусков кластеризации пока нет"}</div>
        </div>
        {processingStateStatus === "stale" && (
          <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2 text-[13px] text-destructive">
            Задача не обновлялась дольше ожидаемого времени. Можно остановить ее и запустить снова.
          </div>
        )}
        {processingState?.errorMessage && (
          <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2 text-[13px] text-destructive">
            {processingState.errorMessage}
          </div>
        )}
        {actionError && (
          <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2 text-[13px] text-destructive">
            {actionError}
          </div>
        )}
        <div>
          <div className="flex items-center justify-between text-[12px] text-muted-foreground mb-2">
            <span>{processingState?.currentStage ?? "Этап не выбран"}</span>
            <span>{Math.round(Number(processingState?.progress ?? 0))}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(0, Number(processingState?.progress ?? 0)))}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canStart && (
            <Button view="action" className="text-[13px] h-9" loading={startProcessing.loading} disabled={isActionLoading} onClick={() => void handleStart()}>
              <span className="flex items-center gap-1.5"><Play className="w-4 h-4" />Запустить обработку</span>
            </Button>
          )}
          {canStop && (
            <Button view="outlined" className="text-[13px] h-9" loading={stopProcessing.loading} disabled={isActionLoading} onClick={() => void handleStop()}>
              <span className="flex items-center gap-1.5"><Square className="w-4 h-4" />Остановить</span>
            </Button>
          )}
          {processingStateStatus === "cancelling" && (
            <Button view="outlined" className="text-[13px] h-9" disabled loading>
              Останавливаем обработку...
            </Button>
          )}
          {canRetry && (
            <Button view="action" className="text-[13px] h-9" loading={retryProcessing.loading} disabled={isActionLoading} onClick={() => void handleRetry()}>
              <span className="flex items-center gap-1.5"><RotateCcw className="w-4 h-4" />Перезапустить</span>
            </Button>
          )}
          <Button view="outlined" className="text-[13px] h-9" onClick={() => navigate("/upload")}>
            Новая загрузка
          </Button>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-[15px] mb-4" style={{ fontWeight: 600 }}>Состояние данных</h3>
          <div className="space-y-3 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Пачка загрузки</span>
              <span className="font-mono text-[12px] break-all text-right">{uploadId || "Нет данных"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Файлов в последней пачке</span>
              <span style={{ fontWeight: 500 }}>{Number(upload?.filesCount ?? batch?.files ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Типы файлов</span>
              <span className="text-right">{Object.keys((upload?.files ?? {}) as Record<string, unknown>).join(", ") || batch?.fileTypes || "Нет данных"}</span>
            </div>
            {warningCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-warning/5 px-3 py-2 text-warning">
                <AlertTriangle className="w-4 h-4" />
                <span>В последней загрузке есть предупреждения: {formatNumber(warningCount)}</span>
              </div>
            )}
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-[15px] mb-4" style={{ fontWeight: 600 }}>Этапы обработки</h3>
          <div className="space-y-3">
            {(processingState?.stages ?? []).length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Этапы появятся после запуска обработки.</p>
            ) : (
              processingState?.stages.map((stage) => (
                <div key={stage.key} className="flex items-start gap-3">
                  <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center ${
                    stage.status === "done" ? "bg-success/15 text-success" :
                      stage.status === "running" ? "bg-primary/15 text-primary" :
                        stage.status === "error" ? "bg-destructive/15 text-destructive" :
                          stage.status === "cancelled" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"
                  }`}>
                    {stage.status === "done" ? <CheckCircle2 className="w-3.5 h-3.5" /> : stage.status === "running" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="text-[10px]">•</span>}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px]" style={{ fontWeight: 500 }}>{stage.label}</div>
                    <div className="text-[12px] text-muted-foreground">{stageLabel(stage)}</div>
                  </div>
                </div>
              ))
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
              {processingStatus.loading || latestLoading ? (
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
