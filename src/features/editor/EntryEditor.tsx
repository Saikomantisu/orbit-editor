import { AlertCircle, FileCode2, FileText, FolderOpen, Loader2, PenLine, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toTitleCase } from "../../lib/format";
import {
  type CollectionSummary,
  type Entry,
  type EntrySummary,
  type FrontmatterValue,
  readEntry,
  saveEntry,
} from "../../lib/tauri";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { FrontmatterForm } from "./FrontmatterForm";
import { buildFrontmatterFields } from "./frontmatterFields";
import { validateFrontmatter } from "./frontmatterValidation";
import { normalizeForSave, stableStringify } from "./frontmatterValues";

type EntryEditorProps = {
  projectPath: string;
  collection: CollectionSummary | null;
  entry: EntrySummary | null;
  onSaved: () => Promise<void> | void;
};

export function EntryEditor({ projectPath, collection, entry, onSaved }: EntryEditorProps) {
  const [loadedEntry, setLoadedEntry] = useState<Entry | null>(null);
  const [frontmatter, setFrontmatter] = useState<Record<string, FrontmatterValue>>({});
  const [baseline, setBaseline] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const loadSelectedEntry = useCallback(async () => {
    if (!entry) {
      setLoadedEntry(null);
      setFrontmatter({});
      setBaseline("");
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    setSaveError(null);
    setFieldErrors({});

    try {
      const nextEntry = await readEntry(projectPath, entry.filePath);
      const normalized = normalizeForSave(nextEntry.frontmatter);
      setLoadedEntry(nextEntry);
      setFrontmatter(nextEntry.frontmatter);
      setBaseline(stableStringify(normalized));
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
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      setSaveError(null);
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
  const normalizedFrontmatter = useMemo(() => normalizeForSave(frontmatter), [frontmatter]);
  const isDirty = loadedEntry ? stableStringify(normalizedFrontmatter) !== baseline : false;
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
        body: loadedEntry.body,
      });
      setLoadedEntry(savedEntry);
      setFrontmatter(savedEntry.frontmatter);
      setBaseline(stableStringify(normalizeForSave(savedEntry.frontmatter)));
      await onSaved();
    } catch (error) {
      setSaveError(getErrorMessage(error, "Could not save frontmatter."));
    } finally {
      setIsSaving(false);
    }
  }, [hasErrors, isDirty, loadedEntry, normalizedFrontmatter, onSaved, projectPath]);

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
            {entry.title ?? toTitleCase(entry.slug)}
          </h2>
          <p
            className="m-0 mt-1 truncate text-[0.76rem] font-bold text-text-faint"
            title={entry.filePath}
          >
            {entry.filePath}
          </p>
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

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-[0.86rem] font-bold text-text-faint">
            <Loader2 aria-hidden="true" className="animate-spin" size={16} strokeWidth={2.2} />
            Reading entry...
          </div>
        ) : loadError ? (
          <div
            className="grid max-w-2xl gap-3 rounded-orbit border border-danger/25 bg-danger/10 p-4 text-danger-ink"
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
          <div className="mx-auto grid max-w-3xl gap-5">
            <div className="flex items-start gap-2 rounded-orbit border border-white/10 bg-white/[0.035] px-3 py-2.5 text-[0.82rem] leading-5 text-text-faint">
              <PenLine aria-hidden="true" className="mt-0.5 shrink-0" size={16} strokeWidth={2.1} />
              <p className="m-0">
                Editing frontmatter only. Markdown content is preserved unchanged when this entry is
                saved.
              </p>
            </div>

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

            <FrontmatterForm
              projectPath={projectPath}
              primaryFields={primaryFields}
              additionalFields={additionalFields}
              values={frontmatter}
              errors={mergedErrors}
              onChange={(name, value) => {
                setFrontmatter((current) => ({ ...current, [name]: value }));
                setFieldErrors((current) => {
                  const { [name]: _removed, ...remaining } = current;
                  return remaining;
                });
              }}
              onFieldError={(name, error) => {
                setFieldErrors((current) => {
                  const { [name]: _removed, ...remaining } = current;
                  return error ? { ...remaining, [name]: error } : remaining;
                });
              }}
            />
          </div>
        ) : null}
      </div>
    </section>
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
