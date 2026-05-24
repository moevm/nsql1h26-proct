import { type MouseEvent, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Search, Filter, RefreshCw, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, AlertTriangle, Trash2 } from "lucide-react";
import { Button, TextInput, Select, Switch, Label } from "@gravity-ui/uikit";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { SessionDrawer } from "../widgets/session-drawer/SessionDrawer";
import { api, downloadApiFile } from "../shared/api/client";
import type { AnyRecord } from "../entities/types";
import { useClusteringResult, useClusteringRuns } from "../entities/clustering/model/hooks";
import type { ResultSessionRow } from "../entities/clustering/model/types";
import { clusterColors } from "../shared/config/ui";
import { getNested } from "../shared/lib/object";

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-[12px] space-y-1">
        <div style={{ fontWeight: 500 }}>{d.student}</div>
        <div className="text-muted-foreground">Кластер: {d.cluster}</div>
        <div className="text-muted-foreground">Аномалия: {d.anomaly ? "Да" : "Нет"}</div>
      </div>
    );
  }
  return null;
};

function buildZoomDomain(min: number, max: number, zoom: number): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [-1, 1];
  if (min === max) return [min - 1, max + 1];
  const center = (min + max) / 2;
  const halfRange = (max - min) / 2 / zoom;
  return [center - halfRange, center + halfRange];
}

function clusterLabel(clusterId: unknown) {
  const value = Number(clusterId);
  if (!Number.isFinite(value)) return "—";
  return value < 0 ? "noise" : `C${value + 1}`;
}

function getClusterColor(cluster: string) {
  return clusterColors[cluster] ?? (cluster === "noise" ? clusterColors.anomaly : "#6b7280");
}

type ChartPoint = { x: number; y: number };
type ChartDomain = { x: [number, number]; y: [number, number] };

function pointFromMouse(event: MouseEvent<HTMLDivElement>): ChartPoint {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.min(Math.max(event.clientX - rect.left, 0), rect.width),
    y: Math.min(Math.max(event.clientY - rect.top, 0), rect.height),
  };
}

function domainFromDrag(start: ChartPoint, end: ChartPoint, width: number, height: number, xDomain: [number, number], yDomain: [number, number]): ChartDomain {
  const left = Math.min(start.x, end.x) / width;
  const right = Math.max(start.x, end.x) / width;
  const top = Math.min(start.y, end.y) / height;
  const bottom = Math.max(start.y, end.y) / height;
  return {
    x: [xDomain[0] + (xDomain[1] - xDomain[0]) * left, xDomain[0] + (xDomain[1] - xDomain[0]) * right],
    y: [yDomain[1] - (yDomain[1] - yDomain[0]) * bottom, yDomain[1] - (yDomain[1] - yDomain[0]) * top],
  };
}

export function ResultsPage() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const { runs: latestRuns } = useClusteringRuns(1);
  const actualRunId = runId ?? latestRuns[0]?.id;
  const { result } = useClusteringResult(actualRunId);
  const run = (result?.run ?? result) as AnyRecord | undefined;
  const resultSessions = (result?.sessions ?? []) as AnyRecord[];
  const resultStudents = (result?.students ?? []) as AnyRecord[];
  const [selectedSession, setSelectedSession] = useState<ResultSessionRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chartType, setChartType] = useState<"scatter" | "density">("scatter");
  const [highlightAnomalies, setHighlightAnomalies] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [clusterFilter, setClusterFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [manualDomain, setManualDomain] = useState<ChartDomain | null>(null);
  const [dragStart, setDragStart] = useState<ChartPoint | null>(null);
  const [dragEnd, setDragEnd] = useState<ChartPoint | null>(null);
  const [activeTab, setActiveTab] = useState<"sessions" | "clusters">("sessions");

  const assignments = useMemo(() => (getNested(run, "results.sessionAssignments") as AnyRecord[] | undefined) ?? [], [run]);
  const clusters = useMemo(() => (getNested(run, "results.clusters") as AnyRecord[] | undefined) ?? [], [run]);
  const studentsById = useMemo(() => new Map(resultStudents.map((student) => [String(student._id), student])), [resultStudents]);
  const sessionsById = useMemo(() => new Map(resultSessions.map((session) => [String(session._id), session])), [resultSessions]);

  const sessionRows: ResultSessionRow[] = assignments.map((assignment, index) => {
    const session = sessionsById.get(String(assignment.sessionId));
    const student = studentsById.get(String(session?.studentId ?? ""));
    const distanceToCentroid = Number(assignment.distanceToCentroid);
    return {
      id: String(assignment.sessionId ?? index),
      student: String(student?.fullName ?? session?.studentId ?? assignment.sessionId ?? "—"),
      date: session?.startTime ? new Date(String(session.startTime)).toLocaleString("ru-RU") : "—",
      cluster: clusterLabel(assignment.clusterId),
      anomaly: Boolean(assignment.isAnomaly),
      distanceToCentroid: Number.isFinite(distanceToCentroid) ? distanceToCentroid : undefined,
      metrics: (session?.metrics ?? {}) as Record<string, unknown>,
    };
  });

  const filteredSessions = sessionRows.filter((s) => {
    if (searchQuery && !s.student.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (clusterFilter !== "all" && s.cluster !== clusterFilter) return false;
    if (statusFilter === "anomaly" && !s.anomaly) return false;
    if (statusFilter === "normal" && s.anomaly) return false;
    return true;
  });
  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedSessions = filteredSessions.slice((safePage - 1) * pageSize, safePage * pageSize);

  const scatterData = assignments.flatMap((assignment, index) => {
    const row = sessionRows[index] ?? sessionRows[0];
    const coords = (assignment.reducedCoords ?? {}) as AnyRecord;
    const x = Number(coords.x);
    const y = Number(coords.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    return [{
      x,
      y,
      cluster: row?.cluster ?? "C1",
      student: row?.student ?? String(assignment.sessionId ?? "—"),
      anomaly: Boolean(assignment.isAnomaly),
    }];
  });
  const xValues = scatterData.map((point) => point.x);
  const yValues = scatterData.map((point) => point.y);
  const autoXDomain = buildZoomDomain(Math.min(...xValues), Math.max(...xValues), zoomLevel);
  const autoYDomain = buildZoomDomain(Math.min(...yValues), Math.max(...yValues), zoomLevel);
  const xDomain = manualDomain?.x ?? autoXDomain;
  const yDomain = manualDomain?.y ?? autoYDomain;
  const visibleScatterData = scatterData.filter((point) => point.x >= xDomain[0] && point.x <= xDomain[1] && point.y >= yDomain[0] && point.y <= yDomain[1]);
  const selectionBox = dragStart && dragEnd ? {
    left: Math.min(dragStart.x, dragEnd.x),
    top: Math.min(dragStart.y, dragEnd.y),
    width: Math.abs(dragStart.x - dragEnd.x),
    height: Math.abs(dragStart.y - dragEnd.y),
  } : null;
  const densityRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of sessionRows) counts.set(session.cluster, (counts.get(session.cluster) ?? 0) + 1);
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([cluster, count]) => ({ cluster, count }));
  }, [sessionRows]);
  const dynamicClusterOptions = useMemo(() => [
    { value: "all", content: "Все" },
    ...densityRows.map((row) => ({ value: row.cluster, content: row.cluster })),
  ], [densityRows]);
  const maxDensity = Math.max(1, ...densityRows.map((row) => row.count));

  const kpis = [
    { label: "Всего сессий", value: String(getNested(run, "results.totalSessions") ?? resultSessions.length) },
    { label: "Найдено кластеров", value: String(getNested(run, "results.clusterCount") ?? clusters.length) },
    { label: "Обнаружено аномалий", value: String(getNested(run, "results.anomalyCount") ?? 0) },
    { label: "Доля аномалий", value: `${Number((Number(getNested(run, "results.anomalyRate") ?? 0) * 100).toFixed(1))}%` },
    { label: "Ср. уверенность", value: String(getNested(run, "results.silhouetteScore") ?? "—") },
  ];

  const handleRowClick = (session: ResultSessionRow) => {
    setSelectedSession(session);
    setDrawerOpen(true);
  };
  const deleteCurrentRun = async () => {
    if (!actualRunId || !window.confirm("Удалить этот результат кластеризации?")) return;
    await api(`/clustering-runs/${actualRunId}`, { method: "DELETE" });
    navigate("/cluster-history");
  };

  const finishAreaZoom = (event: MouseEvent<HTMLDivElement>) => {
    if (!dragStart || !dragEnd) {
      setDragStart(null);
      setDragEnd(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    if (Math.abs(dragStart.x - dragEnd.x) > 20 && Math.abs(dragStart.y - dragEnd.y) > 20) {
      setManualDomain(domainFromDrag(dragStart, dragEnd, rect.width, rect.height, xDomain, yDomain));
      setZoomLevel(1);
    }
    setDragStart(null);
    setDragEnd(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[22px]" style={{ fontWeight: 600 }}>Кластеры сессий</h1>
          <p className="text-muted-foreground text-[14px] mt-1">Обнаружение необычных паттернов поведения в экзаменационных сессиях</p>
        </div>
        <div className="flex items-center gap-3">
          <Button view="outlined" className="text-[13px] h-9" onClick={() => navigate("/clustering")}><span className="flex flex-row items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" />Перезапустить кластеризацию</span></Button>
          <Button view="action" className="text-[13px] h-9" onClick={() => void downloadApiFile(`/reports/anomalies.csv${run?._id ? `?runId=${run._id}` : ""}`, "anomalies.csv")}>
            <span className="flex flex-row items-center gap-1.5"><Download className="w-3.5 h-3.5" />Экспортировать результаты</span>
          </Button>
          <Button view="outlined" className="text-[13px] h-9 text-destructive" onClick={() => void deleteCurrentRun()} disabled={!actualRunId}>
            <span className="flex flex-row items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" />Удалить</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-card rounded-xl border border-border p-4">
            <div className="text-[12px] text-muted-foreground mb-1">{k.label}</div>
            <div className="text-[24px]" style={{ fontWeight: 600 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-card rounded-xl border border-border p-5">
          <div className="flex bg-muted rounded-lg p-0.5 mb-4 w-fit">
            <button onClick={() => setActiveTab("sessions")} className={`px-4 py-1.5 rounded-md text-[13px] transition-colors ${activeTab === "sessions" ? "bg-card shadow-sm" : "text-muted-foreground"}`} style={{ fontWeight: activeTab === "sessions" ? 600 : 400 }}>Сессии</button>
            <button onClick={() => setActiveTab("clusters")} className={`px-4 py-1.5 rounded-md text-[13px] transition-colors ${activeTab === "clusters" ? "bg-card shadow-sm" : "text-muted-foreground"}`} style={{ fontWeight: activeTab === "clusters" ? 600 : 400 }}>Кластеры</button>
          </div>

          {activeTab === "sessions" ? (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="relative flex-1 min-w-[140px]"><TextInput placeholder="Поиск по студенту" size="s" value={searchQuery} onUpdate={(v) => { setSearchQuery(v); setPage(1); }} startContent={<Search className="w-3.5 h-3.5 text-muted-foreground" />} /></div>
                <Select value={[clusterFilter]} onUpdate={(vals) => { setClusterFilter(vals[0]); setPage(1); }} options={dynamicClusterOptions} placeholder="Кластер" size="s" />
                <Select value={[statusFilter]} onUpdate={(vals) => { setStatusFilter(vals[0]); setPage(1); }} options={[{ value: "all", content: "Все" }, { value: "anomaly", content: "Аномалия" }, { value: "normal", content: "Норма" }]} placeholder="Статус" size="s" />
                <Button view="outlined" size="s" className="h-8 w-8 p-0"><Filter className="w-3.5 h-3.5" /></Button>
              </div>
              <div className="max-h-[430px] overflow-auto pr-1">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 bg-card z-10"><tr className="border-b border-border text-muted-foreground text-left"><th className="pb-2 pr-3" style={{ fontWeight: 500 }}>Студент</th><th className="pb-2 pr-3" style={{ fontWeight: 500 }}>Дата</th><th className="pb-2 pr-3" style={{ fontWeight: 500 }}>Кластер</th><th className="pb-2 pr-3" style={{ fontWeight: 500 }}>Аномалия</th><th className="pb-2" style={{ fontWeight: 500 }}>Расст.</th></tr></thead>
                  <tbody>
                    {paginatedSessions.map((s) => (
                      <tr key={s.id} onClick={() => handleRowClick(s)} className={`border-b border-border/50 cursor-pointer transition-colors ${selectedSession?.id === s.id ? "bg-primary/5" : "hover:bg-muted/50"}`}>
                        <td className="py-2.5 pr-3" style={{ fontWeight: 500 }}>{s.student}</td>
                        <td className="py-2.5 pr-3 text-muted-foreground font-mono text-[11px]">{s.date}</td>
                        <td className="py-2.5 pr-3"><span className="px-2 py-0.5 rounded text-[11px] text-white" style={{ fontWeight: 500, backgroundColor: getClusterColor(s.cluster) }}>{s.cluster}</span></td>
                        <td className="py-2.5 pr-3">{s.anomaly ? <Label theme="danger" icon={<AlertTriangle className="w-3 h-3" />}>Да</Label> : <span className="text-muted-foreground">Нет</span>}</td>
                        <td className="py-2.5"><span style={{ fontWeight: 500 }}>{typeof s.distanceToCentroid === "number" ? s.distanceToCentroid.toFixed(2) : "—"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-4 text-[12px] text-muted-foreground">
                <span>Показано {paginatedSessions.length} из {filteredSessions.length}</span>
                <div className="flex items-center gap-1">
                  <Button view="flat" size="s" className="h-7 w-7 p-0" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}><ChevronLeft className="w-3.5 h-3.5" /></Button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1).map((p) => <Button key={p} view={safePage === p ? "action" : "flat"} size="s" className="h-7 w-7 p-0 text-[12px]" onClick={() => setPage(p)}>{p}</Button>)}
                  {totalPages > 5 && <span>...</span>}
                  <Button view="flat" size="s" className="h-7 w-7 p-0" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}><ChevronRight className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </>
          ) : (
            <div className="max-h-[430px] overflow-auto pr-1">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-card z-10"><tr className="border-b border-border text-muted-foreground text-left"><th className="pb-2 pr-3" style={{ fontWeight: 500 }}>Кластер</th><th className="pb-2 pr-3" style={{ fontWeight: 500 }}>Размер</th><th className="pb-2 pr-3" style={{ fontWeight: 500 }}>Центроид</th><th className="pb-2" style={{ fontWeight: 500 }}>Аномалии</th></tr></thead>
                <tbody>
                  {clusters.map((c, index) => {
                    const id = clusterLabel(c.clusterId ?? index);
                    return (
                      <tr key={id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                        <td className="py-2.5 pr-3"><span className="px-2 py-0.5 rounded text-[11px] text-white" style={{ fontWeight: 500, backgroundColor: getClusterColor(id) }}>{id}</span></td>
                        <td className="py-2.5 pr-3" style={{ fontWeight: 500 }}>{String(c.size ?? 0)}</td>
                        <td className="py-2.5 pr-3 text-muted-foreground">{Array.isArray(c.centroid) ? c.centroid.slice(0, 3).join(", ") : "—"}</td>
                        <td className="py-2.5"><span className={Number(c.anomalyRate ?? 0) > 0.05 ? "text-destructive" : "text-success"} style={{ fontWeight: 500 }}>{Number(Number(c.anomalyRate ?? 0) * 100).toFixed(1)}%</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-[11px] text-muted-foreground mt-3">Показаны средние значения метрик по каждому кластеру. Всего сессий: {assignments.length}.</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-7 bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-[15px]" style={{ fontWeight: 600 }}>Визуализация кластеров</h3>
            <div className="flex items-center gap-3">
              <div className="flex bg-muted rounded-lg p-0.5">
                <button onClick={() => setChartType("scatter")} className={`px-3 py-1 rounded-md text-[12px] transition-colors ${chartType === "scatter" ? "bg-card shadow-sm" : "text-muted-foreground"}`} style={{ fontWeight: chartType === "scatter" ? 500 : 400 }}>2D Разброс</button>
                <button onClick={() => setChartType("density")} className={`px-3 py-1 rounded-md text-[12px] transition-colors ${chartType === "density" ? "bg-card shadow-sm" : "text-muted-foreground"}`} style={{ fontWeight: chartType === "density" ? 500 : 400 }}>Плотность</button>
              </div>
              <div className="flex items-center gap-1.5"><Switch checked={highlightAnomalies} onUpdate={setHighlightAnomalies} size="m" /><span className="text-[12px] text-muted-foreground">Аномалии</span></div>
              <div className="flex gap-1">
                <Button view="flat" size="s" className="h-7 w-7 p-0" onClick={() => { setManualDomain(null); setZoomLevel((value) => Math.min(value * 1.8, 12)); }}><ZoomIn className="w-3.5 h-3.5" /></Button>
                <Button view="flat" size="s" className="h-7 w-7 p-0" onClick={() => { if (manualDomain) setManualDomain(null); else setZoomLevel((value) => Math.max(value / 1.8, 1)); }}><ZoomOut className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mb-4">
            {densityRows.map((row) => <div key={row.cluster} className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getClusterColor(row.cluster) }} /><span className="text-[11px] text-muted-foreground">{row.cluster}</span></div>)}
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full border-2 border-destructive bg-destructive/20" /><span className="text-[11px] text-muted-foreground">Аномалия</span></div>
          </div>
          <div
            className="h-[360px] relative select-none"
            onMouseDown={(event) => {
              if (chartType !== "scatter") return;
              const point = pointFromMouse(event);
              setDragStart(point);
              setDragEnd(point);
            }}
            onMouseMove={(event) => {
              if (!dragStart || chartType !== "scatter") return;
              setDragEnd(pointFromMouse(event));
            }}
            onMouseUp={finishAreaZoom}
            onMouseLeave={() => {
              setDragStart(null);
              setDragEnd(null);
            }}
          >
            {chartType === "scatter" ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="x" type="number" domain={xDomain} allowDataOverflow tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} label={{ value: `Признак 1 · ${zoomLevel.toFixed(1)}x · ${visibleScatterData.length}/${scatterData.length}`, position: "bottom", offset: 5, fontSize: 11, fill: "#9ca3af" }} />
                  <YAxis dataKey="y" type="number" domain={yDomain} allowDataOverflow tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} label={{ value: "Признак 2", angle: -90, position: "insideLeft", offset: 5, fontSize: 11, fill: "#9ca3af" }} />
                  <Tooltip content={<CustomTooltip />} cursor={false} wrapperStyle={{ pointerEvents: "none" }} isAnimationActive={false} />
                  <Scatter data={visibleScatterData} fill="#8884d8">
                    {visibleScatterData.map((entry, i) => <Cell key={i} fill={highlightAnomalies && entry.anomaly ? clusterColors.anomaly : getClusterColor(entry.cluster)} stroke={highlightAnomalies && entry.anomaly ? "#ef4444" : "transparent"} strokeWidth={highlightAnomalies && entry.anomaly ? 3 : 0} r={highlightAnomalies && entry.anomaly ? 7 : 5} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col justify-center gap-4 px-4">
                {densityRows.map((row) => (
                  <div key={row.cluster} className="space-y-1">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getClusterColor(row.cluster) }} />{row.cluster}</span>
                      <span className="text-muted-foreground">{row.count} сессий</span>
                    </div>
                    <div className="h-5 rounded bg-muted overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${(row.count / maxDensity) * 100}%`, backgroundColor: getClusterColor(row.cluster) }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectionBox && selectionBox.width > 4 && selectionBox.height > 4 && (
              <div
                className="absolute border border-primary bg-primary/10 pointer-events-none rounded"
                style={{ left: selectionBox.left, top: selectionBox.top, width: selectionBox.width, height: selectionBox.height }}
              />
            )}
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-2">Точки — сессии в 2D пространстве признаков. Выделите область мышью, чтобы приблизить выбранный участок.</p>
        </div>
      </div>

      <SessionDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} session={selectedSession} />
    </div>
  );
}
