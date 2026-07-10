import type { ReactNode } from "react";

type FieldProps = {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
};

export function Field({ label, children, hint, error }: FieldProps) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[0.68rem] font-black uppercase tracking-[0.06em] text-text-faint">
        {label}
      </span>
      {children}
      {hint ? <p className="m-0 text-xs leading-5 text-text-faint">{hint}</p> : null}
      {error ? <p className="m-0 text-xs leading-5 text-danger-ink">{error}</p> : null}
    </div>
  );
}
