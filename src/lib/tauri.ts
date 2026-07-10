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
  filePath: string;
  extension: EntryExtension;
};

export type SchemaSource = "contentConfig" | "frontmatterInference";

export type FieldType = "string" | "number" | "boolean" | "date" | "array" | "image" | "unknown";

export type FieldSchema = {
  name: string;
  fieldType: FieldType;
  required: boolean;
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

export function openProject() {
  return invoke<ProjectValidation | null>("open_project");
}

export function scanProject(projectPath: string) {
  return invoke<ProjectValidation>("scan_project", { projectPath });
}

export function scanCollections(projectPath: string) {
  return invoke<CollectionScan>("scan_collections", { projectPath });
}

export function startWindowDrag() {
  return getCurrentWindow().startDragging();
}
