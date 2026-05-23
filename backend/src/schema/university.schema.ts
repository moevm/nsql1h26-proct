import type { ObjectId } from "mongodb";

export type UniversityDocument = {
  _id?: ObjectId;
  name: string;
  shortName: string;
  externalCode: string;
  createdAt: Date;
  updateTime: Date;
};
