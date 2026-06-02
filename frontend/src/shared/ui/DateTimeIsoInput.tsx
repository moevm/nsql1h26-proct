import { useEffect, useId, useState } from "react";
import { Calendar } from "lucide-react";
import {
  formatIsoDateTimeDisplay,
  fromDateTimePickerValue,
  isoDateTimeFormatTitle,
  isoDateTimePlaceholder,
  isValidIsoDateTime,
  toDateTimePickerValue,
} from "../lib/dateTime";

type Props = {
  label: string;
  value: string;
  onUpdate: (value: string) => void;
  hideLabel?: boolean;
  showIsoHint?: boolean;
};

function pickerParts(value: string) {
  const pickerValue = toDateTimePickerValue(value) || toDateTimePickerValue(new Date().toISOString());
  const [date = "", time = "00:00"] = pickerValue.split("T");
  const [hour = "00", minute = "00"] = time.split(":");

  return { date, hour, minute };
}

function joinPickerParts(date: string, hour: string, minute: string) {
  if (!date) return "";
  return fromDateTimePickerValue(`${date}T${hour}:${minute}`);
}

function normalizeTimePart(value: string, min: number, max: number) {
  if (!/^\d{1,2}$/.test(value)) return undefined;

  const numberValue = Number(value);
  if (numberValue < min || numberValue > max) return undefined;
  return String(numberValue).padStart(2, "0");
}

export function DateTimeIsoInput({ label, value, onUpdate, hideLabel = false, showIsoHint = true }: Props) {
  const inputId = useId();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const invalid = !isValidIsoDateTime(value);
  const displayValue = editing ? value : formatIsoDateTimeDisplay(value);
  const parts = pickerParts(value);
  const [hourDraft, setHourDraft] = useState(parts.hour);
  const [minuteDraft, setMinuteDraft] = useState(parts.minute);
  const hourInvalid = normalizeTimePart(hourDraft, 0, 23) === undefined;
  const minuteInvalid = normalizeTimePart(minuteDraft, 0, 59) === undefined;
  const emptyPlaceholder = hideLabel ? label : isoDateTimePlaceholder;

  useEffect(() => {
    setHourDraft(parts.hour);
    setMinuteDraft(parts.minute);
  }, [parts.hour, parts.minute]);

  function applyTimePart(nextHour: string, nextMinute: string) {
    const normalizedHour = normalizeTimePart(nextHour, 0, 23);
    const normalizedMinute = normalizeTimePart(nextMinute, 0, 59);
    if (!normalizedHour || !normalizedMinute) return;

    onUpdate(joinPickerParts(parts.date, normalizedHour, normalizedMinute));
  }

  return (
    <div className={`min-w-0 relative ${hideLabel ? "" : "space-y-1.5"}`}>
      {!hideLabel && (
        <label className="text-[12px] text-muted-foreground flex items-center gap-1.5" htmlFor={inputId} style={{ fontWeight: 600 }}>
          <span>{label}</span>
          {showIsoHint && (
            <span className="text-[10px] font-normal font-mono text-muted-foreground/70" title={isoDateTimeFormatTitle}>
              ISO
            </span>
          )}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          className={`w-full min-w-0 h-10 pr-10 ${invalid ? "border-destructive" : ""}`}
          value={displayValue}
          onChange={(event) => onUpdate(event.target.value)}
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
          placeholder={emptyPlaceholder}
          aria-label={label}
          aria-invalid={invalid}
        />
        <button
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          aria-expanded={pickerOpen}
          aria-label={`${label}: открыть выбор даты и времени`}
        >
          <Calendar className="h-4 w-4" />
        </button>
      </div>
      {pickerOpen && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-border bg-card p-3 shadow-lg space-y-2">
          <input
            className="w-full"
            type="date"
            value={parts.date}
            onChange={(event) => onUpdate(joinPickerParts(event.target.value, parts.hour, parts.minute))}
            aria-label={`${label}: дата`}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className={`w-full ${hourInvalid ? "border-destructive" : ""}`}
              type="number"
              min={0}
              max={23}
              value={hourDraft}
              onChange={(event) => {
                setHourDraft(event.target.value);
                applyTimePart(event.target.value, minuteDraft);
              }}
              aria-label={`${label}: часы`}
              placeholder="чч"
            />
            <input
              className={`w-full ${minuteInvalid ? "border-destructive" : ""}`}
              type="number"
              min={0}
              max={59}
              value={minuteDraft}
              onChange={(event) => {
                setMinuteDraft(event.target.value);
                applyTimePart(hourDraft, event.target.value);
              }}
              aria-label={`${label}: минуты`}
              placeholder="мм"
            />
          </div>
          {(hourInvalid || minuteInvalid) && <div className="text-[11px] text-destructive">Часы: 0-23, минуты: 0-59</div>}
          <div className="flex justify-end">
            <button className="button button_secondary h-8 px-3 text-[12px]" type="button" onClick={() => setPickerOpen(false)}>
              Закрыть
            </button>
          </div>
        </div>
      )}
      {invalid && <div className="text-[11px] text-destructive">Введите корректную ISO дату и время</div>}
    </div>
  );
}
