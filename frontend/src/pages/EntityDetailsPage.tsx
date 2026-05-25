import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { entityConfigs } from "../entities/config";
import { AnyRecord, printable, valueByPath } from "../entities/types";
import { api, ApiError } from "../shared/api/client";
import { useAuth } from "../app/providers/AuthProvider";

type Props = {
  name: keyof typeof entityConfigs;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function JsonValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <pre className="bg-muted rounded-lg p-3 text-[12px] overflow-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  if (isPlainObject(value)) {
    return (
      <div className="space-y-2">
        {Object.entries(value).map(([key, nestedValue]) => (
          <div className="border border-border rounded-lg p-3" key={key}>
            <div className="text-[12px] text-muted-foreground mb-1" style={{ fontWeight: 600 }}>{key}</div>
            <JsonValue value={nestedValue} />
          </div>
        ))}
      </div>
    );
  }

  return <span className="break-all">{printable(value) || "—"}</span>;
}

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

  return (
    <section className="bg-card rounded-xl border border-border p-5 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[20px]" style={{ fontWeight: 600 }}>{titleValue || config.title}</h2>
          <p className="text-muted-foreground text-[13px] mt-1">Все атрибуты записи</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {additionalNodes}
          {canEdit && !editing && (
            <button className="button button_secondary" type="button" onClick={startEditing}>
              Редактировать
            </button>
          )}
          <Link className="button" to={backPath}>
            Назад
          </Link>
        </div>
      </div>

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
      {!loading && record && (
        <div className="columns-1 lg:columns-2 gap-3">
          {Object.entries(record).map(([key, value]) => (
            <div className="break-inside-avoid border border-border rounded-xl p-4 space-y-2 mb-3" key={key}>
              <div className="text-[12px] text-muted-foreground" style={{ fontWeight: 600 }}>{key}</div>
              <div className="text-[13px]">
                <JsonValue value={value} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
