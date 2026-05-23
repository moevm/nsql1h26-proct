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
} from "lucide-react";
import { Button, TextInput, Select, Label } from "@gravity-ui/uikit";
import { useUploads } from "../entities/upload/model/hooks";
import { uploadStatusLabels } from "../shared/config/ui";
import { api } from "../shared/api/client";

type SortField = "id" | "date" | "author" | "status";
type SortDir = "asc" | "desc";

export function UploadHistoryPage() {
  const navigate = useNavigate();
  const { groupedBatches: batches, refetch } = useUploads(200);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [authorFilter, setAuthorFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  const filtered = batches
    .filter((b) => {
      if (search && !b.id.toLowerCase().includes(search.toLowerCase()) && !b.author.toLowerCase().includes(search.toLowerCase()) && !b.fileTypes.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (authorFilter !== "all" && b.author !== authorFilter) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "id") cmp = a.id.localeCompare(b.id);
      else if (sortField === "date") cmp = a.date.localeCompare(b.date);
      else if (sortField === "author") cmp = a.author.localeCompare(b.author);
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      return sortDir === "asc" ? cmp : -cmp;
    });

  const hasFilters = search || statusFilter !== "all" || authorFilter !== "all";

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setAuthorFilter("all");
  };

  const deleteBatch = async (id: string) => {
    if (!window.confirm("Удалить эту пачку загрузок и связанные данные?")) return;
    await api(`/uploads/${id}`, { method: "DELETE" });
    refetch();
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <TextInput
            placeholder="Поиск по ID, автору или типу файла"
            size="m"
            value={search}
            onUpdate={setSearch}
            startContent={<Search className="w-3.5 h-3.5 text-muted-foreground" />}
          />
          <Select
            value={[statusFilter]}
            onUpdate={(v) => setStatusFilter(v[0])}
            options={[
              { value: "all", content: "Все статусы" },
              { value: "success", content: "Успешно" },
              { value: "warning", content: "Предупреждения" },
              { value: "error", content: "Ошибка" },
            ]}
            size="m"
          />
          <Select
            value={[authorFilter]}
            onUpdate={(v) => setAuthorFilter(v[0])}
            options={[
              { value: "all", content: "Все авторы" },
              ...authors.map((a) => ({ value: a, content: a })),
            ]}
            size="m"
          />
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
                  <tr key={b.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 pr-4 font-mono text-[12px]" style={{ fontWeight: 500 }}>{b.id}</td>
                    <td className="py-3 pr-4 text-muted-foreground font-mono text-[12px]">{b.date}</td>
                    <td className="py-3 pr-4">{b.author}</td>
                    <td className="py-3 pr-4 text-center">{b.files}</td>
                    <td className="py-3 pr-4 text-muted-foreground max-w-[260px] truncate">{b.fileTypes}</td>
                    <td className="py-3 pr-4">
                      <Label theme={uploadStatusLabels[b.status].theme}>
                        {uploadStatusLabels[b.status].text}
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
                          onClick={() => navigate(`/upload-history/${b.id}`)}
                        >
                          <span className="flex items-center gap-1">
                            <ScrollText className="w-3 h-3" />
                            Журнал
                          </span>
                        </Button>
                        <Button view="outlined" size="s" className="text-[12px] h-7 text-destructive" onClick={() => void deleteBatch(b.id)}>
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
      </div>
    </div>
  );
}
