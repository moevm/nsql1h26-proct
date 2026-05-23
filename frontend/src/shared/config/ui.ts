export const clusterColors: Record<string, string> = {
  C1: "#3b82f6",
  C2: "#10b981",
  C3: "#8b5cf6",
  C4: "#f97316",
  C5: "#14b8a6",
  anomaly: "#ef4444",
};

export const uploadStatusLabels = {
  success: { theme: "success" as const, text: "Успешно" },
  warning: { theme: "warning" as const, text: "Предупреждения" },
  error: { theme: "danger" as const, text: "Ошибка" },
};

export const runStatusLabels = {
  success: { theme: "success" as const, label: "Завершено" },
  running: { theme: "info" as const, label: "Выполняется" },
  error: { theme: "danger" as const, label: "Ошибка" },
};

export const reportDateRangeOptions = [
  { value: "7d", content: "Последние 7 дней" },
  { value: "30d", content: "Последние 30 дней" },
  { value: "90d", content: "Последние 90 дней" },
  { value: "all", content: "За всё время" },
];

export const clusterOptions = [
  { value: "all", content: "Все кластеры" },
  { value: "C1", content: "C1" },
  { value: "C2", content: "C2" },
  { value: "C3", content: "C3" },
  { value: "C4", content: "C4" },
  { value: "C5", content: "C5" },
];

export const clusteringMetricGroups = [
  {
    title: "Метрики Moodle",
    metrics: [
      { label: "Всего действий", feature: "totalActions" },
      { label: "Действий в минуту", feature: "actionsPerMinute" },
      { label: "Соотношение пас./акт.", feature: "viewToSubmitRatio" },
      { label: "Переходов по страницам", feature: "pageTransitions" },
    ],
  },
  {
    title: "Метрики камеры",
    metrics: [
      { label: "Длит. отсутствия лица", feature: "faceAbsenceRate" },
      { label: "Длит. постороннего лица", feature: "foreignFaceRate" },
      { label: "Количество смен лица", feature: "faceSwapCount" },
      { label: "Ср. уверенность совпадения", feature: "avgFaceConfidence" },
    ],
  },
];

export const distanceMetricOptions = [
  { value: "euclidean", content: "Евклидова" },
  { value: "manhattan", content: "Манхэттенская" },
  { value: "cosine", content: "Косинусная" },
];
