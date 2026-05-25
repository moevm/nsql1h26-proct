import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { entityConfigs } from "../entities/config";
import { AnyRecord, printable, valueByPath } from "../entities/types";
import { api, ApiError } from "../shared/api/client";

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
  const [record, setRecord] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <section className="bg-card rounded-xl border border-border p-5 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[20px]" style={{ fontWeight: 600 }}>{titleValue || config.title}</h2>
          <p className="text-muted-foreground text-[13px] mt-1">Все атрибуты записи</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {name === "sessions" && record?._id && (
            <Link className="button button_secondary" to={`/events?sessionId=${record._id}`}>
              События сессии
            </Link>
          )}
          <Link className="button" to={backPath}>
            Назад
          </Link>
        </div>
      </div>

      {loading && <div className="notice">Загрузка данных...</div>}
      {error && <div className="error">{error}</div>}
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
