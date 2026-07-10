/** Capitalize just the first letter: "blogs" → "Blogs". */
export function capitalizeFirst(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/**
 * Turn a slug into a readable title: "choosing-outdoor-formats" → "Choosing
 * Outdoor Formats". Nested slugs keep their hierarchy: "guides/start" →
 * "Guides / Start".
 */
export function toTitleCase(value: string) {
  return value
    .split("/")
    .map((segment) =>
      segment
        .split("-")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
    )
    .filter(Boolean)
    .join(" / ");
}

export function formatEntryModified(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
