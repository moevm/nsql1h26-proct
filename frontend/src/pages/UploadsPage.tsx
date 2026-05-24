import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Download, History, Upload } from "lucide-react";
import { Button, Label } from "@gravity-ui/uikit";
import { csvImportCards, type CsvKind } from "../features/csv-upload/config/csvImportConfig";
import { useCsvImport } from "../features/csv-upload/model/useCsvImport";
import { useUploads } from "../entities/upload/model/hooks";

export function UploadsPage() {
  const navigate = useNavigate();
  const inputs = useRef<Record<CsvKind, HTMLInputElement | null>>({ students: null, sessions: null, moodle_events: null, ocr_events: null });
  const [dragging, setDragging] = useState<CsvKind | null>(null);
  const savedBatch = readUploadPageState();
  const [batchMode, setBatchMode] = useState<"new" | "existing">(savedBatch.batchMode);
  const [selectedBatchId, setSelectedBatchId] = useState(savedBatch.selectedBatchId);
  const { statuses, results, errors, uploadCsv, downloadTemplate } = useCsvImport();
  const { items: uploadItems } = useUploads(200);
  const batchOptions = useMemo(() => {
    const batches = new Map<string, { id: string; createdAt: string; files: number; rows: number }>();
    for (const upload of uploadItems) {
      const id = String(upload.importBatchId ?? upload._id ?? "");
      if (!id) continue;
      const existing = batches.get(id);
      batches.set(id, {
        id,
        createdAt: String(existing?.createdAt ?? upload.createdAt ?? ""),
        files: (existing?.files ?? 0) + Number(upload.filesCount ?? 1),
        rows: (existing?.rows ?? 0) + Number(upload.totalRows ?? 0),
      });
    }
    return [...batches.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [uploadItems]);
  const activeBatchId = batchMode === "existing" ? selectedBatchId : undefined;

  useEffect(() => {
    sessionStorage.setItem("upload-page-state", JSON.stringify({ batchMode, selectedBatchId }));
  }, [batchMode, selectedBatchId]);

  async function uploadIntoActiveBatch(kind: CsvKind, file?: File) {
    const result = await uploadCsv(kind, file, activeBatchId);
    if (result?.importBatchId) {
      setSelectedBatchId(result.importBatchId);
      setBatchMode("existing");
    }
  }

  function handleFileChange(kind: CsvKind, event: ChangeEvent<HTMLInputElement>) {
    void uploadIntoActiveBatch(kind, event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDrop(kind: CsvKind, event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(null);
    void uploadIntoActiveBatch(kind, event.dataTransfer.files[0]);
  }

  const totalRows = Object.values(results).reduce((sum, result) => sum + (result?.totalRows ?? 0), 0);
  const insertedRows = Object.values(results).reduce((sum, result) => sum + (result?.insertedCount ?? 0), 0);
  const warningRows = Object.values(results).reduce((sum, result) => sum + (result?.errorCount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px]" style={{ fontWeight: 600 }}>
            Загрузка данных экзамена
          </h1>
          <p className="text-muted-foreground text-[14px] mt-1">
            Загружайте большие CSV-файлы: студенты, сессии, Moodle и OCR.
          </p>
        </div>
        <Link to="/upload-history">
          <Button view="outlined" className="text-[13px] h-9">
            <span className="flex items-center gap-1.5">
              <History className="w-4 h-4" />
              История загрузок
            </span>
          </Button>
        </Link>
      </div>

      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div>
          <h3 className="text-[15px]" style={{ fontWeight: 600 }}>Пачка загрузок</h3>
          <p className="text-[13px] text-muted-foreground mt-1">
            Свяжите CSV студентов, сессий, Moodle и OCR в один датасет, чтобы потом выбирать его целиком для кластеризации.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            className={`text-left rounded-lg border p-4 transition-colors ${batchMode === "new" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
            onClick={() => setBatchMode("new")}
          >
            <div className="text-[14px]" style={{ fontWeight: 600 }}>Создать новую пачку</div>
            <div className="text-[12px] text-muted-foreground mt-1">Первый загруженный CSV создаст новый ID пачки.</div>
          </button>
          <div className={`rounded-lg border p-4 space-y-3 ${batchMode === "existing" ? "border-primary bg-primary/5" : "border-border"}`}>
            <button className="text-left w-full" onClick={() => setBatchMode("existing")}>
              <div className="text-[14px]" style={{ fontWeight: 600 }}>Добавить в существующую пачку</div>
              <div className="text-[12px] text-muted-foreground mt-1">Используйте, если уже загрузили часть файлов для этого экзамена.</div>
            </button>
            <select
              className="w-full h-9 rounded border border-border bg-background px-3 text-[13px]"
              value={selectedBatchId}
              onChange={(event) => {
                setSelectedBatchId(event.target.value);
                setBatchMode("existing");
              }}
            >
              <option value="">Выберите пачку</option>
              {batchOptions.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.id.slice(-8)} · файлов {batch.files} · строк {batch.rows}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="text-[12px] text-muted-foreground">
          Активная пачка: {batchMode === "existing" && selectedBatchId ? selectedBatchId : "будет создана при следующей загрузке"}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
        {csvImportCards.map((card) => {
          const Icon = card.icon;
          const status = statuses[card.kind];
          const result = results[card.kind];
          return (
            <div
              key={card.kind}
              className={`bg-card rounded-xl border p-5 space-y-4 transition-all ${
                dragging === card.kind ? "border-primary bg-accent/50 scale-[1.01]" : "border-border"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(card.kind);
              }}
              onDragLeave={() => setDragging(null)}
              onDrop={(event) => handleDrop(card.kind, event)}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-[14px]" style={{ fontWeight: 600 }}>
                    {card.title}
                  </h3>
                  <Label theme="info" className="mt-1">{card.typeLabel}</Label>
                  <p className="text-[12px] text-muted-foreground mt-0.5">{card.helper}</p>
                </div>
              </div>

              <div className="border-2 border-dashed border-border rounded-lg p-5 text-center space-y-3 hover:border-primary/40 transition-colors">
                <Upload className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                <div>
                  <p className="text-[13px] text-muted-foreground">Перетащите CSV или выберите файл</p>
                  <input
                    ref={(node) => {
                      inputs.current[card.kind] = node;
                    }}
                    className="hidden"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => handleFileChange(card.kind, event)}
                  />
                  <Button view="outlined" size="s" className="mt-2 text-[12px]" onClick={() => inputs.current[card.kind]?.click()} loading={status === "uploading"}>
                    Выбрать CSV
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button view="flat" size="s" className="text-[12px]" onClick={() => void downloadTemplate(card.kind)}>
                  <span className="flex items-center gap-1">
                    <Download className="w-3.5 h-3.5" />
                    Шаблон
                  </span>
                </Button>
                <code className="text-[11px] bg-muted px-2 py-1 rounded text-muted-foreground">{card.columns}</code>
              </div>

              {status === "uploaded" && result && (
                <div className="border border-success/20 bg-success/5 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <span className="text-[13px] text-success" style={{ fontWeight: 500 }}>
                      Загружено {result.insertedCount} из {result.totalRows}
                    </span>
                  </div>
                  {result.errorCount > 0 && <p className="text-[12px] text-warning">Предупреждений: {result.errorCount}</p>}
                  <p className="text-[11px] text-muted-foreground break-all">Пачка: {result.importBatchId}</p>
                  <button className="text-[12px] text-primary hover:underline" onClick={() => navigate(`/uploads/${result.uploadId}/log`)}>
                    Открыть журнал
                  </button>
                </div>
              )}

              {status === "error" && (
                <div className="border border-destructive/20 bg-destructive/5 rounded-lg p-3 flex gap-2 text-[12px] text-destructive">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errors[card.kind]}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px]" style={{ fontWeight: 600 }}>
            Проверка последней загрузки
          </h3>
          <Label theme={warningRows ? "warning" : "success"}>{warningRows ? "Есть предупреждения" : "Готово к обработке"}</Label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-left">
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Тип</th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Статус</th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Строк</th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Добавлено</th>
                <th className="pb-3" style={{ fontWeight: 500 }}>Ошибки</th>
              </tr>
            </thead>
            <tbody>
              {csvImportCards.map((card) => {
                const result = results[card.kind];
                return (
                  <tr key={card.kind} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-4" style={{ fontWeight: 500 }}>{card.title}</td>
                    <td className="py-3 pr-4">
                      <Label theme={statuses[card.kind] === "error" ? "danger" : statuses[card.kind] === "uploaded" ? "success" : "info"}>
                        {statuses[card.kind] === "empty" ? "Ожидает CSV" : statuses[card.kind] === "uploading" ? "Загрузка" : statuses[card.kind] === "uploaded" ? "Загружено" : "Ошибка"}
                      </Label>
                    </td>
                    <td className="py-3 pr-4">{result?.totalRows ?? "-"}</td>
                    <td className="py-3 pr-4">{result?.insertedCount ?? "-"}</td>
                    <td className="py-3 text-warning">{result?.errorCount ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <div className="text-[24px] text-primary" style={{ fontWeight: 600 }}>{totalRows}</div>
          <div className="text-[12px] text-muted-foreground mt-1">Строк прочитано</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <div className="text-[24px] text-success" style={{ fontWeight: 600 }}>{insertedRows}</div>
          <div className="text-[12px] text-muted-foreground mt-1">Документов добавлено</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <div className="text-[24px] text-warning" style={{ fontWeight: 600 }}>{warningRows}</div>
          <div className="text-[12px] text-muted-foreground mt-1">Предупреждений</div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-4 flex items-center justify-between gap-3 sticky bottom-0">
        <p className="text-[13px] text-muted-foreground">После загрузки CSV можно перейти к обработке и кластеризации.</p>
        <Link to="/processing">
          <Button view="action" className="text-[13px] h-9">
            <span className="flex items-center gap-1.5">
              Начать обработку
              <ArrowRight className="w-4 h-4" />
            </span>
          </Button>
        </Link>
      </div>
    </div>
  );
}

function readUploadPageState() {
  try {
    const raw = sessionStorage.getItem("upload-page-state");
    if (!raw) return { batchMode: "new" as const, selectedBatchId: "" };
    const parsed = JSON.parse(raw) as { batchMode?: "new" | "existing"; selectedBatchId?: string };
    return { batchMode: parsed.batchMode ?? "new", selectedBatchId: parsed.selectedBatchId ?? "" };
  } catch {
    return { batchMode: "new" as const, selectedBatchId: "" };
  }
}
