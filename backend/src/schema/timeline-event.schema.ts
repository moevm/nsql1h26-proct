import type { ObjectId } from "mongodb";

export type MoodleEventData = {
  action: string;
  target: string;
  courseName: string;
  ip: string;
  userAgent: string;
  quizId?: string;
  questionId?: string;
  answer?: string;
  isCorrect?: boolean;
  timeSpent?: number;
  tabFocus?: boolean;
};

export type OcrEventData = {
  frameIndex: number;
  videoOffsetMs: number;
  blocks: Array<{
    label: string;
    content: string;
    bbox: number[];
    confidence: number;
    order: number;
  }>;
  markdown?: string;
};

export type SystemEventData = {
  code: string;
  message: string;
};

export type TimelineEventDocument = {
  _id?: ObjectId;
  uploadId: ObjectId;
  importBatchId?: ObjectId;
  studentId: ObjectId;
  sessionId: ObjectId;
  eventType: string;
  eventTime: Date;
  sourceFileKey: string;
  moodle?: MoodleEventData;
  ocr?: OcrEventData;
  system?: SystemEventData;
  createdAt: Date;
  updateTime: Date;
};
