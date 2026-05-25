import type { FilterField } from "../../entities/types";

export function filterParamKeys(field: FilterField) {
  if (field.type === "dateRange" || field.type === "dateTime") return [`${field.key}From`, `${field.key}To`];
  if (field.type === "numberRange") return [`${field.key}Min`, `${field.key}Max`];
  return [field.key];
}

export function dateTimeFilterKeys(fields: FilterField[]) {
  return fields.filter((field) => field.type === "dateTime").flatMap(filterParamKeys);
}
