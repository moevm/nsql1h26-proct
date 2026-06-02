export const defaultPageSizeOptions = [1, 10, 25, 50, 100, 200];

export function readStoredPageSize(storageKey: string | undefined, fallback: number) {
  if (!storageKey || typeof window === "undefined") return fallback;
  const value = Number(window.localStorage.getItem(storageKey));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function writeStoredPageSize(storageKey: string | undefined, value: number) {
  if (!storageKey || typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, String(value));
}
