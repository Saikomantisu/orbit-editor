import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type ProjectCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  required: boolean;
};

export type ProjectValidation = {
  path: string;
  name: string;
  isValid: boolean;
  checks: ProjectCheck[];
  errors: string[];
  warnings: string[];
};

export type EntryExtension = "md" | "mdx";

export type EntrySummary = {
  id: string;
  slug: string;
  title: string | null;
  filePath: string;
  extension: EntryExtension;
  lastModified: string | null;
  draft: boolean | null;
};

export type SchemaSource = "contentConfig" | "frontmatterInference";

export type FieldType = "string" | "number" | "boolean" | "date" | "array" | "image" | "unknown";

export type FieldSchema = {
  name: string;
  fieldType: FieldType;
  itemType?: FieldType;
  required: boolean;
  options: string[];
};

export type CollectionSchema = {
  source: SchemaSource;
  fields: FieldSchema[];
  warnings: string[];
};

export type CollectionSummary = {
  name: string;
  path: string;
  entries: EntrySummary[];
  schema: CollectionSchema | null;
  warnings: string[];
};

export type CollectionScan = {
  projectPath: string;
  contentPath: string;
  schemaConfigPath: string | null;
  collections: CollectionSummary[];
  warnings: string[];
};

export type CreateEntryInput = {
  projectPath: string;
  collection: string;
  slug: string;
  extension: EntryExtension;
  title: string;
};

export type DuplicateEntryInput = {
  projectPath: string;
  sourceFilePath: string;
  newSlug: string;
};

export type DeleteEntryInput = {
  projectPath: string;
  filePath: string;
};

export type FrontmatterValue =
  | null
  | string
  | number
  | boolean
  | FrontmatterValue[]
  | { [key: string]: FrontmatterValue };

export type Entry = {
  id: string;
  slug: string;
  filePath: string;
  extension: EntryExtension;
  frontmatter: Record<string, FrontmatterValue>;
  body: string;
  lastModified: string | null;
};

export type SaveEntryInput = {
  projectPath: string;
  filePath: string;
  frontmatter: Record<string, FrontmatterValue>;
  body: string;
};

export function openProject() {
  return invoke<ProjectValidation | null>("open_project");
}

export function pickProjectImage(projectPath: string, currentImagePath?: string) {
  return invoke<string | null>("pick_project_image", { projectPath, currentImagePath });
}

export function scanProject(projectPath: string) {
  return invoke<ProjectValidation>("scan_project", { projectPath });
}

export function scanCollections(projectPath: string) {
  return invoke<CollectionScan>("scan_collections", { projectPath });
}

export function createEntry(input: CreateEntryInput) {
  return invoke<EntrySummary>("create_entry", { input });
}

export function duplicateEntry(input: DuplicateEntryInput) {
  return invoke<EntrySummary>("duplicate_entry", { input });
}

export function deleteEntry(input: DeleteEntryInput) {
  return invoke<void>("delete_entry", { input });
}

export function readEntry(projectPath: string, filePath: string) {
  return invoke<Entry>("read_entry", { projectPath, filePath });
}

export function saveEntry(input: SaveEntryInput) {
  return invoke<Entry>("save_entry", { input });
}

export function importDroppedImage(projectPath: string, entryFilePath: string, sourcePath: string) {
  return invoke<string>("import_dropped_image", { projectPath, entryFilePath, sourcePath });
}

export function startWindowDrag() {
  return getCurrentWindow().startDragging();
}
