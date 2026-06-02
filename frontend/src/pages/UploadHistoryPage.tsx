import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileStack,
  Search,
  Filter,
  ScrollText,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  Cpu,
  RotateCcw,
  Square,
} from "lucide-react";
import { Button, TextInput, Select, Label } from "@gravity-ui/uikit";
import { isActiveProcessingStatus, isRetryableProcessingStatus } from "../entities/upload/model/adapters";
import { useRetryProcessing, useStopProcessing, useUploads } from "../entities/upload/model/hooks";
import { getUploadStatusLabel } from "../shared/config/ui";
import { api } from "../shared/api/client";
import { dateFilterValue, matchesDateRange, matchesNumberRange, matchesText } from "../shared/lib/clientFilters";
import { readStoredPageSize, writeStoredPageSize } from "../shared/lib/paginationStorage";
import { FilterDateTimeRange, FilterFormField, FilterNumberRange } from "../shared/ui/FilterField";
import { TablePagination } from "../shared/ui/TablePagination";

type SortField = "id" | "date" | "author" | "status";
type SortDir = "asc" | "desc";

export function UploadHistoryPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(() => readStoredPageSize("table-page-size", 10));
  const { groupedBatches: batches, total, refetch } = useUploads({ page, limit });
  const stopProcessing = useStopProcessing();
  const retryProcessing = useRetryProcessing();
  const [idFilter, setIdFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [authorFilter, setAuthorFilter] = useState("all");
  const [fileTypesFilter, setFileTypesFilter] = useState("");
  const [filesMin, setFilesMin] = useState("");
  const [filesMax, setFilesMax] = useState("");
  const [rowsMin, setRowsMin] = useState("");
  const [rowsMax, setRowsMax] = useState("");
  const [studentsMin, setStudentsMin] = useState("");
  const [studentsMax, setStudentsMax] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [actingBatchId, setActingBatchId] = useState("");

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 text-primary" />
      : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  const authors = [...new Set(batches.map((b) => b.author))];
  const dateFromTime = dateFilterValue(dateFrom);
  const dateToTime = dateFilterValue(dateTo);

  const filtered = batches
    .filter((b) => {
      if (!matchesText(b.id, idFilter)) return false;
      if (!matchesText(b.fileTypes, fileTypesFilter)) return false;
      if (statusFilter !== "all" && !matchesStatusFilter(b.status, statusFilter)) return false;
      if (authorFilter !== "all" && b.author !== authorFilter) return false;
      if (!matchesNumberRange(b.files, filesMin, filesMax)) return false;
      if (!matchesNumberRange(b.rowsCount, rowsMin, rowsMax)) return false;
      if (!matchesNumberRange(b.studentsCount, studentsMin, studentsMax)) return false;
      if (!matchesDateRange(b.createdAt, dateFromTime, dateToTime)) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "id") cmp = a.id.localeCompare(b.id);
      else if (sortField === "date") cmp = a.createdAt.localeCompare(b.createdAt);
      else if (sortField === "author") cmp = a.author.localeCompare(b.author);
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      return sortDir === "asc" ? cmp : -cmp;
    });
  const hasFilters =
    idFilter ||
    dateFrom ||
    dateTo ||
    statusFilter !== "all" ||
    authorFilter !== "all" ||
    fileTypesFilter ||
    filesMin ||
    filesMax ||
    rowsMin ||
    rowsMax ||
    studentsMin ||
    studentsMax;

  const resetFilters = () => {
    setIdFilter("");
    setDateFrom("");
    setDateTo("");
    setStatusFilter("all");
    setAuthorFilter("all");
    setFileTypesFilter("");
    setFilesMin("");
    setFilesMax("");
    setRowsMin("");
    setRowsMax("");
    setStudentsMin("");
    setStudentsMax("");
    setPage(1);
  };
  const updateLimit = (nextLimit: number) => {
    writeStoredPageSize("table-page-size", nextLimit);
    setLimit(nextLimit);
    setPage(1);
  };

  const deleteBatch = async (id: string) => {
    if (!window.confirm("Удалить эту пачку загрузок и связанные данные?")) return;
    await api(`/uploads/${id}`, { method: "DELETE" });
    refetch();
  };

  const stopBatchProcessing = async (id: string) => {
    if (!window.confirm("Остановить обработку? Исходные файлы сохранятся, обработку можно будет перезапустить.")) return;
    setActingBatchId(id);
    try {
      await stopProcessing.run(id);
      refetch();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Не удалось остановить обработку");
    } finally {
      setActingBatchId("");
    }
  };

  const retryBatchProcessing = async (id: string) => {
    setActingBatchId(id);
    try {
      await retryProcessing.run(id);
      refetch();
      navigate(`/processing?uploadId=${id}`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Не удалось перезапустить обработку");
    } finally {
      setActingBatchId("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileStack className="w-5 h-5 text-primary" />
            <h1 className="text-[22px]" style={{ fontWeight: 600 }}>История загрузок</h1>
          </div>
          <p className="text-muted-foreground text-[14px]">
            Все пачки загруженных данных с привязкой к сессии анализа
          </p>
        </div>
        <Button view="action" className="text-[13px] h-9" onClick={() => navigate("/upload")}>
          Новая загрузка
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-[13px]" style={{ fontWeight: 500 }}>Составной фильтр</span>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="ml-auto flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
              Сбросить
            </button>
          )}
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <FilterFormField label="ID загрузки">
              <TextInput
                placeholder="Поиск по ID"
                size="l"
                value={idFilter}
                onUpdate={setIdFilter}
                startContent={<Search className="w-3.5 h-3.5 text-muted-foreground" />}
              />
            </FilterFormField>
            <FilterFormField label="Статус">
              <Select
                value={[statusFilter]}
                onUpdate={(v) => setStatusFilter(v[0] ?? "all")}
                options={[
                  { value: "all", content: "Все статусы" },
                  { value: "success", content: "Успешно" },
                  { value: "warning", content: "Предупреждения" },
                  { value: "error", content: "Ошибка" },
                  { value: "processing", content: "Обработка" },
                  { value: "cancelled", content: "Остановлено" },
                  { value: "stale", content: "Зависло" },
                ]}
                size="l"
                width="max"
              />
            </FilterFormField>
            <FilterFormField label="Автор">
              <Select
                value={[authorFilter]}
                onUpdate={(v) => setAuthorFilter(v[0] ?? "all")}
                options={[
                  { value: "all", content: "Все авторы" },
                  ...authors.map((a) => ({ value: a, content: a })),
                ]}
                size="l"
                width="max"
              />
            </FilterFormField>
            <FilterFormField label="Типы файлов">
              <TextInput placeholder="Например: moodle, camera" size="l" value={fileTypesFilter} onUpdate={setFileTypesFilter} />
            </FilterFormField>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FilterDateTimeRange label="Дата загрузки" from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FilterNumberRange label="Файлов" from={filesMin} to={filesMax} onFromChange={setFilesMin} onToChange={setFilesMax} />
            <FilterNumberRange label="Строк" from={rowsMin} to={rowsMax} onFromChange={setRowsMin} onToChange={setRowsMax} />
            <FilterNumberRange label="Студентов" from={studentsMin} to={studentsMax} onFromChange={setStudentsMin} onToChange={setStudentsMax} />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[13px] text-muted-foreground">
            Найдено загрузок: <span style={{ fontWeight: 500 }} className="text-foreground">{filtered.length}</span>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-left">
                <th className="pb-3 pr-4 cursor-pointer hover:text-foreground" style={{ fontWeight: 500 }} onClick={() => toggleSort("id")}>
                  <span className="flex items-center gap-1">ID загрузки <SortIcon field="id" /></span>
                </th>
                <th className="pb-3 pr-4 cursor-pointer hover:text-foreground" style={{ fontWeight: 500 }} onClick={() => toggleSort("date")}>
                  <span className="flex items-center gap-1">Дата <SortIcon field="date" /></span>
                </th>
                <th className="pb-3 pr-4 cursor-pointer hover:text-foreground" style={{ fontWeight: 500 }} onClick={() => toggleSort("author")}>
                  <span className="flex items-center gap-1">Автор <SortIcon field="author" /></span>
                </th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Файлов</th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Типы файлов</th>
                <th className="pb-3 pr-4 cursor-pointer hover:text-foreground" style={{ fontWeight: 500 }} onClick={() => toggleSort("status")}>
                  <span className="flex items-center gap-1">Статус <SortIcon field="status" /></span>
                </th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Строк</th>
                <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Студентов</th>
                <th className="pb-3" style={{ fontWeight: 500 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground text-[13px]">
                    По заданным условиям загрузок не найдено
                  </td>
                </tr>
              ) : (
                filtered.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/uploads/${b.id}/log`)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      navigate(`/uploads/${b.id}/log`);
                    }}
                    tabIndex={0}
                    role="link"
                    title="Открыть журнал пачки"
                    aria-label="Открыть журнал пачки"
                  >
                    <td className="py-3 pr-4 font-mono text-[12px]" style={{ fontWeight: 500 }}>{b.id}</td>
                    <td className="py-3 pr-4 text-muted-foreground font-mono text-[12px]">{b.date}</td>
                    <td className="py-3 pr-4">{b.author}</td>
                    <td className="py-3 pr-4 text-center">{b.files}</td>
                    <td className="py-3 pr-4 text-muted-foreground max-w-[260px] truncate">{b.fileTypes}</td>
                    <td className="py-3 pr-4">
                      <Label theme={getUploadStatusLabel(b.status).theme}>
                        {getUploadStatusLabel(b.status).text}
                      </Label>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{b.rows}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{b.students}</td>
                    <td className="py-3">
                      <div className="flex flex-row items-center gap-2">
                        <Button
                          view="outlined"
                          size="s"
                          className="text-[12px] h-7"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/uploads/${b.id}/log`);
                          }}
                        >
                          <span className="flex items-center gap-1">
                            <ScrollText className="w-3 h-3" />
                            Журнал
                          </span>
                        </Button>
                        <Button
                          view="outlined"
                          size="s"
                          className="text-[12px] h-7"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/processing?uploadId=${b.id}`);
                          }}
                        >
                          <span className="flex items-center gap-1">
                            <Cpu className="w-3 h-3" />
                            Обработка
                          </span>
                        </Button>
                        {isActiveProcessingStatus(b.status) && (
                          <Button
                            view="outlined"
                            size="s"
                            className="text-[12px] h-7"
                            loading={stopProcessing.loading && actingBatchId === b.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              void stopBatchProcessing(b.id);
                            }}
                          >
                            <span className="flex items-center gap-1">
                              <Square className="w-3 h-3" />
                              Остановить
                            </span>
                          </Button>
                        )}
                        {isRetryableProcessingStatus(b.status) && (
                          <Button
                            view="outlined"
                            size="s"
                            className="text-[12px] h-7"
                            loading={retryProcessing.loading && actingBatchId === b.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              void retryBatchProcessing(b.id);
                            }}
                          >
                            <span className="flex items-center gap-1">
                              <RotateCcw className="w-3 h-3" />
                              Перезапустить
                            </span>
                          </Button>
                        )}
                        <Button
                          view="outlined"
                          size="s"
                          className="text-[12px] h-7 text-destructive"
                          onClick={(event) => {
                            event.stopPropagation();
                            void deleteBatch(b.id);
                          }}
                        >
                          <span className="flex items-center gap-1">
                            <Trash2 className="w-3 h-3" />
                            Удалить
                          </span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          total={hasFilters ? filtered.length : total}
          page={hasFilters ? 1 : page}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={updateLimit}
          className="mt-4"
        />
      </div>
    </div>
  );
}

function matchesStatusFilter(status: string, filter: string) {
  if (filter === "error") return ["error", "failed", "stale"].includes(status);
  if (filter === "processing") return ["queued", "processing", "cancelling"].includes(status);
  if (filter === "success") return ["success", "done"].includes(status);
  if (filter === "warning") return ["warning", "done_with_warnings"].includes(status);
  return status === filter;
}
