import { Eye, FileCode2, FileText, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toTitleCase } from "../../lib/format";
import type { CollectionScan, ProjectValidation } from "../../lib/tauri";
import { AlertDialog } from "../../ui/AlertDialog";
import { CollectionSidebar } from "../collections/CollectionSidebar";
import { EntryEditor } from "../editor/EntryEditor";
import { AstroPreview } from "../preview/AstroPreview";

type ProjectWorkspaceProps = {
  project: ProjectValidation;
  scan: CollectionScan | null;
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onBackHome: () => void;
  previewRequest: number;
};

type PreviewTab = {
  id: "preview";
  kind: "preview";
  label: "Astro Preview";
};

type EntryTab = {
  id: string;
  kind: "entry";
  collectionName: string;
  entryId: string;
  label: string;
  extension: "md" | "mdx";
};

type WorkspaceTab = PreviewTab | EntryTab;

const previewTab: PreviewTab = { id: "preview", kind: "preview", label: "Astro Preview" };

/**
 * The in-project workspace: a writing-first three-pane shell of
 * sidebar (collections ↔ entries) · Markdown editor · metadata panel.
 *
 * Open documents stay mounted behind their tabs, so moving between files never
 * replaces an in-progress edit. The collection list remains navigation, not a
 * second editor history.
 */
export function ProjectWorkspace({
  project,
  scan,
  isLoading,
  errorMessage,
  onRetry,
  onBackHome,
  previewRequest,
}: ProjectWorkspaceProps) {
  const [selectedCollectionName, setSelectedCollectionName] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [metadataOpen, setMetadataOpen] = useState(true);
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [dirtyTabIds, setDirtyTabIds] = useState<Set<string>>(() => new Set());
  const [tabPendingClose, setTabPendingClose] = useState<WorkspaceTab | null>(null);

  const collections = scan?.collections ?? [];
  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.name === selectedCollectionName) ?? null,
    [collections, selectedCollectionName],
  );
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
  const selectedEntryId =
    activeTab?.kind === "entry" && activeTab.collectionName === selectedCollection?.name
      ? activeTab.entryId
      : null;

  useEffect(() => {
    if (previewRequest > 0) {
      setTabs((currentTabs) =>
        currentTabs.some((tab) => tab.kind === "preview")
          ? currentTabs
          : [...currentTabs, previewTab],
      );
      setActiveTabId(previewTab.id);
    }
  }, [previewRequest]);

  useEffect(() => {
    if (!scan) {
      return;
    }

    const availableEntryIds = new Set(
      scan.collections.flatMap((collection) =>
        collection.entries.map((entry) => `${collection.name}:${entry.id}`),
      ),
    );
    setTabs((currentTabs) =>
      currentTabs.filter(
        (tab) =>
          tab.kind === "preview" || availableEntryIds.has(`${tab.collectionName}:${tab.entryId}`),
      ),
    );
  }, [scan]);

  useEffect(() => {
    if (activeTabId && tabs.some((tab) => tab.id === activeTabId)) {
      return;
    }

    setActiveTabId(tabs.at(-1)?.id ?? null);
  }, [activeTabId, tabs]);

  function selectCollection(name: string) {
    setSelectedCollectionName(name);
  }

  function backToCollections() {
    setSelectedCollectionName(null);
  }

  function openEntry(entryId: string) {
    if (!selectedCollection) {
      return;
    }

    const entry = selectedCollection.entries.find((candidate) => candidate.id === entryId);
    if (!entry) {
      return;
    }

    const id = `entry:${selectedCollection.name}:${entry.id}`;
    setTabs((currentTabs) => {
      if (currentTabs.some((tab) => tab.id === id)) {
        return currentTabs;
      }

      return [
        ...currentTabs,
        {
          id,
          kind: "entry",
          collectionName: selectedCollection.name,
          entryId: entry.id,
          label: entry.title?.trim() || toTitleCase(entry.slug),
          extension: entry.extension,
        },
      ];
    });
    setActiveTabId(id);
  }

  function closeTab(tab: WorkspaceTab) {
    if (dirtyTabIds.has(tab.id)) {
      setTabPendingClose(tab);
      return;
    }

    removeTab(tab.id);
  }

  function removeTab(tabId: string) {
    setTabs((currentTabs) => {
      const closingIndex = currentTabs.findIndex((tab) => tab.id === tabId);
      const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);

      if (activeTabId === tabId) {
        setActiveTabId(nextTabs[closingIndex]?.id ?? nextTabs[closingIndex - 1]?.id ?? null);
      }

      return nextTabs;
    });
    setDirtyTabIds((current) => {
      const next = new Set(current);
      next.delete(tabId);
      return next;
    });
  }

  const handleTabDirtyChange = useCallback((tabId: string, isDirty: boolean) => {
    setDirtyTabIds((current) => {
      const alreadyDirty = current.has(tabId);
      if (alreadyDirty === isDirty) {
        return current;
      }

      const next = new Set(current);
      if (isDirty) next.add(tabId);
      else next.delete(tabId);
      return next;
    });
  }, []);

  return (
    <div className="grid h-full min-h-0 overflow-hidden grid-cols-[auto_minmax(0,1fr)] bg-bg-base">
      <CollectionSidebar
        projectPath={project.path}
        scan={scan}
        isLoading={isLoading}
        errorMessage={errorMessage}
        selectedCollection={selectedCollection}
        selectedEntryId={selectedEntryId}
        isCollapsed={!sidebarOpen}
        onToggleCollapsed={() => setSidebarOpen((open) => !open)}
        onRetry={onRetry}
        onBackHome={onBackHome}
        onSelectCollection={selectCollection}
        onBackToCollections={backToCollections}
        onSelectEntry={openEntry}
        onClearSelectedEntry={() => setActiveTabId(null)}
        onRefreshCollections={onRetry}
      />

      <section
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg-base"
        aria-label="Workspace"
      >
        <WorkspaceTabs
          activeTabId={activeTabId}
          dirtyTabIds={dirtyTabIds}
          tabs={tabs}
          onActivate={setActiveTabId}
          onClose={closeTab}
        />

        <div className="relative flex min-h-0 flex-1 flex-col">
          {tabs.length === 0 ? (
            <EntryEditor
              projectPath={project.path}
              collection={selectedCollection}
              entry={null}
              metadataOpen={metadataOpen}
              onToggleMetadata={() => setMetadataOpen((open) => !open)}
              onSaved={onRetry}
            />
          ) : null}

          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            if (tab.kind === "preview") {
              return (
                <div
                  className={
                    isActive
                      ? "flex h-full flex-col"
                      : "invisible absolute inset-0 flex h-full flex-col pointer-events-none"
                  }
                  id={`workspace-panel-${tab.id}`}
                  key={tab.id}
                  aria-hidden={!isActive}
                  aria-labelledby={`workspace-tab-${tab.id}`}
                  role="tabpanel"
                >
                  <AstroPreview projectPath={project.path} />
                </div>
              );
            }

            const collection =
              collections.find((candidate) => candidate.name === tab.collectionName) ?? null;
            const entry =
              collection?.entries.find((candidate) => candidate.id === tab.entryId) ?? null;
            return (
              <div
                className={
                  isActive
                    ? "flex h-full flex-col"
                    : "invisible absolute inset-0 flex h-full flex-col pointer-events-none"
                }
                id={`workspace-panel-${tab.id}`}
                key={tab.id}
                aria-hidden={!isActive}
                aria-labelledby={`workspace-tab-${tab.id}`}
                role="tabpanel"
              >
                <EntryEditor
                  projectPath={project.path}
                  collection={collection}
                  entry={entry}
                  metadataOpen={metadataOpen}
                  tabId={tab.id}
                  onDirtyChange={handleTabDirtyChange}
                  onToggleMetadata={() => setMetadataOpen((open) => !open)}
                  onSaved={onRetry}
                />
              </div>
            );
          })}
        </div>
      </section>

      <AlertDialog
        actionLabel="Close tab"
        description="Closing this tab discards its unsaved changes. Save the entry first to keep them."
        onAction={() => {
          if (tabPendingClose) removeTab(tabPendingClose.id);
          setTabPendingClose(null);
        }}
        onOpenChange={(open) => {
          if (!open) setTabPendingClose(null);
        }}
        open={Boolean(tabPendingClose)}
        title={`Close ${tabPendingClose?.label ?? "tab"}?`}
      />
    </div>
  );
}

function WorkspaceTabs({
  tabs,
  activeTabId,
  dirtyTabIds,
  onActivate,
  onClose,
}: {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  dirtyTabIds: Set<string>;
  onActivate: (tabId: string) => void;
  onClose: (tab: WorkspaceTab) => void;
}) {
  if (tabs.length === 0) return null;

  return (
    <div
      className="workspace-tabs flex h-10 shrink-0 items-stretch overflow-x-auto border-b border-white/10 bg-surface-panel"
      role="tablist"
      aria-label="Open files"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const isDirty = dirtyTabIds.has(tab.id);
        const Icon = tab.kind === "preview" ? Eye : tab.extension === "mdx" ? FileCode2 : FileText;
        return (
          <div
            className="group flex min-w-0 shrink-0 items-stretch border-r border-white/10 bg-transparent data-[active=true]:bg-bg-base"
            data-active={isActive || undefined}
            data-dirty={isDirty || undefined}
            key={tab.id}
          >
            <button
              aria-controls={`workspace-panel-${tab.id}`}
              aria-selected={isActive}
              aria-label={isDirty ? `${tab.label}, unsaved changes` : tab.label}
              className="flex min-w-0 items-center gap-2 px-3 text-sm font-medium text-text-subtle transition-colors hover:bg-white/[0.04] hover:text-text-primary group-data-[active=true]:text-text-primary group-data-[dirty=true]:text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/45"
              id={`workspace-tab-${tab.id}`}
              onClick={() => onActivate(tab.id)}
              role="tab"
              type="button"
            >
              <Icon aria-hidden="true" className="shrink-0" size={14} strokeWidth={2.2} />
              <span className="max-w-44 truncate">{tab.label}</span>
              {isDirty ? (
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full bg-warning shadow-[0_0_0_2px_rgb(255_193_94_/_0.16)]"
                  title="Unsaved changes"
                />
              ) : null}
            </button>
            <button
              aria-label={`Close ${tab.label}`}
              className="mr-1 inline-flex w-7 items-center justify-center self-stretch text-text-faint transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/45"
              onClick={() => onClose(tab)}
              type="button"
            >
              <X aria-hidden="true" size={14} strokeWidth={2.3} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
