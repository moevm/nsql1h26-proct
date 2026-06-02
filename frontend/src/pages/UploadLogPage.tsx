import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ScrollText,
  Filter,
  Search,
  X,
  UserX,
  AlertTriangle,
  Info,
  Loader2,
} from "lucide-react";
import { Button, TextInput, Select, Label } from "@gravity-ui/uikit";
import { api, ApiError } from "../shared/api/client";
import type { AnyRecord } from "../entities/types";
import { RecordDetailsView } from "../shared/ui/RecordDetailsView";
import { FilterDateTimeRange, FilterFormField, FilterNumberRange } from "../shared/ui/FilterField";
import { getUploadStatusLabel } from "../shared/config/ui";
import { formatDate, formatDurationMs } from "../shared/lib/format";
import { isValidIsoDateTime } from "../shared/lib/dateTime";
import { readStoredPageSize, writeStoredPageSize } from "../shared/lib/paginationStorage";
import { TablePagination } from "../shared/ui/TablePagination";
import { useRetryProcessing, useStartProcessing, useStopProcessing } from "../entities/upload/model/hooks";
import { isActiveProcessingStatus, isRetryableProcessingStatus } from "../entities/upload/model/adapters";

interface LogEntry {
  id: number;
  time: string;
  level: "info" | "warn" | "error";
  file: string;
  line: number;
  entityType: "student" | "moodle" | "camera";
  message: string;
}

interface ProblemRow {
  file: string;
  line: number;
  content: string;
  error: string;
}

interface UnmappedStudent {
  id: string;
  possibleMatch: string;
  reason: string;
}

const levelConfig = {
  info: { theme: "info" as const, icon: <Info className="w-3 h-3" />, label: "info" },
  warn: { theme: "warning" as const, icon: <AlertTriangle className="w-3 h-3" />, label: "warn" },
  error: { theme: "danger" as const, icon: <AlertTriangle className="w-3 h-3" />, label: "error" },
};

const entityLabels: Record<LogEntry["entityType"], string> = {
  student: "Студент",
  moodle: "Строка Moodle",
  camera: "Запись камеры",
};

type TabType = "log" | "problems" | "unmapped";
const finalUploadStatuses = new Set(["done", "done_with_warnings", "failed", "success", "warning", "error"]);

type PaginationState = {
  page: number;
  limit: number;
  total: number;
};

function normalizeEntity(value: unknown): LogEntry["entityType"] {
  const raw = String(value ?? "");
  if (raw.includes("student")) return "student";
  if (raw.includes("ocr") || raw.includes("camera")) return "camera";
  return "moodle";
}

export function UploadLogPage() {
  const { uploadId, id } = useParams<{ uploadId?: string; id?: string }>();
  const currentId = uploadId ?? id ?? "";
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("log");
  const [levelFilter, setLevelFilter] = useState("all");
  const [fileFilter, setFileFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [lineMin, setLineMin] = useState("");
  const [lineMax, setLineMax] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [search, setSearch] = useState("");
  const [problemFileFilter, setProblemFileFilter] = useState("");
  const [problemLineMin, setProblemLineMin] = useState("");
  const [problemLineMax, setProblemLineMax] = useState("");
  const [problemContentFilter, setProblemContentFilter] = useState("");
  const [problemErrorFilter, setProblemErrorFilter] = useState("");
  const [unmappedIdFilter, setUnmappedIdFilter] = useState("");
  const [unmappedMatchFilter, setUnmappedMatchFilter] = useState("");
  const [unmappedReasonFilter, setUnmappedReasonFilter] = useState("");
  const [upload, setUpload] = useState<AnyRecord | null>(null);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [problemRows, setProblemRows] = useState<ProblemRow[]>([]);
  const [unmappedStudents, setUnmappedStudents] = useState<UnmappedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [paginationByTab, setPaginationByTab] = useState<Record<TabType, PaginationState>>(() => {
    const limit = readStoredPageSize("table-page-size", 10);
    return {
      log: { page: 1, limit, total: 0 },
      problems: { page: 1, limit, total: 0 },
      unmapped: { page: 1, limit, total: 0 },
    };
  });
  const startProcessing = useStartProcessing();
  const stopProcessing = useStopProcessing();
  const retryProcessing = useRetryProcessing();
  const timeFromValid = isValidIsoDateTime(timeFrom);
  const timeToValid = isValidIsoDateTime(timeTo);
  const timeFiltersValid = timeFromValid && timeToValid;
  const activePagination = paginationByTab[activeTab];

  const updatePagination = useCallback((tab: TabType, patch: Partial<PaginationState>) => {
    setPaginationByTab((current) => ({ ...current, [tab]: { ...current[tab], ...patch } }));
  }, []);

  const resetActivePage = () => updatePagination(activeTab, { page: 1 });
  const updateActivePage = (page: number) => updatePagination(activeTab, { page });
  const updateActiveLimit = (limit: number) => {
    writeStoredPageSize("table-page-size", limit);
    setPaginationByTab((current) => ({
      log: { ...current.log, page: 1, limit },
      problems: { ...current.problems, page: 1, limit },
      unmapped: { ...current.unmapped, page: 1, limit },
    }));
  };

  const loadLog = useCallback(async () => {
    if (!currentId) return;
    if (!timeFiltersValid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    setLoadError("");
    try {
      const params = new URLSearchParams();
      params.set("table", activeTab);
      params.set("page", String(activePagination.page));
      params.set("limit", String(activePagination.limit));
      if (levelFilter !== "all") params.set("level", levelFilter);
      if (fileFilter !== "all") params.set("file", fileFilter);
      if (entityFilter !== "all") params.set("entityType", entityFilter);
      if (lineMin) params.set("lineFrom", lineMin);
      if (lineMax) params.set("lineTo", lineMax);
      if (timeFrom) params.set("timeFrom", timeFrom);
      if (timeTo) params.set("timeTo", timeTo);
      if (search) params.set("search", search);
      if (problemFileFilter) params.set("problemFile", problemFileFilter);
      if (problemLineMin) params.set("problemLineFrom", problemLineMin);
      if (problemLineMax) params.set("problemLineTo", problemLineMax);
      if (problemContentFilter) params.set("problemContent", problemContentFilter);
      if (problemErrorFilter) params.set("problemError", problemErrorFilter);
      if (unmappedIdFilter) params.set("unmappedId", unmappedIdFilter);
      if (unmappedMatchFilter) params.set("unmappedMatch", unmappedMatchFilter);
      if (unmappedReasonFilter) params.set("unmappedReason", unmappedReasonFilter);
      const query = params.toString();
      const data = await api<{ upload: AnyRecord; processingLog: AnyRecord[]; unresolvedStudents: AnyRecord[]; pagination?: PaginationState }>(
        `/uploads/${currentId}/log${query ? `?${query}` : ""}`,
      );
      setUpload(data.upload);
      if (activeTab === "log") {
        setLogEntries(
          data.processingLog.map((entry, index) => {
            const timestamp = entry.timestamp ? String(entry.timestamp) : "";
            return {
              id: (activePagination.page - 1) * activePagination.limit + index + 1,
              time: timestamp ? new Date(timestamp).toLocaleTimeString("ru-RU") : "—",
              level: String(entry.level ?? "info") as LogEntry["level"],
              file: String(entry.sourceFileKey ?? "csv"),
              line: Number(entry.line ?? 0),
              entityType: normalizeEntity(entry.entityType),
              message: String(entry.message ?? ""),
            };
          }),
        );
      }
      if (activeTab === "problems") {
        setProblemRows(
          data.processingLog.map((entry) => ({
            file: String(entry.sourceFileKey ?? "csv"),
            line: Number(entry.line ?? 0),
            content: String(entry.rowContent ?? "—"),
            error: String(entry.message ?? "—"),
          })),
        );
      }
      if (activeTab === "unmapped") {
        setUnmappedStudents(
          data.unresolvedStudents.map((student) => ({
            id: String(student.externalId ?? student.id ?? ""),
            possibleMatch: String(student.possibleMatch ?? "—"),
            reason: String(student.reason ?? "Не сопоставлен"),
          })),
        );
      }
      updatePagination(activeTab, {
        page: data.pagination?.page ?? activePagination.page,
        limit: data.pagination?.limit ?? activePagination.limit,
        total: data.pagination?.total ?? 0,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setNotFound(true);
      } else {
        setLoadError(error instanceof Error ? error.message : "Не удалось загрузить журнал");
      }
    } finally {
      setLoading(false);
    }
  }, [
    activePagination.limit,
    activePagination.page,
    activeTab,
    currentId,
    entityFilter,
    fileFilter,
    levelFilter,
    lineMax,
    lineMin,
    problemContentFilter,
    problemErrorFilter,
    problemFileFilter,
    problemLineMax,
    problemLineMin,
    search,
    timeFrom,
    timeFiltersValid,
    timeTo,
    unmappedIdFilter,
    unmappedMatchFilter,
    unmappedReasonFilter,
    updatePagination,
  ]);

  useEffect(() => {
    void loadLog();
  }, [loadLog, reloadKey]);

  const files = [...new Set(logEntries.map((e) => e.file))];

  const hasFilters =
    levelFilter !== "all" ||
    fileFilter !== "all" ||
    entityFilter !== "all" ||
    lineMin ||
    lineMax ||
    timeFrom ||
    timeTo ||
    search;

  const resetFilters = () => {
    setLevelFilter("all");
    setFileFilter("all");
    setEntityFilter("all");
    setLineMin("");
    setLineMax("");
    setTimeFrom("");
    setTimeTo("");
    setSearch("");
    resetActivePage();
  };

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: "log", label: "Журнал", count: paginationByTab.log.total || logEntries.length },
    { id: "problems", label: "Проблемные строки", count: paginationByTab.problems.total || problemRows.length },
    { id: "unmapped", label: "Несопоставленные студенты", count: paginationByTab.unmapped.total || unmappedStudents.length },
  ];

  const duration = formatDurationMs(upload?.processingDurationMs);
  const uploadStatus = String(upload?.status ?? "");
  const processingState = upload?.processingState as { status?: string } | undefined;
  const lifecycleStatus = String(processingState?.status ?? (finalUploadStatuses.has(uploadStatus) ? "idle" : uploadStatus));
  const importStatusLabel = getUploadStatusLabel(uploadStatus || undefined);
  const lifecycleStatusLabel = getUploadStatusLabel(lifecycleStatus || undefined);
  const canStopUpload = Boolean(currentId && upload && isActiveProcessingStatus(lifecycleStatus) && lifecycleStatus !== "cancelling");
  const canRetryUpload = Boolean(currentId && upload && isRetryableProcessingStatus(lifecycleStatus, uploadStatus));
  const canStartUpload = Boolean(currentId && upload && lifecycleStatus === "idle" && !canRetryUpload);
  const canProcessUpload = canStartUpload || canStopUpload || canRetryUpload || lifecycleStatus === "cancelling";
  const processButtonLabel =
    lifecycleStatus === "cancelling" ? "Останавливаем обработку..." :
      canStopUpload ? "Остановить обработку" :
        canRetryUpload ? "Перезапустить обработку" :
          "Запустить обработку";
  const processButtonLoading = processing || startProcessing.loading || stopProcessing.loading || retryProcessing.loading || lifecycleStatus === "cancelling";

  async function handleProcess() {
    if (!canProcessUpload) return;
    setProcessing(true);
    setProcessError("");
    try {
      if (canStopUpload) {
        if (!window.confirm("Остановить обработку? Уже загруженные исходные файлы сохранятся, обработку можно будет перезапустить.")) return;
        await stopProcessing.run(currentId);
      } else if (canRetryUpload) {
        await retryProcessing.run(currentId);
      } else if (canStartUpload) {
        await startProcessing.run(currentId);
      }
      setReloadKey((key) => key + 1);
    } catch (error) {
      setProcessError(error instanceof Error ? error.message : "Не удалось выполнить действие обработки");
    } finally {
      setProcessing(false);
    }
  }

  if (loading && !upload) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Загрузка журнала...
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate("/upload-history")}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          История загрузок
        </button>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Загрузка не найдена
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate("/upload-history")}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          История загрузок
        </button>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          {loadError || "Не удалось загрузить журнал"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate("/upload-history")}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          История загрузок
        </button>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ScrollText className="w-5 h-5 text-primary" />
              <h1 className="text-[22px]" style={{ fontWeight: 600 }}>
                Журнал обработки — {currentId}
              </h1>
            </div>
            <p className="text-[14px] text-muted-foreground">
              Загрузка от {formatDate(upload?.createdAt)} · {String(upload?.createdByName ?? upload?.createdBy ?? "Система")} · Импорт: {importStatusLabel.text} · Обработка: {lifecycleStatusLabel.text} · Длительность: {duration}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button view="outlined" className="text-[13px] h-9" onClick={() => navigate(`/processing?uploadId=${currentId}`)}>
              Открыть экран обработки
            </Button>
            <Button view="action" className="text-[13px] h-9" loading={processButtonLoading} disabled={!canProcessUpload || lifecycleStatus === "cancelling"} onClick={() => void handleProcess()}>
              {processButtonLabel}
            </Button>
          </div>
        </div>
        {processError && (
          <div className="mt-3 rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2 text-[13px] text-destructive">
            {processError}
          </div>
        )}
      </div>

      <div className="flex bg-muted rounded-lg p-0.5 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-md text-[13px] transition-colors flex items-center gap-1.5 ${
              activeTab === tab.id ? "bg-card shadow-sm" : "text-muted-foreground"
            }`}
            style={{ fontWeight: activeTab === tab.id ? 600 : 400 }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id ? "bg-primary/10 text-primary" : "bg-muted-foreground/20 text-muted-foreground"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {upload && (
        <RecordDetailsView record={upload} title="Атрибуты загрузки" subtitle="Все поля записи загрузки из БД" />
      )}

      {activeTab === "log" && (
        <>
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-[13px]" style={{ fontWeight: 500 }}>Фильтр записей</span>
              {hasFilters && (
                <button onClick={resetFilters} className="ml-auto flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                  Сбросить
                </button>
              )}
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <FilterFormField label="Поиск">
                  <TextInput placeholder="Текст в сообщениях" size="l" value={search} onUpdate={(value) => { setSearch(value); resetActivePage(); }} startContent={<Search className="w-3.5 h-3.5 text-muted-foreground" />} />
                </FilterFormField>
                <FilterFormField label="Уровень">
                  <Select value={[levelFilter]} onUpdate={(v) => { setLevelFilter(v[0]); resetActivePage(); }} options={[{ value: "all", content: "Все уровни" }, { value: "info", content: "info" }, { value: "warn", content: "warn" }, { value: "error", content: "error" }]} size="l" width="max" />
                </FilterFormField>
                <FilterFormField label="Файл">
                  <Select value={[fileFilter]} onUpdate={(v) => { setFileFilter(v[0]); resetActivePage(); }} options={[{ value: "all", content: "Все файлы" }, ...files.map((f) => ({ value: f, content: f }))]} size="l" width="max" />
                </FilterFormField>
                <FilterFormField label="Сущность">
                  <Select value={[entityFilter]} onUpdate={(v) => { setEntityFilter(v[0]); resetActivePage(); }} options={[{ value: "all", content: "Все сущности" }, { value: "student", content: "Студент" }, { value: "moodle", content: "Строка Moodle" }, { value: "camera", content: "Запись камеры" }]} size="l" width="max" />
                </FilterFormField>
                <FilterNumberRange label="Строка" from={lineMin} to={lineMax} onFromChange={(value) => { setLineMin(value); resetActivePage(); }} onToChange={(value) => { setLineMax(value); resetActivePage(); }} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FilterDateTimeRange label="Время записи" from={timeFrom} to={timeTo} onFromChange={(value) => { setTimeFrom(value); resetActivePage(); }} onToChange={(value) => { setTimeTo(value); resetActivePage(); }} />
              </div>
            </div>
            {!timeFiltersValid && (
              <div className="mt-2 text-[12px] text-destructive">
                Введите корректные ISO дату и время для фильтрации журнала.
              </div>
            )}
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left">
                    <th className="pb-3 pr-4 w-20" style={{ fontWeight: 500 }}>Время</th>
                    <th className="pb-3 pr-4 w-20" style={{ fontWeight: 500 }}>Уровень</th>
                    <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Файл</th>
                    <th className="pb-3 pr-4 w-16" style={{ fontWeight: 500 }}>Строка</th>
                    <th className="pb-3 pr-4 w-28" style={{ fontWeight: 500 }}>Сущность</th>
                    <th className="pb-3" style={{ fontWeight: 500 }}>Сообщение</th>
                  </tr>
                </thead>
                <tbody>
                  {logEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-muted-foreground">Записей по заданным условиям не найдено</td>
                    </tr>
                  ) : (
                    logEntries.map((e) => (
                      <tr key={e.id} className={`border-b border-border/50 last:border-0 ${e.level === "error" ? "bg-destructive/3" : e.level === "warn" ? "bg-warning/3" : ""}`}>
                        <td className="py-2.5 pr-4 font-mono text-muted-foreground">{e.time}</td>
                        <td className="py-2.5 pr-4"><Label theme={levelConfig[e.level].theme} icon={levelConfig[e.level].icon}>{levelConfig[e.level].label}</Label></td>
                        <td className="py-2.5 pr-4 text-muted-foreground"><code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{e.file}</code></td>
                        <td className="py-2.5 pr-4 font-mono text-muted-foreground">{e.line || "—"}</td>
                        <td className="py-2.5 pr-4"><span className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{entityLabels[e.entityType]}</span></td>
                        <td className="py-2.5">{e.message}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <TablePagination total={activePagination.total} page={activePagination.page} limit={activePagination.limit} onPageChange={updateActivePage} onLimitChange={updateActiveLimit} className="mt-4" />
          </div>
        </>
      )}

      {activeTab === "problems" && (
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
            <FilterFormField label="Файл">
              <TextInput placeholder="Имя файла" size="l" value={problemFileFilter} onUpdate={(value) => { setProblemFileFilter(value); resetActivePage(); }} />
            </FilterFormField>
            <FilterNumberRange label="Строка" from={problemLineMin} to={problemLineMax} onFromChange={(value) => { setProblemLineMin(value); resetActivePage(); }} onToChange={(value) => { setProblemLineMax(value); resetActivePage(); }} />
            <FilterFormField label="Содержимое">
              <TextInput placeholder="Фрагмент строки" size="l" value={problemContentFilter} onUpdate={(value) => { setProblemContentFilter(value); resetActivePage(); }} />
            </FilterFormField>
            <FilterFormField label="Описание ошибки">
              <TextInput placeholder="Текст ошибки" size="l" value={problemErrorFilter} onUpdate={(value) => { setProblemErrorFilter(value); resetActivePage(); }} />
            </FilterFormField>
          </div>
          {problemRows.length === 0 && activePagination.total === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-[13px]">Проблемных строк не обнаружено</p>
          ) : problemRows.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-[13px]">Проблемных строк по заданным условиям не найдено</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left">
                    <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Файл</th>
                    <th className="pb-3 pr-4 w-16" style={{ fontWeight: 500 }}>Строка</th>
                    <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Содержимое</th>
                    <th className="pb-3" style={{ fontWeight: 500 }}>Описание ошибки</th>
                  </tr>
                </thead>
                <tbody>
                  {problemRows.map((r, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-4"><code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{r.file}</code></td>
                      <td className="py-2.5 pr-4 font-mono text-muted-foreground">{r.line}</td>
                      <td className="py-2.5 pr-4"><code className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-foreground/80">{r.content}</code></td>
                      <td className="py-2.5 text-destructive">{r.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {activePagination.total > 0 && (
            <TablePagination total={activePagination.total} page={activePagination.page} limit={activePagination.limit} onPageChange={updateActivePage} onLimitChange={updateActiveLimit} className="mt-4" />
          )}
        </div>
      )}

      {activeTab === "unmapped" && (
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserX className="w-4 h-4 text-warning" />
            <span className="text-[14px]" style={{ fontWeight: 600 }}>Несопоставленные студенты ({unmappedStudents.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <FilterFormField label="ID из файла">
              <TextInput placeholder="ID студента" size="l" value={unmappedIdFilter} onUpdate={(value) => { setUnmappedIdFilter(value); resetActivePage(); }} />
            </FilterFormField>
            <FilterFormField label="Возможное совпадение">
              <TextInput placeholder="Фрагмент совпадения" size="l" value={unmappedMatchFilter} onUpdate={(value) => { setUnmappedMatchFilter(value); resetActivePage(); }} />
            </FilterFormField>
            <FilterFormField label="Причина">
              <TextInput placeholder="Причина несопоставления" size="l" value={unmappedReasonFilter} onUpdate={(value) => { setUnmappedReasonFilter(value); resetActivePage(); }} />
            </FilterFormField>
          </div>
          {unmappedStudents.length === 0 && activePagination.total === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-[13px]">Все студенты успешно сопоставлены</p>
          ) : unmappedStudents.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-[13px]">Несопоставленных студентов по заданным условиям не найдено</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left">
                    <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>ID из файла</th>
                    <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Возможное совпадение</th>
                    <th className="pb-3" style={{ fontWeight: 500 }}>Причина несопоставления</th>
                  </tr>
                </thead>
                <tbody>
                  {unmappedStudents.map((s) => (
                    <tr key={s.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-4 font-mono text-[12px]" style={{ fontWeight: 500 }}>{s.id}</td>
                      <td className="py-2.5 pr-4 font-mono text-[12px] text-muted-foreground">{s.possibleMatch}</td>
                      <td className="py-2.5 text-warning">{s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {activePagination.total > 0 && (
            <TablePagination total={activePagination.total} page={activePagination.page} limit={activePagination.limit} onPageChange={updateActivePage} onLimitChange={updateActiveLimit} className="mt-4" />
          )}
        </div>
      )}
    </div>
  );
}
