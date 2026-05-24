import { FileText, Table2, Users, Video } from "lucide-react";
import type { ElementType } from "react";

export type CsvKind = "students" | "sessions" | "moodle_events" | "ocr_events";

export type CsvCardConfig = {
  kind: CsvKind;
  title: string;
  typeLabel: string;
  icon: ElementType;
  helper: string;
  columns: string;
};

export const csvImportCards: CsvCardConfig[] = [
  {
    kind: "students",
    title: "Справочник студентов",
    typeLabel: "Тип файла: студенты",
    icon: Users,
    helper: "Массовая загрузка ФИО, групп, email и эталонных эмбеддингов",
    columns: "externalId, fullName, email, group",
  },
  {
    kind: "sessions",
    title: "Сессии экзаменов",
    typeLabel: "Тип файла: сессии",
    icon: Table2,
    helper: "Сессии студентов с агрегированными метриками Moodle/OCR",
    columns: "externalStudentId, examName, startTime, anomalyScore",
  },
  {
    kind: "moodle_events",
    title: "Журналы Moodle",
    typeLabel: "Тип файла: Moodle",
    icon: FileText,
    helper: "Действия на страницах курса, ответы, переходы и фокус вкладки",
    columns: "externalStudentId, eventTime, action, target",
  },
  {
    kind: "ocr_events",
    title: "OCR и распознавание лиц",
    typeLabel: "Тип файла: OCR",
    icon: Video,
    helper: "Кадры скринкастов, распознанный текст и уверенность модели",
    columns: "externalStudentId, eventTime, content, confidence",
  },
];
