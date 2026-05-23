import { AnyRecord } from "../../entities/types";

type Assignment = {
  sessionId: string;
  clusterId: number;
  isAnomaly: boolean;
  reducedCoords: { x: number; y: number };
};

export function ClusterChart({ assignments }: { assignments: AnyRecord[] }) {
  const points = assignments as unknown as Assignment[];
  if (!points.length) return <div className="notice">Нет точек для визуализации</div>;

  const xs = points.map((item) => item.reducedCoords?.x ?? 0);
  const ys = points.map((item) => item.reducedCoords?.y ?? 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = (value: number, min: number, max: number) => 10 + ((value - min) / Math.max(max - min, 1)) * 80;

  return (
    <div className="chart">
      {points.map((point) => (
        <div
          key={`${point.sessionId}-${point.clusterId}`}
          className={point.isAnomaly ? "chart-point anomaly" : "chart-point"}
          title={`cluster=${point.clusterId}, anomaly=${point.isAnomaly}`}
          style={{
            left: `${scale(point.reducedCoords?.x ?? 0, minX, maxX)}%`,
            top: `${100 - scale(point.reducedCoords?.y ?? 0, minY, maxY)}%`,
          }}
        >
          {point.clusterId}
        </div>
      ))}
    </div>
  );
}
