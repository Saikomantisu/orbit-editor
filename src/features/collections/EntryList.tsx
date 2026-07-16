import { ChevronLeft, Copy, FileCode2, FileText, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { capitalizeFirst, formatEntryModified, toTitleCase } from "../../lib/format";
import {
  type CollectionSummary,
  createEntry,
  deleteEntry,
  duplicateEntry,
  type EntryExtension,
  type EntrySummary,
} from "../../lib/tauri";
import { AlertDialog } from "../../ui/AlertDialog";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { DropdownMenu } from "../../ui/DropdownMenu";
import { EmptyState } from "../../ui/EmptyState";
import { Field } from "../../ui/Field";
import { IconButton } from "../../ui/IconButton";
import { TextField } from "../../ui/TextField";
import { SingleToggleGroup } from "../../ui/ToggleGroup";

const extensionOptions: { value: EntryExtension; label: string }[] = [
  { value: "md", label: "MD" },
  { value: "mdx", label: "MDX" },
];

type EntryListProps = {
  projectPath: string;
  collection: CollectionSummary;
  selectedEntryId: string | null;
  onBackToCollections: () => void;
  onSelectEntry: (id: string) => void;
  onClearSelectedEntry: () => void;
  onRefreshCollections: () => Promise<void> | void;
};

type DialogState =
  | { type: "create" }
  | { type: "duplicate"; entry: EntrySummary }
  | { type: "delete"; entry: EntrySummary }
  | null;

export function EntryList({
  projectPath,
  collection,
  selectedEntryId,
  onBackToCollections,
  onSelectEntry,
  onClearSelectedEntry,
  onRefreshCollections,
}: EntryListProps) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "n" ||
        isWorking ||
        dialog
      ) {
        return;
      }

      event.preventDefault();
      setActionError(null);
      setDialog({ type: "create" });
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dialog, isWorking]);

  async function refreshAndSelect(entry: EntrySummary) {
    await onRefreshCollections();
    onSelectEntry(entry.id);
  }

  async function handleCreate(title: string, slug: string, extension: EntryExtension) {
    setIsWorking(true);
    setActionError(null);

    try {
      const entry = await createEntry({
        projectPath,
        collection: collection.name,
        slug,
        extension,
        title,
      });
      setDialog(null);
      await refreshAndSelect(entry);
    } catch (error) {
      setActionError(getErrorMessage(error, "Could not create entry."));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleDuplicate(entry: EntrySummary, newSlug: string) {
    setIsWorking(true);
    setActionError(null);

    try {
      const duplicatedEntry = await duplicateEntry({
        projectPath,
        sourceFilePath: entry.filePath,
        newSlug,
      });
      setDialog(null);
      await refreshAndSelect(duplicatedEntry);
    } catch (error) {
      setActionError(getErrorMessage(error, "Could not duplicate entry."));
    } finally {
      setIsWorking(false);
    }
  }

  async function handleDelete(entry: EntrySummary) {
    setIsWorking(true);
    setActionError(null);

    try {
      await deleteEntry({ projectPath, filePath: entry.filePath });
      if (entry.id === selectedEntryId) {
        onClearSelectedEntry();
      }
      setDialog(null);
      await onRefreshCollections();
    } catch (error) {
      setActionError(getErrorMessage(error, "Could not delete entry."));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2.5">
        <button
          className="inline-flex min-h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md bg-transparent py-1 pr-1 text-left font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
          type="button"
          onClick={onBackToCollections}
          title="Back to collections"
        >
          <ChevronLeft aria-hidden="true" className="shrink-0" size={15} strokeWidth={2.4} />
          <span className="truncate text-sm" title={collection.name}>
            {capitalizeFirst(collection.name)}
          </span>
        </button>
        <Badge variant="muted" title={entryCountLabel(collection.entries.length)}>
          {collection.entries.length}
        </Badge>
        <IconButton
          label="Create entry"
          tooltip="Create entry (⌘N / Ctrl+N)"
          onClick={() => {
            setActionError(null);
            setDialog({ type: "create" });
          }}
        >
          <Plus aria-hidden="true" size={15} strokeWidth={2.4} />
        </IconButton>
      </div>

      {actionError ? (
        <div
          className="mb-2 flex items-start gap-2 rounded-orbit border border-danger/25 bg-danger/10 px-3 py-2.5 text-base leading-5 text-danger-ink"
          role="alert"
        >
          <span>{actionError}</span>
        </div>
      ) : null}

      {collection.warnings.length ? (
        <div className="mb-2 grid gap-1.5">
          {collection.warnings.map((warning) => (
            <p
              className="m-0 rounded-md border border-amber-300/18 bg-amber-300/9 px-2.5 py-2 text-sm leading-5 text-amber-100/90"
              key={warning}
            >
              {warning}
            </p>
          ))}
        </div>
      ) : null}

      {collection.entries.length === 0 ? (
        <EmptyState
          icon={<FileText aria-hidden="true" size={20} strokeWidth={2.1} />}
          title="No entries yet"
          action={
            <Button size="sm" variant="soft" onClick={() => setDialog({ type: "create" })}>
              <Plus aria-hidden="true" size={14} strokeWidth={2.4} />
              Create entry
            </Button>
          }
        >
          {capitalizeFirst(collection.name)} has no Markdown or MDX files.
        </EmptyState>
      ) : (
        <ul className="m-0 grid list-none gap-1.5 p-0">
          {collection.entries.map((entry) => (
            <li key={entry.id}>
              <EntryRow
                entry={entry}
                isSelected={entry.id === selectedEntryId}
                onSelect={() => onSelectEntry(entry.id)}
                onDuplicate={() => {
                  setActionError(null);
                  setDialog({ type: "duplicate", entry });
                }}
                onDelete={() => {
                  setActionError(null);
                  setDialog({ type: "delete", entry });
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {dialog?.type === "create" ? (
        <CreateEntryDialog
          collectionName={collection.name}
          isWorking={isWorking}
          onCancel={() => setDialog(null)}
          onCreate={handleCreate}
        />
      ) : null}

      {dialog?.type === "duplicate" ? (
        <DuplicateEntryDialog
          entry={dialog.entry}
          existingSlugs={collection.entries.map((entry) => entry.slug)}
          isWorking={isWorking}
          onCancel={() => setDialog(null)}
          onDuplicate={(newSlug) => handleDuplicate(dialog.entry, newSlug)}
        />
      ) : null}

      {dialog?.type === "delete" ? (
        <AlertDialog
          open
          title={`Delete "${entryDisplayTitle(dialog.entry)}"?`}
          description="This removes the Markdown file from your Astro project."
          actionLabel="Delete"
          isWorking={isWorking}
          onOpenChange={(open) => {
            if (!open) {
              setDialog(null);
            }
          }}
          onAction={() => handleDelete(dialog.entry)}
        />
      ) : null}
    </div>
  );
}

function EntryRow({
  entry,
  isSelected,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  entry: EntrySummary;
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const Icon = entry.extension === "mdx" ? FileCode2 : FileText;
  const displayTitle = entryDisplayTitle(entry);
  const modified = formatEntryModified(entry.lastModified);

  return (
    <div
      className="group relative rounded-orbit border border-transparent transition-[background,border-color] hover:bg-white/[0.05] data-[selected=true]:border-accent/45 data-[selected=true]:bg-accent/10"
      data-selected={isSelected ? "true" : undefined}
    >
      <button
        className="flex w-full min-w-0 items-start gap-2.5 bg-transparent px-3 py-3 pr-11 text-left text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
        type="button"
        aria-current={isSelected ? "true" : undefined}
        onClick={onSelect}
      >
        <Icon
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-text-subtle"
          size={16}
          strokeWidth={2.1}
        />
        <span className="grid min-w-0 gap-1">
          <strong
            className="truncate text-base font-medium text-text-muted group-data-[selected=true]:text-accent-hover"
            title={displayTitle}
          >
            {displayTitle}
          </strong>
          <small className="truncate text-xs font-normal text-text-faint" title={entry.slug}>
            {entry.slug}
          </small>
          <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-normal text-text-faint">
            {modified ? <span>{modified}</span> : null}
            <Badge variant={entry.extension === "mdx" ? "accent" : "neutral"}>
              {entry.extension.toUpperCase()}
            </Badge>
            {entry.draft === true ? <Badge variant="warning">Draft</Badge> : null}
            {entry.draft === false ? <Badge variant="success">Ready</Badge> : null}
          </span>
        </span>
      </button>
      <div className="absolute right-2.5 top-3">
        <DropdownMenu
          label="Entry actions"
          trigger={
            <IconButton label="Entry actions" variant="ghost">
              <MoreHorizontal aria-hidden="true" size={15} strokeWidth={2.3} />
            </IconButton>
          }
          items={[
            {
              label: "Duplicate",
              icon: <Copy aria-hidden="true" size={13} strokeWidth={2.3} />,
              onSelect: onDuplicate,
            },
            {
              label: "Delete",
              icon: <Trash2 aria-hidden="true" size={13} strokeWidth={2.3} />,
              destructive: true,
              onSelect: onDelete,
            },
          ]}
        />
      </div>
    </div>
  );
}

function CreateEntryDialog({
  collectionName,
  isWorking,
  onCancel,
  onCreate,
}: {
  collectionName: string;
  isWorking: boolean;
  onCancel: () => void;
  onCreate: (title: string, slug: string, extension: EntryExtension) => void;
}) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [extension, setExtension] = useState<EntryExtension>("md");
  const [slugWasEdited, setSlugWasEdited] = useState(false);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugWasEdited) {
      setSlug(slugify(value));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedSlug = slugify(slug);
    if (!normalizedSlug) {
      return;
    }
    onCreate(title, normalizedSlug, extension);
  }

  return (
    <Dialog
      open
      title="Create entry"
      description={`Create a new entry in ${collectionName}.`}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
    >
      <form className="grid gap-3" onSubmit={handleSubmit}>
        <p className="m-0 text-base leading-5 text-text-subtle">Collection: {collectionName}</p>
        <TextField
          label="Title"
          value={title}
          onChange={(event) => handleTitleChange(event.currentTarget.value)}
        />
        <TextField
          label="Slug"
          value={slug}
          onChange={(event) => {
            setSlugWasEdited(true);
            setSlug(slugify(event.currentTarget.value));
          }}
          placeholder="new-entry"
        />
        <Field label="Entry extension">
          <SingleToggleGroup
            label="Entry extension"
            value={extension}
            options={extensionOptions}
            onValueChange={setExtension}
          />
        </Field>
        <DialogActions
          confirmLabel="Create"
          isWorking={isWorking}
          isDisabled={!slug.trim()}
          onCancel={onCancel}
        />
      </form>
    </Dialog>
  );
}

function DuplicateEntryDialog({
  entry,
  existingSlugs,
  isWorking,
  onCancel,
  onDuplicate,
}: {
  entry: EntrySummary;
  existingSlugs: string[];
  isWorking: boolean;
  onCancel: () => void;
  onDuplicate: (newSlug: string) => void;
}) {
  const [newSlug, setNewSlug] = useState(() => nextCopySlug(entry.slug, existingSlugs));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedSlug = slugify(newSlug);
    if (!normalizedSlug) {
      return;
    }
    onDuplicate(normalizedSlug);
  }

  return (
    <Dialog
      open
      title="Duplicate entry"
      description={`Duplicate ${entryDisplayTitle(entry)}.`}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
    >
      <form className="grid gap-3" onSubmit={handleSubmit}>
        <p className="m-0 text-base leading-5 text-text-subtle">{entryDisplayTitle(entry)}</p>
        <TextField
          label="New slug"
          value={newSlug}
          onChange={(event) => setNewSlug(slugify(event.currentTarget.value))}
        />
        <DialogActions
          confirmLabel="Duplicate"
          isWorking={isWorking}
          isDisabled={!newSlug.trim()}
          onCancel={onCancel}
        />
      </form>
    </Dialog>
  );
}

function DialogActions({
  confirmLabel,
  isWorking,
  isDisabled,
  onCancel,
}: {
  confirmLabel: string;
  isWorking: boolean;
  isDisabled: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button disabled={isWorking} size="sm" variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button disabled={isWorking || isDisabled} size="sm" type="submit" variant="primary">
        {isWorking ? "Working..." : confirmLabel}
      </Button>
    </div>
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

function entryDisplayTitle(entry: EntrySummary) {
  return entry.title ?? toTitleCase(entry.slug);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_\-./]/g, "")
    .replace(/-+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^[./-]+|[./-]+$/g, "");
}

function nextCopySlug(slug: string, existingSlugs: string[]) {
  const existing = new Set(existingSlugs);
  let candidate = `${slug}-copy`;
  let index = 2;

  while (existing.has(candidate)) {
    candidate = `${slug}-copy-${index}`;
    index += 1;
  }

  return candidate;
}

function entryCountLabel(count: number) {
  return `${count} ${count === 1 ? "entry" : "entries"}`;
}
