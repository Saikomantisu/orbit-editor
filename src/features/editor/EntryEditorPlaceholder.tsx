import { FileCode2, FileText, FolderOpen, PenLine } from "lucide-react";
import { toTitleCase } from "../../lib/format";
import type { CollectionSummary, EntrySummary } from "../../lib/tauri";
import { Badge } from "../../ui/Badge";
import { EmptyState } from "../../ui/EmptyState";

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
      <section className="min-w-0 bg-bg-base p-8">
        <div className="flex h-full items-center justify-center">
          <EmptyState
            icon={<FolderOpen aria-hidden="true" size={26} strokeWidth={1.8} />}
            title="Select a collection"
          >
            Choose a collection from the sidebar to browse its entries and schema.
          </EmptyState>
        </div>
      </section>
    );
  }

  if (!entry) {
    const entryLabel = collection.entries.length === 1 ? "entry" : "entries";
    return (
      <section className="min-w-0 bg-bg-base p-8">
        <div className="flex h-full items-center justify-center">
          <EmptyState
            icon={<FileText aria-hidden="true" size={26} strokeWidth={1.8} />}
            title="Select an entry"
          >
            {collection.name} has {collection.entries.length} {entryLabel}. Pick one from the
            sidebar to open it.
          </EmptyState>
        </div>
      </section>
    );
  }

  const Icon = entry.extension === "mdx" ? FileCode2 : FileText;

  return (
    <section className="min-w-0 bg-bg-base p-8">
      <div className="mx-auto grid h-full max-w-3xl content-start gap-5">
        <div className="flex min-w-0 items-start gap-3 rounded-orbit border border-white/10 bg-surface-panel p-4">
          <Icon
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-text-subtle"
            size={18}
            strokeWidth={2.1}
          />
          <div className="min-w-0 flex-1">
            <h2 className="m-0 truncate text-lg font-semibold text-text-primary" title={entry.slug}>
              {toTitleCase(entry.slug)}
            </h2>
            <p
              className="m-0 mt-1 truncate text-sm font-normal text-text-faint"
              title={entry.filePath}
            >
              {entry.filePath}
            </p>
          </div>
          <Badge variant={entry.extension === "mdx" ? "accent" : "neutral"}>
            {entry.extension.toUpperCase()}
          </Badge>
        </div>

        <div className="grid place-items-center gap-2.5 rounded-orbit border border-dashed border-white/10 bg-white/[0.025] px-6 py-10 text-center">
          <PenLine aria-hidden="true" className="text-text-faint" size={24} strokeWidth={1.8} />
          <h3 className="m-0 text-base font-semibold text-text-muted">
            Visual editing is coming soon
          </h3>
          <p className="m-0 max-w-[32rem] text-base leading-6 text-text-faint">
            Reading and editing entry content isn't available yet. For now, open this file in your
            editor — Orbit Editor never changes files behind your back.
          </p>
        </div>
      </div>
    </section>
  );
}
