import { X, Download, ExternalLink, AlertTriangle } from "lucide-react";
import { Button, Label, Drawer } from "@gravity-ui/uikit";
import { useNavigate } from "react-router-dom";
import type { ResultSessionRow } from "../../entities/clustering/model/types";
import { mapSessionToDrawerMetrics } from "../../entities/clustering/model/adapters";
import { clusterColors } from "../../shared/config/ui";
import { saveTextFile } from "../../shared/lib/format";

interface SessionDrawerProps {
  open: boolean;
  onClose: () => void;
  session: ResultSessionRow | null;
}

export function SessionDrawer({ open, onClose, session }: SessionDrawerProps) {
  const navigate = useNavigate();
  if (!session) return null;

  const { moodleMetrics, cameraMetrics } = mapSessionToDrawerMetrics(session);
  const clusterColor = clusterColors[session.cluster] || (session.cluster === "noise" ? clusterColors.anomaly : "#6b7280");
  const exportSession = () => {
    const rows = [
      ["field", "value"],
      ["id", session.id],
      ["student", session.student],
      ["date", session.date],
      ["cluster", session.cluster],
      ["anomaly", session.anomaly ? "true" : "false"],
      ["confidence", typeof session.confidence === "number" ? session.confidence.toFixed(2) : ""],
      ["distanceToCentroid", typeof session.distanceToCentroid === "number" ? String(session.distanceToCentroid) : ""],
      ...moodleMetrics.map((metric) => [metric.label, metric.value]),
      ...cameraMetrics.map((metric) => [metric.label, metric.value]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\n")}`;
    saveTextFile(csv, `session_${session.id}.csv`, "text/csv;charset=utf-8");
  };

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} placement="right" size={460}>
      <div className="w-full h-full flex flex-col bg-card">
        <div className="p-5 pb-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[16px]" style={{ fontWeight: 600 }}>
              Детали сессии
            </span>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div>
            <div className="text-[15px]" style={{ fontWeight: 500 }}>{session.student}</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">{session.date}</div>
          </div>
          <div className="flex gap-2">
            <span
              className="px-2 py-0.5 rounded text-[11px] text-white"
              style={{ fontWeight: 500, backgroundColor: clusterColor }}
            >
              {session.cluster}
            </span>
            {session.anomaly && (
              <Label theme="danger" icon={<AlertTriangle className="w-3 h-3" />}>
                Аномалия
              </Label>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-[11px] text-muted-foreground mb-1">Кластер</div>
              <div className="text-[18px]" style={{ fontWeight: 600, color: clusterColor }}>
                {session.cluster}
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-[11px] text-muted-foreground mb-1">Уверенность</div>
              <div className="text-[18px]" style={{ fontWeight: 600 }}>{typeof session.confidence === "number" ? session.confidence.toFixed(2) : "—"}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-[11px] text-muted-foreground mb-1">Расстояние</div>
              <div className="text-[18px]" style={{ fontWeight: 600 }}>{typeof session.distanceToCentroid === "number" ? session.distanceToCentroid.toFixed(2) : "—"}</div>
            </div>
          </div>

          <div>
            <h4 className="text-[13px] text-muted-foreground mb-3" style={{ fontWeight: 500 }}>
              Метрики Moodle
            </h4>
            <div className="space-y-3">
              {moodleMetrics.map((m) => (
                <div key={m.label} className="flex justify-between text-[12px] border-b border-border/40 pb-2 last:border-0">
                    <span className="text-muted-foreground">{m.label}</span>
                    <span style={{ fontWeight: 500 }}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-[13px] text-muted-foreground mb-3" style={{ fontWeight: 500 }}>
              Метрики камеры
            </h4>
            <div className="space-y-3">
              {cameraMetrics.map((m) => (
                <div key={m.label} className="flex justify-between text-[12px] border-b border-border/40 pb-2 last:border-0">
                    <span className="text-muted-foreground">{m.label}</span>
                    <span style={{ fontWeight: 500 }}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 pt-4 border-t border-border flex gap-3">
          <Button view="outlined" className="flex-1 text-[13px] h-9" onClick={exportSession}>
            <span className="flex flex-row items-center justify-center gap-2">
              <Download className="w-3.5 h-3.5" />
              Экспорт сессии CSV
            </span>
          </Button>
          <Button view="action" className="flex-1 text-[13px] h-9" onClick={() => navigate(`/sessions?sessionId=${encodeURIComponent(session.id)}`)}>
            <span className="flex flex-row items-center justify-center gap-2">
              <ExternalLink className="w-3.5 h-3.5" />
              Открыть детали
            </span>
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
