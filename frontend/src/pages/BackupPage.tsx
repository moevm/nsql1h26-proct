import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { HardDrive, Download, Upload, CheckCircle2, AlertTriangle, Clock, XCircle, Filter, X } from "lucide-react";
import { Button, Label, Select, TextInput } from "@gravity-ui/uikit";
import { api } from "../shared/api/client";
import { useBackupExport } from "../features/backup-export/model/useBackupExport";
import { formatDate, formatNumber } from "../shared/lib/format";
import { readStoredPageSize, writeStoredPageSize } from "../shared/lib/paginationStorage";
import { FilterDateTimeRange, FilterFormField, FilterNumberRange } from "../shared/ui/FilterField";
import { TablePagination } from "../shared/ui/TablePagination";

type BackupOperation = "export" | "import" | "validate";
type BackupStatus = "success" | "failed";

interface BackupHistoryRecord {
  _id?: string;
  operation: BackupOperation;
  status: BackupStatus;
  fileName: string;
  sizeBytes: number;
  compressedSizeBytes?: number;
  collectionCounts: Record<string, number>;
  backupVersion?: string;
  actorName: string;
  createdAt: string;
  errorMessage?: string;
  hasPayload?: boolean;
}

interface BackupValidationResult {
  valid: boolean;
  counts: Record<string, number>;
  errors: string[];
  warnings: string[];
}

interface BackupHistoryResponse {
  items: BackupHistoryRecord[];
  total: number;
  page: number;
  limit: number;
}

const operationLabels: Record<BackupOperation, string> = {
  export: "Экспорт",
  import: "Импорт",
  validate: "Проверка",
};

function formatBytes(value: unknown) {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export function BackupPage() {
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [history, setHistory] = useState<BackupHistoryRecord[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(() => readStoredPageSize("table-page-size", 10));
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [fileFilter, setFileFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sizeMin, setSizeMin] = useState("");
  const [sizeMax, setSizeMax] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [operationFilter, setOperationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailsFilter, setDetailsFilter] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { exporting, exportBackup, exportHistoryBackup } = useBackupExport();

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const query = new URLSearchParams({
        page: String(historyPage),
        limit: String(historyLimit),
      });
      if (fileFilter) query.set("fileName", fileFilter);
      if (dateFrom) query.set("createdAtFrom", dateFrom);
      if (dateTo) query.set("createdAtTo", dateTo);
      if (sizeMin) query.set("sizeMin", sizeMin);
      if (sizeMax) query.set("sizeMax", sizeMax);
      if (authorFilter) query.set("actorName", authorFilter);
      if (operationFilter !== "all") query.set("operation", operationFilter);
      if (statusFilter !== "all") query.set("status", statusFilter);
      if (detailsFilter) query.set("details", detailsFilter);
      const data = await api<BackupHistoryResponse>(`/backup/history?${query.toString()}`);
      setHistory(data.items);
      setHistoryTotal(data.total);
      setHistoryPage(data.page);
      setHistoryLimit(data.limit);
    } catch (error) {
      setHistory([]);
      setHistoryTotal(0);
      setHistoryError(error instanceof Error ? error.message : "Не удалось загрузить историю бэкапов");
    } finally {
      setHistoryLoading(false);
    }
  }, [authorFilter, dateFrom, dateTo, detailsFilter, fileFilter, historyLimit, historyPage, operationFilter, sizeMax, sizeMin, statusFilter]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function handleExport() {
    await exportBackup();
    await loadHistory();
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const validation = await api<BackupValidationResult>("/backup/validate", { method: "POST", body: formData });
      if (!validation.valid) {
        setImportStatus(`Бэкап не прошел проверку: ${validation.errors.join("; ")}`);
        await loadHistory();
        return;
      }

      const totalRows = Object.values(validation.counts ?? {}).reduce((sum, count) => sum + Number(count ?? 0), 0);
      const confirmed = window.confirm(
        `Восстановить базу из файла ${file.name}?\n\nТекущие данные будут полностью перезаписаны. В бэкапе найдено записей: ${formatNumber(totalRows)}.`,
      );
      if (!confirmed) {
        setImportStatus("Импорт отменен пользователем");
        await loadHistory();
        return;
      }

      const importFormData = new FormData();
      importFormData.append("file", file);
      await api("/backup/import?confirmOverwrite=true", { method: "POST", body: importFormData });
      setImportStatus("Бэкап импортирован");
      await loadHistory();
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : "Не удалось импортировать бэкап");
      await loadHistory();
    } finally {
      setImporting(false);
    }
  };
  const hasHistoryFilters = fileFilter || dateFrom || dateTo || sizeMin || sizeMax || authorFilter || operationFilter !== "all" || statusFilter !== "all" || detailsFilter;
  const resetHistoryFilters = () => {
    setFileFilter("");
    setDateFrom("");
    setDateTo("");
    setSizeMin("");
    setSizeMax("");
    setAuthorFilter("");
    setOperationFilter("all");
    setStatusFilter("all");
    setDetailsFilter("");
    setHistoryPage(1);
  };
  const updateHistoryLimit = (limit: number) => {
    writeStoredPageSize("table-page-size", limit);
    setHistoryLimit(limit);
    setHistoryPage(1);
  };
  const updateHistoryFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setHistoryPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <HardDrive className="w-5 h-5 text-primary" />
          <h1 className="text-[22px]" style={{ fontWeight: 600 }}>Резервное копирование</h1>
        </div>
        <p className="text-muted-foreground text-[14px]">Полный экспорт и импорт базы данных системы</p>
      </div>

      <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-warning mt-0.5 shrink-0" />
        <div>
          <div className="text-[14px] text-warning" style={{ fontWeight: 500 }}>Важно</div>
          <p className="text-[13px] text-foreground/80 mt-0.5">Импорт бэкапа полностью перезапишет все текущие данные системы, включая загрузки, результаты кластеризации и отчёты. Перед восстановлением рекомендуется создать новый бэкап.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Download className="w-5 h-5 text-primary" /></div>
            <div><h3 className="text-[15px]" style={{ fontWeight: 600 }}>Экспорт всей базы</h3><p className="text-[12px] text-muted-foreground">Скачать полный дамп всех данных</p></div>
          </div>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Формат</span><span style={{ fontWeight: 500 }}>JSON.GZ</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Включает</span><span style={{ fontWeight: 500 }}>Загрузки, сессии, кластеры, отчёты</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Источник</span><span style={{ fontWeight: 500 }}>Текущая MongoDB</span></div>
          </div>
          <Button view="action" width="max" className="h-10" loading={exporting} onClick={() => void handleExport()}>
            <span className="flex items-center gap-1.5"><Download className="w-4 h-4" />{exporting ? "Формирование..." : "Экспорт всей базы"}</span>
          </Button>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center"><Upload className="w-5 h-5 text-warning" /></div>
            <div><h3 className="text-[15px]" style={{ fontWeight: 600 }}>Импорт из файла</h3><p className="text-[12px] text-muted-foreground">Восстановить базу из бэкапа</p></div>
          </div>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Поддерживаемый формат</span><span style={{ fontWeight: 500 }}>JSON, JSON.GZ</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Действие</span><span className="text-warning" style={{ fontWeight: 500 }}>Перезапись всех данных</span></div>
          </div>
          <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-warning/40 transition-colors cursor-pointer">
            <Upload className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-[13px] text-muted-foreground">Перетащите файл бэкапа или</p>
            <input ref={inputRef} className="hidden" type="file" accept=".json,.json.gz,.gz,application/json,application/gzip" onChange={(event) => void handleImport(event)} />
            <Button view="outlined" size="s" className="mt-2 text-[12px]" loading={importing} onClick={() => inputRef.current?.click()}>Выбрать файл</Button>
            {importStatus && <p className="text-[12px] text-muted-foreground mt-2">{importStatus}</p>}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-[15px]" style={{ fontWeight: 600 }}>История бэкапов</h3>
          </div>
          <Button view="flat" size="s" className="text-[12px]" onClick={() => void loadHistory()} loading={historyLoading}>
            Обновить
          </Button>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-[13px]" style={{ fontWeight: 500 }}>Фильтр истории бэкапов</span>
            {hasHistoryFilters && (
              <button onClick={resetHistoryFilters} className="ml-auto flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
                Сбросить
              </button>
            )}
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <FilterFormField label="Файл">
                <TextInput placeholder="Имя файла" size="l" value={fileFilter} onUpdate={updateHistoryFilter(setFileFilter)} />
              </FilterFormField>
              <FilterFormField label="Автор">
                <TextInput placeholder="Автор операции" size="l" value={authorFilter} onUpdate={updateHistoryFilter(setAuthorFilter)} />
              </FilterFormField>
              <FilterFormField label="Операция">
                <Select
                  value={[operationFilter]}
                  onUpdate={(value) => {
                    setOperationFilter(value[0] ?? "all");
                    setHistoryPage(1);
                  }}
                  options={[
                    { value: "all", content: "Все операции" },
                    { value: "export", content: "Экспорт" },
                    { value: "import", content: "Импорт" },
                    { value: "validate", content: "Проверка" },
                  ]}
                  size="l"
                  width="max"
                />
              </FilterFormField>
              <FilterFormField label="Статус">
                <Select
                  value={[statusFilter]}
                  onUpdate={(value) => {
                    setStatusFilter(value[0] ?? "all");
                    setHistoryPage(1);
                  }}
                  options={[
                    { value: "all", content: "Все статусы" },
                    { value: "success", content: "Готово" },
                    { value: "failed", content: "Ошибка" },
                  ]}
                  size="l"
                  width="max"
                />
              </FilterFormField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <FilterDateTimeRange label="Дата" from={dateFrom} to={dateTo} onFromChange={updateHistoryFilter(setDateFrom)} onToChange={updateHistoryFilter(setDateTo)} />
              <FilterNumberRange label="Размер, байт" from={sizeMin} to={sizeMax} onFromChange={updateHistoryFilter(setSizeMin)} onToChange={updateHistoryFilter(setSizeMax)} />
              <FilterFormField label="Детали">
                <TextInput placeholder="Ошибка или количество коллекций" size="l" value={detailsFilter} onUpdate={updateHistoryFilter(setDetailsFilter)} />
              </FilterFormField>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-left">
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Файл</th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Дата</th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Размер</th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Автор</th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Операция</th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Статус</th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Детали</th>
                <th className="pb-3" style={{ fontWeight: 500 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr><td colSpan={8} className="py-10 text-center text-muted-foreground">Загрузка истории...</td></tr>
              ) : historyError ? (
                <tr><td colSpan={8} className="py-10 text-center text-destructive">{historyError}</td></tr>
              ) : history.length === 0 && !hasHistoryFilters ? (
                <tr><td colSpan={8} className="py-10 text-center text-muted-foreground">История бэкапов пока пуста</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-muted-foreground">По заданным условиям бэкапов не найдено</td></tr>
              ) : (
                history.map((item) => (
                  <tr key={item._id ?? `${item.operation}-${item.createdAt}-${item.fileName}`} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                    <td className="py-3 pr-4"><code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{item.fileName}</code></td>
                    <td className="py-3 pr-4 font-mono text-[12px] text-muted-foreground">{formatDate(item.createdAt)}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{formatBytes(item.compressedSizeBytes ?? item.sizeBytes)}</td>
                    <td className="py-3 pr-4">{item.actorName}</td>
                    <td className="py-3 pr-4">{operationLabels[item.operation] ?? item.operation}</td>
                    <td className="py-3 pr-4">
                      {item.status === "success" ? (
                        <Label theme="success" icon={<CheckCircle2 className="w-3 h-3" />}>Готово</Label>
                      ) : (
                        <Label theme="danger" icon={<XCircle className="w-3 h-3" />}>Ошибка</Label>
                      )}
                    </td>
                    <td className="py-3 text-muted-foreground max-w-[320px] truncate" title={item.errorMessage || undefined}>
                      {item.errorMessage || `Коллекций: ${Object.keys(item.collectionCounts ?? {}).length}`}
                    </td>
                    <td className="py-3">
                      {item.operation === "export" && item.status === "success" ? (
                        <Button
                          view="outlined"
                          size="s"
                          className="text-[12px] h-7"
                          disabled={!item.hasPayload || !item._id}
                          title={item.hasPayload ? "Скачать сохраненный бэкап" : "Для старой записи файл бэкапа не сохранен"}
                          loading={exporting}
                          onClick={() => item._id && void exportHistoryBackup(item._id, item.fileName)}
                        >
                          <span className="flex items-center gap-1"><Download className="w-3 h-3" />Скачать</span>
                        </Button>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          total={historyTotal}
          page={historyPage}
          limit={historyLimit}
          onPageChange={setHistoryPage}
          onLimitChange={updateHistoryLimit}
          className="mt-4"
        />
      </div>
    </div>
  );
}
