export type ClusterRunHistoryRow = {
  id: string;
  startedAt: string;
  finishedAt: string;
  duration: string;
  algorithm: "K-Means" | "DBSCAN";
  clusters: number;
  anomalies: number;
  status: "success" | "running" | "error";
  subset: string;
};

export type ResultSessionRow = {
  id: string;
  student: string;
  date: string;
  cluster: string;
  anomaly: boolean;
  confidence?: number;
  distanceToCentroid?: number;
  metrics?: Record<string, unknown>;
};

export type DrawerMetric = {
  label: string;
  value: string;
};
