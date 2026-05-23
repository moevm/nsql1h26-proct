import type { AnyRecord } from "../../entities/types";

export function getNested(record: AnyRecord | undefined, path: string) {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object") return (current as AnyRecord)[part];
    return undefined;
  }, record);
}
