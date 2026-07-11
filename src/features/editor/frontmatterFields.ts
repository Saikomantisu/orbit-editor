import type { CollectionSchema, FieldSchema, FieldType, FrontmatterValue } from "../../lib/tauri";
import { inferFieldType, isFrontmatterRecord } from "./frontmatterValues";

export type FrontmatterField = {
  name: string;
  fieldType: FieldType;
  itemType?: FieldType;
  required: boolean;
  options: string[];
  source: "schema" | "frontmatter";
  isAdditional: boolean;
};

export function buildFrontmatterFields(
  schema: CollectionSchema | null,
  frontmatter: Record<string, FrontmatterValue>,
) {
  const fields: FrontmatterField[] = [];
  const seen = new Set<string>();

  for (const schemaField of schema?.fields ?? []) {
    fields.push(fromSchemaField(schemaField));
    seen.add(schemaField.name);
  }

  const extraFields = Object.keys(frontmatter)
    .filter((name) => !seen.has(name))
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({
      name,
      fieldType: inferFieldTypeForField(name, frontmatter[name]),
      itemType: undefined,
      required: false,
      options: [],
      source: "frontmatter" as const,
      isAdditional: true,
    }));

  return {
    primaryFields: fields,
    additionalFields: extraFields,
  };
}

export function shouldUseTextarea(field: FrontmatterField, value: FrontmatterValue | undefined) {
  if (field.fieldType !== "string") {
    return false;
  }

  if (["description", "summary", "excerpt", "content", "bio"].includes(field.name.toLowerCase())) {
    return true;
  }

  return typeof value === "string" && (value.includes("\n") || value.length > 120);
}

export function isObjectLikeUnknown(field: FrontmatterField, value: FrontmatterValue | undefined) {
  return field.fieldType === "unknown" && isFrontmatterRecord(value);
}

function fromSchemaField(field: FieldSchema): FrontmatterField {
  return {
    name: field.name,
    fieldType: field.fieldType,
    itemType: field.itemType,
    required: field.required,
    options: field.options,
    source: "schema",
    isAdditional: false,
  };
}

function inferFieldTypeForField(name: string, value: FrontmatterValue | undefined): FieldType {
  const inferredType = inferFieldType(value);
  if (inferredType !== "string" && inferredType !== "unknown") {
    return inferredType;
  }

  return looksLikeDateFieldName(name) ? "date" : inferredType;
}

function looksLikeDateFieldName(name: string) {
  const normalizedName = name.replaceAll(/[_\-\s]+/g, "").toLowerCase();

  return (
    normalizedName === "date" ||
    normalizedName === "createdat" ||
    normalizedName === "updatedat" ||
    normalizedName === "publishedat" ||
    normalizedName === "modifiedat"
  );
}
