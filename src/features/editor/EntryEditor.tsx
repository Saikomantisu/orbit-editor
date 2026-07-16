import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  FilePenLine,
  FileText,
  FolderOpen,
  Loader2,
  Pencil,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  type CollectionSummary,
  type Entry,
  type EntrySummary,
  type FrontmatterValue,
  importImageAsset,
  readEntry,
  saveEntry,
} from "../../lib/tauri";
import { AlertDialog } from "../../ui/AlertDialog";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { IconButton } from "../../ui/IconButton";
import { SingleToggleGroup } from "../../ui/ToggleGroup";
import { FrontmatterForm } from "./FrontmatterForm";
import { buildFrontmatterFields, type FrontmatterField } from "./frontmatterFields";
import { type FrontmatterErrors, validateFrontmatter } from "./frontmatterValidation";
import { normalizeForSave, stableStringify } from "./frontmatterValues";
import { useImageAssetPicker } from "./imageAssets";
import { MarkdownPreview } from "./MarkdownPreview";

type ContentMode = "edit" | "preview";

// CodeMirror and its language registry are only needed while editing a document. Keeping them
// out of the shell makes project selection, collection browsing, and preview start faster.
const MarkdownEditor = lazy(() =>
  import("./MarkdownEditor").then(({ MarkdownEditor }) => ({ default: MarkdownEditor })),
);

type EntryEditorProps = {
  projectPath: string;
  collection: CollectionSummary | null;
  entry: EntrySummary | null;
  metadataOpen: boolean;
  onToggleMetadata: () => void;
  onSaved: () => Promise<void> | void;
  tabId?: string;
  onDirtyChange?: (tabId: string, isDirty: boolean) => void;
};

export function EntryEditor({
  projectPath,
  collection,
  entry,
  metadataOpen,
  onToggleMetadata,
  onSaved,
  tabId,
  onDirtyChange,
}: EntryEditorProps) {
  const [loadedEntry, setLoadedEntry] = useState<Entry | null>(null);
  const [frontmatter, setFrontmatter] = useState<Record<string, FrontmatterValue>>({});
  const [baseline, setBaseline] = useState("");
  const [body, setBody] = useState("");
  const [bodyBaseline, setBodyBaseline] = useState("");
  const [contentMode, setContentMode] = useState<ContentMode>("edit");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [reloadConfirmationOpen, setReloadConfirmationOpen] = useState(false);
  const { chooseImage, confirmation: imageImportConfirmation } = useImageAssetPicker(
    projectPath,
    loadedEntry?.filePath ?? entry?.filePath ?? "",
  );

  const loadSelectedEntry = useCallback(async () => {
    if (!entry) {
      setLoadedEntry(null);
      setFrontmatter({});
      setBaseline("");
      setBody("");
      setBodyBaseline("");
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    setSaveError(null);
    setImageError(null);
    setFieldErrors({});

    try {
      const nextEntry = await readEntry(projectPath, entry.filePath);
      const normalized = normalizeForSave(nextEntry.frontmatter);
      setLoadedEntry(nextEntry);
      setFrontmatter(nextEntry.frontmatter);
      setBaseline(stableStringify(normalized));
      setBody(nextEntry.body);
      setBodyBaseline(nextEntry.body);
    } catch (error) {
      setLoadedEntry(null);
      setLoadError(getErrorMessage(error, "Could not read entry."));
    } finally {
      setIsLoading(false);
    }
  }, [entry, projectPath]);

  useEffect(() => {
    let isActive = true;

    async function load() {
      if (!entry) {
        setLoadedEntry(null);
        setFrontmatter({});
        setBaseline("");
        setBody("");
        setBodyBaseline("");
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      setSaveError(null);
      setImageError(null);
      setFieldErrors({});

      try {
        const nextEntry = await readEntry(projectPath, entry.filePath);
        if (!isActive) {
          return;
        }
        const normalized = normalizeForSave(nextEntry.frontmatter);
        setLoadedEntry(nextEntry);
        setFrontmatter(nextEntry.frontmatter);
        setBaseline(stableStringify(normalized));
        setBody(nextEntry.body);
        setBodyBaseline(nextEntry.body);
      } catch (error) {
        if (!isActive) {
          return;
        }
        setLoadedEntry(null);
        setLoadError(getErrorMessage(error, "Could not read entry."));
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isActive = false;
    };
  }, [entry, projectPath]);

  const { primaryFields, additionalFields } = useMemo(
    () => buildFrontmatterFields(collection?.schema ?? null, frontmatter),
    [collection?.schema, frontmatter],
  );
  const allFields = useMemo(
    () => [...primaryFields, ...additionalFields],
    [additionalFields, primaryFields],
  );
  const validationErrors = useMemo(
    () => validateFrontmatter(allFields, frontmatter),
    [allFields, frontmatter],
  );
  const mergedErrors = { ...validationErrors, ...fieldErrors };
  const metadataErrorCount = Object.keys(mergedErrors).length;

  const normalizedFrontmatter = useMemo(() => normalizeForSave(frontmatter), [frontmatter]);
  const frontmatterDirty = loadedEntry
    ? stableStringify(normalizedFrontmatter) !== baseline
    : false;
  const bodyDirty = loadedEntry ? body !== bodyBaseline : false;
  const isDirty = frontmatterDirty || bodyDirty;
  const hasErrors = Object.keys(mergedErrors).length > 0;
  const isSaveConflict = saveError?.includes("changed on disk after it was opened") ?? false;

  useEffect(() => {
    if (!tabId) {
      return;
    }

    onDirtyChange?.(tabId, isDirty);

    return () => onDirtyChange?.(tabId, false);
  }, [isDirty, onDirtyChange, tabId]);

  const handleSave = useCallback(async () => {
    if (!loadedEntry || !isDirty || hasErrors || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const savedEntry = await saveEntry({
        projectPath,
        filePath: loadedEntry.filePath,
        frontmatter: normalizedFrontmatter,
        body,
        expectedRevision: loadedEntry.revision,
      });
      setLoadedEntry(savedEntry);
      setFrontmatter(savedEntry.frontmatter);
      setBaseline(stableStringify(normalizeForSave(savedEntry.frontmatter)));
      setBody(savedEntry.body);
      setBodyBaseline(savedEntry.body);
      await onSaved();
    } catch (error) {
      setSaveError(getErrorMessage(error, "Could not save entry."));
    } finally {
      setIsSaving(false);
    }
  }, [
    body,
    hasErrors,
    isDirty,
    isSaving,
    loadedEntry,
    normalizedFrontmatter,
    onSaved,
    projectPath,
  ]);

  const handleDropImage = useCallback(
    async (sourcePath: string) => {
      if (!loadedEntry) {
        return null;
      }
      setImageError(null);
      try {
        const imported = await importImageAsset(projectPath, loadedEntry.filePath, sourcePath);
        return imported.reference;
      } catch (error) {
        setImageError(getErrorMessage(error, "Could not add the dropped image."));
        return null;
      }
    },
    [loadedEntry, projectPath],
  );

  const handleSelectImage = useCallback(
    async (currentReference?: string) => {
      setImageError(null);
      try {
        return await chooseImage(currentReference);
      } catch (error) {
        const message = getErrorMessage(error, "Could not choose image.");
        setImageError(message);
        throw error;
      }
    },
    [chooseImage],
  );

  const handleFieldChange = useCallback((name: string, value: FrontmatterValue) => {
    setFrontmatter((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => {
      const { [name]: _removed, ...remaining } = current;
      return remaining;
    });
  }, []);

  const handleFieldError = useCallback((name: string, error: string | null) => {
    setFieldErrors((current) => {
      const { [name]: _removed, ...remaining } = current;
      return error ? { ...remaining, [name]: error } : remaining;
    });
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSave();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  if (!collection) {
    return (
      <section className="min-h-0 min-w-0 overflow-hidden bg-bg-base p-8">
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
      <section className="min-h-0 min-w-0 overflow-hidden bg-bg-base p-8">
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

  const showMetadata = metadataOpen;
  const hasEntry = Boolean(loadedEntry) && !isLoading && !loadError;

  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-bg-base">
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-h-0 overflow-auto">
          {isLoading ? (
            <div className="flex items-center gap-2 p-6 text-base font-normal text-text-faint">
              <Loader2 aria-hidden="true" className="animate-spin" size={16} strokeWidth={2.2} />
              Reading entry...
            </div>
          ) : loadError ? (
            <div
              className="m-6 grid max-w-2xl gap-3 rounded-orbit border border-danger/25 bg-danger/10 p-4 text-danger-ink"
              role="alert"
            >
              <div className="flex gap-2">
                <AlertCircle
                  aria-hidden="true"
                  className="mt-0.5 shrink-0"
                  size={18}
                  strokeWidth={2.2}
                />
                <p className="m-0 text-base leading-5">{loadError}</p>
              </div>
              <Button className="w-fit" size="sm" variant="danger" onClick={loadSelectedEntry}>
                Retry
              </Button>
            </div>
          ) : loadedEntry ? (
            <div className="mx-auto grid max-w-3xl gap-6 px-8 py-8">
              {saveError ? (
                <div
                  className="flex items-start gap-2 rounded-orbit border border-danger/25 bg-danger/10 px-3 py-2.5 text-base leading-5 text-danger-ink"
                  role="alert"
                >
                  <AlertCircle
                    aria-hidden="true"
                    className="mt-0.5 shrink-0"
                    size={18}
                    strokeWidth={2.2}
                  />
                  <div className="grid min-w-0 flex-1 gap-2">
                    <span>{saveError}</span>
                    {isSaveConflict ? (
                      <Button
                        className="w-fit"
                        size="sm"
                        variant="danger"
                        onClick={() => setReloadConfirmationOpen(true)}
                      >
                        Reload entry
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <section className="grid gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-text-muted">
                      <FilePenLine
                        aria-hidden="true"
                        className="shrink-0 text-text-subtle"
                        size={14}
                      />
                      <span className="truncate" title={loadedEntry.filePath}>
                        {loadedEntry.filePath}
                      </span>
                    </div>
                    <p className="m-0 mt-1 text-xs text-text-faint">
                      Changes save directly to this file in your Astro project.
                    </p>
                  </div>
                  <div className="w-44">
                    <SingleToggleGroup
                      label="Content view"
                      value={contentMode}
                      onValueChange={setContentMode}
                      options={[
                        {
                          value: "edit",
                          label: "Edit",
                          icon: <Pencil aria-hidden="true" size={13} strokeWidth={2.3} />,
                        },
                        {
                          value: "preview",
                          label: "Preview",
                          icon: <Eye aria-hidden="true" size={13} strokeWidth={2.3} />,
                        },
                      ]}
                    />
                  </div>
                  <Button
                    disabled={!isDirty || hasErrors || isSaving}
                    size="sm"
                    variant="primary"
                    onClick={() => void handleSave()}
                    title={
                      hasErrors
                        ? "Fix metadata errors before saving"
                        : isDirty
                          ? "Save changes (⌘S / Ctrl+S)"
                          : "No changes to save"
                    }
                  >
                    {isSaving ? "Saving…" : isDirty ? "Save" : "Saved"}
                    {!isSaving && isDirty ? (
                      <span className="rounded bg-accent-ink/10 px-1 py-0.5 text-2xs font-medium text-accent-ink/70">
                        ⌘S
                      </span>
                    ) : null}
                  </Button>
                </div>

                {imageError ? (
                  <div
                    className="flex items-start gap-2 rounded-orbit border border-danger/25 bg-danger/10 px-3 py-2.5 text-base leading-5 text-danger-ink"
                    role="alert"
                  >
                    <AlertCircle
                      aria-hidden="true"
                      className="mt-0.5 shrink-0"
                      size={18}
                      strokeWidth={2.2}
                    />
                    <span>{imageError}</span>
                  </div>
                ) : null}

                {contentMode === "edit" ? (
                  <Suspense
                    fallback={
                      <div className="flex min-h-[24rem] items-center text-base text-text-faint">
                        Loading editor…
                      </div>
                    }
                  >
                    <MarkdownEditor
                      value={body}
                      onChange={setBody}
                      onDropImage={handleDropImage}
                      onSelectImage={handleSelectImage}
                    />
                  </Suspense>
                ) : (
                  <MarkdownPreview body={body} />
                )}
              </section>
            </div>
          ) : null}
        </div>

        {hasEntry && showMetadata ? (
          <MetadataPanel
            projectPath={projectPath}
            entryFilePath={loadedEntry?.filePath ?? entry.filePath}
            primaryFields={primaryFields}
            additionalFields={additionalFields}
            values={frontmatter}
            errors={mergedErrors}
            onChange={handleFieldChange}
            onFieldError={handleFieldError}
            onChooseImage={handleSelectImage}
            onCollapse={onToggleMetadata}
          />
        ) : null}

        {hasEntry && !showMetadata ? (
          <MetadataRail errorCount={metadataErrorCount} onExpand={onToggleMetadata} />
        ) : null}
      </div>

      <AlertDialog
        actionLabel="Reload entry"
        description="Reloading replaces the unsaved changes in Orbit with the current file on disk."
        onAction={() => {
          setReloadConfirmationOpen(false);
          void loadSelectedEntry();
        }}
        onOpenChange={setReloadConfirmationOpen}
        open={reloadConfirmationOpen}
        title="Discard unsaved changes?"
      />
      {imageImportConfirmation}
    </section>
  );
}

type MetadataPanelProps = {
  projectPath: string;
  entryFilePath: string;
  primaryFields: FrontmatterField[];
  additionalFields: FrontmatterField[];
  values: Record<string, FrontmatterValue>;
  errors: FrontmatterErrors;
  onChange: (name: string, value: FrontmatterValue) => void;
  onFieldError: (name: string, error: string | null) => void;
  onChooseImage: (currentReference?: string) => Promise<string | null>;
  onCollapse: () => void;
};

function MetadataPanel({
  projectPath,
  entryFilePath,
  primaryFields,
  additionalFields,
  values,
  errors,
  onChange,
  onFieldError,
  onChooseImage,
  onCollapse,
}: MetadataPanelProps) {
  const isEmpty = primaryFields.length === 0 && additionalFields.length === 0;

  return (
    <aside
      className="flex h-full min-h-0 w-[320px] min-w-0 shrink-0 flex-col overflow-hidden border-l border-white/10 bg-surface-panel"
      aria-label="Metadata"
    >
      <header className="flex min-h-12 items-center gap-2 border-b border-white/10 px-4">
        <h3 className="m-0 flex-1 text-sm font-medium uppercase tracking-wide text-text-subtle">
          Metadata
        </h3>
        <IconButton label="Hide metadata" tooltip="Hide metadata" onClick={onCollapse}>
          <ChevronRight aria-hidden="true" size={16} strokeWidth={2.2} />
        </IconButton>
      </header>

      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4">
        {isEmpty ? (
          <p className="m-0 text-base font-normal text-text-faint">
            This entry has no frontmatter fields yet.
          </p>
        ) : (
          <FrontmatterForm
            projectPath={projectPath}
            entryFilePath={entryFilePath}
            primaryFields={primaryFields}
            additionalFields={additionalFields}
            values={values}
            errors={errors}
            onChange={onChange}
            onFieldError={onFieldError}
            onChooseImage={onChooseImage}
          />
        )}
      </div>
    </aside>
  );
}

function MetadataRail({ errorCount, onExpand }: { errorCount: number; onExpand: () => void }) {
  return (
    <aside
      className="flex w-12 shrink-0 flex-col items-center gap-2 border-l border-white/10 bg-surface-panel p-2"
      aria-label="Metadata"
    >
      <IconButton label="Show metadata" tooltip="Show metadata" onClick={onExpand}>
        <ChevronLeft aria-hidden="true" size={16} strokeWidth={2.2} />
      </IconButton>
      {errorCount > 0 ? (
        <Badge
          variant="danger"
          title={`${errorCount} metadata ${errorCount === 1 ? "error" : "errors"}`}
        >
          {errorCount}
        </Badge>
      ) : null}
    </aside>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return fallback;
}
