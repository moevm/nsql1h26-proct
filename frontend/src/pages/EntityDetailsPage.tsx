import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { entityConfigs } from "../entities/config";
import { AnyRecord, printable, valueByPath } from "../entities/types";
import { api, ApiError } from "../shared/api/client";
import { useAuth } from "../app/providers/AuthProvider";
import { RecordDetailsView } from "../shared/ui/RecordDetailsView";

type Props = {
  name: keyof typeof entityConfigs;
};

export function EntityDetailsPage({ name }: Props) {
  const { id } = useParams();
  const config = entityConfigs[name];
  const { user } = useAuth();
  const [record, setRecord] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setError("");
    void api<AnyRecord>(`${config.endpoint}/${id}`)
      .then(setRecord)
      .catch((err) => setError(err instanceof ApiError && err.status === 404 ? "Запись не найдена" : err instanceof Error ? err.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [config.endpoint, id]);

  const titleValue = record && config.detailTitleKey ? printable(valueByPath(record, config.detailTitleKey)) : "";
  const backPath = config.detailBackPath ?? `/${name}`;
  const additionalNodes = record ? config.detailAdditionalNodes?.(record) : null;
  const canEdit = Boolean(config.detailEditable && user?.role === "admin" && record);

  function startEditing() {
    if (!record) return;
    setEditValue(JSON.stringify(record, null, 2));
    setSaveError("");
    setEditing(true);
  }

  async function saveEdit() {
    if (!id) return;

    setSaving(true);
    setSaveError("");
    try {
      const payload = JSON.parse(editValue) as AnyRecord;
      const updated = await api<AnyRecord>(`${config.endpoint}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setRecord(updated);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof SyntaxError ? "JSON заполнен некорректно" : err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  const actions = (
    <>
      {additionalNodes}
      {canEdit && !editing && (
        <button className="button button_secondary" type="button" onClick={startEditing}>
          Редактировать
        </button>
      )}
      <Link className="button" to={backPath}>
        Назад
      </Link>
    </>
  );

  return (
    <RecordDetailsView record={!loading ? record : null} title={titleValue || config.title} actions={actions}>
      {loading && <div className="notice">Загрузка данных...</div>}
      {error && <div className="error">{error}</div>}
      {editing && record && (
        <div className="border border-border rounded-xl p-4 space-y-3">
          <div>
            <h3 className="text-[16px]" style={{ fontWeight: 600 }}>Редактирование</h3>
            <p className="text-[12px] text-muted-foreground mt-1">Измените JSON и сохраните запись.</p>
          </div>
          <textarea className="w-full font-mono text-[12px]" rows={18} value={editValue} onChange={(event) => setEditValue(event.target.value)} />
          {saveError && <div className="error">{saveError}</div>}
          <div className="flex justify-end gap-2">
            <button className="button button_secondary" type="button" onClick={() => setEditing(false)} disabled={saving}>
              Отмена
            </button>
            <button className="button" type="button" onClick={() => void saveEdit()} disabled={saving}>
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </div>
      )}
    </RecordDetailsView>
  );
}
