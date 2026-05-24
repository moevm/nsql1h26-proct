import {
  Clock,
  AlertTriangle,
  Database,
} from "lucide-react";
import { Label } from "@gravity-ui/uikit";
import { useLatestUpload, useUploadLog } from "../entities/upload/model/hooks";
import { useSessionsSummary, useStudentsSummary } from "../entities/summary/model/hooks";
import { useClusteringRuns } from "../entities/clustering/model/hooks";
import { formatNumber } from "../shared/lib/format";

export function ProcessingPage() {
  const { upload, batch, loading } = useLatestUpload();
  const { logEntries } = useUploadLog(String(upload?._id ?? ""));
  const sessions = useSessionsSummary();
  const students = useStudentsSummary();
  const { runs } = useClusteringRuns(1);
  const latestRun = runs[0];

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

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px]" style={{ fontWeight: 600 }}>Журнал обработки</h3>
          </div>
          <div className="space-y-0.5 max-h-[300px] overflow-auto">
            {logEntries.length === 0 ? (
              <div className="px-3 py-8 text-center text-[13px] text-muted-foreground">Журнал последней загрузки пока пуст</div>
            ) : logEntries.map((entry) => (
              <div key={entry.id} className={`flex gap-3 px-3 py-2 rounded text-[13px] ${entry.level === "warn" ? "bg-warning/5" : ""}`}>
                <span className="text-muted-foreground font-mono text-[12px] min-w-[65px]">{entry.time}</span>
                <span className={entry.level === "warn" ? "text-warning" : entry.level === "error" ? "text-destructive" : "text-foreground"}>
                  {entry.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
