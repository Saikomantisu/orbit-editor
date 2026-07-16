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
  revision: string;
};

export type SaveEntryInput = {
  projectPath: string;
  filePath: string;
  frontmatter: Record<string, FrontmatterValue>;
  body: string;
  expectedRevision: string;
};

export type ImageAssetSelection =
  | { kind: "project"; reference: string; fileName: string }
  | { kind: "external"; sourcePath: string; fileName: string };

export type ImageAssetImport = {
  reference: string;
  fileName: string;
};

export type PreviewState = "stopped" | "starting" | "running" | "error";

export type PreviewStatus = {
  state: PreviewState;
  url: string | null;
  command: string | null;
  message: string | null;
  canStopPortProcess: boolean;
};

export function openProject() {
  return invoke<ProjectValidation | null>("open_project");
}

export function selectImageAsset(
  projectPath: string,
  entryFilePath: string,
  currentReference?: string,
) {
  return invoke<ImageAssetSelection | null>("select_image_asset", {
    projectPath,
    entryFilePath,
    currentReference,
  });
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

export function importImageAsset(projectPath: string, entryFilePath: string, sourcePath: string) {
  return invoke<ImageAssetImport>("import_image_asset", { projectPath, entryFilePath, sourcePath });
}

export function startDevServer(projectPath: string) {
  return invoke<PreviewStatus>("start_dev_server", { projectPath });
}

export function stopDevServer() {
  return invoke<PreviewStatus>("stop_dev_server");
}

export function stopProcessOnPreviewPort() {
  return invoke<void>("stop_process_on_preview_port");
}

export function getPreviewStatus() {
  return invoke<PreviewStatus>("preview_status");
}

export function openPreviewInBrowser() {
  return invoke<void>("open_preview_in_browser");
}

export function startWindowDrag() {
  return getCurrentWindow().startDragging();
}
