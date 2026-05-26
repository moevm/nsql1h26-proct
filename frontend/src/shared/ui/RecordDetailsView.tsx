import type { ReactNode } from "react";
import { printable, type AnyRecord } from "../../entities/types";

type Props = {
  record: AnyRecord | null;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function JsonValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <pre className="bg-muted rounded-lg p-3 text-[12px] overflow-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  if (isPlainObject(value)) {
    return (
      <div className="space-y-2">
        {Object.entries(value).map(([key, nestedValue]) => (
          <div className="border border-border rounded-lg p-3" key={key}>
            <div className="text-[12px] text-muted-foreground mb-1" style={{ fontWeight: 600 }}>{key}</div>
            <JsonValue value={nestedValue} />
          </div>
        ))}
      </div>
    );
  }

  return <span className="break-all">{printable(value) || "—"}</span>;
}

export function RecordDetailsView({ record, title, subtitle = "Все атрибуты записи", actions, children }: Props) {
  return (
    <section className="bg-card rounded-xl border border-border p-5 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-[20px]" style={{ fontWeight: 600 }}>{title}</h2>
          <p className="text-muted-foreground text-[13px] mt-1">{subtitle}</p>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>

      {children}

      {record && (
        <div className="columns-1 lg:columns-2 gap-3">
          {Object.entries(record).map(([key, value]) => (
            <div className="break-inside-avoid border border-border rounded-xl p-4 space-y-2 mb-3" key={key}>
              <div className="text-[12px] text-muted-foreground" style={{ fontWeight: 600 }}>{key}</div>
              <div className="text-[13px]">
                <JsonValue value={value} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
