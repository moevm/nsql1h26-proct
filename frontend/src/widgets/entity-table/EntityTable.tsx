import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError, buildQuery, ListResponse } from "../../shared/api/client";
import { FilterPanel } from "../../shared/ui/FilterPanel";
import { AnyRecord, EntityConfig, printable, valueByPath } from "../../entities/types";
import { useUrlFilters } from "../../features/filtering/useUrlFilters";
import { useModal } from "../../app/providers/ModalProvider";
import { useAuth } from "../../app/providers/AuthProvider";

type Props = {
  config: EntityConfig;
  rowLink?: (row: AnyRecord) => string | undefined;
  extraActions?: ReactNode;
};

function CreateEntityForm({ config, onCreated }: { config: EntityConfig; onCreated: () => void }) {
  const [value, setValue] = useState(JSON.stringify(config.createTemplate, null, 2));
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api(config.createEndpoint ?? config.endpoint, {
        method: "POST",
        body: value,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка создания");
    }
  }

  return (
    <form className="json-form" onSubmit={submit}>
      <p>Добавление выполняется через сервер приложения. JSON можно отредактировать перед сохранением.</p>
      <textarea value={value} onChange={(event) => setValue(event.target.value)} rows={14} />
      {error && <div className="error">{error}</div>}
      <button className="button" type="submit">
        Сохранить
      </button>
    </form>
  );
}

export function EntityTable({ config, rowLink, extraActions }: Props) {
  const [params] = useSearchParams();
  const [data, setData] = useState<ListResponse<AnyRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { openModal, closeModal } = useModal();
  const { user } = useAuth();
  const filters = useUrlFilters(config.filters);
  const query = useMemo(() => buildQuery(params), [params]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await api<ListResponse<AnyRecord>>(`${config.endpoint}${query}`));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? "Недостаточно прав для просмотра этой таблицы" : err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [config.endpoint, query]);

  return (
    <section className="bg-card rounded-xl border border-border p-5 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[20px]" style={{ fontWeight: 600 }}>{config.title}</h2>
          <p className="text-muted-foreground text-[13px] mt-1">Текстовый поиск выполняется по подстроке без учёта регистра.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {extraActions}
          {user?.role === "admin" && config.endpoint !== "/audit-logs" && (
            <button className="button" onClick={() => openModal(`Добавить: ${config.title}`, <CreateEntityForm config={config} onCreated={() => { closeModal(); void load(); }} />)}>
              Добавить
            </button>
          )}
        </div>
      </div>

      <FilterPanel fields={config.filters} draft={filters.draft} setDraft={filters.setDraft} onSubmit={filters.submit} onReset={filters.reset} />

      {loading && <div className="notice">Загрузка данных...</div>}
      {error && <div className="error">{error}</div>}
      {!loading && data && (
        <>
          <div className="text-[13px] text-muted-foreground">
            Найдено: <span className="text-foreground" style={{ fontWeight: 500 }}>{data.total}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  {config.columns.map((column) => (
                    <th className="pb-3 pr-4" style={{ fontWeight: 500 }} key={column.key}>{column.label}</th>
                  ))}
                  {rowLink && <th className="pb-3" style={{ fontWeight: 500 }}>Переход</th>}
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors" key={row._id ?? JSON.stringify(row)}>
                    {config.columns.map((column) => (
                      <td className="py-3 pr-4 max-w-[280px] truncate" key={column.key}>{printable(valueByPath(row, column.key))}</td>
                    ))}
                    {rowLink && (
                      <td className="py-3">
                        {rowLink(row) ? (
                          <Link className="text-link" to={rowLink(row)!}>
                            Открыть
                          </Link>
                        ) : (
                          ""
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
