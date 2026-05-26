import { isValidIsoDateTime } from "./dateTime";

export function matchesText(value: string, filter: string) {
  return !filter || value.toLowerCase().includes(filter.toLowerCase());
}

export function numberFilterValue(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function matchesNumberRange(value: number, min: string, max: string) {
  const minValue = numberFilterValue(min);
  const maxValue = numberFilterValue(max);
  if (minValue !== undefined && value < minValue) return false;
  if (maxValue !== undefined && value > maxValue) return false;
  return true;
}

export function dateFilterValue(value: string) {
  if (!value.trim() || !isValidIsoDateTime(value)) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function matchesDateRange(rawValue: string, from?: number, to?: number) {
  if (from === undefined && to === undefined) return true;
  const time = new Date(rawValue).getTime();
  if (Number.isNaN(time)) return false;
  if (from !== undefined && time < from) return false;
  if (to !== undefined && time > to) return false;
  return true;
}
