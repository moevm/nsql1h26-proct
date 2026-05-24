import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { History, Search, Filter, BarChart3, X, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button, TextInput, Select, Label } from "@gravity-ui/uikit";
import { useClusteringRuns } from "../entities/clustering/model/hooks";
import { runStatusLabels } from "../shared/config/ui";

type SortField = "id" | "startedAt" | "algorithm" | "status";

export function ClusterHistoryPage() {
  const navigate = useNavigate();
  const { runs, deleteRun } = useClusteringRuns(50);
  const [search, setSearch] = useState("");
  const [algoFilter, setAlgoFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
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

  const hasFilters = search || algoFilter !== "all" || statusFilter !== "all";
  const resetFilters = () => { setSearch(""); setAlgoFilter("all"); setStatusFilter("all"); };

  const filtered = runs
    .filter((r) => {
      if (search && !r.id.toLowerCase().includes(search.toLowerCase()) && !r.subset.toLowerCase().includes(search.toLowerCase())) return false;
      if (algoFilter !== "all" && r.algorithm !== algoFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "id") cmp = a.id.localeCompare(b.id);
      else if (sortField === "startedAt") cmp = a.startedAt.localeCompare(b.startedAt);
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <TextInput placeholder="Поиск по ID или подмножеству" size="l" value={search} onUpdate={setSearch} startContent={<Search className="w-3.5 h-3.5 text-muted-foreground" />} />
          <Select value={[algoFilter]} onUpdate={(v) => setAlgoFilter(v[0])} options={[{ value: "all", content: "Все алгоритмы" }, { value: "K-Means", content: "K-Means" }, { value: "DBSCAN", content: "DBSCAN" }]} size="m" />
          <Select value={[statusFilter]} onUpdate={(v) => setStatusFilter(v[0])} options={[{ value: "all", content: "Все статусы" }, { value: "success", content: "Завершено" }, { value: "running", content: "Выполняется" }, { value: "error", content: "Ошибка" }]} size="m" />
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
