import type { FrontmatterValue } from "../../lib/tauri";
import type { FrontmatterField } from "./frontmatterFields";

export type FrontmatterErrors = Record<string, string>;

export function validateFrontmatter(
  fields: FrontmatterField[],
  values: Record<string, FrontmatterValue>,
): FrontmatterErrors {
  const errors: FrontmatterErrors = {};

  for (const field of fields) {
    const value = values[field.name];
    if (!field.required && isEmpty(value)) {
      continue;
    }

    if (field.required && isEmpty(value)) {
      errors[field.name] = `${field.name} is required.`;
      continue;
    }

    if (field.fieldType === "number" && !isValidNumber(value)) {
      errors[field.name] = `${field.name} must be a number.`;
    }

    if (field.fieldType === "date" && !isValidDate(value)) {
      errors[field.name] = `${field.name} must be a valid date.`;
    }

    if (field.fieldType === "array" && field.required && !hasArrayItems(value)) {
      errors[field.name] = `${field.name} needs at least one item.`;
    }
  }

  return errors;
}

function isEmpty(value: FrontmatterValue | undefined) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function isValidNumber(value: FrontmatterValue | undefined) {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidDate(value: FrontmatterValue | undefined) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function hasArrayItems(value: FrontmatterValue | undefined) {
  return Array.isArray(value) && value.length > 0;
}
