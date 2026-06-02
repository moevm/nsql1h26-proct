import type { ReactNode } from "react";
import { isoDateTimeFormatTitle } from "../lib/dateTime";
import { DateTimeIsoInput } from "./DateTimeIsoInput";

type FieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function FilterFormField({ label, children, className = "" }: FieldProps) {
  return (
    <div className={`space-y-1.5 min-w-0 ${className}`}>
      <span className="text-[12px] text-muted-foreground block" style={{ fontWeight: 600 }}>
        {label}
      </span>
      {children}
    </div>
  );
}

/** @deprecated Use FilterFormField */
export const FilterField = FilterFormField;

function IsoBadge() {
  return (
    <span className="text-[10px] text-muted-foreground/70 font-mono shrink-0" title={isoDateTimeFormatTitle}>
      ISO
    </span>
  );
}

type RangeProps = {
  label: string;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  fromPlaceholder?: string;
  toPlaceholder?: string;
  className?: string;
};

export function FilterNumberRange({
  label,
  from,
  to,
  onFromChange,
  onToChange,
  fromPlaceholder = "От",
  toPlaceholder = "До",
  className = "",
}: RangeProps) {
  return (
    <FilterFormField label={label} className={className}>
      <div className="grid grid-cols-2 gap-2">
        <input
          className="w-full h-10"
          type="number"
          placeholder={fromPlaceholder}
          value={from}
          onChange={(event) => onFromChange(event.target.value)}
          aria-label={`${label}, ${fromPlaceholder}`}
        />
        <input
          className="w-full h-10"
          type="number"
          placeholder={toPlaceholder}
          value={to}
          onChange={(event) => onToChange(event.target.value)}
          aria-label={`${label}, ${toPlaceholder}`}
        />
      </div>
    </FilterFormField>
  );
}

type DateTimeRangeProps = {
  label: string;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  className?: string;
};

export function FilterDateTimeRange({
  label,
  from,
  to,
  onFromChange,
  onToChange,
  className = "",
}: DateTimeRangeProps) {
  return (
    <div className={`space-y-1.5 min-w-0 ${className}`}>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 600 }}>
          {label}
        </span>
        <IsoBadge />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <DateTimeIsoInput hideLabel showIsoHint={false} label="От" value={from} onUpdate={onFromChange} />
        <DateTimeIsoInput hideLabel showIsoHint={false} label="До" value={to} onUpdate={onToChange} />
      </div>
    </div>
  );
}
