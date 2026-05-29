import { useState, type ReactNode } from "react";
import { printable, type AnyRecord } from "../../entities/types";

type Props = {
  record: AnyRecord | null;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
};

type JsonModalState = {
  path: string;
  value: unknown;
} | null;

const inlineArrayLimit = 4;
const inlineObjectKeysLimit = 6;
const inlineJsonLengthLimit = 600;
const previewLength = 420;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function jsonPreview(value: unknown) {
  const json = JSON.stringify(value, null, 2);
  if (!json) return "";
  return json.length > previewLength ? `${json.slice(0, previewLength)}...` : json;
}

function isLargeJsonValue(value: unknown) {
  if (!Array.isArray(value) && !isPlainObject(value)) return false;

  const json = JSON.stringify(value);
  if (json && json.length > inlineJsonLengthLimit) return true;
  if (Array.isArray(value)) return value.length > inlineArrayLimit;
  return Object.keys(value).length > inlineObjectKeysLimit;
}

function JsonPreview({ value, path, onOpen }: { value: unknown; path: string; onOpen?: (state: Exclude<JsonModalState, null>) => void }) {
  const entriesCount = Array.isArray(value) ? value.length : isPlainObject(value) ? Object.keys(value).length : 0;
  const typeLabel = Array.isArray(value) ? "Массив" : "Объект";

  return (
    <div className="bg-muted rounded-lg p-3 border border-border">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 600 }}>
          {typeLabel}: {entriesCount} {Array.isArray(value) ? "элем." : "полей"}
        </span>
        <button className="text-[12px] text-link hover:underline" type="button" onClick={() => onOpen?.({ path, value })}>
          Открыть полностью
        </button>
      </div>
      <pre className="text-[12px] overflow-hidden whitespace-pre-wrap break-words max-h-40">
        {jsonPreview(value)}
      </pre>
    </div>
  );
}

export function JsonValue({ value, path = "Значение", onOpenJson }: { value: unknown; path?: string; onOpenJson?: (state: Exclude<JsonModalState, null>) => void }) {
  if (isLargeJsonValue(value)) {
    return <JsonPreview value={value} path={path} onOpen={onOpenJson} />;
  }

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
            <JsonValue value={nestedValue} path={`${path}.${key}`} onOpenJson={onOpenJson} />
          </div>
        ))}
      </div>
    );
  }

  return <span className="break-all">{printable(value) || "—"}</span>;
}

export function RecordDetailsView({ record, title, subtitle = "Все атрибуты записи", actions, children }: Props) {
  const [jsonModal, setJsonModal] = useState<JsonModalState>(null);

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
                <JsonValue value={value} path={key} onOpenJson={setJsonModal} />
              </div>
            </div>
          ))}
        </div>
      )}
      {jsonModal && (
        <div className="modal-backdrop" onClick={() => setJsonModal(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <h3>{jsonModal.path}</h3>
              <button className="button button_secondary" type="button" onClick={() => setJsonModal(null)}>
                Закрыть
              </button>
            </div>
            <pre className="bg-muted rounded-lg p-3 text-[12px] overflow-auto max-h-[70vh] whitespace-pre-wrap break-words">
              {JSON.stringify(jsonModal.value, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
