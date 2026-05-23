import { useMemo } from "react";
import { FileText, AlertTriangle, Users, Download } from "lucide-react";
import { Button, Label } from "@gravity-ui/uikit";
import { useStudentsSummary, useSessionsSummary } from "../entities/summary/model/hooks";
import { useClusteringRuns } from "../entities/clustering/model/hooks";
import { useReportExport, type ReportExportKind } from "../features/export-report/model/useReportExport";
import { formatNumber } from "../shared/lib/format";

export function ReportsPage() {
  const sessions = useSessionsSummary();
  const students = useStudentsSummary();
  const { items: rawRuns, runs } = useClusteringRuns(1);
  const latestRawRun = rawRuns[0];
  const runId = String(latestRawRun?._id ?? "");
  const anomalies = Number((latestRawRun?.results as { anomalyCount?: number } | undefined)?.anomalyCount ?? 0);
  const { download } = useReportExport(runId);

  const exportCards = useMemo(() => [
    { kind: "sessions" as ReportExportKind, title: "Все сессии", icon: FileText, description: "JSON-экспорт всех экзаменационных сессий из MongoDB", rows: `${formatNumber(sessions.total)} сессий`, color: "text-primary bg-primary/10", action: "Экспорт JSON" },
    { kind: "anomalies" as ReportExportKind, title: "Только аномалии", icon: AlertTriangle, description: "CSV-экспорт сессий с аномальным поведением", rows: `${formatNumber(anomalies)} сессий`, color: "text-destructive bg-destructive/10" },
    { kind: "students" as ReportExportKind, title: "Студенты", icon: Users, description: "JSON-экспорт всех студентов из MongoDB", rows: `${formatNumber(students.total)} студентов`, color: "text-warning bg-warning/10", action: "Экспорт JSON" },
  ], [anomalies, sessions.total, students.total]);

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
          <h3 className="text-[15px] mb-4" style={{ fontWeight: 600 }}>Последний запуск кластеризации из БД</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className="border-b border-border text-muted-foreground text-left"><th className="pb-3 pr-4" style={{ fontWeight: 500 }}>ID запуска</th><th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Дата</th><th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Аномалий</th><th className="pb-3" style={{ fontWeight: 500 }}>Статус</th></tr></thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">В БД пока нет запусков кластеризации для экспорта аномалий.</td></tr>
                ) : runs.map((run) => (
                  <tr key={run.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-4"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" /><span className="text-[12px] font-mono" style={{ fontWeight: 500 }}>{run.id}</span></div></td>
                    <td className="py-3 pr-4 text-muted-foreground text-[12px] font-mono">{run.startedAt}</td>
                    <td className="py-3 pr-4 text-muted-foreground text-[12px]">{formatNumber(run.anomalies)}</td>
                    <td className="py-3"><Label theme={run.status === "success" ? "success" : run.status === "running" ? "info" : "danger"}>{run.status}</Label></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </div>
    </div>
  );
}
