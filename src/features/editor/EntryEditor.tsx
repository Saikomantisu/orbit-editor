import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileCode2,
  FileText,
  FolderOpen,
  Loader2,
  Pencil,
  Save,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toTitleCase } from "../../lib/format";
import {
  type CollectionSummary,
  type Entry,
  type EntrySummary,
  type FrontmatterValue,
  importDroppedImage,
  readEntry,
  saveEntry,
} from "../../lib/tauri";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { IconButton } from "../../ui/IconButton";
import { SingleToggleGroup } from "../../ui/ToggleGroup";
import { FrontmatterForm } from "./FrontmatterForm";
import { buildFrontmatterFields, type FrontmatterField } from "./frontmatterFields";
import { type FrontmatterErrors, validateFrontmatter } from "./frontmatterValidation";
import { normalizeForSave, stableStringify } from "./frontmatterValues";
import { MarkdownEditor } from "./MarkdownEditor";
import { MarkdownPreview } from "./MarkdownPreview";

type ContentMode = "edit" | "preview";

type EntryEditorProps = {
  projectPath: string;
  collection: CollectionSummary | null;
  entry: EntrySummary | null;
  metadataOpen: boolean;
  onToggleMetadata: () => void;
  onSaved: () => Promise<void> | void;
};

export function EntryEditor({
  projectPath,
  collection,
  entry,
  metadataOpen,
  onToggleMetadata,
  onSaved,
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

  const handleSave = useCallback(async () => {
    if (!loadedEntry || !isDirty || hasErrors) {
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
  }, [body, hasErrors, isDirty, loadedEntry, normalizedFrontmatter, onSaved, projectPath]);

  const handleDropImage = useCallback(
    async (sourcePath: string) => {
      if (!loadedEntry) {
        return null;
      }
      setImageError(null);
      try {
        return await importDroppedImage(projectPath, loadedEntry.filePath, sourcePath);
      } catch (error) {
        setImageError(getErrorMessage(error, "Could not add the dropped image."));
        return null;
      }
    },
    [loadedEntry, projectPath],
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

  const Icon = entry.extension === "mdx" ? FileCode2 : FileText;
  const headerTitle =
    (typeof frontmatter.title === "string" && frontmatter.title.trim()) ||
    entry.title ||
    toTitleCase(entry.slug);
  const showMetadata = metadataOpen;
  const hasEntry = Boolean(loadedEntry) && !isLoading && !loadError;

  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-bg-base">
      <header className="flex min-h-16 items-center gap-3 border-b border-white/10 bg-surface-panel px-5">
        <Icon
          aria-hidden="true"
          className="shrink-0 text-text-subtle"
          size={18}
          strokeWidth={2.1}
        />
        <div className="min-w-0 flex-1">
          <h2 className="m-0 truncate text-[1rem] font-black text-text-primary" title={entry.slug}>
            {headerTitle}
          </h2>
        </div>
        <Badge variant={entry.extension === "mdx" ? "accent" : "neutral"}>
          {entry.extension.toUpperCase()}
        </Badge>
        <Badge variant={isDirty ? "warning" : "muted"}>{isDirty ? "Unsaved" : "Saved"}</Badge>

        <Button
          variant="primary"
          size="sm"
          disabled={!isDirty || hasErrors || isSaving || isLoading}
          onClick={handleSave}
        >
          <Save aria-hidden="true" size={14} strokeWidth={2.4} />
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-h-0 overflow-auto">
          {isLoading ? (
            <div className="flex items-center gap-2 p-6 text-[0.86rem] font-bold text-text-faint">
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
                <p className="m-0 text-[0.86rem] leading-5">{loadError}</p>
              </div>
              <Button className="w-fit" size="sm" variant="danger" onClick={loadSelectedEntry}>
                Retry
              </Button>
            </div>
          ) : loadedEntry ? (
            <div className="mx-auto grid max-w-3xl gap-6 px-8 py-8">
              {saveError ? (
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
                  <span>{saveError}</span>
                </div>
              ) : null}

              <section className="grid gap-3">
                <div className="flex items-center justify-end gap-3">
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
                </div>

                {imageError ? (
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
                    <span>{imageError}</span>
                  </div>
                ) : null}

                {contentMode === "edit" ? (
                  <MarkdownEditor value={body} onChange={setBody} onDropImage={handleDropImage} />
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
            primaryFields={primaryFields}
            additionalFields={additionalFields}
            values={frontmatter}
            errors={mergedErrors}
            onChange={handleFieldChange}
            onFieldError={handleFieldError}
            onCollapse={onToggleMetadata}
          />
        ) : null}

        {hasEntry && !showMetadata ? (
          <MetadataRail errorCount={metadataErrorCount} onExpand={onToggleMetadata} />
        ) : null}
      </div>
    </section>
  );
}

type MetadataPanelProps = {
  projectPath: string;
  primaryFields: FrontmatterField[];
  additionalFields: FrontmatterField[];
  values: Record<string, FrontmatterValue>;
  errors: FrontmatterErrors;
  onChange: (name: string, value: FrontmatterValue) => void;
  onFieldError: (name: string, error: string | null) => void;
  onCollapse: () => void;
};

function MetadataPanel({
  projectPath,
  primaryFields,
  additionalFields,
  values,
  errors,
  onChange,
  onFieldError,
  onCollapse,
}: MetadataPanelProps) {
  const isEmpty = primaryFields.length === 0 && additionalFields.length === 0;

  return (
    <aside
      className="flex h-full min-h-0 w-[320px] shrink-0 flex-col overflow-hidden border-l border-white/10 bg-surface-panel"
      aria-label="Metadata"
    >
      <header className="flex min-h-12 items-center gap-2 border-b border-white/10 px-4">
        <h3 className="m-0 flex-1 text-[0.78rem] font-black uppercase tracking-wide text-text-subtle">
          Metadata
        </h3>
        <IconButton label="Hide metadata" tooltip="Hide metadata" onClick={onCollapse}>
          <ChevronRight aria-hidden="true" size={16} strokeWidth={2.2} />
        </IconButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isEmpty ? (
          <p className="m-0 text-[0.82rem] font-bold text-text-faint">
            This entry has no frontmatter fields yet.
          </p>
        ) : (
          <FrontmatterForm
            projectPath={projectPath}
            primaryFields={primaryFields}
            additionalFields={additionalFields}
            values={values}
            errors={errors}
            onChange={onChange}
            onFieldError={onFieldError}
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
