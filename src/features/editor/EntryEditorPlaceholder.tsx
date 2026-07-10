import { FileCode2, FileText, FolderOpen, PenLine } from "lucide-react";
import { toTitleCase } from "../../lib/format";
import type { CollectionSummary, EntrySummary } from "../../lib/tauri";

type EntryEditorPlaceholderProps = {
  collection: CollectionSummary | null;
  entry: EntrySummary | null;
};

/**
 * Center pane. Entry reading/editing is not wired up in the backend yet
 * (`read_entry` is unimplemented), so this stays an honest placeholder rather
 * than a fake editor — see principles.md §3 "Visual, Not Magical".
 */
export function EntryEditorPlaceholder({ collection, entry }: EntryEditorPlaceholderProps) {
  if (!collection) {
    return (
      <section className="ws-editor">
        <div className="ws-editor-empty">
          <FolderOpen aria-hidden="true" size={26} strokeWidth={1.8} />
          <h2>Select a collection</h2>
          <p>Choose a collection from the sidebar to browse its entries and schema.</p>
        </div>
      </section>
    );
  }

  if (!entry) {
    const entryLabel = collection.entries.length === 1 ? "entry" : "entries";
    return (
      <section className="ws-editor">
        <div className="ws-editor-empty">
          <FileText aria-hidden="true" size={26} strokeWidth={1.8} />
          <h2>Select an entry</h2>
          <p>
            {collection.name} has {collection.entries.length} {entryLabel}. Pick one from the
            sidebar to open it.
          </p>
        </div>
      </section>
    );
  }

  const Icon = entry.extension === "mdx" ? FileCode2 : FileText;

  return (
    <section className="ws-editor">
      <div className="ws-editor-entry">
        <div className="ws-editor-entry-head">
          <Icon aria-hidden="true" size={18} strokeWidth={2.1} />
          <div>
            <h2 title={entry.slug}>{toTitleCase(entry.slug)}</h2>
            <p title={entry.filePath}>{entry.filePath}</p>
          </div>
          <span className="entry-ext-badge" data-ext={entry.extension}>
            {entry.extension.toUpperCase()}
          </span>
        </div>

        <div className="ws-editor-soon">
          <PenLine aria-hidden="true" size={24} strokeWidth={1.8} />
          <h3>Visual editing is coming soon</h3>
          <p>
            Reading and editing entry content isn't available yet. For now, open this file in your
            editor — Orbit Editor never changes files behind your back.
          </p>
        </div>
      </div>
    </section>
  );
}
