import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AnyRecord } from "../entities/types";
import { api, ApiError } from "../shared/api/client";
import { RecordDetailsView } from "../shared/ui/RecordDetailsView";

export function ProcessingLogDetailsPage() {
  const { uploadId = "", entryIndex = "" } = useParams<{ uploadId?: string; entryIndex?: string }>();
  const [record, setRecord] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const index = Number(entryIndex);
    if (!uploadId || !Number.isInteger(index) || index < 0) {
      setRecord(null);
      setError("Запись журнала не найдена");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setRecord(null);
    void api<{ processingLog?: AnyRecord[] }>(`/uploads/${uploadId}/log`)
      .then((data) => {
        const entry = data.processingLog?.[index];
        if (!entry) {
          setError("Запись журнала не найдена");
          return;
        }
        setRecord(entry);
      })
      .catch((err) => setError(err instanceof ApiError && err.status === 404 ? "Загрузка не найдена" : err instanceof Error ? err.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [entryIndex, uploadId]);

  const actions = (
    <>
      <Link className="button button_secondary" to={`/upload-history/${uploadId}`}>
        Загрузка
      </Link>
      <Link className="button" to="/processing">
        Назад
      </Link>
    </>
  );

  return (
    <RecordDetailsView
      record={!loading ? record : null}
      title={`Запись журнала #${Number(entryIndex) + 1 || ""}`}
      subtitle="Все атрибуты записи журнала обработки"
      actions={actions}
    >
      {loading && <div className="notice">Загрузка данных...</div>}
      {error && <div className="error">{error}</div>}
    </RecordDetailsView>
  );
}
