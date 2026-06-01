import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<ListResponse<AnyRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { openModal, closeModal } = useModal();
  const { user } = useAuth();
  const filters = useUrlFilters(config.filters);
  const query = useMemo(() => buildQuery(params), [params]);
  const requestedPage = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const requestedLimit = Math.min(200, Math.max(5, Number(params.get("limit") ?? 50) || 50));

  function setPage(page: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(Math.max(1, page)));
    setParams(next);
  }

  function setLimit(limit: string) {
    const next = new URLSearchParams(params);
    next.set("limit", limit);
    next.set("page", "1");
    setParams(next);
  }

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
          <div className="flex items-center justify-between gap-3 flex-wrap text-[13px] text-muted-foreground">
            <div>
              Найдено: <span className="text-foreground" style={{ fontWeight: 500 }}>{data.total}</span>
            </div>
            <div>
              Показаны записи{" "}
              <span className="text-foreground" style={{ fontWeight: 500 }}>
                {data.total === 0 ? 0 : (data.page - 1) * data.limit + 1}-{Math.min(data.page * data.limit, data.total)}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  {config.columns.map((column) => (
                    <th className="pb-3 pr-4" style={{ fontWeight: 500 }} key={column.key}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => {
                  const link = rowLink?.(row);

                  return (
                    <tr
                      className={`border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors ${link ? "cursor-pointer" : ""}`}
                      key={row._id ?? JSON.stringify(row)}
                      onClick={() => { if (link) navigate(link); }}
                      onKeyDown={(event) => {
                        if (!link || (event.key !== "Enter" && event.key !== " ")) return;
                        event.preventDefault();
                        navigate(link);
                      }}
                      tabIndex={link ? 0 : undefined}
                      role={link ? "link" : undefined}
                      title={link ? "Открыть запись" : undefined}
                      aria-label={link ? "Открыть запись" : undefined}
                    >
                      {config.columns.map((column) => (
                        <td className="py-3 pr-4 max-w-[280px] truncate" key={column.key}>{printable(valueByPath(row, column.key))}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-border text-[13px]">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>На странице</span>
              <select
                className="h-[34px]"
                value={String(data.limit ?? requestedLimit)}
                onChange={(event) => setLimit(event.target.value)}
                aria-label="Количество записей на странице"
              >
                {[10, 25, 50, 100, 200].map((limit) => (
                  <option key={limit} value={limit}>
                    {limit}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button className="button button_secondary" type="button" disabled={(data.page ?? requestedPage) <= 1} onClick={() => setPage((data.page ?? requestedPage) - 1)}>
                Назад
              </button>
              <span className="text-muted-foreground">
                Страница <span className="text-foreground" style={{ fontWeight: 500 }}>{data.page ?? requestedPage}</span> из{" "}
                <span className="text-foreground" style={{ fontWeight: 500 }}>{Math.max(1, Math.ceil(data.total / (data.limit || requestedLimit)))}</span>
              </span>
              <button
                className="button button_secondary"
                type="button"
                disabled={(data.page ?? requestedPage) >= Math.max(1, Math.ceil(data.total / (data.limit || requestedLimit)))}
                onClick={() => setPage((data.page ?? requestedPage) + 1)}
              >
                Вперёд
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
