import { Document, ObjectId } from "mongodb";

import { getCollection } from "../db/collections.js";
import { entityConfig, type EntityName } from "../schema/entity.schema.js";
import type { AuthUser } from "../schema/user.schema.js";
import { getQuery, normalizeIncoming, setNested, type QuerySource } from "../utils/query.js";

function parseDateFilterValue(value: string, boundary: "from" | "to") {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const timestamp = /^-?\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  const parsed = Number.isNaN(timestamp) ? new Date(trimmed) : new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    parsed.setUTCHours(boundary === "to" ? 23 : 0, boundary === "to" ? 59 : 0, boundary === "to" ? 59 : 0, boundary === "to" ? 999 : 0);
  }

  return parsed;
}

export function buildFilter(entity: EntityName, query: QuerySource): Document {
  const config = entityConfig[entity];
  const filter: Document = {};

  for (const field of config.text) {
    const value = getQuery(query, field);
    if (!value) continue;
    if (config.exact.includes(field)) {
      setNested(filter, field, value);
    } else {
      setNested(filter, field, { $regex: value, $options: "i" });
    }
  }

  for (const field of config.objectIds) {
    const value = getQuery(query, field);
    if (value && ObjectId.isValid(value)) setNested(filter, field, new ObjectId(value));
  }

  for (const field of config.dates) {
    const from = getQuery(query, `${field}From`);
    const to = getQuery(query, `${field}To`);
    if (!from && !to) continue;
    const range: Document = {};
    const fromDate = from ? parseDateFilterValue(from, "from") : undefined;
    const toDate = to ? parseDateFilterValue(to, "to") : undefined;
    if (fromDate) range.$gte = fromDate;
    if (toDate) range.$lte = toDate;
    if (Object.keys(range).length) setNested(filter, field, range);
  }

  for (const field of config.numbers) {
    const min = getQuery(query, `${field}Min`);
    const max = getQuery(query, `${field}Max`);
    if (!min && !max) continue;
    const range: Document = {};
    if (min) range.$gte = Number(min);
    if (max) range.$lte = Number(max);
    setNested(filter, field, range);
  }

  return filter;
}

function andObjectIdIn(filter: Document, field: string, ids: ObjectId[]) {
  if (ids.length === 0) {
    setNested(filter, field, { $in: [] });
    return;
  }

  const existing = field.split(".").reduce<unknown>((current, part) => (current && typeof current === "object" ? (current as Document)[part] : undefined), filter);
  if (existing instanceof ObjectId) {
    setNested(filter, field, ids.some((id) => id.equals(existing)) ? existing : { $in: [] });
    return;
  }
  setNested(filter, field, { $in: ids });
}

async function applyStudentLinkedFilters(entity: EntityName, query: QuerySource, filter: Document) {
  if (entity !== "sessions" && entity !== "timeline_events") return;

  const studentFilter: Document = {};
  for (const field of ["group", "program", "educationLevel", "faculty"]) {
    const value = getQuery(query, `student.${field}`);
    if (!value) continue;
    studentFilter[field] = field === "educationLevel" ? value : { $regex: value, $options: "i" };
  }

  if (Object.keys(studentFilter).length) {
    const students = await getCollection("students").find(studentFilter, { projection: { _id: 1 } }).toArray();
    andObjectIdIn(filter, "studentId", students.map((student) => student._id as ObjectId));
  }

  const courseName = getQuery(query, "courseName");
  if (entity === "sessions" && courseName) {
    const events = await getCollection("timeline_events")
      .find({ "moodle.courseName": { $regex: courseName, $options: "i" } }, { projection: { sessionId: 1 } })
      .toArray();
    andObjectIdIn(filter, "_id", events.map((event) => event.sessionId as ObjectId));
  }
}

async function applyRoleScope(entity: EntityName, user: AuthUser, filter: Document) {
  if (user.role === "admin") return;

  if (entity === "uploads" || entity === "clustering_runs") {
    andObjectIdIn(filter, "userId", [new ObjectId(user._id)]);
    return;
  }

  if (entity === "students" || entity === "sessions" || entity === "timeline_events") {
    const uploads = await getCollection("uploads").find({ userId: new ObjectId(user._id) }, { projection: { _id: 1 } }).toArray();
    andObjectIdIn(filter, "uploadId", uploads.map((upload) => upload._id as ObjectId));
  }
}

function uniqueObjectIds(values: unknown[]) {
  const ids = new Map<string, ObjectId>();
  for (const value of values) {
    if (value instanceof ObjectId) ids.set(value.toHexString(), value);
  }
  return [...ids.values()];
}

function objectIdKey(value: unknown) {
  return value instanceof ObjectId ? value.toHexString() : "";
}

async function enrichSessionItems(items: Document[]) {
  if (!items.length) return items;

  const studentIds = uniqueObjectIds(items.map((item) => item.studentId));
  const sessionIds = uniqueObjectIds(items.map((item) => item._id));
  const [students, courseEvents] = await Promise.all([
    studentIds.length
      ? getCollection("students")
          .find(
            { _id: { $in: studentIds } },
            { projection: { fullName: 1, group: 1, program: 1, educationLevel: 1, faculty: 1 } },
          )
          .toArray()
      : Promise.resolve([]),
    sessionIds.length
      ? getCollection("timeline_events")
          .find(
            { sessionId: { $in: sessionIds }, "moodle.courseName": { $exists: true, $ne: "" } },
            { projection: { sessionId: 1, "moodle.courseName": 1 }, sort: { eventTime: 1 } },
          )
          .toArray()
      : Promise.resolve([]),
  ]);

  const studentsById = new Map(students.map((student) => [objectIdKey(student._id), student]));
  const courseNameBySessionId = new Map<string, string>();
  for (const event of courseEvents) {
    const sessionId = objectIdKey(event.sessionId);
    const courseName = (event.moodle as Document | undefined)?.courseName;
    if (sessionId && courseName && !courseNameBySessionId.has(sessionId)) {
      courseNameBySessionId.set(sessionId, String(courseName));
    }
  }

  return items.map((item) => ({
    ...item,
    student: studentsById.get(objectIdKey(item.studentId)) ?? item.student,
    courseName: courseNameBySessionId.get(objectIdKey(item._id)) ?? item.courseName ?? "",
  }));
}

async function enrichEntityItems(entity: EntityName, items: Document[]) {
  if (entity === "sessions") return enrichSessionItems(items);
  return items;
}

export function canReadEntity(entity: EntityName, user: AuthUser) {
  if (user.role === "admin") return true;
  return ["uploads", "students", "sessions", "timeline_events", "clustering_runs"].includes(entity);
}

export function canCreateEntity(entity: EntityName, user: AuthUser) {
  if (entity === "audit_logs") return false;
  return user.role === "admin";
}

export async function listEntities(entity: EntityName, query: QuerySource, user: AuthUser) {
  const limit = Math.min(Number(getQuery(query, "limit") ?? 50), 200);
  const page = Math.max(Number(getQuery(query, "page") ?? 1), 1);
  const filter = buildFilter(entity, query);
  await applyRoleScope(entity, user, filter);
  await applyStudentLinkedFilters(entity, query, filter);
  const collection = getCollection(entity);
  const [items, total] = await Promise.all([
    collection
      .find(filter)
      .sort(entityConfig[entity].defaultSort)
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);
  return { items: await enrichEntityItems(entity, items), total, page, limit };
}

export async function getSessionById(id: string, user: AuthUser) {
  if (!ObjectId.isValid(id)) return null;

  const filter: Document = { _id: new ObjectId(id) };
  await applyRoleScope("sessions", user, filter);
  const session = await getCollection("sessions").findOne(filter);
  if (!session) return null;

  const [enriched] = await enrichSessionItems([session]);
  return enriched ?? null;
}

function normalizeSessionUpdate(body: Document) {
  const payload = normalizeIncoming(body);
  delete payload.student;
  delete payload.courseName;

  for (const field of ["startTime", "endTime", "createdAt", "updateTime"]) {
    if (payload[field]) payload[field] = new Date(String(payload[field]));
  }

  return payload;
}

export async function updateSessionById(id: string, body: Document, user: AuthUser) {
  if (!ObjectId.isValid(id)) return null;

  const filter: Document = { _id: new ObjectId(id) };
  await applyRoleScope("sessions", user, filter);

  const payload = normalizeSessionUpdate(body);
  payload.updateTime = new Date();

  const result = await getCollection("sessions").findOneAndUpdate(filter, { $set: payload }, { returnDocument: "after" });
  if (!result) return null;

  const [enriched] = await enrichSessionItems([result]);
  return enriched ?? null;
}

export async function createEntity(entity: EntityName, body: Document, user: AuthUser) {
  const now = new Date();
  const payload = normalizeIncoming(body);
  const result = await getCollection(entity).insertOne({
    ...payload,
    ...(entity === "uploads" ? { userId: new ObjectId(user._id) } : {}),
    createdAt: payload.createdAt ? new Date(String(payload.createdAt)) : now,
    updateTime: now,
  });
  return result.insertedId;
}
