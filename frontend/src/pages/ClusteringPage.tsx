import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, RotateCcw, CheckCircle2, History, CalendarDays, Database, Search, X } from "lucide-react";
import { Button, Checkbox, TextInput, Switch, Select } from "@gravity-ui/uikit";
import { useUploads } from "../entities/upload/model/hooks";
import { useSessionsSummary } from "../entities/summary/model/hooks";
import { useRunClustering } from "../features/run-clustering/model/useRunClustering";
import { clusteringMetricGroups, distanceMetricOptions } from "../shared/config/ui";

type Algorithm = "kmeans" | "dbscan";

export function ClusteringPage() {
  const navigate = useNavigate();
  const metricLabels = useMemo(() => clusteringMetricGroups.flatMap((group) => group.metrics.map((metric) => metric.label)), []);
  const featureMap = useMemo(() => Object.fromEntries(clusteringMetricGroups.flatMap((group) => group.metrics.map((metric) => [metric.label, metric.feature]))), []);
  const [algorithm, setAlgorithm] = useState<Algorithm>("kmeans");
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(() => new Set(metricLabels));
  const [clusters, setClusters] = useState("5");
  const [autoDetect, setAutoDetect] = useState(true);
  const [distanceMetric, setDistanceMetric] = useState("euclidean");
  const [epsilon, setEpsilon] = useState("0.5");
  const [minSamples, setMinSamples] = useState("5");
  const [markNoise, setMarkNoise] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [courseName, setCourseName] = useState("");
  const [examName, setExamName] = useState("");
  const [group, setGroup] = useState("");
  const [program, setProgram] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [selectedBatches, setSelectedBatches] = useState<string[]>(["all"]);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchSearch, setBatchSearch] = useState("");
  const { items: uploads } = useUploads(200);
  const sessions = useSessionsSummary();
  const { running, run } = useRunClustering();
  const batchOptions = useMemo(() => {
    const batches = new Map<string, { id: string; createdAt: string; files: number; rows: number; status: string }>();
    for (const upload of uploads) {
      const id = String(upload.importBatchId ?? upload._id ?? "");
      if (!id) continue;
      const current = batches.get(id);
      batches.set(id, {
        id,
        createdAt: String(current?.createdAt ?? upload.createdAt ?? ""),
        files: (current?.files ?? 0) + Number(upload.filesCount ?? 1),
        rows: (current?.rows ?? 0) + Number(upload.totalRows ?? 0),
        status: String(upload.status ?? current?.status ?? ""),
      });
    }
    return [...batches.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [uploads]);
  const selectedBatchCount = selectedBatches.includes("all") ? batchOptions.length : selectedBatches.length;
  const filteredBatches = batchOptions.filter((batch) => {
    const query = batchSearch.toLowerCase();
    return !query || batch.id.toLowerCase().includes(query) || batch.status.toLowerCase().includes(query);
  });
  const selectedBatchRows = batchOptions
    .filter((batch) => selectedBatches.includes("all") || selectedBatches.includes(batch.id))
    .reduce((sum, batch) => sum + batch.rows, 0);
  const selectedBatchFiles = batchOptions
    .filter((batch) => selectedBatches.includes("all") || selectedBatches.includes(batch.id))
    .reduce((sum, batch) => sum + batch.files, 0);

  const toggleMetric = (m: string) => {
    const next = new Set(selectedMetrics);
    if (next.has(m)) next.delete(m);
    else next.add(m);
    setSelectedMetrics(next);
  };

  async function runClustering() {
    const batchIds = selectedBatches.includes("all") ? [] : selectedBatches;
    const result = await run({
      algorithm,
      k: Number(clusters),
      batchIds,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      courseName: courseName || undefined,
      examName: examName || undefined,
      group: group || undefined,
      program: program || undefined,
      educationLevel: educationLevel || undefined,
      selectedFeatures: [...selectedMetrics].map((metric) => featureMap[metric] ?? metric),
      distanceMetric,
      autoDetectAnomalies: autoDetect,
      epsilon: Number(epsilon),
      minSamples: Number(minSamples),
      markNoiseAsAnomalies: markNoise,
    });
    navigate(`/results/${result._id}`);
  }

  const reset = () => {
    setAlgorithm("kmeans");
    setSelectedMetrics(new Set(metricLabels));
    setClusters("5");
    setAutoDetect(true);
    setDistanceMetric("euclidean");
    setEpsilon("0.5");
    setMinSamples("5");
    setMarkNoise(true);
    setDateFrom("");
    setDateTo("");
    setCourseName("");
    setExamName("");
    setGroup("");
    setProgram("");
    setEducationLevel("");
    setSelectedBatches(["all"]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-[22px]" style={{ fontWeight: 600 }}>Настройка кластеризации</h1>
          <p className="text-muted-foreground text-[14px] mt-1">Выберите алгоритм, метрики и запустите кластеризацию</p>
        </div>
        <Button view="outlined" className="text-[13px] h-9" onClick={() => navigate("/cluster-history")}>
          <span className="flex items-center gap-1.5"><History className="w-4 h-4" />История запусков</span>
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          <h3 className="text-[15px]" style={{ fontWeight: 600 }}>Фильтр подмножества данных</h3>
        </div>
        <p className="text-[13px] text-muted-foreground">Выберите период и пачки загрузок для кластеризации. Сводка датасета обновится автоматически.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-[13px] text-muted-foreground flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />Дата от</label>
            <TextInput type="text" placeholder="YYYY-MM-DD" value={dateFrom} onUpdate={setDateFrom} size="m" style={{ fontSize: 13 }} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] text-muted-foreground flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />Дата до</label>
            <TextInput type="text" placeholder="YYYY-MM-DD" value={dateTo} onUpdate={setDateTo} size="m" style={{ fontSize: 13 }} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] text-muted-foreground">Пачки загрузок</label>
            <Button view="outlined" width="max" className="h-9 text-[13px]" onClick={() => setBatchModalOpen(true)}>
              Выбрать пачки: {selectedBatches.includes("all") ? "все" : selectedBatchCount}
            </Button>
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] text-muted-foreground">Имя курса</label>
            <TextInput placeholder="Например: NoSQL" value={courseName} onUpdate={setCourseName} size="m" style={{ fontSize: 13 }} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] text-muted-foreground">Имя экзамена</label>
            <TextInput placeholder="Например: Базы данных" value={examName} onUpdate={setExamName} size="m" style={{ fontSize: 13 }} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] text-muted-foreground">Группа студента</label>
            <TextInput placeholder="Например: P331" value={group} onUpdate={setGroup} size="m" style={{ fontSize: 13 }} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] text-muted-foreground">Программа</label>
            <TextInput placeholder="Например: Прикладная информатика" value={program} onUpdate={setProgram} size="m" style={{ fontSize: 13 }} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] text-muted-foreground">Уровень обучения</label>
            <Select value={[educationLevel || "all"]} onUpdate={(vals) => setEducationLevel(vals[0] === "all" ? "" : vals[0])} options={[{ value: "all", content: "Все" }, { value: "bachelor", content: "bachelor" }, { value: "master", content: "master" }, { value: "specialist", content: "specialist" }]} size="m" />
          </div>
        </div>
      </div>

      {batchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setBatchModalOpen(false)}>
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(event) => event.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[16px]" style={{ fontWeight: 600 }}>Пачки загрузок</h3>
                <p className="text-[12px] text-muted-foreground mt-1">Можно выбрать все загрузки или несколько конкретных пачек.</p>
              </div>
              <button className="p-1 rounded hover:bg-muted" onClick={() => setBatchModalOpen(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <TextInput placeholder="Поиск по ID или статусу" value={batchSearch} onUpdate={setBatchSearch} startContent={<Search className="w-3.5 h-3.5 text-muted-foreground" />} />
              <div className="flex flex-wrap gap-2">
                <Button view={selectedBatches.includes("all") ? "action" : "outlined"} size="s" onClick={() => setSelectedBatches(["all"])}>Все загрузки</Button>
                <Button view="outlined" size="s" onClick={() => setSelectedBatches([])}>Очистить</Button>
              </div>
            </div>
            <div className="px-5 pb-5 overflow-auto space-y-2">
              {filteredBatches.map((batch) => {
                const id = batch.id;
                const checked = selectedBatches.includes("all") || selectedBatches.includes(id);
                return (
                  <label key={id} className="flex items-center gap-3 border border-border rounded-lg p-3 hover:bg-muted/40 cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onUpdate={(value) => {
                        const current = selectedBatches.includes("all") ? [] : selectedBatches;
                        setSelectedBatches(value ? [...current, id] : current.filter((item) => item !== id));
                      }}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px]" style={{ fontWeight: 500 }}>Пачка {id.slice(-8)}</span>
                      <span className="block text-[12px] text-muted-foreground">{batch.createdAt ? new Date(batch.createdAt).toLocaleString("ru-RU") : "Дата неизвестна"} · файлов {batch.files} · строк {batch.rows}</span>
                    </span>
                  </label>
                );
              })}
              {filteredBatches.length === 0 && <div className="py-10 text-center text-[13px] text-muted-foreground">Пачки не найдены</div>}
            </div>
            <div className="p-5 border-t border-border flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">Выбрано: {selectedBatches.includes("all") ? "все" : selectedBatches.length}</span>
              <Button view="action" onClick={() => setBatchModalOpen(false)}>Готово</Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-[15px]" style={{ fontWeight: 600 }}>Алгоритм</h3>
            <div className="grid grid-cols-2 gap-3">
              {(["kmeans", "dbscan"] as Algorithm[]).map((algo) => (
                <button key={algo} onClick={() => setAlgorithm(algo)} className={`p-4 rounded-lg border-2 text-left transition-all ${algorithm === algo ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[14px]" style={{ fontWeight: 600 }}>{algo === "kmeans" ? "K-Means" : "DBSCAN"}</span>
                    {algorithm === algo && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-[12px] text-muted-foreground">{algo === "kmeans" ? "Кластеризация разбиением с заданным числом кластеров" : "Плотностная кластеризация с кластерами произвольной формы"}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 space-y-5">
            <h3 className="text-[15px]" style={{ fontWeight: 600 }}>Признаки для включения</h3>
            <div>
              {clusteringMetricGroups.map((group) => (
                <div key={group.title} className="mb-5 last:mb-0">
                  <h4 className="text-[13px] text-muted-foreground mb-3" style={{ fontWeight: 500 }}>{group.title}</h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    {group.metrics.map((metric) => (
                      <div key={metric.label} onClick={() => toggleMetric(metric.label)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors">
                        <Checkbox checked={selectedMetrics.has(metric.label)} onUpdate={() => toggleMetric(metric.label)} />
                        <span className="text-[13px]" style={{ fontWeight: 400 }}>{metric.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-[15px] mb-3" style={{ fontWeight: 600 }}>Итог признаков</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {[...selectedMetrics].map((m) => (
                <span key={m} className="px-2.5 py-1 bg-primary/10 text-primary rounded-md text-[12px]" style={{ fontWeight: 500 }}>{m}</span>
              ))}
            </div>
            <p className="text-[13px] text-muted-foreground">Выбрано {selectedMetrics.size} из {metricLabels.length} метрик</p>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6 lg:self-start">
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-[15px]" style={{ fontWeight: 600 }}>Параметры</h3>
            {algorithm === "kmeans" ? (
              <div className="space-y-4">
                <div className="space-y-1.5"><label className="text-[13px]">Количество кластеров</label><TextInput type="number" value={clusters} onUpdate={(v) => setClusters(v)} size="m" style={{ fontSize: 13 }} /></div>
                <div className="flex items-center justify-between"><label className="text-[13px]" style={{ fontWeight: 400 }}>Автообнаружение аномалий</label><Switch checked={autoDetect} onUpdate={setAutoDetect} /></div>
                <div className="space-y-1.5">
                  <label className="text-[13px]">Метрика расстояния</label>
                  <Select value={[distanceMetric]} onUpdate={(vals) => setDistanceMetric(vals[0])} options={distanceMetricOptions} size="m" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5"><label className="text-[13px]">Эпсилон</label><TextInput type="number" value={epsilon} onUpdate={(v) => setEpsilon(v)} size="m" style={{ fontSize: 13 }} /></div>
                <div className="space-y-1.5"><label className="text-[13px]">Мин. образцов</label><TextInput type="number" value={minSamples} onUpdate={(v) => setMinSamples(v)} size="m" style={{ fontSize: 13 }} /></div>
                <div className="flex items-center justify-between"><label className="text-[13px]" style={{ fontWeight: 400 }}>Отмечать шум как аномалии</label><Switch checked={markNoise} onUpdate={setMarkNoise} /></div>
              </div>
            )}
          </div>

          <div className="bg-card rounded-xl border border-border p-5 space-y-3">
            <h3 className="text-[15px]" style={{ fontWeight: 600 }}>Сводка датасета</h3>
            {[
              { label: "Сессий в БД", value: sessions.total.toLocaleString("ru-RU") },
              { label: "Выбрано пачек", value: selectedBatches.includes("all") ? batchOptions.length.toLocaleString("ru-RU") : selectedBatches.length.toLocaleString("ru-RU") },
              { label: "Файлов в выбранных пачках", value: selectedBatchFiles.toLocaleString("ru-RU") },
              { label: "Строк в выбранных пачках", value: selectedBatchRows.toLocaleString("ru-RU") },
            ].map((s) => (
              <div key={s.label} className="flex justify-between text-[13px]"><span className="text-muted-foreground">{s.label}</span><span style={{ fontWeight: 500 }}>{s.value}</span></div>
            ))}
          </div>

          <div className="space-y-2.5">
            <Button view="action" width="max" className="h-10" loading={running} onClick={() => void runClustering()}>
              <span className="flex items-center gap-1.5"><Play className="w-4 h-4" />Запустить кластеризацию</span>
            </Button>
            <Button view="outlined" width="max" className="h-10" onClick={reset}>
              <span className="flex items-center gap-1.5"><RotateCcw className="w-4 h-4" />Сброс</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
