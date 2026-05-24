import { Document, ObjectId } from "mongodb";

import { getCollection } from "../db/collections.js";

export async function getAnomalyRows(runId?: string) {
  const run =
    runId && ObjectId.isValid(runId)
      ? await getCollection("clustering_runs").findOne({ _id: new ObjectId(runId) })
      : await getCollection("clustering_runs").findOne({}, { sort: { startedAt: -1 } });

  if (!run) return null;

  const assignments = (((run.results as Document).sessionAssignments as Document[]) ?? []).filter((item) => item.isAnomaly);
  const sessions = await getCollection("sessions").find({ _id: { $in: assignments.map((item) => item.sessionId as ObjectId) } }).toArray();
  const students = await getCollection("students").find({ _id: { $in: sessions.map((session) => session.studentId as ObjectId) } }).toArray();

  return assignments.map((assignment) => {
    const session = sessions.find((item) => item._id.equals(assignment.sessionId as ObjectId));
    const student = students.find((item) => item._id.equals(session?.studentId as ObjectId));
    return {
      student: student?.fullName,
      group: student?.group,
      exam: session?.examName,
      clusterId: assignment.clusterId,
      distanceToCentroid: assignment.distanceToCentroid,
      anomalyScore: (session?.metrics as Document | undefined)?.combined ? ((session?.metrics as Document).combined as Document).anomalyScore : "",
    };
  });
}

export async function getStudentsExportRows() {
  return getCollection("students").find({}, { sort: { group: 1, fullName: 1 } }).toArray();
}

export async function getSessionsExportRows() {
  return getCollection("sessions").find({}, { sort: { startTime: -1 } }).toArray();
}
