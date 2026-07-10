import { AlertCircle, Asterisk, ChevronLeft, ChevronRight, ListTree } from "lucide-react";
import type { CollectionSummary, FieldSchema } from "../../lib/tauri";
import { Badge } from "../../ui/Badge";
import { EmptyState } from "../../ui/EmptyState";
import { IconButton } from "../../ui/IconButton";

type SchemaInspectorProps = {
  collection: CollectionSummary | null;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
};

export function SchemaInspector({
  collection,
  isCollapsed,
  onToggleCollapsed,
}: SchemaInspectorProps) {
  const schema = collection?.schema ?? null;

  if (isCollapsed) {
    return (
      <aside
        className="flex w-12 shrink-0 justify-center border-l border-white/10 bg-surface-panel p-2"
        aria-label="Schema fields"
      >
        <IconButton label="Expand schema" tooltip="Expand schema" onClick={onToggleCollapsed}>
          <ChevronLeft aria-hidden="true" size={16} strokeWidth={2.2} />
        </IconButton>
      </aside>
    );
  }

  return (
    <aside
      className="flex w-[280px] min-w-0 shrink-0 flex-col border-l border-white/10 bg-surface-panel"
      aria-label="Schema fields"
    >
      <header className="flex min-h-12 items-center justify-between gap-2 border-b border-white/10 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <IconButton label="Collapse schema" tooltip="Collapse schema" onClick={onToggleCollapsed}>
            <ChevronRight aria-hidden="true" size={16} strokeWidth={2.2} />
          </IconButton>
          <h2 className="m-0 text-[0.86rem] font-black text-text-primary">Schema</h2>
        </div>
        {schema?.source === "contentConfig" ? <Badge variant="accent">From config</Badge> : null}
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {!collection ? (
          <EmptyState
            icon={<ListTree aria-hidden="true" size={20} strokeWidth={2.1} />}
            title="No collection selected"
          >
            Pick a collection to inspect its schema fields.
          </EmptyState>
        ) : !schema || schema.fields.length === 0 ? (
          <EmptyState
            icon={<ListTree aria-hidden="true" size={20} strokeWidth={2.1} />}
            title="No schema detected"
          >
            Orbit Editor could not read a schema for <em>{collection.name}</em> from content.config
            or its frontmatter.
          </EmptyState>
        ) : (
          <>
            <p className="mb-3 flex items-center justify-between text-[0.68rem] font-black uppercase tracking-[0.08em] text-text-faint">
              Fields <Badge variant="muted">{schema.fields.length}</Badge>
            </p>

            <ul className="m-0 grid list-none gap-2 p-0">
              {schema.fields.map((field) => (
                <FieldCard field={field} key={field.name} />
              ))}
            </ul>

            {schema.warnings.length ? (
              <div className="mt-3 grid gap-1.5">
                {schema.warnings.map((warning) => (
                  <p
                    className="m-0 rounded-md border border-amber-300/18 bg-amber-300/9 px-2.5 py-2 text-[0.78rem] leading-5 text-amber-100/90"
                    key={warning}
                  >
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}

            <p className="mt-4 text-[0.76rem] leading-5 text-text-faint">
              These fields become an editable form once the entry editor lands.
            </p>
          </>
        )}
      </div>
    </aside>
  );
}

function FieldCard({ field }: { field: FieldSchema }) {
  return (
    <li
      className="grid gap-2 rounded-orbit border border-white/10 bg-white/[0.035] p-3 data-[unknown=true]:border-amber-300/25"
      data-unknown={field.fieldType === "unknown" ? "true" : undefined}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <strong className="truncate text-[0.82rem] font-black text-text-muted" title={field.name}>
          {field.name}
        </strong>
        {field.required ? (
          <Asterisk
            aria-label="Required"
            className="shrink-0 text-accent-hover"
            size={12}
            strokeWidth={3}
          />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <Badge variant="neutral">{field.fieldType}</Badge>
        <Badge variant={field.required ? "accent" : "muted"}>
          {field.required ? "Required" : "Optional"}
        </Badge>
        {field.fieldType === "unknown" ? (
          <Badge variant="warning" title="Unsupported schema shape">
            <AlertCircle aria-hidden="true" size={12} strokeWidth={2.4} />
            unsupported
          </Badge>
        ) : null}
      </div>
    </li>
  );
}
