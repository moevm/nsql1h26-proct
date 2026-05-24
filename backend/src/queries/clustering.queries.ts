import { Document, ObjectId } from "mongodb";

import { getCollection } from "../db/collections.js";
import type { FeatureSession } from "../schema/session.schema.js";

export function findSessionsForClustering(filter: Document) {
  return getCollection("sessions").find(filter).toArray() as Promise<FeatureSession[]>;
}

export async function insertClusteringRun(document: Document) {
  const result = await getCollection("clustering_runs").insertOne(document);
  return result.insertedId;
}

export async function getRunWithSessions(runId: string) {
  const run = await getCollection("clustering_runs").findOne({ _id: new ObjectId(runId) });
  if (!run) return null;

  const sessionIds = ((run.results as Document)?.sessionAssignments as Document[] | undefined)?.map((item) => item.sessionId as ObjectId) ?? [];
  const sessions = await getCollection("sessions").find({ _id: { $in: sessionIds } }).toArray();
  const studentIds = sessions.map((session) => session.studentId as ObjectId);
  const students = await getCollection("students").find({ _id: { $in: studentIds } }).toArray();
  return { run, sessions, students };
}

export async function deleteClusteringRun(runId: string) {
  if (!ObjectId.isValid(runId)) return false;
  const result = await getCollection("clustering_runs").deleteOne({ _id: new ObjectId(runId) });
  return result.deletedCount > 0;
}
