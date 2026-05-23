import type { ObjectId } from "mongodb";

export type SessionAssignment = {
  sessionId: ObjectId;
  clusterId: number;
  isAnomaly: boolean;
  distanceToCentroid: number;
  reducedCoords: {
    x: number;
    y: number;
  };
};

export type ClusterResult = {
  clusterId: number;
  size: number;
  centroid: number[];
  avgMetrics: Record<string, number>;
  anomalyRate: number;
};

export type ClusteringRunDocument = {
  _id?: ObjectId;
  userId: ObjectId;
  uploadIds: ObjectId[];
  startedAt: Date;
  finishedAt: Date;
  createdAt: Date;
  updateTime: Date;
  status: string;
  statusHistory?: Array<{
    oldStatus: string;
    newStatus: string;
    changedAt: Date;
    changedBy: string;
    reason: string;
  }>;
  algorithm: "kmeans" | "dbscan" | string;
  parameters: {
    k?: number;
    distanceMetric: string;
    selectedFeatures: string[];
  };
  filter: {
    dateFrom?: Date | null;
    dateTo?: Date | null;
    uploadIds: ObjectId[] | string[];
  };
  results: {
    totalSessions: number;
    clusterCount: number;
    anomalyCount: number;
    anomalyRate: number;
    silhouetteScore: number;
    clusters: ClusterResult[];
    sessionAssignments: SessionAssignment[];
  };
};
