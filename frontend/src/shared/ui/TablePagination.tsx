import { defaultPageSizeOptions } from "../lib/paginationStorage";

type TablePaginationProps = {
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  pageSizeOptions?: number[];
  className?: string;
};

export function TablePagination({
  total,
  page,
  limit,
  onPageChange,
  onLimitChange,
  pageSizeOptions = defaultPageSizeOptions,
  className = "",
}: TablePaginationProps) {
  const safeLimit = Math.max(1, limit || pageSizeOptions[0] || 1);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const safePage = Math.min(Math.max(1, page || 1), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * safeLimit + 1;
  const to = Math.min(safePage * safeLimit, total);
  const options = pageSizeOptions.includes(safeLimit) ? pageSizeOptions : [...pageSizeOptions, safeLimit].sort((a, b) => a - b);

  return (
    <div className={`flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-border text-[13px] ${className}`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>Показаны</span>
        <span className="text-foreground" style={{ fontWeight: 500 }}>
          {from}-{to}
        </span>
        <span>из</span>
        <span className="text-foreground" style={{ fontWeight: 500 }}>
          {total}
        </span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-muted-foreground">
          <span>На странице</span>
          <select
            className="h-[34px]"
            value={safeLimit}
            onChange={(event) => onLimitChange(Number(event.target.value))}
            aria-label="Количество записей на странице"
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button className="button button_secondary" type="button" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>
            Назад
          </button>
          <span className="text-muted-foreground">
            Страница{" "}
            <span className="text-foreground" style={{ fontWeight: 500 }}>
              {safePage}
            </span>{" "}
            из{" "}
            <span className="text-foreground" style={{ fontWeight: 500 }}>
              {totalPages}
            </span>
          </span>
          <button className="button button_secondary" type="button" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)}>
            Вперёд
          </button>
        </div>
      </div>
    </div>
  );
}
