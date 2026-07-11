import type { FieldType, FrontmatterValue } from "../../lib/tauri";

export function isFrontmatterRecord(
  value: FrontmatterValue | undefined,
): value is Record<string, FrontmatterValue> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function inferFieldType(value: FrontmatterValue | undefined): FieldType {
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (typeof value === "number") {
    return "number";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (typeof value === "string") {
    return looksLikeDate(value) ? "date" : "string";
  }

  return "unknown";
}

export function stableStringify(value: FrontmatterValue): string {
  return JSON.stringify(sortValue(value));
}

export function normalizeForSave(
  values: Record<string, FrontmatterValue>,
): Record<string, FrontmatterValue> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => !isEmptyOptionalValue(value)),
  );
}

export function toInputString(value: FrontmatterValue | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
}

function looksLikeDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}/.test(value);
}

function isEmptyOptionalValue(value: FrontmatterValue) {
  return value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

function sortValue(value: FrontmatterValue): FrontmatterValue {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (isFrontmatterRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortValue(child)]),
    );
  }

  return value;
}
