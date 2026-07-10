import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileCode2,
  FileText,
  Folder,
  RefreshCw,
} from "lucide-react";
import { capitalizeFirst, toTitleCase } from "../../lib/format";
import type { CollectionScan, CollectionSummary, EntrySummary } from "../../lib/tauri";

type CollectionSidebarProps = {
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
};

export function CollectionSidebar({
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
}: CollectionSidebarProps) {
  if (isCollapsed) {
    return (
      <aside className="ws-rail ws-rail-left" aria-label="Collections and entries">
        <button
          className="ws-icon-button"
          type="button"
          onClick={onToggleCollapsed}
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <ChevronRight aria-hidden="true" size={16} strokeWidth={2.2} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="ws-sidebar" aria-label="Collections and entries">
      <header className="ws-sidebar-header">
        <button
          className="workspace-back-button"
          type="button"
          onClick={onBackHome}
          title="Back to home"
        >
          <ArrowLeft aria-hidden="true" size={15} strokeWidth={2.4} />
          <span>Home</span>
        </button>

        <div className="ws-sidebar-spacer" aria-hidden="true" />

        <button
          className="ws-icon-button"
          type="button"
          onClick={onRetry}
          disabled={isLoading}
          title="Rescan collections"
        >
          <RefreshCw
            aria-hidden="true"
            size={15}
            strokeWidth={2.2}
            className={isLoading ? "is-spinning" : undefined}
          />
        </button>

        <button
          className="ws-icon-button"
          type="button"
          onClick={onToggleCollapsed}
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
        >
          <ChevronLeft aria-hidden="true" size={16} strokeWidth={2.2} />
        </button>
      </header>

      <div className="ws-sidebar-body">
        {isLoading ? <p className="ws-sidebar-message">Scanning collections…</p> : null}

        {!isLoading && errorMessage ? (
          <div className="workspace-alert" role="alert">
            <AlertCircle aria-hidden="true" size={18} strokeWidth={2.2} />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {!isLoading && !errorMessage && selectedCollection ? (
          <EntryList
            collection={selectedCollection}
            selectedEntryId={selectedEntryId}
            onBackToCollections={onBackToCollections}
            onSelectEntry={onSelectEntry}
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
    <>
      {collections.length === 0 ? (
        <div className="ws-empty">
          <Folder aria-hidden="true" size={20} strokeWidth={2.1} />
          <strong>No collections found</strong>
          {scan ? <span title={scan.contentPath}>{scan.contentPath}</span> : null}
        </div>
      ) : (
        <ul className="ws-nav">
          {collections.map((collection) => (
            <li key={collection.path}>
              <button
                className="ws-nav-item ws-nav-collection"
                type="button"
                onClick={() => onSelectCollection(collection.name)}
              >
                <Folder aria-hidden="true" size={16} strokeWidth={2.1} />
                <span className="ws-nav-text">
                  <strong title={collection.name}>{capitalizeFirst(collection.name)}</strong>
                </span>
                <span className="ws-nav-count" title={entryCountLabel(collection.entries.length)}>
                  {collection.entries.length}
                </span>
                <ChevronRight aria-hidden="true" size={15} strokeWidth={2.2} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function EntryList({
  collection,
  selectedEntryId,
  onBackToCollections,
  onSelectEntry,
}: {
  collection: CollectionSummary;
  selectedEntryId: string | null;
  onBackToCollections: () => void;
  onSelectEntry: (id: string) => void;
}) {
  return (
    <>
      <div className="ws-entry-head">
        <button
          className="ws-back-collections"
          type="button"
          onClick={onBackToCollections}
          title="Back to collections"
        >
          <ChevronLeft aria-hidden="true" size={16} strokeWidth={2.6} />
          <span className="ws-collection-name" title={collection.name}>
            {capitalizeFirst(collection.name)}
          </span>
        </button>
        <span className="ws-nav-count" title={entryCountLabel(collection.entries.length)}>
          {collection.entries.length}
        </span>
      </div>

      {collection.warnings.length ? (
        <div className="warning-list ws-warning-list">
          {collection.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      {collection.entries.length === 0 ? (
        <div className="ws-empty">
          <FileText aria-hidden="true" size={20} strokeWidth={2.1} />
          <strong>No entries yet</strong>
          <span>This collection has no Markdown or MDX files.</span>
        </div>
      ) : (
        <ul className="ws-nav">
          {collection.entries.map((entry) => (
            <li key={entry.id}>
              <EntryRow
                entry={entry}
                isSelected={entry.id === selectedEntryId}
                onSelect={() => onSelectEntry(entry.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function EntryRow({
  entry,
  isSelected,
  onSelect,
}: {
  entry: EntrySummary;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = entry.extension === "mdx" ? FileCode2 : FileText;

  return (
    <button
      className="ws-nav-item ws-nav-entry"
      type="button"
      aria-current={isSelected ? "true" : undefined}
      onClick={onSelect}
    >
      <Icon aria-hidden="true" size={16} strokeWidth={2.1} />
      <span className="ws-nav-text">
        <strong title={entry.slug}>{toTitleCase(entry.slug)}</strong>
        <small title={entry.filePath}>{fileName(entry.filePath)}</small>
      </span>
      <span className="entry-ext-badge" data-ext={entry.extension}>
        {entry.extension.toUpperCase()}
      </span>
    </button>
  );
}

function fileName(filePath: string) {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

function entryCountLabel(count: number) {
  return `${count} ${count === 1 ? "entry" : "entries"}`;
}
