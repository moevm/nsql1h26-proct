export function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU");
}

export function formatDateOnly(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ru-RU");
}

export function formatNumber(value: unknown) {
  return Number(value ?? 0).toLocaleString("ru-RU");
}

export function formatDuration(start: unknown, finish: unknown) {
  if (!start || !finish) return "—";
  const delta = Math.max(0, new Date(String(finish)).getTime() - new Date(String(start)).getTime());
  const seconds = Math.round(delta / 1000);
  if (seconds < 60) return `${seconds}с`;
  return `${Math.floor(seconds / 60)}м ${seconds % 60}с`;
}

export function saveJsonFile(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  saveBlob(blob, fileName);
}

export function saveTextFile(text: string, fileName: string, type = "text/plain;charset=utf-8") {
  saveBlob(new Blob([text], { type }), fileName);
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
