import { type InputHTMLAttributes, useId } from "react";
import { cx } from "../lib/classes";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({ className, error, hint, id, label, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <label className="grid gap-1.5" htmlFor={inputId}>
      <span className="text-[0.68rem] font-black uppercase tracking-[0.06em] text-text-faint">
        {label}
      </span>
      <input
        id={inputId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={cx(
          "min-h-9 w-full rounded-orbit border border-white/10 bg-white/[0.05] px-2.5 text-[0.86rem] text-text-primary outline-none transition-colors placeholder:text-text-faint focus:border-accent/45 focus-visible:ring-2 focus-visible:ring-accent/35",
          className,
        )}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="m-0 text-xs leading-5 text-text-faint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="m-0 text-xs leading-5 text-danger-ink">
          {error}
        </p>
      ) : null}
    </label>
  );
}
