import { useState } from "react";
import type { CollectionScan, ProjectValidation } from "../../lib/tauri";
import { CollectionSidebar } from "../collections/CollectionSidebar";
import { SchemaInspector } from "../collections/SchemaInspector";
import { EntryEditorPlaceholder } from "../editor/EntryEditorPlaceholder";

type ProjectWorkspaceProps = {
  project: ProjectValidation;
  scan: CollectionScan | null;
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onBackHome: () => void;
};

/**
 * The in-project workspace: a persistent three-pane shell of
 * sidebar (collections ↔ entries) · editor · schema inspector.
 *
 * Selection lives here and is always derived against the latest scan, so a
 * rescan that drops a collection or entry simply falls back to an empty pane
 * instead of pointing at something that no longer exists.
 */
export function ProjectWorkspace({
  project,
  scan,
  isLoading,
  errorMessage,
  onRetry,
  onBackHome,
}: ProjectWorkspaceProps) {
  const [selectedCollectionName, setSelectedCollectionName] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  const collections = scan?.collections ?? [];
  const selectedCollection =
    collections.find((collection) => collection.name === selectedCollectionName) ?? null;
  const selectedEntry =
    selectedCollection?.entries.find((entry) => entry.id === selectedEntryId) ?? null;

  function selectCollection(name: string) {
    setSelectedCollectionName(name);
    setSelectedEntryId(null);
  }

  function backToCollections() {
    setSelectedCollectionName(null);
    setSelectedEntryId(null);
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[auto_minmax(0,1fr)_auto] bg-bg-base">
      <CollectionSidebar
        projectPath={project.path}
        scan={scan}
        isLoading={isLoading}
        errorMessage={errorMessage}
        selectedCollection={selectedCollection}
        selectedEntryId={selectedEntry?.id ?? null}
        isCollapsed={!sidebarOpen}
        onToggleCollapsed={() => setSidebarOpen((open) => !open)}
        onRetry={onRetry}
        onBackHome={onBackHome}
        onSelectCollection={selectCollection}
        onBackToCollections={backToCollections}
        onSelectEntry={setSelectedEntryId}
        onClearSelectedEntry={() => setSelectedEntryId(null)}
        onRefreshCollections={onRetry}
      />

      <EntryEditorPlaceholder collection={selectedCollection} entry={selectedEntry} />

      <SchemaInspector
        collection={selectedCollection}
        isCollapsed={!inspectorOpen}
        onToggleCollapsed={() => setInspectorOpen((open) => !open)}
      />
    </div>
  );
}
