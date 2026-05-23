import type { ObjectId } from "mongodb";

export type StudentDocument = {
  _id?: ObjectId;
  uploadId: ObjectId;
  importBatchId?: ObjectId;
  universityId: ObjectId;
  externalId: string;
  recordBookNumber: string;
  fullName: string;
  email: string;
  faculty: string;
  program: string;
  educationLevel: string;
  group: string;
  faceEmbedding?: number[];
  createdAt: Date;
  updateTime: Date;
};
