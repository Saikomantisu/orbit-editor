import { AlertCircle, Asterisk, ChevronLeft, ChevronRight, ListTree } from "lucide-react";
import type { CollectionSummary, FieldSchema } from "../../lib/tauri";

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
      <aside className="ws-rail ws-rail-right" aria-label="Schema fields">
        <button
          className="ws-icon-button"
          type="button"
          onClick={onToggleCollapsed}
          title="Expand schema"
          aria-label="Expand schema"
        >
          <ChevronLeft aria-hidden="true" size={16} strokeWidth={2.2} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="ws-inspector" aria-label="Schema fields">
      <header className="ws-inspector-header">
        <div className="ws-inspector-title">
          <button
            className="ws-icon-button"
            type="button"
            onClick={onToggleCollapsed}
            title="Collapse schema"
            aria-label="Collapse schema"
          >
            <ChevronRight aria-hidden="true" size={16} strokeWidth={2.2} />
          </button>
          <h2>Schema</h2>
        </div>
        {schema?.source === "contentConfig" ? (
          <span className="schema-source-badge" data-source={schema.source}>
            From config
          </span>
        ) : null}
      </header>

      <div className="ws-inspector-body">
        {!collection ? (
          <div className="ws-empty">
            <ListTree aria-hidden="true" size={20} strokeWidth={2.1} />
            <strong>No collection selected</strong>
            <span>Pick a collection to inspect its schema fields.</span>
          </div>
        ) : !schema || schema.fields.length === 0 ? (
          <div className="ws-empty">
            <ListTree aria-hidden="true" size={20} strokeWidth={2.1} />
            <strong>No schema detected</strong>
            <span>
              Orbit Editor could not read a schema for <em>{collection.name}</em> from
              content.config or its frontmatter.
            </span>
          </div>
        ) : (
          <>
            <p className="ws-section-label">
              Fields<span>{schema.fields.length}</span>
            </p>

            <ul className="schema-field-list">
              {schema.fields.map((field) => (
                <FieldCard field={field} key={field.name} />
              ))}
            </ul>

            {schema.warnings.length ? (
              <div className="warning-list ws-warning-list">
                {schema.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}

            <p className="ws-inspector-note">
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
      className="schema-field-card"
      data-unknown={field.fieldType === "unknown" ? "true" : undefined}
    >
      <div className="schema-field-head">
        <strong title={field.name}>{field.name}</strong>
        {field.required ? (
          <Asterisk aria-label="Required" className="schema-required" size={12} strokeWidth={3} />
        ) : null}
      </div>
      <div className="schema-field-meta">
        <span className="schema-type-pill">{field.fieldType}</span>
        <span className="schema-field-requirement">{field.required ? "Required" : "Optional"}</span>
        {field.fieldType === "unknown" ? (
          <span className="schema-field-warning" title="Unsupported schema shape">
            <AlertCircle aria-hidden="true" size={12} strokeWidth={2.4} />
            unsupported
          </span>
        ) : null}
      </div>
    </li>
  );
}
