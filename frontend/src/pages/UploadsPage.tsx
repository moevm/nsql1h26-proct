import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Download, Filter, History, RotateCcw, Square, Trash2, Upload, X } from "lucide-react";
import { Button, Label, Select, TextInput } from "@gravity-ui/uikit";
import { csvImportCards, type CsvKind } from "../features/csv-upload/config/csvImportConfig";
import { useCsvImport } from "../features/csv-upload/model/useCsvImport";
import { isActiveProcessingStatus, isRetryableProcessingStatus, statusPriority, uploadStatus } from "../entities/upload/model/adapters";
import { useRetryProcessing, useStartProcessing, useStopProcessing, useUploads } from "../entities/upload/model/hooks";
import type { AnyRecord } from "../entities/types";
import { matchesNumberRange, matchesText } from "../shared/lib/clientFilters";
import { useClientPagination } from "../shared/lib/useClientPagination";
import { FilterFormField, FilterNumberRange } from "../shared/ui/FilterField";
import { TablePagination } from "../shared/ui/TablePagination";

export function UploadsPage() {
  const navigate = useNavigate();
  const inputs = useRef<Record<CsvKind, HTMLInputElement | null>>({ students: null, sessions: null, moodle_events: null, ocr_events: null });
  const [dragging, setDragging] = useState<CsvKind | null>(null);
  const savedBatch = readUploadPageState();
  const [batchMode, setBatchMode] = useState<"new" | "existing">(savedBatch.batchMode);
  const [selectedBatchId, setSelectedBatchId] = useState(savedBatch.selectedBatchId);
  const [validationTypeFilter, setValidationTypeFilter] = useState("");
  const [validationStatusFilter, setValidationStatusFilter] = useState("all");
  const [validationRowsMin, setValidationRowsMin] = useState("");
  const [validationRowsMax, setValidationRowsMax] = useState("");
  const [validationInsertedMin, setValidationInsertedMin] = useState("");
  const [validationInsertedMax, setValidationInsertedMax] = useState("");
  const [validationFilesMin, setValidationFilesMin] = useState("");
  const [validationFilesMax, setValidationFilesMax] = useState("");
  const [validationErrorsMin, setValidationErrorsMin] = useState("");
  const [validationErrorsMax, setValidationErrorsMax] = useState("");
  const currentBatchIdRef = useRef(savedBatch.batchMode === "existing" ? savedBatch.selectedBatchId : "");
  const [sessionBatchIds, setSessionBatchIds] = useState<Set<string>>(() => new Set());
  const activeBatchId = batchMode === "existing" ? selectedBatchId : undefined;
  const { statuses, results, errors, uploadCsv, downloadTemplate, resetImportState } = useCsvImport(activeBatchId);
  const { items: uploadItems, loading: uploadsLoading, refetch: refetchUploads } = useUploads(200);
  const startProcessing = useStartProcessing();
  const stopProcessing = useStopProcessing();
  const retryProcessing = useRetryProcessing();
  const batchOptions = useMemo(() => {
    const batches = new Map<string, { id: string; createdAt: string; files: number; rows: number; kinds: Set<string> }>();
    for (const upload of uploadItems) {
      const id = String(upload.importBatchId ?? upload._id ?? "");
      if (!id) continue;
      const existing = batches.get(id);
      const kinds = Object.keys((upload.files ?? {}) as Record<string, unknown>);
      batches.set(id, {
        id,
        createdAt: String(existing?.createdAt ?? upload.createdAt ?? ""),
        files: (existing?.files ?? 0) + Number(upload.filesCount ?? 1),
        rows: (existing?.rows ?? 0) + Number(upload.totalRows ?? 0),
        kinds: new Set([...(existing?.kinds ?? []), ...kinds]),
      });
    }
    return [...batches.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [uploadItems]);
  const activeBatchUploads = uploadItems.filter((upload) => String(upload.importBatchId ?? upload._id ?? "") === activeBatchId);
  const activeProcessingStateStatus = activeBatchUploads
    .map((upload) => String(((upload.processingState ?? {}) as { status?: string }).status ?? ""))
    .find(Boolean);
  const activeLifecycleStatus = activeBatchUploads
    .map(uploadStatus)
    .sort((a, b) => statusPriority(b) - statusPriority(a))[0];

  useEffect(() => {
    sessionStorage.setItem("upload-page-state", JSON.stringify({ batchMode, selectedBatchId }));
  }, [batchMode, selectedBatchId]);

  useEffect(() => {
    if (!sessionBatchIds.size) return;
    setSessionBatchIds((ids) => new Set([...ids].filter((id) => !batchOptions.some((batch) => batch.id === id))));
  }, [batchOptions, sessionBatchIds.size]);

  useEffect(() => {
    if (uploadsLoading || batchMode !== "existing" || !selectedBatchId) return;
    if (sessionBatchIds.has(selectedBatchId)) return;
    if (batchOptions.some((batch) => batch.id === selectedBatchId)) return;
    currentBatchIdRef.current = "";
    setBatchMode("new");
    setSelectedBatchId("");
  }, [batchMode, batchOptions, selectedBatchId, sessionBatchIds, uploadsLoading]);

  async function uploadIntoActiveBatch(kind: CsvKind, file?: File) {
    if (batchMode === "existing" && !selectedBatchId) return;
    const uploadBatchId = currentBatchIdRef.current || activeBatchId;
    const result = await uploadCsv(kind, file, uploadBatchId);
    if (result?.importBatchId) {
      currentBatchIdRef.current = result.importBatchId;
      setSessionBatchIds((ids) => new Set(ids).add(result.importBatchId));
      setSelectedBatchId(result.importBatchId);
      setBatchMode("existing");
      refetchUploads();
    }
  }

  function resetUploadPageState() {
    currentBatchIdRef.current = "";
    setSessionBatchIds(new Set());
    setSelectedBatchId("");
    setBatchMode("new");
    resetImportState({ all: true });
    sessionStorage.setItem("upload-page-state", JSON.stringify({ batchMode: "new", selectedBatchId: "" }));
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

  const cardStates = useMemo(() => Object.fromEntries(csvImportCards.map((card) => {
    const result = results[card.kind];
    const serverAggregate = aggregateBatchFiles(activeBatchUploads, card.kind);
    const sessionStatus = statuses[card.kind];
    const hasUploadedData = Boolean(serverAggregate.filesCount || result);
    const status = sessionStatus === "uploading" ? "uploading" : hasUploadedData ? "uploaded" : sessionStatus === "error" ? "error" : "empty";
    return [card.kind, {
      status,
      result,
      uploadId: result?.uploadId ?? serverAggregate.uploadId,
      importBatchId: result?.importBatchId ?? serverAggregate.importBatchId ?? activeBatchId,
      totalRows: serverAggregate.filesCount ? serverAggregate.totalRows : result?.totalRows,
      insertedCount: serverAggregate.filesCount ? serverAggregate.insertedCount : result?.insertedCount,
      errorCount: serverAggregate.filesCount ? serverAggregate.errorCount : result?.errorCount ?? 0,
      filesCount: serverAggregate.filesCount || (result ? 1 : 0),
      lastError: sessionStatus === "error" ? errors[card.kind] : undefined,
    }];
  })) as Record<CsvKind, ActiveCsvCardState>, [activeBatchId, activeBatchUploads, errors, results, statuses]);
  const totalRows = Object.values(cardStates).reduce((sum, state) => sum + Number(state.totalRows ?? 0), 0);
  const insertedRows = Object.values(cardStates).reduce((sum, state) => sum + Number(state.insertedCount ?? state.totalRows ?? 0), 0);
  const warningRows = Object.values(cardStates).reduce((sum, state) => sum + Number(state.errorCount ?? 0), 0);
  const activeWarningRows = warningRows;
  const activeKinds = new Set(csvImportCards.filter((card) => cardStates[card.kind].status === "uploaded").map((card) => card.kind));
  const requiredKinds = new Set<CsvKind>(["students", "sessions"]);
  const missingCards = csvImportCards.filter((card) => requiredKinds.has(card.kind) && !activeKinds.has(card.kind));
  const isProcessingActive = isActiveProcessingStatus(activeLifecycleStatus);
  const canStartProcessing = Boolean(activeBatchId && missingCards.length === 0 && !isProcessingActive);
  const shouldRetryProcessing = isRetryableProcessingStatus(activeProcessingStateStatus);
  const uploadSelectionError = batchMode === "existing" && !selectedBatchId ? "Выберите существующую пачку или создайте новую." : "";
  const isCreatingBatch = batchMode === "new" && Object.values(statuses).some((status) => status === "uploading");
  const startHint = uploadSelectionError
    ? uploadSelectionError
    : !activeBatchId
    ? "Сначала загрузите CSV и сформируйте активную пачку."
    : missingCards.length
      ? `Не хватает файлов: ${missingCards.map((card) => card.title).join(", ")}.`
      : isProcessingActive
        ? "Обработка этой пачки уже выполняется. Можно открыть экран обработки."
      : shouldRetryProcessing
        ? "Все файлы загружены, можно перезапустить обработку."
        : "Все файлы загружены, можно запускать обработку.";
  const startHintClass = isProcessingActive ? "text-primary" : canStartProcessing ? "text-success" : "text-warning";
  const validationStatusText = (status: ActiveCsvCardState["status"]) => status === "empty" ? "Ожидает CSV" : status === "uploading" ? "Загрузка" : status === "uploaded" ? "Загружено" : "Ошибка";
  const hasValidationFilters =
    validationTypeFilter ||
    validationStatusFilter !== "all" ||
    validationRowsMin ||
    validationRowsMax ||
    validationInsertedMin ||
    validationInsertedMax ||
    validationFilesMin ||
    validationFilesMax ||
    validationErrorsMin ||
    validationErrorsMax;
  const resetValidationFilters = () => {
    setValidationTypeFilter("");
    setValidationStatusFilter("all");
    setValidationRowsMin("");
    setValidationRowsMax("");
    setValidationInsertedMin("");
    setValidationInsertedMax("");
    setValidationFilesMin("");
    setValidationFilesMax("");
    setValidationErrorsMin("");
    setValidationErrorsMax("");
  };
  const filteredValidationCards = csvImportCards.filter((card) => {
    const state = cardStates[card.kind];
    const inserted = Number(state.insertedCount ?? state.totalRows ?? 0);
    if (!matchesText(card.title, validationTypeFilter)) return false;
    if (validationStatusFilter !== "all" && state.status !== validationStatusFilter) return false;
    if (!matchesNumberRange(Number(state.totalRows ?? 0), validationRowsMin, validationRowsMax)) return false;
    if (!matchesNumberRange(inserted, validationInsertedMin, validationInsertedMax)) return false;
    if (!matchesNumberRange(Number(state.filesCount ?? 0), validationFilesMin, validationFilesMax)) return false;
    if (!matchesNumberRange(Number(state.errorCount ?? 0), validationErrorsMin, validationErrorsMax)) return false;
    return true;
  });
  const validationPagination = useClientPagination(filteredValidationCards, 10, "table-page-size");
  const validationLabel = uploadSelectionError
    ? { theme: "warning" as const, text: "Пачка не выбрана" }
    : !activeBatchId
    ? { theme: "normal" as const, text: "Ожидает загрузки" }
    : missingCards.length
      ? { theme: "warning" as const, text: "Не все файлы загружены" }
      : isProcessingActive
        ? { theme: "info" as const, text: "Обработка выполняется" }
      : shouldRetryProcessing
        ? { theme: "info" as const, text: "Можно перезапустить" }
      : activeWarningRows
        ? { theme: "warning" as const, text: "Есть предупреждения" }
        : { theme: "success" as const, text: "Готово к обработке" };

  async function handleStartProcessing() {
    if (!activeBatchId || !canStartProcessing) return;
    try {
      if (shouldRetryProcessing) {
        await retryProcessing.run(activeBatchId);
      } else {
        await startProcessing.run(activeBatchId);
      }
      navigate(`/processing?uploadId=${activeBatchId}`);
    } catch {
      // Inline error is rendered near the action button.
    }
  }

  async function handleStopProcessing() {
    if (!activeBatchId || !isProcessingActive) return;
    try {
      await stopProcessing.run(activeBatchId);
      navigate(`/processing?uploadId=${activeBatchId}`);
    } catch {
      // Inline error is rendered near the action button.
    }
  }

  function handleOpenProcessing() {
    if (!activeBatchId) return;
    navigate(`/processing?uploadId=${activeBatchId}`);
  }

  return (
    <div className="space-y-6 pb-24">
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
            onClick={() => {
              currentBatchIdRef.current = "";
              setSessionBatchIds(new Set());
              setSelectedBatchId("");
              setBatchMode("new");
              resetImportState({ all: true });
            }}
          >
            <div className="text-[14px]" style={{ fontWeight: 600 }}>Создать новую пачку</div>
            <div className="text-[12px] text-muted-foreground mt-1">Первый загруженный CSV создаст новый ID пачки.</div>
          </button>
          <div className={`rounded-lg border p-4 space-y-3 ${batchMode === "existing" ? "border-primary bg-primary/5" : "border-border"}`}>
            <button
              className="text-left w-full"
              onClick={() => {
                currentBatchIdRef.current = selectedBatchId;
                setBatchMode("existing");
              }}
            >
              <div className="text-[14px]" style={{ fontWeight: 600 }}>Добавить в существующую пачку</div>
              <div className="text-[12px] text-muted-foreground mt-1">Используйте, если уже загрузили часть файлов для этого экзамена.</div>
            </button>
            <select
              className="w-full h-9 rounded border border-border bg-background px-3 text-[13px]"
              value={selectedBatchId}
              onChange={(event) => {
                const nextBatchId = event.target.value;
                currentBatchIdRef.current = nextBatchId;
                setSelectedBatchId(nextBatchId);
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
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[12px] text-muted-foreground">
            Если на странице остались результаты от неверной пачки, сбросьте локальное состояние загрузки. Данные в БД не удаляются.
          </p>
          <Button view="flat-danger" size="s" className="text-[12px]" onClick={resetUploadPageState}>
            <span className="flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" />
              Сбросить состояние
            </span>
          </Button>
        </div>
        {uploadSelectionError && (
          <div className="rounded-lg bg-warning/5 border border-warning/20 px-3 py-2 text-[12px] text-warning">
            {uploadSelectionError}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
        {csvImportCards.map((card) => {
          const Icon = card.icon;
          const state = cardStates[card.kind];
          const uploadDisabled = Boolean(uploadSelectionError) || (isCreatingBatch && state.status !== "uploading");
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
              onDrop={(event) => {
                if (uploadDisabled) {
                  event.preventDefault();
                  setDragging(null);
                  return;
                }
                handleDrop(card.kind, event);
              }}
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
                  <Button
                    view="outlined"
                    size="s"
                    className="mt-2 text-[12px]"
                    onClick={() => inputs.current[card.kind]?.click()}
                    loading={state.status === "uploading"}
                    disabled={uploadDisabled}
                  >
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

              {state.status === "uploaded" && (
                <div className="border border-success/20 bg-success/5 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <span className="text-[13px] text-success" style={{ fontWeight: 500 }}>
                      Загружено {state.insertedCount ?? state.totalRows ?? 0} из {state.totalRows ?? 0}
                    </span>
                  </div>
                  {state.errorCount > 0 && <p className="text-[12px] text-warning">Предупреждений: {state.errorCount}</p>}
                  {state.filesCount > 1 && <p className="text-[12px] text-muted-foreground">Файлов этого типа: {state.filesCount}</p>}
                  <p className="text-[11px] text-muted-foreground break-all">Пачка: {state.importBatchId}</p>
                  <button className="text-[12px] text-primary hover:underline" onClick={() => state.uploadId && navigate(`/uploads/${state.uploadId}/log`)}>
                    Открыть журнал
                  </button>
                </div>
              )}

              {state.status === "error" && (
                <div className="border border-destructive/20 bg-destructive/5 rounded-lg p-3 flex gap-2 text-[12px] text-destructive">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{state.lastError}</span>
                </div>
              )}
              {state.status === "uploaded" && state.lastError && (
                <div className="border border-destructive/20 bg-destructive/5 rounded-lg p-3 flex gap-2 text-[12px] text-destructive">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Последняя попытка не загружена: {state.lastError}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px]" style={{ fontWeight: 600 }}>
            Проверка активной пачки
          </h3>
          <Label theme={validationLabel.theme}>{validationLabel.text}</Label>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-[13px]" style={{ fontWeight: 500 }}>Фильтр проверки</span>
            {hasValidationFilters && (
              <button onClick={resetValidationFilters} className="ml-auto flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
                Сбросить
              </button>
            )}
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <FilterFormField label="Тип">
                <TextInput placeholder="Тип файла" size="l" value={validationTypeFilter} onUpdate={setValidationTypeFilter} />
              </FilterFormField>
              <FilterFormField label="Статус">
                <Select
                  value={[validationStatusFilter]}
                  onUpdate={(value) => setValidationStatusFilter(value[0] ?? "all")}
                  options={[
                    { value: "all", content: "Все статусы" },
                    { value: "empty", content: "Ожидает CSV" },
                    { value: "uploading", content: "Загрузка" },
                    { value: "uploaded", content: "Загружено" },
                    { value: "error", content: "Ошибка" },
                  ]}
                  size="l"
                  width="max"
                />
              </FilterFormField>
              <FilterNumberRange label="Строк" from={validationRowsMin} to={validationRowsMax} onFromChange={setValidationRowsMin} onToChange={setValidationRowsMax} />
              <FilterNumberRange label="Добавлено" from={validationInsertedMin} to={validationInsertedMax} onFromChange={setValidationInsertedMin} onToChange={setValidationInsertedMax} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FilterNumberRange label="Файлов" from={validationFilesMin} to={validationFilesMax} onFromChange={setValidationFilesMin} onToChange={setValidationFilesMax} />
              <FilterNumberRange label="Ошибки" from={validationErrorsMin} to={validationErrorsMax} onFromChange={setValidationErrorsMin} onToChange={setValidationErrorsMax} />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-left">
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Тип</th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Статус</th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Строк</th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Добавлено</th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Файлов</th>
                <th className="pb-3" style={{ fontWeight: 500 }}>Ошибки</th>
              </tr>
            </thead>
            <tbody>
              {validationPagination.total === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">
                    По заданным условиям файлов не найдено
                  </td>
                </tr>
              ) : validationPagination.paginatedItems.map((card) => {
                const state = cardStates[card.kind];
                return (
                  <tr key={card.kind} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-4" style={{ fontWeight: 500 }}>{card.title}</td>
                    <td className="py-3 pr-4">
                      <Label theme={state.status === "error" ? "danger" : state.status === "uploaded" ? "success" : "info"}>
                        {validationStatusText(state.status)}
                      </Label>
                    </td>
                    <td className="py-3 pr-4">{state.totalRows ?? "-"}</td>
                    <td className="py-3 pr-4">{state.insertedCount ?? state.totalRows ?? "-"}</td>
                    <td className="py-3 pr-4">{state.filesCount || "-"}</td>
                    <td className="py-3 text-warning">{state.errorCount || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <TablePagination
          total={validationPagination.total}
          page={validationPagination.page}
          limit={validationPagination.limit}
          onPageChange={validationPagination.setPage}
          onLimitChange={validationPagination.setLimit}
          className="mt-4"
        />
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

      <div className="bg-card rounded-xl border border-border p-4 flex items-center justify-between gap-3 sticky bottom-0 mb-4">
        <div>
          <p className="text-[13px] text-muted-foreground">После загрузки CSV запустите обработку пачки.</p>
          <p className={`text-[12px] mt-1 ${startHintClass}`}>{startHint}</p>
          {(startProcessing.error || retryProcessing.error || stopProcessing.error) && <p className="text-[12px] mt-1 text-destructive">{startProcessing.error || retryProcessing.error || stopProcessing.error}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {isProcessingActive && (
            <Button view="outlined" className="text-[13px] h-9" loading={stopProcessing.loading} onClick={() => void handleStopProcessing()}>
              <span className="flex items-center gap-1.5">
                Остановить
                <Square className="w-4 h-4" />
              </span>
            </Button>
          )}
          <Button
            view="action"
            className="text-[13px] h-9"
            disabled={!canStartProcessing && !isProcessingActive}
            loading={startProcessing.loading || retryProcessing.loading}
            onClick={isProcessingActive ? handleOpenProcessing : () => void handleStartProcessing()}
          >
            <span className="flex items-center gap-1.5">
              {isProcessingActive ? "Открыть обработку" : shouldRetryProcessing ? "Перезапустить обработку" : "Начать обработку"}
              {shouldRetryProcessing ? <RotateCcw className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}

type ActiveCsvCardState = {
  status: "empty" | "uploading" | "uploaded" | "error";
  result?: { uploadId: string; importBatchId: string; totalRows: number; insertedCount: number; errorCount: number };
  uploadId?: string;
  importBatchId?: string;
  totalRows?: number;
  insertedCount?: number;
  errorCount: number;
  filesCount: number;
  lastError?: string;
};

function aggregateBatchFiles(uploads: AnyRecord[], kind: CsvKind) {
  const aggregate = {
    uploadId: undefined as string | undefined,
    importBatchId: undefined as string | undefined,
    totalRows: 0,
    insertedCount: 0,
    errorCount: 0,
    filesCount: 0,
  };
  for (const upload of uploads) {
    const files = (upload.files ?? {}) as Record<string, AnyRecord>;
    const file = files[kind];
    if (!file) continue;
    const summary = (upload.summary ?? {}) as AnyRecord;
    const rows = Number(file.rowsCount ?? upload.totalRows ?? summary.totalRows ?? 0);
    aggregate.uploadId = aggregate.uploadId ?? String(upload._id ?? "");
    aggregate.importBatchId = aggregate.importBatchId ?? String(upload.importBatchId ?? upload._id ?? "");
    aggregate.totalRows += rows;
    aggregate.insertedCount += Number(upload.matchedStudents ?? rows);
    aggregate.errorCount += Number(upload.errorCount ?? summary.errorCount ?? (upload.unresolvedStudents as unknown[] | undefined)?.length ?? 0);
    aggregate.filesCount += 1;
  }
  return aggregate;
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
