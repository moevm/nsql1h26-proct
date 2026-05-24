import { ChangeEvent, useRef, useState } from "react";
import { HardDrive, Download, Upload, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { Button, Label } from "@gravity-ui/uikit";
import { api } from "../shared/api/client";
import { useBackupExport } from "../features/backup-export/model/useBackupExport";

export function BackupPage() {
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { exporting, lastExportedAt, lastFileName, exportBackup } = useBackupExport();

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const payload = JSON.parse(await file.text()) as Record<string, unknown[]>;
      await api("/backup/import", { method: "POST", body: JSON.stringify(payload) });
      setImportStatus("Бэкап импортирован");
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : "Не удалось импортировать бэкап");
    } finally {
      setImporting(false);
    }
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
            <div className="flex justify-between"><span className="text-muted-foreground">Формат</span><span style={{ fontWeight: 500 }}>JSON.GZ (сжатый)</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Включает</span><span style={{ fontWeight: 500 }}>Загрузки, сессии, кластеры, отчёты</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Источник</span><span style={{ fontWeight: 500 }}>Текущая MongoDB</span></div>
          </div>
          <Button view="action" width="max" className="h-10" loading={exporting} onClick={() => void exportBackup()}>
            <span className="flex items-center gap-1.5"><Download className="w-4 h-4" />{exporting ? "Формирование..." : "Экспорт всей базы"}</span>
          </Button>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center"><Upload className="w-5 h-5 text-warning" /></div>
            <div><h3 className="text-[15px]" style={{ fontWeight: 600 }}>Импорт из файла</h3><p className="text-[12px] text-muted-foreground">Восстановить базу из бэкапа</p></div>
          </div>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Поддерживаемые форматы</span><span style={{ fontWeight: 500 }}>JSON.GZ, JSON</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Действие</span><span className="text-warning" style={{ fontWeight: 500 }}>Перезапись всех данных</span></div>
          </div>
          <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-warning/40 transition-colors cursor-pointer">
            <Upload className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-[13px] text-muted-foreground">Перетащите файл бэкапа или</p>
            <input ref={inputRef} className="hidden" type="file" accept=".json,application/json" onChange={(event) => void handleImport(event)} />
            <Button view="outlined" size="s" className="mt-2 text-[12px]" loading={importing} onClick={() => inputRef.current?.click()}>Выбрать файл</Button>
            {importStatus && <p className="text-[12px] text-muted-foreground mt-2">{importStatus}</p>}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4"><Clock className="w-4 h-4 text-muted-foreground" /><h3 className="text-[15px]" style={{ fontWeight: 600 }}>Текущий экспорт</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b border-border text-muted-foreground text-left"><th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Файл</th><th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Создан</th><th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Автор</th><th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Статус</th></tr></thead>
            <tbody>
              {!lastFileName ? (
                <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">История бэкапов пока не хранится. После экспорта здесь появится файл текущей сессии.</td></tr>
              ) : (
                <tr className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                  <td className="py-3 pr-4"><code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{lastFileName}</code></td>
                  <td className="py-3 pr-4 font-mono text-[12px] text-muted-foreground">{lastExportedAt}</td>
                  <td className="py-3 pr-4">Система</td>
                  <td className="py-3 pr-4"><Label theme="success" icon={<CheckCircle2 className="w-3 h-3" />}>Готово</Label></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
