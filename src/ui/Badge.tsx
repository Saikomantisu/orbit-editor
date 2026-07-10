import type { HTMLAttributes } from "react";
import { cx } from "../lib/classes";

type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger" | "muted";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-white/[0.06] text-text-subtle",
  accent: "bg-accent/12 text-accent-hover",
  success: "bg-emerald-300/13 text-emerald-100",
  warning: "bg-amber-300/14 text-amber-100",
  danger: "bg-danger/14 text-danger-ink",
  muted: "bg-white/[0.045] text-text-faint",
};

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex min-w-0 items-center gap-1 rounded-[5px] px-1.5 py-px text-[0.6rem] font-black uppercase leading-4 tracking-[0.04em]",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
