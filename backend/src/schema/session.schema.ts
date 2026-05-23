import type { Document, ObjectId, WithId } from "mongodb";

export type SessionMetrics = {
  moodle?: Record<string, number>;
  ocr?: Record<string, number>;
  combined?: {
    anomalyScore?: number;
    riskLevel?: string;
  };
};

export type SessionDocument = {
  _id?: ObjectId;
  uploadId: ObjectId;
  importBatchId?: ObjectId;
  studentId: ObjectId;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  examName: string;
  metrics: SessionMetrics;
  featureVector: number[];
  createdAt: Date;
  updateTime: Date;
};

export type FeatureSession = WithId<Document> & {
  featureVector?: number[];
  metrics?: SessionMetrics;
};
