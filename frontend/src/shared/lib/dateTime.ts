const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/;

export const isoDateTimePlaceholder = "2026-03-01T09:30:00.000Z";

export function isValidIsoDateTime(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return isoDateTimePattern.test(trimmed) && !Number.isNaN(new Date(trimmed).getTime());
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

export function toDateTimePickerValue(value: string) {
  if (!isValidIsoDateTime(value) || !value.trim()) return "";

  const date = new Date(value);
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join("-") + `T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

export function fromDateTimePickerValue(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function timestampToIsoDateTime(value: string) {
  if (!/^-?\d+$/.test(value)) return value;

  const date = new Date(Number(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function isoDateTimeToTimestamp(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? undefined : String(timestamp);
}
