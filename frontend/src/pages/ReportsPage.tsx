import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, BarChart3, CalendarDays, CheckCircle2, Database, Download, FileText, History, Layers, Users } from "lucide-react";
import { Button, Select, Switch, TextInput } from "@gravity-ui/uikit";
import { useClusteringRuns } from "../entities/clustering/model/hooks";
import { useReportExport, type ReportExportFormat, type ReportExportKind } from "../features/export-report/model/useReportExport";
import { formatNumber } from "../shared/lib/format";
import { getRunStatusLabel, runStatusLabels } from "../shared/config/ui";
import type { AnyRecord } from "../entities/types";

const reportKindOptions = [
  { value: "sessions", content: "Все сессии" },
  { value: "anomalies", content: "Только аномалии" },
  { value: "students", content: "Студенты с аномальными сессиями" },
];

function clusterLabel(clusterId: unknown) {
  const value = Number(clusterId);
  if (!Number.isFinite(value)) return "—";
  return value < 0 ? "noise" : `C${value + 1}`;
}

function percent(value: unknown) {
  const numeric = Number(value ?? 0);
  return `${Number.isFinite(numeric) ? (numeric * 100).toFixed(1) : "0.0"}%`;
}

function getRunResults(run: AnyRecord | undefined) {
  return (run?.results ?? {}) as AnyRecord;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export function ReportsPage() {
  const navigate = useNavigate();
  const { items: rawRuns, runs } = useClusteringRuns(50);
  const latestRawRun = rawRuns[0];
  const [selectedRunId, setSelectedRunId] = useState("");
  const runId = selectedRunId || String(latestRawRun?._id ?? "");
  const selectedRun = rawRuns.find((run) => String(run._id) === runId) ?? latestRawRun;
  const selectedHistoryRun = runs.find((run) => run.id === runId);
  const selectedResults = getRunResults(selectedRun);
  const selectedTotalSessions = Number(selectedResults.totalSessions ?? 0);
  const selectedClusters = Number(selectedResults.clusterCount ?? 0);
  const selectedAnomalies = Number(selectedResults.anomalyCount ?? 0);
  const selectedAnomalyRate = selectedResults.anomalyRate;
  const selectedStatus = selectedHistoryRun?.status ?? "success";
  const selectedStatusLabel = getRunStatusLabel(selectedStatus);
  const { download } = useReportExport();
  const [reportKind, setReportKind] = useState<ReportExportKind>("sessions");
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo] = useState("");
  const [clusterId, setClusterId] = useState("all");
  const [onlyAnomalies, setOnlyAnomalies] = useState(false);
  const [includeRawMetrics, setIncludeRawMetrics] = useState(false);
  const [includeStudents, setIncludeStudents] = useState(true);
  const [exportingFormat, setExportingFormat] = useState<ReportExportFormat | null>(null);
  const [exportError, setExportError] = useState("");

  const reportCards = useMemo(() => [
    { kind: "sessions" as ReportExportKind, title: "Все сессии", icon: FileText, description: "Полный набор сессий выбранного запуска", rows: `${formatNumber(selectedTotalSessions)} сессий`, color: "text-primary bg-primary/10" },
    { kind: "anomalies" as ReportExportKind, title: "Только аномалии", icon: AlertTriangle, description: "Сессии, отмеченные выбранным запуском как аномальные", rows: `${formatNumber(selectedAnomalies)} аномалий`, color: "text-destructive bg-destructive/10" },
    { kind: "students" as ReportExportKind, title: "Студенты с аномалиями", icon: Users, description: "Агрегация студентов по аномальным сессиям", rows: `по ${formatNumber(selectedAnomalies)} аномальным сессиям`, color: "text-warning bg-warning/10" },
  ], [selectedAnomalies, selectedTotalSessions]);
  const clusterOptions = useMemo(() => {
    const clusters = (((selectedRun?.results as AnyRecord | undefined)?.clusters as AnyRecord[] | undefined) ?? [])
      .map((cluster, index) => {
        const id = Number(cluster.clusterId ?? index);
        return { value: String(id), content: clusterLabel(id) };
      });
    return [{ value: "all", content: "Все кластеры" }, ...clusters];
  }, [selectedRun]);
  const runOptions = useMemo(() => runs.map((run) => ({
    value: run.id,
    content: `${run.startedAt} · ${run.algorithm} · ${runStatusLabels[run.status].label} · ${formatNumber(run.clusters)} кл. · ${formatNumber(run.anomalies)} аном. · ${run.id.slice(-8)}`,
  })), [runs]);
  const selectedReport = reportKindOptions.find((option) => option.value === reportKind)?.content ?? "Отчет";
  const selectedClusterLabel = clusterOptions.find((option) => option.value === clusterId)?.content ?? "Все кластеры";
  const activeFilters = [
    reportDateFrom ? `с ${reportDateFrom}` : undefined,
    reportDateTo ? `по ${reportDateTo}` : undefined,
    clusterId !== "all" ? selectedClusterLabel : undefined,
    (onlyAnomalies || reportKind !== "sessions") ? "только аномалии" : undefined,
    includeRawMetrics ? "сырые метрики" : undefined,
    (includeStudents || reportKind !== "sessions") ? "данные студентов" : undefined,
  ].filter(Boolean);

  async function exportReport(format: ReportExportFormat) {
    setExportingFormat(format);
    setExportError("");
    try {
      await download({
        kind: reportKind,
        format,
        runId,
        dateFrom: reportDateFrom,
        dateTo: reportDateTo,
        clusterId,
        onlyAnomalies: onlyAnomalies || reportKind !== "sessions",
        includeRawMetrics,
        includeStudents: includeStudents || reportKind !== "sessions",
      });
    } catch {
      setExportError("Не удалось сформировать отчет. Проверьте выбранный запуск и параметры фильтра.");
    } finally {
      setExportingFormat(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-5 h-5 text-primary" />
            <h1 className="text-[22px]" style={{ fontWeight: 600 }}>Экспорт аналитических отчётов</h1>
          </div>
          <p className="text-muted-foreground text-[14px]">Выберите запуск кластеризации, настройте состав отчета и скачайте JSON или CSV</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-[15px]" style={{ fontWeight: 600 }}>1. Выбранный запуск</h3>
            <p className="text-[12px] text-muted-foreground mt-1">Все счетчики и доступные кластеры ниже относятся к этому запуску.</p>
          </div>
          <Button view="outlined" className="text-[13px] h-9" onClick={() => navigate("/cluster-history")}>
            <span className="flex items-center gap-1.5"><History className="w-3.5 h-3.5" />Полная история</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-5 space-y-1.5">
            <label className="text-[13px] text-muted-foreground">Запуск кластеризации</label>
            <Select
              value={runId ? [runId] : []}
              onUpdate={(value) => setSelectedRunId(value[0] ?? "")}
              options={runOptions}
              placeholder="Выберите запуск"
              size="m"
            />
            {selectedHistoryRun && (
              <div className="text-[12px] text-muted-foreground font-mono pt-1">ID: {selectedHistoryRun.id}</div>
            )}
          </div>

          <div className="xl:col-span-7 grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Сессий", value: formatNumber(selectedTotalSessions), icon: Database },
              { label: "Кластеров", value: formatNumber(selectedClusters), icon: Layers },
              { label: "Аномалий", value: formatNumber(selectedAnomalies), icon: AlertTriangle },
              { label: "Доля", value: percent(selectedAnomalyRate), icon: BarChart3 },
              { label: "Статус", value: selectedStatusLabel.label, icon: CheckCircle2 },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border p-3 min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </div>
                <div className="text-[16px] truncate" style={{ fontWeight: 600 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {selectedHistoryRun && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[13px]">
            <div className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="w-4 h-4" />Начало: <span className="text-foreground">{selectedHistoryRun.startedAt}</span></div>
            <div className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="w-4 h-4" />Конец: <span className="text-foreground">{selectedHistoryRun.finishedAt}</span></div>
            <div className="flex items-center gap-2 text-muted-foreground"><Layers className="w-4 h-4" />Алгоритм: <span className="text-foreground">{selectedHistoryRun.algorithm}</span></div>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-[15px] mb-3" style={{ fontWeight: 600 }}>2. Тип отчета</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reportCards.map((card) => (
          <button
            key={card.kind}
            type="button"
            onClick={() => setReportKind(card.kind)}
            className={`bg-card rounded-xl border-2 p-5 space-y-4 flex flex-col text-left transition-colors ${reportKind === card.kind ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"}`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}><card.icon className="w-5 h-5" /></div>
              <div className="flex-1"><h4 className="text-[14px]" style={{ fontWeight: 600 }}>{card.title}</h4><p className="text-[12px] text-muted-foreground mt-1">{card.description}</p></div>
              {reportKind === card.kind && <CheckCircle2 className="w-4 h-4 text-primary" />}
            </div>
            <div className="text-[13px] text-muted-foreground">{card.rows}</div>
          </button>
        ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-card rounded-xl border border-border p-5 space-y-5">
          <div>
            <h3 className="text-[15px]" style={{ fontWeight: 600 }}>3. Параметры экспорта</h3>
            <p className="text-[12px] text-muted-foreground mt-1">JSON содержит структурированные данные и метаданные. CSV удобен для таблиц и Excel.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Тип данных">
              <Select value={[reportKind]} onUpdate={(value) => setReportKind((value[0] ?? "sessions") as ReportExportKind)} options={reportKindOptions} size="m" />
            </Field>
            <Field label="Кластер">
              <Select value={[clusterId]} onUpdate={(value) => setClusterId(value[0] ?? "all")} options={clusterOptions} size="m" />
            </Field>
            <Field label="Дата с">
              <TextInput placeholder="Например: 2026-03-01T00:00:00.000Z" value={reportDateFrom} onUpdate={setReportDateFrom} size="m" />
            </Field>
            <Field label="Дата по">
              <TextInput placeholder="Например: 2026-03-31T23:59:59.999Z" value={reportDateTo} onUpdate={setReportDateTo} size="m" />
            </Field>
          </div>

          <div className="border-t border-border pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px]">Только аномалии</div>
                <div className="text-[11px] text-muted-foreground">Для аномалий и студентов включено автоматически</div>
              </div>
              <Switch checked={onlyAnomalies || reportKind !== "sessions"} onUpdate={setOnlyAnomalies} disabled={reportKind !== "sessions"} size="m" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px]">Сырые метрики</div>
                <div className="text-[11px] text-muted-foreground">Добавить поле `metrics`</div>
              </div>
              <Switch checked={includeRawMetrics} onUpdate={setIncludeRawMetrics} size="m" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px]">Данные студентов</div>
                <div className="text-[11px] text-muted-foreground">ФИО, группа, email</div>
              </div>
              <Switch checked={includeStudents || reportKind !== "sessions"} onUpdate={setIncludeStudents} disabled={reportKind !== "sessions"} size="m" />
            </div>
          </div>

          {exportError && <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-[13px] text-destructive">{exportError}</div>}
        </div>

        <div className="lg:col-span-4">
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-[15px]" style={{ fontWeight: 600 }}>Что будет экспортировано</h3>
            <div className="space-y-3 text-[13px]">
              {[
                { label: "Запуск", value: selectedHistoryRun ? `${selectedHistoryRun.startedAt} · ${selectedHistoryRun.algorithm}` : "Не выбран" },
                { label: "Отчет", value: selectedReport },
                { label: "Строк в запуске", value: reportKind === "anomalies" || reportKind === "students" ? formatNumber(selectedAnomalies) : formatNumber(selectedTotalSessions) },
                { label: "Кластер", value: selectedClusterLabel },
              ].map((item) => (
                <div key={item.label} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="text-right" style={{ fontWeight: 500 }}>{item.value}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {activeFilters.length === 0 ? (
                <span className="text-[12px] text-muted-foreground">Дополнительные фильтры не заданы</span>
              ) : activeFilters.map((filter) => (
                <span key={filter} className="px-2.5 py-1 bg-muted rounded-md text-[12px] text-muted-foreground">{filter}</span>
              ))}
            </div>
            <div className="space-y-2">
              <Button view="action" width="max" className="h-10" onClick={() => void exportReport("json")} loading={exportingFormat === "json"} disabled={!runId}>
                <span className="flex items-center gap-1.5"><Download className="w-4 h-4" />Скачать JSON</span>
              </Button>
              <Button view="outlined" width="max" className="h-10" onClick={() => void exportReport("csv")} loading={exportingFormat === "csv"} disabled={!runId}>
                <span className="flex items-center gap-1.5"><Download className="w-4 h-4" />Скачать CSV</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
