import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, AlertTriangle, Users, Download, Filter, Search, X, BarChart3 } from "lucide-react";
import { Button, Label, Select, TextInput } from "@gravity-ui/uikit";
import { useStudentsSummary, useSessionsSummary } from "../entities/summary/model/hooks";
import { useClusteringRuns } from "../entities/clustering/model/hooks";
import { useReportExport, type ReportExportKind } from "../features/export-report/model/useReportExport";
import { formatNumber } from "../shared/lib/format";
import { dateFilterValue, matchesDateRange, matchesNumberRange, matchesText } from "../shared/lib/clientFilters";
import { DateTimeIsoInput } from "../shared/ui/DateTimeIsoInput";

export function ReportsPage() {
  const navigate = useNavigate();
  const sessions = useSessionsSummary();
  const students = useStudentsSummary();
  const { items: rawRuns, runs } = useClusteringRuns(50);
  const latestRawRun = rawRuns[0];
  const runId = String(latestRawRun?._id ?? "");
  const anomalies = Number((latestRawRun?.results as { anomalyCount?: number } | undefined)?.anomalyCount ?? 0);
  const { download } = useReportExport(runId);
  const [runIdFilter, setRunIdFilter] = useState("");
  const [startedFrom, setStartedFrom] = useState("");
  const [startedTo, setStartedTo] = useState("");
  const [anomaliesMin, setAnomaliesMin] = useState("");
  const [anomaliesMax, setAnomaliesMax] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const exportCards = useMemo(() => [
    { kind: "sessions" as ReportExportKind, title: "Все сессии", icon: FileText, description: "JSON-экспорт всех экзаменационных сессий из MongoDB", rows: `${formatNumber(sessions.total)} сессий`, color: "text-primary bg-primary/10", action: "Экспорт JSON" },
    { kind: "anomalies" as ReportExportKind, title: "Только аномалии", icon: AlertTriangle, description: "CSV-экспорт сессий с аномальным поведением", rows: `${formatNumber(anomalies)} сессий`, color: "text-destructive bg-destructive/10" },
    { kind: "students" as ReportExportKind, title: "Студенты", icon: Users, description: "JSON-экспорт всех студентов из MongoDB", rows: `${formatNumber(students.total)} студентов`, color: "text-warning bg-warning/10", action: "Экспорт JSON" },
  ], [anomalies, sessions.total, students.total]);
  const startedFromTime = dateFilterValue(startedFrom);
  const startedToTime = dateFilterValue(startedTo);
  const hasRunFilters = runIdFilter || startedFrom || startedTo || anomaliesMin || anomaliesMax || statusFilter !== "all";
  const filteredRuns = runs.filter((run) => {
    if (!matchesText(run.id, runIdFilter)) return false;
    if (!matchesDateRange(run.startedAtRaw, startedFromTime, startedToTime)) return false;
    if (!matchesNumberRange(run.anomalies, anomaliesMin, anomaliesMax)) return false;
    if (statusFilter !== "all" && run.status !== statusFilter) return false;
    return true;
  });

  function resetRunFilters() {
    setRunIdFilter("");
    setStartedFrom("");
    setStartedTo("");
    setAnomaliesMin("");
    setAnomaliesMax("");
    setStatusFilter("all");
  }

  function openRunDetails(runId: string) {
    if (!runId) return;
    navigate(`/clustering-runs/${runId}`);
  }

  function openRunResults(runId: string) {
    if (!runId) return;
    navigate(`/results/${runId}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px]" style={{ fontWeight: 600 }}>Экспорт аналитических отчётов</h1>
        <p className="text-muted-foreground text-[14px] mt-1">Скачайте сводки сессий и аномалий для аудита</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {exportCards.map((card) => (
          <div key={card.title} className="bg-card rounded-xl border border-border p-5 space-y-4 flex flex-col">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}><card.icon className="w-5 h-5" /></div>
              <div className="flex-1"><h3 className="text-[14px]" style={{ fontWeight: 600 }}>{card.title}</h3><p className="text-[12px] text-muted-foreground mt-1">{card.description}</p></div>
            </div>
            <div className="text-[13px] text-muted-foreground">{card.rows}</div>
            <Button view="action" className="text-[13px] h-9 mt-auto" width="max" onClick={() => void download(card.kind)}>
              <span className="flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />{card.action ?? "Экспорт CSV"}</span>
            </Button>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <div>
              <h3 className="text-[15px]" style={{ fontWeight: 600 }}>Запуски кластеризации из БД</h3>
              <p className="text-[12px] text-muted-foreground mt-1">Клик по строке открывает просмотр и редактирование отчёта; результаты доступны отдельной кнопкой</p>
            </div>
            <span className="text-[13px] text-muted-foreground">
              Найдено запусков: <span className="text-foreground" style={{ fontWeight: 500 }}>{filteredRuns.length}</span>
            </span>
          </div>

          <div className="bg-card rounded-xl border border-border p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-[13px]" style={{ fontWeight: 500 }}>Фильтр запусков</span>
              {hasRunFilters && (
                <button onClick={resetRunFilters} className="ml-auto flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                  Сбросить
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <TextInput placeholder="ID запуска" size="l" value={runIdFilter} onUpdate={setRunIdFilter} startContent={<Search className="w-3.5 h-3.5 text-muted-foreground" />} />
              <div className="grid grid-cols-2 gap-2 xl:col-span-2">
                <DateTimeIsoInput label="Дата от" value={startedFrom} onUpdate={setStartedFrom} />
                <DateTimeIsoInput label="Дата до" value={startedTo} onUpdate={setStartedTo} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className="w-full h-10" type="number" placeholder="Аномалий от" value={anomaliesMin} onChange={(event) => setAnomaliesMin(event.target.value)} />
                <input className="w-full h-10" type="number" placeholder="Аномалий до" value={anomaliesMax} onChange={(event) => setAnomaliesMax(event.target.value)} />
              </div>
              <Select
                value={[statusFilter]}
                onUpdate={(value) => setStatusFilter(value[0] ?? "all")}
                options={[
                  { value: "all", content: "Все статусы" },
                  { value: "success", content: "Завершено" },
                  { value: "running", content: "Выполняется" },
                  { value: "error", content: "Ошибка" },
                ]}
                size="m"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-border text-muted-foreground text-left"><th className="pb-3 pr-4" style={{ fontWeight: 500 }}>ID запуска</th><th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Дата</th><th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Аномалий</th><th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Статус</th><th className="pb-3" style={{ fontWeight: 500 }}>Действия</th></tr></thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">В БД пока нет запусков кластеризации для экспорта аномалий.</td></tr>
                ) : filteredRuns.length === 0 ? (
                  <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">По заданным условиям запусков не найдено.</td></tr>
                ) : filteredRuns.map((run) => (
                  <tr
                    key={run.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => openRunDetails(run.id)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      openRunDetails(run.id);
                    }}
                    tabIndex={0}
                    role="link"
                    title="Открыть отчёт запуска"
                    aria-label="Открыть отчёт запуска"
                  >
                    <td className="py-3 pr-4"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" /><span className="text-[12px] font-mono" style={{ fontWeight: 500 }}>{run.id}</span></div></td>
                    <td className="py-3 pr-4 text-muted-foreground text-[12px] font-mono">{run.startedAt}</td>
                    <td className="py-3 pr-4 text-muted-foreground text-[12px]">{formatNumber(run.anomalies)}</td>
                    <td className="py-3 pr-4"><Label theme={run.status === "success" ? "success" : run.status === "running" ? "info" : "danger"}>{run.status}</Label></td>
                    <td className="py-3">
                      <Button
                        view="outlined"
                        size="s"
                        className="text-[12px] h-7"
                        onClick={(event) => {
                          event.stopPropagation();
                          openRunResults(run.id);
                        }}
                      >
                        <span className="flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" />
                          Перейти к результатам
                        </span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </div>
    </div>
  );
}
