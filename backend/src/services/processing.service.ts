import { Document, ObjectId } from "mongodb";

import { getCollection } from "../db/collections.js";
import type { ProcessingLogEntry, ProcessingStageState, ProcessingState, ProcessingStatus, UnresolvedStudent } from "../schema/upload.schema.js";
import type { AuthUser } from "../schema/user.schema.js";
import { deriveBatchUploadMetrics, mergeUnresolvedStudents } from "./upload-lifecycle.service.js";
import { safeRecordAuditEvent, type AuditContext } from "./audit.service.js";

const activeStatuses = new Set<ProcessingStatus>(["queued", "processing", "cancelling"]);
const retryableStatuses = new Set<ProcessingStatus>(["cancelled", "failed", "stale", "done", "done_with_warnings"]);
const staleAfterMs = 2 * 60 * 1000;
const stageDelayMs = 600;

const processingStages = [
  { key: "validate_files", label: "Проверка файлов" },
  { key: "normalize_timestamps", label: "Нормализация временных меток" },
  { key: "match_students", label: "Сопоставление личностей студентов" },
  { key: "build_sessions", label: "Построение экзаменационных сессий" },
  { key: "compute_metrics", label: "Вычисление метрик" },
  { key: "prepare_dataset", label: "Подготовка датасета для кластеризации" },
] as const;

const activeJobs = new Map<string, { startedAt: Date }>();

export class ProcessingError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

type BatchScope = {
  batchId: ObjectId;
  controllerUploadId: ObjectId;
  uploadIds: ObjectId[];
  uploads: Document[];
};

type ProcessingResponse = {
  ok: boolean;
  upload: Document;
  processingLog: Document[];
  unresolvedStudents: UnresolvedStudent[];
};

function objectId(value: unknown) {
  return typeof value === "string" && ObjectId.isValid(value) ? new ObjectId(value) : value instanceof ObjectId ? value : undefined;
}

function userScope(user: AuthUser): Document {
  if (user.role === "admin") return {};
  const id = objectId(user._id);
  return id ? { userId: id } : { userId: "__none__" };
}

async function resolveBatchScope(batchOrUploadId: string, user: AuthUser): Promise<BatchScope> {
  const id = objectId(batchOrUploadId);
  if (!id) throw new ProcessingError(400, "Некорректный ID загрузки");

  const scope = userScope(user);
  const directUpload = await getCollection("uploads").findOne({ _id: id, ...scope });
  const batchId = (directUpload?.importBatchId as ObjectId | undefined) ?? id;
  const uploads = directUpload?.importBatchId
    ? await getCollection("uploads").find({ importBatchId: directUpload.importBatchId, ...scope }).sort({ createdAt: 1 }).toArray()
    : directUpload
      ? [directUpload]
      : await getCollection("uploads").find({ importBatchId: id, ...scope }).sort({ createdAt: 1 }).toArray();

  if (!uploads.length) throw new ProcessingError(404, "Загрузка не найдена");

  return {
    batchId,
    controllerUploadId: uploads[0]._id as ObjectId,
    uploadIds: uploads.map((upload) => upload._id as ObjectId),
    uploads,
  };
}

function initialStages(): ProcessingStageState[] {
  return processingStages.map((stage) => ({ ...stage, status: "pending" }));
}

function stateFromUploads(uploads: Document[]): ProcessingState {
  const state = uploads.find((upload) => upload.processingState)?.processingState as ProcessingState | undefined;
  if (state) return state;

  const uploadStatus = String(uploads[0]?.status ?? "idle") as ProcessingStatus;
  const status: ProcessingStatus = uploadStatus === "done" || uploadStatus === "done_with_warnings" || uploadStatus === "failed" ? "idle" : uploadStatus;
  return {
    status,
    progress: status === "idle" ? 0 : 100,
    stages: initialStages(),
    attempt: 0,
  };
}

function processingLogEntry(level: ProcessingLogEntry["level"], message: string, sourceFileKey = "processing", entityType = "pipeline"): ProcessingLogEntry {
  return {
    timestamp: new Date(),
    level,
    sourceFileKey,
    entityType,
    message,
  };
}

function statusText(status: ProcessingStatus) {
  const labels: Record<ProcessingStatus, string> = {
    idle: "Ожидает обработки",
    queued: "Ожидает запуска",
    processing: "Обработка",
    cancelling: "Остановка",
    cancelled: "Остановлено",
    done: "Завершено",
    done_with_warnings: "Завершено с предупреждениями",
    failed: "Ошибка",
    stale: "Зависло",
  };
  return labels[status];
}

function buildState(params: {
  base?: ProcessingState;
  status: ProcessingStatus;
  stageIndex?: number;
  stageStatus?: ProcessingStageState["status"];
  progress?: number;
  message?: string;
  errorMessage?: string;
  cancelRequestedAt?: Date;
  finishedAt?: Date;
  attempt?: number;
}): ProcessingState {
  const now = new Date();
  const stages: ProcessingStageState[] = (params.base?.stages?.length ? params.base.stages : initialStages()).map((stage, index): ProcessingStageState => {
    if (params.stageIndex === undefined) return { ...stage };
    if (index < params.stageIndex) return { ...stage, status: "done", finishedAt: stage.finishedAt ?? now };
    if (index > params.stageIndex) return { ...stage, status: stage.status === "done" ? "done" : "pending" };
    return {
      ...stage,
      status: params.stageStatus ?? stage.status,
      startedAt: stage.startedAt ?? now,
      finishedAt: ["done", "error", "cancelled"].includes(params.stageStatus ?? "") ? now : stage.finishedAt,
      message: params.message ?? stage.message,
    };
  });

  return {
    status: params.status,
    currentStage: params.stageIndex === undefined ? params.base?.currentStage : processingStages[params.stageIndex]?.key,
    progress: params.progress ?? params.base?.progress ?? 0,
    stages,
    startedAt: params.base?.startedAt ?? now,
    finishedAt: params.finishedAt,
    errorMessage: params.errorMessage,
    cancelRequestedAt: params.cancelRequestedAt ?? params.base?.cancelRequestedAt,
    lastHeartbeatAt: now,
    attempt: params.attempt ?? params.base?.attempt ?? 1,
  };
}

function historyEntry(oldStatus: string, newStatus: string, userId: ObjectId, reason: string) {
  return {
    oldStatus,
    newStatus,
    changedAt: new Date(),
    changedBy: String(userId),
    reason,
  };
}

async function setProcessingState(scope: BatchScope, state: ProcessingState, logEntry?: ProcessingLogEntry, extraSet: Document = {}) {
  const now = new Date();
  await getCollection("uploads").updateMany(
    { _id: { $in: scope.uploadIds } },
    {
      $set: {
        processingState: state,
        updateTime: now,
        ...extraSet,
      },
    },
  );

  if (logEntry) {
    await getCollection("uploads").updateOne({ _id: scope.controllerUploadId }, { $push: { processingLog: logEntry } } as Document);
  }
}

async function transitionBatchStatus(scope: BatchScope, user: AuthUser, newStatus: string, reason: string, state: ProcessingState, logEntry?: ProcessingLogEntry, extraSet: Document = {}) {
  const userId = new ObjectId(user._id);
  const uploads = await getCollection("uploads").find({ _id: { $in: scope.uploadIds } }).toArray();
  const now = new Date();

  for (const upload of uploads) {
    const oldStatus = String(upload.status ?? "");
    const update: Document = {
      $set: {
        status: newStatus,
        processingState: state,
        updateTime: now,
        ...extraSet,
      },
    };
    if (oldStatus !== newStatus) {
      update.$push = { statusHistory: historyEntry(oldStatus, newStatus, userId, reason) };
    }
    await getCollection("uploads").updateOne({ _id: upload._id }, update);
  }

  if (logEntry) {
    await getCollection("uploads").updateOne({ _id: scope.controllerUploadId }, { $push: { processingLog: logEntry } } as Document);
  }
}

function hasStaleHeartbeat(state: ProcessingState) {
  if (!activeStatuses.has(state.status)) return false;
  const heartbeat = state.lastHeartbeatAt ? new Date(String(state.lastHeartbeatAt)).getTime() : 0;
  return !heartbeat || Date.now() - heartbeat > staleAfterMs;
}

function fileKinds(uploads: Document[]) {
  return new Set(
    uploads.flatMap((upload) =>
      Object.keys((upload.files as Record<string, unknown> | undefined) ?? {}),
    ),
  );
}

async function runStage(stageKey: string, scope: BatchScope) {
  const batchIds = [scope.batchId];
  const linkedFilter = { $or: [{ uploadId: { $in: scope.uploadIds } }, { importBatchId: { $in: batchIds } }] };

  if (stageKey === "validate_files") {
    const kinds = fileKinds(scope.uploads);
    const missing = ["students", "sessions"].filter((kind) => !kinds.has(kind));
    if (missing.length) {
      throw new Error(`Не загружены обязательные CSV: ${missing.join(", ")}`);
    }
    return;
  }

  if (stageKey === "normalize_timestamps") {
    const sessions = await getCollection("sessions").find(linkedFilter, { projection: { _id: 1, startTime: 1, endTime: 1 } }).toArray();
    if (!sessions.length) throw new Error("Не найдены сессии для обработки");
    return;
  }

  if (stageKey === "match_students") {
    const unresolved = scope.uploads.flatMap((upload) => (upload.unresolvedStudents as UnresolvedStudent[] | undefined) ?? []);
    if (unresolved.length) {
      await getCollection("uploads").updateOne(
        { _id: scope.controllerUploadId },
        { $push: { processingLog: processingLogEntry("warn", `Найдено несопоставленных студентов: ${unresolved.length}`, "students", "student") } } as Document,
      );
    }
    return;
  }

  if (stageKey === "build_sessions") {
    const sessionCount = await getCollection("sessions").countDocuments(linkedFilter);
    if (!sessionCount) throw new Error("Не удалось построить экзаменационные сессии");
    return;
  }

  if (stageKey === "compute_metrics") {
    const sessions = await getCollection("sessions").find(linkedFilter).toArray();
    for (const session of sessions) {
      const moodle = (session.metrics as Document | undefined)?.moodle ?? {};
      const ocr = (session.metrics as Document | undefined)?.ocr ?? {};
      const combined = (session.metrics as Document | undefined)?.combined ?? {};
      const featureVector = [
        Number(moodle.totalActions ?? 0),
        Number(moodle.actionsPerMinute ?? 0),
        Number(moodle.tabSwitchCount ?? 0),
        Number(moodle.pasteEventCount ?? 0),
        Number(ocr.faceAbsenceRate ?? 0),
        Number(ocr.foreignFaceRate ?? 0),
        Number(combined.anomalyScore ?? 0),
        Number(session.durationMinutes ?? 0),
      ];
      await getCollection("sessions").updateOne({ _id: session._id }, { $set: { featureVector, updateTime: new Date() } });
    }
    return;
  }

  if (stageKey === "prepare_dataset") {
    const [sessionsCount, studentsCount] = await Promise.all([
      getCollection("sessions").countDocuments(linkedFilter),
      getCollection("students").countDocuments(linkedFilter),
    ]);
    await getCollection("uploads").updateMany(
      { _id: { $in: scope.uploadIds } },
      { $set: { totalRows: sessionsCount, matchedStudents: studentsCount, updateTime: new Date() } },
    );
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function hasCancelRequest(scope: BatchScope) {
  const upload = await getCollection("uploads").findOne({ _id: scope.controllerUploadId }, { projection: { processingState: 1 } });
  const state = upload?.processingState as ProcessingState | undefined;
  return Boolean(state?.cancelRequestedAt || state?.status === "cancelling");
}

async function finishCancelled(scope: BatchScope, user: AuthUser, base: ProcessingState, stageIndex: number) {
  const state = buildState({
    base,
    status: "cancelled",
    stageIndex,
    stageStatus: "cancelled",
    progress: base.progress,
    message: "Обработка остановлена пользователем",
    finishedAt: new Date(),
  });
  await transitionBatchStatus(
    scope,
    user,
    "cancelled",
    "Обработка остановлена",
    state,
    processingLogEntry("warn", "Обработка остановлена пользователем"),
    { processingFinishedAt: new Date() },
  );
}

async function runProcessingJob(batchId: string, user: AuthUser, auditContext?: AuditContext) {
  try {
    let scope = await resolveBatchScope(batchId, user);
    let state = stateFromUploads(scope.uploads);

    for (let index = 0; index < processingStages.length; index += 1) {
      scope = await resolveBatchScope(batchId, user);
      state = stateFromUploads(scope.uploads);
      if (await hasCancelRequest(scope)) {
        await finishCancelled(scope, user, state, index);
        return;
      }

      const stage = processingStages[index];
      const runningState = buildState({
        base: state,
        status: "processing",
        stageIndex: index,
        stageStatus: "running",
        progress: Math.round((index / processingStages.length) * 100),
        message: stage.label,
      });
      await setProcessingState(scope, runningState, processingLogEntry("info", `Этап начат: ${stage.label}`));

      await sleep(stageDelayMs);
      scope = await resolveBatchScope(batchId, user);
      if (await hasCancelRequest(scope)) {
        await finishCancelled(scope, user, runningState, index);
        return;
      }

      await runStage(stage.key, scope);
      const doneState = buildState({
        base: runningState,
        status: "processing",
        stageIndex: index,
        stageStatus: "done",
        progress: Math.round(((index + 1) / processingStages.length) * 100),
        message: stage.label,
      });
      await setProcessingState(scope, doneState, processingLogEntry("info", `Этап завершен: ${stage.label}`));
    }

    scope = await resolveBatchScope(batchId, user);
    const unresolvedCount = scope.uploads.flatMap((upload) => (upload.unresolvedStudents as UnresolvedStudent[] | undefined) ?? []).length;
    const finalStatus: ProcessingStatus = unresolvedCount ? "done_with_warnings" : "done";
    const finalState = buildState({
      base: stateFromUploads(scope.uploads),
      status: finalStatus,
      progress: 100,
      finishedAt: new Date(),
      message: "Обработка завершена",
    });
    await transitionBatchStatus(
      scope,
      user,
      finalStatus,
      "Обработка завершена",
      finalState,
      processingLogEntry(unresolvedCount ? "warn" : "info", unresolvedCount ? `Обработка завершена с предупреждениями: ${unresolvedCount}` : "Обработка завершена"),
      { processingFinishedAt: new Date() },
    );
    await safeRecordAuditEvent({
      ...auditContext,
      actorUserId: new ObjectId(user._id),
      actorType: "user",
      action: "upload.process_complete",
      entityType: "upload",
      entityId: scope.batchId,
      occurredAt: new Date(),
      details: { status: finalStatus },
    });
  } catch (error) {
    const scope = await resolveBatchScope(batchId, user).catch(() => null);
    if (!scope) return;
    const state = buildState({
      base: stateFromUploads(scope.uploads),
      status: "failed",
      stageStatus: "error",
      progress: stateFromUploads(scope.uploads).progress,
      errorMessage: error instanceof Error ? error.message : "Ошибка обработки",
      finishedAt: new Date(),
    });
    await transitionBatchStatus(
      scope,
      user,
      "failed",
      "Ошибка обработки",
      state,
      processingLogEntry("error", state.errorMessage ?? "Ошибка обработки"),
      { processingFinishedAt: new Date() },
    );
  } finally {
    activeJobs.delete(batchId);
  }
}

async function markStaleIfNeeded(scope: BatchScope, state: ProcessingState, user: AuthUser) {
  const batchKey = String(scope.batchId);
  if (!activeStatuses.has(state.status)) return state;
  if (activeJobs.has(batchKey) && !hasStaleHeartbeat(state)) return state;

  const staleState = buildState({
    base: state,
    status: "stale",
    progress: state.progress,
    errorMessage: "Задача не обновлялась дольше ожидаемого времени",
    finishedAt: new Date(),
  });
  await transitionBatchStatus(
    scope,
    user,
    "stale",
    "Обработка зависла",
    staleState,
    processingLogEntry("error", "Задача обработки помечена как зависшая"),
  );
  return staleState;
}

function aggregateUpload(scope: BatchScope, state: ProcessingState) {
  const metrics = deriveBatchUploadMetrics(scope.uploads);
  const files = Object.assign({}, ...scope.uploads.map((upload) => upload.files ?? {})) as Document;
  const createdAt = scope.uploads[0]?.createdAt;
  const updateTime = scope.uploads.reduce((latest, upload) => {
    const current = upload.updateTime ? new Date(String(upload.updateTime)).getTime() : 0;
    return current > latest ? current : latest;
  }, 0);
  return {
    _id: scope.batchId,
    importBatchId: scope.batchId,
    createdAt,
    updateTime: updateTime ? new Date(updateTime) : createdAt,
    status: state.status === "idle" ? String(scope.uploads[0]?.status ?? "idle") : state.status,
    filesCount: metrics.filesCount,
    totalRows: metrics.totalRows,
    matchedStudents: metrics.matchedStudents,
    files,
    processingState: state,
    processingStartedAt: state.startedAt ?? scope.uploads[0]?.processingStartedAt,
    processingFinishedAt: state.finishedAt ?? scope.uploads.at(-1)?.processingFinishedAt,
  };
}

function aggregateLog(scope: BatchScope): Document[] {
  return scope.uploads
    .flatMap((upload) =>
      ((upload.processingLog as Document[] | undefined) ?? []).map((entry): Document => ({
        ...entry,
        sourceFileKey: entry.sourceFileKey ?? Object.keys((upload.files as Document | undefined) ?? {})[0] ?? "processing",
      })),
    )
    .sort((left: Document, right: Document) => String(left.timestamp ?? "").localeCompare(String(right.timestamp ?? "")));
}

async function buildResponse(scope: BatchScope, state: ProcessingState): Promise<ProcessingResponse> {
  return {
    ok: true,
    upload: aggregateUpload(scope, state),
    processingLog: aggregateLog(scope),
    unresolvedStudents: mergeUnresolvedStudents(
      [],
      scope.uploads.flatMap((upload) => (upload.unresolvedStudents as UnresolvedStudent[] | undefined) ?? []),
    ),
  };
}

export async function getProcessingStatus(batchOrUploadId: string, user: AuthUser) {
  const scope = await resolveBatchScope(batchOrUploadId, user);
  const state = await markStaleIfNeeded(scope, stateFromUploads(scope.uploads), user);
  const freshScope = state.status === stateFromUploads(scope.uploads).status ? scope : await resolveBatchScope(batchOrUploadId, user);
  return buildResponse(freshScope, stateFromUploads(freshScope.uploads).status === state.status ? stateFromUploads(freshScope.uploads) : state);
}

export async function startProcessing(batchOrUploadId: string, user: AuthUser, auditContext?: AuditContext, retry = false) {
  const scope = await resolveBatchScope(batchOrUploadId, user);
  const currentState = await markStaleIfNeeded(scope, stateFromUploads(scope.uploads), user);
  const batchKey = String(scope.batchId);

  if (activeStatuses.has(currentState.status)) {
    if (activeJobs.has(batchKey)) return buildResponse(scope, currentState);
    throw new ProcessingError(409, "Задача обработки зависла. Остановите или перезапустите обработку.");
  }
  if (!retry && retryableStatuses.has(currentState.status)) {
    throw new ProcessingError(409, "Эту обработку нужно перезапустить через действие «Перезапустить»");
  }

  const nextAttempt = (currentState.attempt ?? 0) + 1;
  const queuedState = buildState({
    status: "queued",
    progress: 0,
    attempt: nextAttempt,
  });
  await transitionBatchStatus(
    scope,
    user,
    "processing",
    retry ? "Повторный запуск обработки" : "Обработка запущена",
    queuedState,
    processingLogEntry("info", retry ? `Повторный запуск обработки, попытка ${nextAttempt}` : "Обработка поставлена в очередь"),
    { processingStartedAt: new Date(), processingFinishedAt: null },
  );
  await safeRecordAuditEvent({
    ...auditContext,
    actorUserId: new ObjectId(user._id),
    actorType: "user",
    action: retry ? "upload.process_retry" : "upload.process_start",
    entityType: "upload",
    entityId: scope.batchId,
    occurredAt: new Date(),
    details: { attempt: nextAttempt },
  });

  activeJobs.set(batchKey, { startedAt: new Date() });
  setTimeout(() => {
    void runProcessingJob(batchKey, user, auditContext);
  }, 0);

  const freshScope = await resolveBatchScope(batchOrUploadId, user);
  return buildResponse(freshScope, stateFromUploads(freshScope.uploads));
}

export async function stopProcessing(batchOrUploadId: string, user: AuthUser) {
  const scope = await resolveBatchScope(batchOrUploadId, user);
  const state = await markStaleIfNeeded(scope, stateFromUploads(scope.uploads), user);
  if (!activeStatuses.has(state.status)) return buildResponse(scope, state);

  const cancellingState = buildState({
    base: state,
    status: "cancelling",
    progress: state.progress,
    cancelRequestedAt: new Date(),
    message: "Запрошена остановка обработки",
  });
  await transitionBatchStatus(
    scope,
    user,
    "processing",
    "Запрошена остановка обработки",
    cancellingState,
    processingLogEntry("warn", "Пользователь запросил остановку обработки"),
  );

  const freshScope = await resolveBatchScope(batchOrUploadId, user);
  return buildResponse(freshScope, stateFromUploads(freshScope.uploads));
}

export async function retryProcessing(batchOrUploadId: string, user: AuthUser, auditContext?: AuditContext) {
  const scope = await resolveBatchScope(batchOrUploadId, user);
  const state = await markStaleIfNeeded(scope, stateFromUploads(scope.uploads), user);
  if (activeStatuses.has(state.status) && activeJobs.has(String(scope.batchId))) {
    throw new ProcessingError(409, "Обработка уже выполняется");
  }
  return startProcessing(batchOrUploadId, user, auditContext, true);
}
