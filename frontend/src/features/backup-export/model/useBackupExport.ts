import { useState } from "react";
import { api } from "../../../shared/api/client";
import { saveJsonFile } from "../../../shared/lib/format";

export function useBackupExport() {
  const [exporting, setExporting] = useState(false);
  const [lastExportedAt, setLastExportedAt] = useState<string | null>(null);
  const [lastFileName, setLastFileName] = useState<string | null>(null);

  async function exportBackup() {
    setExporting(true);
    try {
      const data = await api<Record<string, unknown[]>>("/backup/export");
      const fileName = `backup_proctoring_${new Date().toISOString().slice(0, 10)}.json`;
      saveJsonFile(data, fileName);
      setLastExportedAt(new Date().toLocaleString("ru-RU"));
      setLastFileName(fileName);
    } finally {
      setExporting(false);
    }
  }

  return { exporting, lastExportedAt, lastFileName, exportBackup };
}
