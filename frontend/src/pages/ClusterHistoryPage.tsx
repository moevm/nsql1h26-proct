import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { History, Search, Filter, BarChart3, X, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button, TextInput, Select, Label } from "@gravity-ui/uikit";
import { useClusteringRuns } from "../entities/clustering/model/hooks";
import { runStatusLabels } from "../shared/config/ui";
import { isValidIsoDateTime } from "../shared/lib/dateTime";
import { DateTimeIsoInput } from "../shared/ui/DateTimeIsoInput";

type SortField = "id" | "startedAt" | "algorithm" | "status";

function matchesText(value: string, filter: string) {
  return !filter || value.toLowerCase().includes(filter.toLowerCase());
}

function numberFilterValue(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function matchesNumberRange(value: number, min: string, max: string) {
  const minValue = numberFilterValue(min);
  const maxValue = numberFilterValue(max);
  if (minValue !== undefined && value < minValue) return false;
  if (maxValue !== undefined && value > maxValue) return false;
  return true;
}

function dateFilterValue(value: string) {
  if (!value.trim() || !isValidIsoDateTime(value)) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? undefined : parsed;
}

function matchesDateRange(rawValue: string, from?: number, to?: number) {
  if (from === undefined && to === undefined) return true;
  const time = new Date(rawValue).getTime();
  if (Number.isNaN(time)) return false;
  if (from !== undefined && time < from) return false;
  if (to !== undefined && time > to) return false;
  return true;
}

export function ClusterHistoryPage() {
  const navigate = useNavigate();
  const { runs, deleteRun } = useClusteringRuns(50);
  const [idFilter, setIdFilter] = useState("");
  const [startedFrom, setStartedFrom] = useState("");
  const [startedTo, setStartedTo] = useState("");
  const [finishedFrom, setFinishedFrom] = useState("");
  const [finishedTo, setFinishedTo] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [durationMax, setDurationMax] = useState("");
  const [algoFilter, setAlgoFilter] = useState("all");
  const [clustersMin, setClustersMin] = useState("");
  const [clustersMax, setClustersMax] = useState("");
  const [anomaliesMin, setAnomaliesMin] = useState("");
  const [anomaliesMax, setAnomaliesMax] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subsetFilter, setSubsetFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("startedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  const hasFilters =
    idFilter ||
    startedFrom ||
    startedTo ||
    finishedFrom ||
    finishedTo ||
    durationMin ||
    durationMax ||
    algoFilter !== "all" ||
    clustersMin ||
    clustersMax ||
    anomaliesMin ||
    anomaliesMax ||
    statusFilter !== "all" ||
    subsetFilter;
  const resetFilters = () => {
    setIdFilter("");
    setStartedFrom("");
    setStartedTo("");
    setFinishedFrom("");
    setFinishedTo("");
    setDurationMin("");
    setDurationMax("");
    setAlgoFilter("all");
    setClustersMin("");
    setClustersMax("");
    setAnomaliesMin("");
    setAnomaliesMax("");
    setStatusFilter("all");
    setSubsetFilter("");
  };
  const startedFromTime = dateFilterValue(startedFrom);
  const startedToTime = dateFilterValue(startedTo);
  const finishedFromTime = dateFilterValue(finishedFrom);
  const finishedToTime = dateFilterValue(finishedTo);

  const filtered = runs
    .filter((r) => {
      if (!matchesText(r.id, idFilter)) return false;
      if (!matchesDateRange(r.startedAtRaw, startedFromTime, startedToTime)) return false;
      if (!matchesDateRange(r.finishedAtRaw, finishedFromTime, finishedToTime)) return false;
      if (!matchesNumberRange(r.durationSeconds, durationMin, durationMax)) return false;
      if (algoFilter !== "all" && r.algorithm !== algoFilter) return false;
      if (!matchesNumberRange(r.clusters, clustersMin, clustersMax)) return false;
      if (!matchesNumberRange(r.anomalies, anomaliesMin, anomaliesMax)) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!matchesText(r.subset, subsetFilter)) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "id") cmp = a.id.localeCompare(b.id);
      else if (sortField === "startedAt") cmp = a.startedAtRaw.localeCompare(b.startedAtRaw);
      else if (sortField === "algorithm") cmp = a.algorithm.localeCompare(b.algorithm);
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      return sortDir === "asc" ? cmp : -cmp;
    });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <History className="w-5 h-5 text-primary" />
            <h1 className="text-[22px]" style={{ fontWeight: 600 }}>История запусков кластеризации</h1>
          </div>
          <p className="text-muted-foreground text-[14px]">Все запуски кластеризации с параметрами, подмножеством данных и техническими сведениями</p>
        </div>
        <Button view="action" className="text-[13px] h-9" onClick={() => navigate("/clustering")}>Новый запуск</Button>
      </div>

      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-[13px]" style={{ fontWeight: 500 }}>Составной фильтр</span>
          {hasFilters && <button onClick={resetFilters} className="ml-auto flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"><X className="w-3 h-3" />Сбросить</button>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <TextInput placeholder="ID запуска" size="l" value={idFilter} onUpdate={setIdFilter} startContent={<Search className="w-3.5 h-3.5 text-muted-foreground" />} />
          <div className="grid grid-cols-2 gap-2 xl:col-span-2">
            <DateTimeIsoInput label="Начало от" value={startedFrom} onUpdate={setStartedFrom} />
            <DateTimeIsoInput label="Начало до" value={startedTo} onUpdate={setStartedTo} />
          </div>
          <div className="grid grid-cols-2 gap-2 xl:col-span-2">
            <DateTimeIsoInput label="Конец от" value={finishedFrom} onUpdate={setFinishedFrom} />
            <DateTimeIsoInput label="Конец до" value={finishedTo} onUpdate={setFinishedTo} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className="w-full h-10" type="number" placeholder="Длит. от, сек" value={durationMin} onChange={(event) => setDurationMin(event.target.value)} />
            <input className="w-full h-10" type="number" placeholder="Длит. до, сек" value={durationMax} onChange={(event) => setDurationMax(event.target.value)} />
          </div>
          <Select value={[algoFilter]} onUpdate={(v) => setAlgoFilter(v[0] ?? "all")} options={[{ value: "all", content: "Все алгоритмы" }, { value: "K-Means", content: "K-Means" }, { value: "DBSCAN", content: "DBSCAN" }]} size="m" />
          <div className="grid grid-cols-2 gap-2">
            <input className="w-full h-10" type="number" placeholder="Кластеров от" value={clustersMin} onChange={(event) => setClustersMin(event.target.value)} />
            <input className="w-full h-10" type="number" placeholder="Кластеров до" value={clustersMax} onChange={(event) => setClustersMax(event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className="w-full h-10" type="number" placeholder="Аномалий от" value={anomaliesMin} onChange={(event) => setAnomaliesMin(event.target.value)} />
            <input className="w-full h-10" type="number" placeholder="Аномалий до" value={anomaliesMax} onChange={(event) => setAnomaliesMax(event.target.value)} />
          </div>
          <Select value={[statusFilter]} onUpdate={(v) => setStatusFilter(v[0] ?? "all")} options={[{ value: "all", content: "Все статусы" }, { value: "success", content: "Завершено" }, { value: "running", content: "Выполняется" }, { value: "error", content: "Ошибка" }]} size="m" />
          <TextInput placeholder="Подмножество" size="l" value={subsetFilter} onUpdate={setSubsetFilter} />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[13px] text-muted-foreground">Найдено запусков: <span style={{ fontWeight: 500 }} className="text-foreground">{filtered.length}</span></span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-left">
                <th className="pb-3 pr-4 cursor-pointer hover:text-foreground" style={{ fontWeight: 500 }} onClick={() => toggleSort("id")}><span className="flex items-center gap-1">ID <SortIcon field="id" /></span></th>
                <th className="pb-3 pr-4 cursor-pointer hover:text-foreground" style={{ fontWeight: 500 }} onClick={() => toggleSort("startedAt")}><span className="flex items-center gap-1">Начало <SortIcon field="startedAt" /></span></th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Конец</th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Длит.</th>
                <th className="pb-3 pr-4 cursor-pointer hover:text-foreground" style={{ fontWeight: 500 }} onClick={() => toggleSort("algorithm")}><span className="flex items-center gap-1">Алгоритм <SortIcon field="algorithm" /></span></th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Кластеров</th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Аномалий</th>
                <th className="pb-3 pr-4 cursor-pointer hover:text-foreground" style={{ fontWeight: 500 }} onClick={() => toggleSort("status")}><span className="flex items-center gap-1">Статус <SortIcon field="status" /></span></th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Подмножество</th>
                <th className="pb-3" style={{ fontWeight: 500 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="py-12 text-center text-muted-foreground text-[13px]">По заданным условиям запусков не найдено</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 pr-4 font-mono text-[12px]" style={{ fontWeight: 500 }}>{r.id}</td>
                  <td className="py-3 pr-4 font-mono text-[12px] text-muted-foreground">{r.startedAt}</td>
                  <td className="py-3 pr-4 font-mono text-[12px] text-muted-foreground">{r.finishedAt}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{r.duration}</td>
                  <td className="py-3 pr-4"><span className="text-[12px] bg-primary/10 text-primary px-2 py-0.5 rounded" style={{ fontWeight: 500 }}>{r.algorithm}</span></td>
                  <td className="py-3 pr-4 text-center" style={{ fontWeight: 500 }}>{r.clusters || "—"}</td>
                  <td className="py-3 pr-4 text-center">{r.anomalies > 0 ? <span className="text-destructive" style={{ fontWeight: 500 }}>{r.anomalies}</span> : "—"}</td>
                  <td className="py-3 pr-4"><Label theme={runStatusLabels[r.status].theme}>{runStatusLabels[r.status].label}</Label></td>
                  <td className="py-3 pr-4 text-muted-foreground text-[12px]">{r.subset}</td>
                  <td className="py-3">
                    <div className="flex flex-row items-center gap-2">
                      {r.status === "success" && (
                        <Button view="outlined" size="s" className="text-[12px] h-7" onClick={() => navigate(`/results/${r.id}`)}>
                          <span className="flex flex-row items-center gap-1"><BarChart3 className="w-3 h-3" />Результаты</span>
                        </Button>
                      )}
                      <Button
                        view="outlined"
                        size="s"
                        className="text-[12px] h-7 text-destructive"
                        onClick={() => {
                          if (window.confirm("Удалить этот запуск кластеризации?")) void deleteRun(r.id);
                        }}
                      >
                        <span className="flex flex-row items-center gap-1"><Trash2 className="w-3 h-3" />Удалить</span>
                      </Button>
                    </div>
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
