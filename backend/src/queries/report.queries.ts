import { Document, ObjectId } from "mongodb";

import { getCollection } from "../db/collections.js";
import type { AuthUser } from "../schema/user.schema.js";

export type ReportKind = "sessions" | "anomalies" | "students";

export type ReportFilters = {
  runId?: string;
  dateFrom?: string;
  dateTo?: string;
  clusterId?: string;
  onlyAnomalies?: boolean;
  includeRawMetrics?: boolean;
  includeStudents?: boolean;
};

export type ReportPayload = {
  meta: {
    kind: ReportKind;
    runId: string;
    generatedAt: string;
    total: number;
  };
  filters: ReportFilters;
  items: Document[];
  total: number;
};

type AssignmentContext = {
  assignment: Document;
  session: Document;
  student?: Document;
};

export function normalizeReportKind(kind: string): ReportKind | undefined {
  if (kind === "sessions" || kind === "anomalies") return kind;
  if (kind === "students" || kind === "studentsWithAnomalies") return "students";
  return undefined;
}

function idVariants(value: unknown) {
  if (value instanceof ObjectId) return [value, value.toHexString()];
  if (typeof value === "string" && ObjectId.isValid(value)) return [new ObjectId(value), value];
  return [];
}

function toObjectId(value: unknown) {
  if (value instanceof ObjectId) return value;
  if (typeof value === "string" && ObjectId.isValid(value)) return new ObjectId(value);
  return undefined;
}

function idKey(value: unknown) {
  if (value instanceof ObjectId) return value.toHexString();
  return String(value ?? "");
}

function parseDate(value: string | undefined, boundary: "from" | "to") {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setUTCHours(boundary === "to" ? 23 : 0, boundary === "to" ? 59 : 0, boundary === "to" ? 59 : 0, boundary === "to" ? 999 : 0);
  }
  return date;
}

function parseClusterId(value: string | undefined) {
  if (!value || value === "all") return undefined;
  if (value === "noise") return -1;
  const prefixed = /^c(\d+)$/i.exec(value);
  if (prefixed) return Number(prefixed[1]) - 1;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function clusterLabel(clusterId: unknown) {
  const value = Number(clusterId);
  if (!Number.isFinite(value)) return "—";
  return value < 0 ? "noise" : `C${value + 1}`;
}

function nested(source: Document | undefined, path: string) {
  return path.split(".").reduce<unknown>((current, part) => (current && typeof current === "object" ? (current as Document)[part] : undefined), source);
}

function hasTeacherScope(user: AuthUser) {
  return user.role !== "admin";
}

async function findReportRun(filters: ReportFilters, user: AuthUser) {
  const query: Document = {};
  if (filters.runId) {
    const runId = toObjectId(filters.runId);
    if (!runId) return null;
    query._id = runId;
  } else {
    query.status = "success";
  }

  if (hasTeacherScope(user)) {
    query.userId = { $in: idVariants(user._id) };
  }

  return getCollection("clustering_runs").findOne(query, { sort: { startedAt: -1 } });
}

async function buildAssignmentContext(run: Document) {
  const assignments = (((run.results as Document | undefined)?.sessionAssignments as Document[] | undefined) ?? []).filter((item) => item.sessionId);
  const sessionIds = assignments.flatMap((item) => {
    const objectId = toObjectId(item.sessionId);
    return objectId ? [objectId] : [];
  });
  const sessions = sessionIds.length ? await getCollection("sessions").find({ _id: { $in: sessionIds } }).toArray() : [];
  const students = sessions.length
    ? await getCollection("students").find({ _id: { $in: sessions.flatMap((session) => {
      const studentId = toObjectId(session.studentId);
      return studentId ? [studentId] : [];
    }) } }).toArray()
    : [];
  const sessionsById = new Map(sessions.map((session) => [idKey(session._id), session]));
  const studentsById = new Map(students.map((student) => [idKey(student._id), student]));

  return assignments.flatMap((assignment) => {
    const session = sessionsById.get(idKey(assignment.sessionId));
    if (!session) return [];
    return [{ assignment, session, student: studentsById.get(idKey(session.studentId)) }];
  });
}

function filterAssignmentContext(kind: ReportKind, filters: ReportFilters, rows: AssignmentContext[]) {
  const dateFrom = parseDate(filters.dateFrom, "from");
  const dateTo = parseDate(filters.dateTo, "to");
  const clusterId = parseClusterId(filters.clusterId);
  const onlyAnomalies = kind === "anomalies" || kind === "students" || filters.onlyAnomalies;

  return rows.filter(({ assignment, session }) => {
    const startedAt = new Date(String(session.startTime ?? ""));
    if (dateFrom && (!Number.isFinite(startedAt.getTime()) || startedAt < dateFrom)) return false;
    if (dateTo && (!Number.isFinite(startedAt.getTime()) || startedAt > dateTo)) return false;
    if (clusterId !== undefined && Number(assignment.clusterId) !== clusterId) return false;
    if (onlyAnomalies && !assignment.isAnomaly) return false;
    return true;
  });
}

function buildSessionRow({ assignment, session, student }: AssignmentContext, filters: ReportFilters, forceStudent = false): Document {
  const includeStudent = forceStudent || filters.includeStudents;
  const metrics = (session.metrics as Document | undefined) ?? {};
  const row: Document = {
    sessionId: idKey(session._id),
    examName: session.examName,
    startTime: session.startTime,
    endTime: session.endTime,
    durationMinutes: session.durationMinutes,
    clusterId: assignment.clusterId,
    clusterLabel: clusterLabel(assignment.clusterId),
    isAnomaly: Boolean(assignment.isAnomaly),
    distanceToCentroid: assignment.distanceToCentroid,
    anomalyScore: nested(metrics, "combined.anomalyScore") ?? "",
    riskLevel: nested(metrics, "combined.riskLevel") ?? "",
  };

  if (includeStudent) {
    row.studentId = idKey(student?._id ?? session.studentId);
    row.studentName = student?.fullName ?? "";
    row.studentGroup = student?.group ?? "";
    row.studentEmail = student?.email ?? "";
  }

  if (filters.includeRawMetrics) {
    row.metrics = metrics;
  }

  return row;
}

function buildStudentRows(rows: AssignmentContext[], filters: ReportFilters) {
  const grouped = new Map<string, Document>();

  for (const context of rows) {
    const studentKey = idKey(context.student?._id ?? context.session.studentId);
    const current = grouped.get(studentKey);
    const exams = new Set<string>(Array.isArray(current?.exams) ? current.exams as string[] : []);
    if (context.session.examName) exams.add(String(context.session.examName));

    grouped.set(studentKey, {
      studentId: studentKey,
      studentName: context.student?.fullName ?? "",
      studentGroup: context.student?.group ?? "",
      studentEmail: context.student?.email ?? "",
      anomalySessionCount: Number(current?.anomalySessionCount ?? 0) + 1,
      exams: [...exams].sort(),
      latestAnomalyAt: context.session.startTime,
      sessions: filters.includeRawMetrics
        ? [...((current?.sessions as Document[] | undefined) ?? []), buildSessionRow(context, { ...filters, includeStudents: false })]
        : undefined,
    });
  }

  return [...grouped.values()].sort((left, right) => String(left.studentGroup ?? "").localeCompare(String(right.studentGroup ?? "")) || String(left.studentName ?? "").localeCompare(String(right.studentName ?? "")));
}

export async function buildReportPayload(kind: ReportKind, filters: ReportFilters, user: AuthUser): Promise<ReportPayload | null> {
  const run = await findReportRun(filters, user);
  if (!run) return null;

  const context = filterAssignmentContext(kind, filters, await buildAssignmentContext(run));
  const items = kind === "students"
    ? buildStudentRows(context, filters)
    : context.map((row) => buildSessionRow(row, filters, kind === "anomalies"));

  return {
    meta: {
      kind,
      runId: idKey(run._id),
      generatedAt: new Date().toISOString(),
      total: items.length,
    },
    filters,
    items,
    total: items.length,
  };
}
