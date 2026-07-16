import { convertFileSrc } from "@tauri-apps/api/core";
import { Calendar, ChevronLeft, ChevronRight, FileImage, Plus, X } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { cx } from "../../lib/classes";
import type { FieldType, FrontmatterValue } from "../../lib/tauri";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { IconButton } from "../../ui/IconButton";
import type { FrontmatterField } from "./frontmatterFields";
import { isObjectLikeUnknown, shouldUseTextarea } from "./frontmatterFields";
import type { FrontmatterErrors } from "./frontmatterValidation";
import { toInputString } from "./frontmatterValues";

type FrontmatterFormProps = {
  projectPath: string;
  entryFilePath: string;
  primaryFields: FrontmatterField[];
  additionalFields: FrontmatterField[];
  values: Record<string, FrontmatterValue>;
  errors: FrontmatterErrors;
  onChange: (name: string, value: FrontmatterValue) => void;
  onFieldError: (name: string, error: string | null) => void;
  onChooseImage: (currentReference?: string) => Promise<string | null>;
};

type MonthDay =
  | { kind: "empty"; key: string }
  | { kind: "day"; key: string; label: number; value: string };

const WEEKDAY_LABELS = [
  { key: "sunday", label: "S" },
  { key: "monday", label: "M" },
  { key: "tuesday", label: "T" },
  { key: "wednesday", label: "W" },
  { key: "thursday", label: "T" },
  { key: "friday", label: "F" },
  { key: "saturday", label: "S" },
];

export function FrontmatterForm({
  projectPath,
  entryFilePath,
  primaryFields,
  additionalFields,
  values,
  errors,
  onChange,
  onFieldError,
  onChooseImage,
}: FrontmatterFormProps) {
  return (
    <div className="grid min-w-0 gap-6">
      <section className="grid min-w-0 gap-4">
        {primaryFields.length ? (
          primaryFields.map((field) => (
            <FrontmatterControl
              key={field.name}
              projectPath={projectPath}
              entryFilePath={entryFilePath}
              field={field}
              value={values[field.name]}
              error={errors[field.name]}
              onChange={onChange}
              onFieldError={onFieldError}
              onChooseImage={onChooseImage}
            />
          ))
        ) : (
          <p className="m-0 rounded-orbit border border-white/10 bg-white/[0.035] px-3 py-2.5 text-base leading-5 text-text-faint">
            No schema fields were detected for this collection. Orbit Editor is showing fields from
            the current entry instead.
          </p>
        )}
      </section>

      {additionalFields.length ? (
        <section className="grid min-w-0 gap-3 border-t border-white/10 pt-5">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <h3 className="m-0 text-base font-semibold text-text-primary">Additional fields</h3>
            <Badge variant="muted">{additionalFields.length}</Badge>
          </div>
          <div className="grid min-w-0 gap-4">
            {additionalFields.map((field) => (
              <FrontmatterControl
                key={field.name}
                projectPath={projectPath}
                entryFilePath={entryFilePath}
                field={field}
                value={values[field.name]}
                error={errors[field.name]}
                onChange={onChange}
                onFieldError={onFieldError}
                onChooseImage={onChooseImage}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FrontmatterControl({
  projectPath,
  entryFilePath,
  field,
  value,
  error,
  onChange,
  onFieldError,
  onChooseImage,
}: {
  projectPath: string;
  entryFilePath: string;
  field: FrontmatterField;
  value: FrontmatterValue | undefined;
  error?: string;
  onChange: (name: string, value: FrontmatterValue) => void;
  onFieldError: (name: string, error: string | null) => void;
  onChooseImage: (currentReference?: string) => Promise<string | null>;
}) {
  const label = `${field.name}${field.required ? " *" : ""}`;
  const hint = field.isAdditional ? "Preserved from this entry's frontmatter." : undefined;

  if (isObjectLikeUnknown(field, value)) {
    return (
      <Field
        label={label}
        hint="Unsupported object field. Orbit Editor will preserve it."
        error={error}
      >
        <textarea
          className={controlClasses("min-h-28 resize-y py-2 font-mono text-xs")}
          readOnly
          value={JSON.stringify(value, null, 2)}
        />
      </Field>
    );
  }

  if (field.options.length > 0) {
    return (
      <Field label={label} hint={hint} error={error}>
        <select
          className={controlClasses()}
          value={toInputString(value)}
          onChange={(event) => onChange(field.name, event.target.value)}
        >
          {!field.required ? <option value="">None</option> : null}
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  if (field.fieldType === "boolean") {
    return (
      <Field label={label} hint={hint} error={error}>
        <label className="flex min-h-9 items-center gap-2.5 rounded-orbit border border-white/10 bg-white/[0.05] px-2.5 text-base text-text-primary">
          <input
            className="h-4 w-4 accent-accent"
            type="checkbox"
            checked={value === true}
            onChange={(event) => onChange(field.name, event.target.checked)}
          />
          <span>{value === true ? "True" : "False"}</span>
        </label>
      </Field>
    );
  }

  if (field.fieldType === "array") {
    if (field.itemType === "image") {
      return (
        <ImageArrayField
          projectPath={projectPath}
          entryFilePath={entryFilePath}
          field={field}
          value={value}
          error={error}
          hint={hint}
          onChange={(nextValue) => onChange(field.name, nextValue)}
          onFieldError={onFieldError}
          onChooseImage={onChooseImage}
        />
      );
    }

    return (
      <TagEditor
        projectPath={projectPath}
        entryFilePath={entryFilePath}
        field={field}
        value={value}
        error={error}
        hint={hint}
        onChange={(nextValue) => onChange(field.name, nextValue)}
      />
    );
  }

  if (shouldRenderImageField(field, value)) {
    return (
      <ImageField
        projectPath={projectPath}
        entryFilePath={entryFilePath}
        field={field}
        value={value}
        error={error}
        hint={hint}
        onChange={onChange}
        onFieldError={onFieldError}
        onChooseImage={onChooseImage}
      />
    );
  }

  if (field.fieldType === "date") {
    return (
      <DateField
        field={field}
        value={value}
        error={error}
        hint={hint}
        onChange={(nextValue) => onChange(field.name, nextValue)}
      />
    );
  }

  if (shouldUseTextarea(field, value)) {
    return (
      <Field label={label} hint={hint} error={error}>
        <textarea
          className={controlClasses("min-h-24 resize-y py-2")}
          value={toInputString(value)}
          onChange={(event) => onChange(field.name, event.target.value)}
        />
      </Field>
    );
  }

  return (
    <Field label={label} hint={hint} error={error}>
      <input
        className={controlClasses()}
        type={inputTypeForField(field.fieldType)}
        value={toInputString(value)}
        onChange={(event) => {
          if (field.fieldType === "number") {
            const nextValue = event.target.value;
            onChange(field.name, nextValue === "" ? "" : Number(nextValue));
            return;
          }

          onChange(field.name, event.target.value);
        }}
      />
    </Field>
  );
}

function DateField({
  field,
  value,
  error,
  hint,
  onChange,
}: {
  field: FrontmatterField;
  value: FrontmatterValue | undefined;
  error?: string;
  hint?: string;
  onChange: (value: FrontmatterValue) => void;
}) {
  const dateValue = normalizeDateInputValue(value);
  const pickerId = useId();
  const monthHeadingId = useId();
  const fieldRef = useRef<HTMLFieldSetElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => monthFromValue(dateValue));
  const monthDays = buildMonthDays(visibleMonth.year, visibleMonth.month);
  const currentMonthLabel = monthLabel(visibleMonth.year, visibleMonth.month);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const animationFrame = requestAnimationFrame(() => {
      pickerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOnOutsidePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && fieldRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [isOpen]);

  function selectDate(nextValue: string) {
    onChange(nextValue);
    setVisibleMonth(monthFromValue(nextValue));
    setIsOpen(false);
  }

  function changeMonth(delta: number) {
    setVisibleMonth((currentMonth) => {
      const nextDate = new Date(currentMonth.year, currentMonth.month + delta, 1);
      return {
        year: nextDate.getFullYear(),
        month: nextDate.getMonth(),
      };
    });
  }

  return (
    <Field label={`${field.name}${field.required ? " *" : ""}`} hint={hint} error={error}>
      <fieldset
        className="relative m-0 min-w-0 border-0 p-0"
        ref={fieldRef}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsOpen(false);
          }
        }}
      >
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            aria-label={`${field.name} date`}
            className={controlClasses("font-mono")}
            inputMode="numeric"
            placeholder="YYYY-MM-DD"
            value={dateValue}
            onChange={(event) => {
              const nextValue = event.target.value;
              onChange(nextValue);
              if (isCompleteDate(nextValue)) {
                setVisibleMonth(monthFromValue(nextValue));
              }
            }}
            onFocus={() => setIsOpen(true)}
          />
          <Button
            className="justify-center px-3"
            size="sm"
            variant="secondary"
            aria-controls={isOpen ? pickerId : undefined}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            onClick={() => setIsOpen((currentValue) => !currentValue)}
          >
            <Calendar aria-hidden="true" size={14} strokeWidth={2.3} />
            Pick
          </Button>
        </div>

        {isOpen ? (
          <div
            aria-labelledby={monthHeadingId}
            className="absolute left-0 top-[calc(100%+0.4rem)] z-50 grid w-[18rem] gap-3 rounded-orbit border border-white/12 bg-[#0e1022]/98 p-3 shadow-[0_18px_48px_rgba(0,0,0,0.38)]"
            id={pickerId}
            ref={pickerRef}
            role="dialog"
          >
            <div className="flex items-center justify-between gap-2">
              <IconButton
                label="Previous month"
                tooltip="Previous month"
                onClick={() => changeMonth(-1)}
              >
                <ChevronLeft aria-hidden="true" size={15} strokeWidth={2.4} />
              </IconButton>
              <strong className="text-base font-semibold text-text-primary" id={monthHeadingId}>
                {currentMonthLabel}
              </strong>
              <IconButton label="Next month" tooltip="Next month" onClick={() => changeMonth(1)}>
                <ChevronRight aria-hidden="true" size={15} strokeWidth={2.4} />
              </IconButton>
            </div>

            <table
              aria-label={`${currentMonthLabel} calendar`}
              className="w-full table-fixed border-separate border-spacing-1"
            >
              <thead>
                <tr>
                  {WEEKDAY_LABELS.map((dayLabel) => (
                    <th
                      className="h-7 text-center text-xs font-medium uppercase text-text-faint"
                      key={dayLabel.key}
                      scope="col"
                    >
                      {dayLabel.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {buildMonthWeeks(monthDays).map((week) => (
                  <tr key={week.map((day) => day.key).join(":")}>
                    {week.map((day) => (
                      <td className="h-8 p-0" key={day.key}>
                        {day.kind === "day" ? (
                          <button
                            aria-label={`Select ${dateButtonLabel(day.value)}`}
                            aria-pressed={day.value === dateValue}
                            className={cx(
                              "grid h-8 w-full place-items-center rounded-md border border-transparent text-sm font-medium text-text-subtle transition-colors hover:border-accent/35 hover:bg-accent/12 hover:text-text-primary",
                              day.value === dateValue
                                ? "border-accent/50 bg-accent text-accent-ink hover:bg-accent hover:text-accent-ink"
                                : "",
                            )}
                            type="button"
                            onClick={() => selectDate(day.value)}
                          >
                            {day.label}
                          </button>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => selectDate(dateToValue(new Date()))}
              >
                Today
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onChange("")}>
                Clear
              </Button>
            </div>
          </div>
        ) : null}
      </fieldset>
    </Field>
  );
}

function ImageArrayField({
  projectPath,
  entryFilePath,
  field,
  value,
  error,
  hint,
  onChange,
  onFieldError,
  onChooseImage,
}: {
  projectPath: string;
  entryFilePath: string;
  field: FrontmatterField;
  value: FrontmatterValue | undefined;
  error?: string;
  hint?: string;
  onChange: (value: FrontmatterValue) => void;
  onFieldError: (name: string, error: string | null) => void;
  onChooseImage: (currentReference?: string) => Promise<string | null>;
}) {
  const [pickingIndex, setPickingIndex] = useState<number | "new" | null>(null);
  const imagePaths = Array.isArray(value) ? value.map((item) => toInputString(item)) : [];

  function updateImage(index: number, nextPath: string) {
    onChange(imagePaths.map((path, currentIndex) => (currentIndex === index ? nextPath : path)));
  }

  function removeImage(index: number) {
    onChange(imagePaths.filter((_, currentIndex) => currentIndex !== index));
  }

  function replaceImage(index: number, nextPath: string) {
    const nextImagePath = nextPath.trim();
    if (!nextImagePath) {
      return;
    }

    updateImage(index, nextImagePath);
  }

  function addImage(imagePath: string) {
    const nextImagePath = imagePath.trim();
    if (!nextImagePath) {
      return;
    }

    onChange([...imagePaths, nextImagePath]);
  }

  async function pickImage(index: number | "new") {
    setPickingIndex(index);
    onFieldError(field.name, null);

    try {
      const currentImagePath = index === "new" ? "" : imagePaths[index];
      const imagePath = await onChooseImage(currentImagePath);
      if (imagePath) {
        if (index === "new") {
          addImage(imagePath);
        } else {
          replaceImage(index, imagePath);
        }
      }
    } catch (error) {
      onFieldError(field.name, typeof error === "string" ? error : "Could not choose image.");
    } finally {
      setPickingIndex(null);
    }
  }

  return (
    <Field label={`${field.name}${field.required ? " *" : ""}`} hint={hint} error={error}>
      <div className="grid gap-3 rounded-orbit border border-white/10 bg-white/[0.035] p-3">
        {imagePaths.length ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-3">
            {imagePaths.map((imagePath, index) => (
              <div
                className="group grid min-w-0 overflow-hidden rounded-orbit border border-white/10 bg-bg-base/70"
                key={imagePath}
              >
                <div className="relative aspect-[4/3] min-w-0 overflow-hidden bg-bg-base">
                  <ImagePreview
                    className="h-full w-full rounded-none border-0"
                    imagePath={imagePath}
                    projectPath={projectPath}
                    entryFilePath={entryFilePath}
                  />
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-gradient-to-b from-black/65 to-transparent p-2">
                    <span className="min-w-0 truncate text-xs font-medium uppercase tracking-[0.08em] text-white/85">
                      {index + 1}
                    </span>
                    <IconButton
                      className="h-7 w-7 bg-black/35 text-white hover:bg-danger/80"
                      label={`Remove image ${index + 1}`}
                      variant="ghost"
                      onClick={() => removeImage(index)}
                    >
                      <X aria-hidden="true" size={14} strokeWidth={2.5} />
                    </IconButton>
                  </div>
                </div>
                <div className="grid gap-2 p-2">
                  <span
                    className="truncate text-sm font-medium text-text-primary"
                    title={imagePath}
                  >
                    {fileNameFromPath(imagePath)}
                  </span>
                  <Button
                    className="w-full justify-center px-2"
                    size="sm"
                    variant="secondary"
                    disabled={pickingIndex === index}
                    onClick={() => pickImage(index)}
                  >
                    <FileImage aria-hidden="true" size={13} strokeWidth={2.3} />
                    {pickingIndex === index ? "Choosing..." : "Replace"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid min-h-32 place-items-center rounded-orbit border border-dashed border-white/14 bg-bg-base/45 px-4 py-6 text-center">
            <div className="grid justify-items-center gap-2">
              <FileImage
                aria-hidden="true"
                className="text-text-faint"
                size={24}
                strokeWidth={1.8}
              />
              <span className="text-base font-normal text-text-faint">No gallery images</span>
            </div>
          </div>
        )}

        <div className="grid min-w-0 gap-2">
          <Button
            className="w-full justify-center"
            size="sm"
            variant="secondary"
            disabled={pickingIndex === "new"}
            onClick={() => pickImage("new")}
          >
            <FileImage aria-hidden="true" size={14} strokeWidth={2.3} />
            {pickingIndex === "new" ? "Choosing..." : "Choose"}
          </Button>
        </div>
      </div>
    </Field>
  );
}

function ImageField({
  projectPath,
  entryFilePath,
  field,
  value,
  error,
  hint,
  onChange,
  onFieldError,
  onChooseImage,
}: {
  projectPath: string;
  entryFilePath: string;
  field: FrontmatterField;
  value: FrontmatterValue | undefined;
  error?: string;
  hint?: string;
  onChange: (name: string, value: FrontmatterValue) => void;
  onFieldError: (name: string, error: string | null) => void;
  onChooseImage: (currentReference?: string) => Promise<string | null>;
}) {
  const [isPicking, setIsPicking] = useState(false);
  const imagePath = toInputString(value).trim();

  async function pickImage() {
    setIsPicking(true);
    onFieldError(field.name, null);

    try {
      const selectedImagePath = await onChooseImage(imagePath);
      if (selectedImagePath) {
        onChange(field.name, selectedImagePath);
      }
    } catch (error) {
      onFieldError(field.name, typeof error === "string" ? error : "Could not choose image.");
    } finally {
      setIsPicking(false);
    }
  }

  return (
    <Field label={`${field.name}${field.required ? " *" : ""}`} hint={hint} error={error}>
      <div className="grid min-w-0 gap-3 rounded-orbit border border-white/10 bg-white/[0.035] p-3">
        <ImagePreview
          className="aspect-[16/10] h-auto w-full"
          imagePath={imagePath}
          key={`${projectPath}:${entryFilePath}:${imagePath}`}
          projectPath={projectPath}
          entryFilePath={entryFilePath}
        />

        <span className="truncate text-base font-medium text-text-primary" title={imagePath}>
          {imagePath ? fileNameFromPath(imagePath) : "No image selected"}
        </span>

        <Button
          className="w-full justify-center"
          size="sm"
          variant="secondary"
          disabled={isPicking}
          onClick={pickImage}
        >
          <FileImage aria-hidden="true" size={14} strokeWidth={2.3} />
          {isPicking ? "Choosing..." : "Choose"}
        </Button>
      </div>
    </Field>
  );
}

function ImagePreview({
  className,
  imagePath,
  projectPath,
  entryFilePath,
}: {
  className: string;
  imagePath: string;
  projectPath: string;
  entryFilePath: string;
}) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const nextPreviewSrc = imagePreviewSrc(projectPath, entryFilePath, imagePath);
  const previewSrc = previewFailed ? null : nextPreviewSrc;

  return (
    <span
      className={cx(
        "grid shrink-0 place-items-center overflow-hidden rounded-md border border-white/10 bg-bg-base",
        className,
      )}
      title={imagePath || "No image selected"}
    >
      {previewSrc ? (
        <img
          alt=""
          className="h-full w-full object-cover"
          src={previewSrc}
          onError={() => setPreviewFailed(true)}
        />
      ) : (
        <FileImage aria-hidden="true" className="text-text-faint" size={20} strokeWidth={1.9} />
      )}
    </span>
  );
}

function imagePreviewSrc(projectPath: string, entryFilePath: string, imagePath: string) {
  if (!imagePath || !looksLikeImagePath(imagePath) || /^(https?:|data:|blob:)/i.test(imagePath)) {
    return null;
  }

  const absolutePath = imagePath.startsWith("/")
    ? joinPath(projectPath, `public/${imagePath.slice(1)}`)
    : isAbsolutePath(imagePath)
      ? imagePath
      : isLegacyProjectRelativeReference(imagePath)
        ? joinPath(projectPath, imagePath)
        : joinPath(parentPath(entryFilePath), imagePath);

  return convertFileSrc(absolutePath);
}

// Earlier Orbit versions stored picker values relative to the project root. Keep those existing
// frontmatter values previewable while new asset references remain relative to their entry.
function isLegacyProjectRelativeReference(imagePath: string) {
  return /^(?:src|public)[\\/]/i.test(imagePath.trim());
}

function parentPath(path: string) {
  const normalized = path.replaceAll("\\", "/");
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index) : path;
}

function looksLikeImagePath(value: string) {
  return /\.(avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(value.trim());
}

function isAbsolutePath(path: string) {
  return /^[A-Za-z]:[\\/]/.test(path) || path.startsWith("\\\\");
}

function joinPath(basePath: string, relativePath: string) {
  const separator = basePath.includes("\\") ? "\\" : "/";
  const normalizedRelative = relativePath.replaceAll(/[\\/]+/g, separator);
  const joined = `${basePath.replace(/[\\/]+$/, "")}${separator}${normalizedRelative.replace(/^[\\/]+/, "")}`;
  return normalizePath(joined, separator);
}

function normalizePath(path: string, separator: string) {
  const prefix = path.startsWith(separator) ? separator : "";
  const segments = path.split(/[\\/]+/);
  const normalized: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (normalized.length > 0 && normalized.at(-1) !== "..") {
        normalized.pop();
      } else if (!prefix) {
        normalized.push(segment);
      }
      continue;
    }
    normalized.push(segment);
  }

  return `${prefix}${normalized.join(separator)}`;
}

function fileNameFromPath(path: string) {
  const normalizedPath = path.trim().replaceAll("\\", "/");
  return normalizedPath.split("/").filter(Boolean).at(-1) ?? path;
}

function TagEditor({
  projectPath,
  entryFilePath,
  field,
  value,
  error,
  hint,
  onChange,
}: {
  projectPath: string;
  entryFilePath: string;
  field: FrontmatterField;
  value: FrontmatterValue | undefined;
  error?: string;
  hint?: string;
  onChange: (value: FrontmatterValue) => void;
}) {
  const tags = Array.isArray(value) ? value.map((item) => toInputString(item)) : [];
  const [draft, setDraft] = useState("");

  function addTag() {
    const nextTag = draft.trim();
    if (!nextTag || tags.includes(nextTag)) {
      return;
    }

    onChange([...tags, nextTag]);
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag();
    }
  }

  return (
    <Field label={`${field.name}${field.required ? " *" : ""}`} hint={hint} error={error}>
      <div className="grid min-w-0 gap-2 rounded-orbit border border-white/10 bg-white/[0.035] p-2">
        <div className="flex min-w-0 flex-wrap gap-2">
          {tags.length ? (
            tags.map((tag) => (
              <span
                className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md bg-accent/12 px-1.5 py-1 text-sm font-normal text-accent-hover"
                key={tag}
              >
                {looksLikeImagePath(tag) ? (
                  <ImagePreview
                    className="h-8 w-10"
                    imagePath={tag}
                    projectPath={projectPath}
                    entryFilePath={entryFilePath}
                  />
                ) : null}
                <span className="min-w-0 truncate">{tag}</span>
                <IconButton
                  className="h-5 w-5"
                  label={`Remove ${tag}`}
                  variant="ghost"
                  onClick={() => onChange(tags.filter((currentTag) => currentTag !== tag))}
                >
                  <X aria-hidden="true" size={12} strokeWidth={2.5} />
                </IconButton>
              </span>
            ))
          ) : (
            <span className="px-1 text-sm text-text-faint">No items</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            className={controlClasses("min-w-0 flex-1")}
            placeholder="Add item"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button className="shrink-0 px-3" size="sm" variant="secondary" onClick={addTag}>
            <Plus aria-hidden="true" size={14} strokeWidth={2.4} />
            Add
          </Button>
        </div>
      </div>
    </Field>
  );
}

function shouldRenderImageField(field: FrontmatterField, value: FrontmatterValue | undefined) {
  if (field.fieldType === "image") {
    return true;
  }

  if (typeof value === "string" && looksLikeImagePath(value)) {
    return true;
  }

  return (
    field.fieldType === "string" &&
    ["image", "thumbnail", "cover", "hero", "poster", "logo"].some((namePart) =>
      field.name.toLowerCase().includes(namePart),
    )
  );
}

function inputTypeForField(fieldType: FieldType) {
  if (fieldType === "number") {
    return "number";
  }

  return "text";
}

function normalizeDateInputValue(value: FrontmatterValue | undefined) {
  const inputValue = toInputString(value);
  return inputValue.length >= 10 ? inputValue.slice(0, 10) : inputValue;
}

function monthFromValue(value: string) {
  if (isCompleteDate(value)) {
    const [year, month] = value.split("-").map(Number);
    return {
      year,
      month: month - 1,
    };
  }

  const today = new Date();
  return {
    year: today.getFullYear(),
    month: today.getMonth(),
  };
}

function buildMonthDays(year: number, month: number): MonthDay[] {
  const firstDay = new Date(year, month, 1).getDay();
  const dayCount = new Date(year, month + 1, 0).getDate();
  const days: MonthDay[] = [];

  for (let emptyDay = 0; emptyDay < firstDay; emptyDay += 1) {
    days.push({ kind: "empty", key: `empty-${year}-${month}-${emptyDay}` });
  }

  for (let day = 1; day <= dayCount; day += 1) {
    const value = datePartsToValue(year, month, day);
    days.push({
      kind: "day",
      key: value,
      label: day,
      value,
    });
  }

  return days;
}

function buildMonthWeeks(days: MonthDay[]) {
  const weeks: MonthDay[][] = [];
  let week: MonthDay[] = [];

  for (const day of days) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }

  if (week.length > 0) {
    const lastDayKey = week.at(-1)?.key ?? "last";
    while (week.length < 7) {
      week.push({ kind: "empty", key: `trailing-${lastDayKey}-${week.length}` });
    }
    weeks.push(week);
  }

  return weeks;
}

function datePartsToValue(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateToValue(date: Date) {
  return datePartsToValue(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateButtonLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1));
}

function isCompleteDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function controlClasses(className?: string) {
  return cx(
    "min-h-9 min-w-0 max-w-full w-full rounded-orbit border border-white/10 bg-white/[0.05] px-2.5 text-base text-text-primary outline-none transition-colors placeholder:text-text-faint focus:border-accent/45 focus-visible:ring-2 focus-visible:ring-accent/35 disabled:opacity-60",
    className,
  );
}
