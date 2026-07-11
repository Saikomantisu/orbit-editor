import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, Folder, RefreshCw } from "lucide-react";
import { capitalizeFirst } from "../../lib/format";
import type { CollectionScan, CollectionSummary } from "../../lib/tauri";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { IconButton } from "../../ui/IconButton";
import { EntryList } from "./EntryList";

type CollectionSidebarProps = {
  projectPath: string;
  scan: CollectionScan | null;
  isLoading: boolean;
  errorMessage: string | null;
  selectedCollection: CollectionSummary | null;
  selectedEntryId: string | null;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onRetry: () => void;
  onBackHome: () => void;
  onSelectCollection: (name: string) => void;
  onBackToCollections: () => void;
  onSelectEntry: (id: string) => void;
  onClearSelectedEntry: () => void;
  onRefreshCollections: () => Promise<void> | void;
};

export function CollectionSidebar({
  projectPath,
  scan,
  isLoading,
  errorMessage,
  selectedCollection,
  selectedEntryId,
  isCollapsed,
  onToggleCollapsed,
  onRetry,
  onBackHome,
  onSelectCollection,
  onBackToCollections,
  onSelectEntry,
  onClearSelectedEntry,
  onRefreshCollections,
}: CollectionSidebarProps) {
  if (isCollapsed) {
    return (
      <aside
        className="flex w-12 shrink-0 justify-center border-r border-white/10 bg-surface-panel p-2"
        aria-label="Collections and entries"
      >
        <IconButton label="Expand sidebar" tooltip="Expand sidebar" onClick={onToggleCollapsed}>
          <ChevronRight aria-hidden="true" size={16} strokeWidth={2.2} />
        </IconButton>
      </aside>
    );
  }

  return (
    <aside
      className="flex h-full min-h-0 w-[300px] min-w-0 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-surface-panel"
      aria-label="Collections and entries"
    >
      <header className="flex min-h-12 items-center gap-2 border-b border-white/10 px-3">
        <Button className="px-2.5" size="sm" variant="ghost" onClick={onBackHome}>
          <ArrowLeft aria-hidden="true" size={15} strokeWidth={2.4} />
          <span className="text-sm">Home</span>
        </Button>

        <div className="flex-1" aria-hidden="true" />

        <IconButton
          label="Rescan collections"
          tooltip="Rescan collections"
          onClick={onRetry}
          disabled={isLoading}
        >
          <RefreshCw
            aria-hidden="true"
            size={15}
            strokeWidth={2.2}
            className={isLoading ? "animate-spin" : undefined}
          />
        </IconButton>

        <IconButton label="Collapse sidebar" tooltip="Collapse sidebar" onClick={onToggleCollapsed}>
          <ChevronLeft aria-hidden="true" size={16} strokeWidth={2.2} />
        </IconButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <p className="m-0 text-[0.82rem] font-bold text-text-faint">Scanning collections...</p>
        ) : null}

        {!isLoading && errorMessage ? (
          <div
            className="flex items-start gap-2 rounded-orbit border border-danger/25 bg-danger/10 px-3 py-2.5 text-[0.82rem] leading-5 text-danger-ink"
            role="alert"
          >
            <AlertCircle
              aria-hidden="true"
              className="mt-0.5 shrink-0"
              size={18}
              strokeWidth={2.2}
            />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {!isLoading && !errorMessage && selectedCollection ? (
          <EntryList
            projectPath={projectPath}
            collection={selectedCollection}
            selectedEntryId={selectedEntryId}
            onBackToCollections={onBackToCollections}
            onSelectEntry={onSelectEntry}
            onClearSelectedEntry={onClearSelectedEntry}
            onRefreshCollections={onRefreshCollections}
          />
        ) : null}

        {!isLoading && !errorMessage && !selectedCollection ? (
          <CollectionList scan={scan} onSelectCollection={onSelectCollection} />
        ) : null}
      </div>
    </aside>
  );
}

function CollectionList({
  scan,
  onSelectCollection,
}: {
  scan: CollectionScan | null;
  onSelectCollection: (name: string) => void;
}) {
  const collections = scan?.collections ?? [];

  return (
    <div>
      {collections.length === 0 ? (
        <EmptyState
          icon={<Folder aria-hidden="true" size={20} strokeWidth={2.1} />}
          title="No collections found"
        >
          {scan ? <span title={scan.contentPath}>{scan.contentPath}</span> : null}
        </EmptyState>
      ) : (
        <ul className="m-0 grid list-none gap-1.5 p-0">
          {collections.map((collection) => (
            <li key={collection.path}>
              <button
                className="flex min-h-[42px] w-full min-w-0 items-center gap-2.5 rounded-orbit border border-transparent bg-transparent px-3 py-2 text-left text-text-body transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
                type="button"
                onClick={() => onSelectCollection(collection.name)}
              >
                <Folder
                  aria-hidden="true"
                  className="shrink-0 text-text-subtle"
                  size={16}
                  strokeWidth={2.1}
                />
                <span className="min-w-0 flex-1">
                  <strong
                    className="block truncate text-[0.82rem] font-black text-text-muted"
                    title={collection.name}
                  >
                    {capitalizeFirst(collection.name)}
                  </strong>
                </span>
                <Badge variant="muted" title={entryCountLabel(collection.entries.length)}>
                  {collection.entries.length}
                </Badge>
                <ChevronRight
                  aria-hidden="true"
                  className="shrink-0 text-text-faint"
                  size={15}
                  strokeWidth={2.2}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function entryCountLabel(count: number) {
  return `${count} ${count === 1 ? "entry" : "entries"}`;
}
