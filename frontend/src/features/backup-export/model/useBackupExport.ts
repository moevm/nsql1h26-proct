import { useState } from "react";
import { downloadApiFile } from "../../../shared/api/client";

export function useBackupExport() {
  const [exporting, setExporting] = useState(false);

  async function exportBackup() {
    setExporting(true);
    try {
      const fileName = `backup_proctoring_${new Date().toISOString().replace(/[:.]/g, "-")}.json.gz`;
      await downloadApiFile("/backup/export", fileName);
    } finally {
      setExporting(false);
    }
  }

  async function exportHistoryBackup(id: string, fileName: string) {
    setExporting(true);
    try {
      await downloadApiFile(`/backup/history/${id}/export`, fileName);
    } finally {
      setExporting(false);
    }
  }

  return { exporting, exportBackup, exportHistoryBackup };
}
