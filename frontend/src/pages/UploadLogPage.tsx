import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ScrollText,
  Filter,
  Search,
  X,
  UserX,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Button, TextInput, Select, Label } from "@gravity-ui/uikit";
import { api } from "../shared/api/client";
import type { AnyRecord } from "../entities/types";
import { RecordDetailsView } from "../shared/ui/RecordDetailsView";

interface LogEntry {
  id: number;
  time: string;
  level: "info" | "warn" | "error";
  file: string;
  line: number;
  entityType: "student" | "moodle" | "camera";
  message: string;
}

interface ProblemRow {
  file: string;
  line: number;
  content: string;
  error: string;
}

interface UnmappedStudent {
  id: string;
  reason: string;
}

const levelConfig = {
  info: { theme: "info" as const, icon: <Info className="w-3 h-3" />, label: "info" },
  warn: { theme: "warning" as const, icon: <AlertTriangle className="w-3 h-3" />, label: "warn" },
  error: { theme: "danger" as const, icon: <AlertTriangle className="w-3 h-3" />, label: "error" },
};

const entityLabels: Record<LogEntry["entityType"], string> = {
  student: "Студент",
  moodle: "Строка Moodle",
  camera: "Запись камеры",
};

type TabType = "log" | "problems" | "unmapped";

function normalizeEntity(value: unknown): LogEntry["entityType"] {
  const raw = String(value ?? "");
  if (raw.includes("student")) return "student";
  if (raw.includes("ocr") || raw.includes("camera")) return "camera";
  return "moodle";
}

export function UploadLogPage() {
  const { uploadId, id } = useParams<{ uploadId?: string; id?: string }>();
  const currentId = uploadId ?? id ?? "";
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("log");
  const [levelFilter, setLevelFilter] = useState("all");
  const [fileFilter, setFileFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [upload, setUpload] = useState<AnyRecord | null>(null);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [problemRows, setProblemRows] = useState<ProblemRow[]>([]);
  const [unmappedStudents, setUnmappedStudents] = useState<UnmappedStudent[]>([]);

  useEffect(() => {
    if (!currentId) return;
    setUpload(null);
    setLogEntries([]);
    setProblemRows([]);
    setUnmappedStudents([]);
    void api<{ upload: AnyRecord; processingLog: AnyRecord[]; unresolvedStudents: AnyRecord[] }>(`/uploads/${currentId}/log`).then((data) => {
      setUpload(data.upload);
      setLogEntries(
        data.processingLog.map((entry, index) => ({
          id: index + 1,
          time: entry.timestamp ? new Date(String(entry.timestamp)).toLocaleTimeString("ru-RU") : "—",
          level: String(entry.level ?? "info") as LogEntry["level"],
          file: String(entry.sourceFileKey ?? "csv"),
          line: Number(entry.line ?? 0),
          entityType: normalizeEntity(entry.entityType),
          message: String(entry.message ?? ""),
        })),
      );
      setProblemRows(
        data.processingLog
          .filter((entry) => String(entry.level) !== "info")
          .map((entry) => ({
            file: String(entry.sourceFileKey ?? "csv"),
            line: Number(entry.line ?? 0),
            content: String(entry.message ?? ""),
            error: String(entry.message ?? ""),
          })),
      );
      setUnmappedStudents(
        data.unresolvedStudents.map((student) => ({
          id: String(student.externalId ?? student.id ?? ""),
          reason: String(student.reason ?? "Не сопоставлен"),
        })),
      );
    });
  }, [currentId]);

  const files = [...new Set(logEntries.map((e) => e.file))];

  const hasFilters = levelFilter !== "all" || fileFilter !== "all" || entityFilter !== "all" || search;

  const resetFilters = () => {
    setLevelFilter("all");
    setFileFilter("all");
    setEntityFilter("all");
    setSearch("");
  };

  const filteredLog = logEntries.filter((e) => {
    if (levelFilter !== "all" && e.level !== levelFilter) return false;
    if (fileFilter !== "all" && e.file !== fileFilter) return false;
    if (entityFilter !== "all" && e.entityType !== entityFilter) return false;
    if (search && !e.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: "log", label: "Журнал", count: logEntries.length },
    { id: "problems", label: "Проблемные строки", count: problemRows.length },
    { id: "unmapped", label: "Несопоставленные студенты", count: unmappedStudents.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate("/upload-history")}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          История загрузок
        </button>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ScrollText className="w-5 h-5 text-primary" />
              <h1 className="text-[22px]" style={{ fontWeight: 600 }}>
                Журнал обработки — {currentId}
              </h1>
            </div>
            <p className="text-[14px] text-muted-foreground">
              Загрузка от {upload?.createdAt ? new Date(String(upload.createdAt)).toLocaleString("ru-RU") : "—"} · {String(upload?.createdByName ?? upload?.createdBy ?? "Система")} · Статус: {String(upload?.status ?? "—")}
            </p>
          </div>
          <Button view="action" className="text-[13px] h-9" onClick={() => void api(`/process/${currentId}`, { method: "POST", body: "{}" })}>
            Запустить обработку
          </Button>
        </div>
      </div>

      <div className="flex bg-muted rounded-lg p-0.5 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-md text-[13px] transition-colors flex items-center gap-1.5 ${
              activeTab === tab.id ? "bg-card shadow-sm" : "text-muted-foreground"
            }`}
            style={{ fontWeight: activeTab === tab.id ? 600 : 400 }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id ? "bg-primary/10 text-primary" : "bg-muted-foreground/20 text-muted-foreground"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {upload && (
        <RecordDetailsView record={upload} title="Атрибуты загрузки" subtitle="Все поля записи загрузки из БД" />
      )}

      {activeTab === "log" && (
        <>
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-[13px]" style={{ fontWeight: 500 }}>Фильтр записей</span>
              {hasFilters && (
                <button onClick={resetFilters} className="ml-auto flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                  Сбросить
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <TextInput placeholder="Поиск в сообщениях" size="m" value={search} onUpdate={setSearch} startContent={<Search className="w-3.5 h-3.5 text-muted-foreground" />} />
              <Select value={[levelFilter]} onUpdate={(v) => setLevelFilter(v[0])} options={[{ value: "all", content: "Все уровни" }, { value: "info", content: "info" }, { value: "warn", content: "warn" }, { value: "error", content: "error" }]} size="m" />
              <Select value={[fileFilter]} onUpdate={(v) => setFileFilter(v[0])} options={[{ value: "all", content: "Все файлы" }, ...files.map((f) => ({ value: f, content: f }))]} size="m" />
              <Select value={[entityFilter]} onUpdate={(v) => setEntityFilter(v[0])} options={[{ value: "all", content: "Все сущности" }, { value: "student", content: "Студент" }, { value: "moodle", content: "Строка Moodle" }, { value: "camera", content: "Запись камеры" }]} size="m" />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left">
                    <th className="pb-3 pr-4 w-20" style={{ fontWeight: 500 }}>Время</th>
                    <th className="pb-3 pr-4 w-20" style={{ fontWeight: 500 }}>Уровень</th>
                    <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Файл</th>
                    <th className="pb-3 pr-4 w-16" style={{ fontWeight: 500 }}>Строка</th>
                    <th className="pb-3 pr-4 w-28" style={{ fontWeight: 500 }}>Сущность</th>
                    <th className="pb-3" style={{ fontWeight: 500 }}>Сообщение</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLog.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-muted-foreground">Записей по заданным условиям не найдено</td>
                    </tr>
                  ) : (
                    filteredLog.map((e) => (
                      <tr key={e.id} className={`border-b border-border/50 last:border-0 ${e.level === "error" ? "bg-destructive/3" : e.level === "warn" ? "bg-warning/3" : ""}`}>
                        <td className="py-2.5 pr-4 font-mono text-muted-foreground">{e.time}</td>
                        <td className="py-2.5 pr-4"><Label theme={levelConfig[e.level].theme} icon={levelConfig[e.level].icon}>{levelConfig[e.level].label}</Label></td>
                        <td className="py-2.5 pr-4 text-muted-foreground"><code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{e.file}</code></td>
                        <td className="py-2.5 pr-4 font-mono text-muted-foreground">{e.line || "—"}</td>
                        <td className="py-2.5 pr-4"><span className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{entityLabels[e.entityType]}</span></td>
                        <td className="py-2.5">{e.message}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "problems" && (
        <div className="bg-card rounded-xl border border-border p-5">
          {problemRows.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-[13px]">Проблемных строк не обнаружено</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left">
                    <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Файл</th>
                    <th className="pb-3 pr-4 w-16" style={{ fontWeight: 500 }}>Строка</th>
                    <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>Содержимое</th>
                    <th className="pb-3" style={{ fontWeight: 500 }}>Описание ошибки</th>
                  </tr>
                </thead>
                <tbody>
                  {problemRows.map((r, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-4"><code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{r.file}</code></td>
                      <td className="py-2.5 pr-4 font-mono text-muted-foreground">{r.line}</td>
                      <td className="py-2.5 pr-4"><code className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-foreground/80">{r.content}</code></td>
                      <td className="py-2.5 text-destructive">{r.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "unmapped" && (
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserX className="w-4 h-4 text-warning" />
            <span className="text-[14px]" style={{ fontWeight: 600 }}>Несопоставленные студенты ({unmappedStudents.length})</span>
          </div>
          {unmappedStudents.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-[13px]">Все студенты успешно сопоставлены</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left">
                    <th className="pb-3 pr-4" style={{ fontWeight: 500 }}>ID студента</th>
                    <th className="pb-3" style={{ fontWeight: 500 }}>Причина несопоставления</th>
                  </tr>
                </thead>
                <tbody>
                  {unmappedStudents.map((s) => (
                    <tr key={s.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-4 font-mono text-[12px]" style={{ fontWeight: 500 }}>{s.id}</td>
                      <td className="py-2.5 text-warning">{s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
