import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cx } from "../lib/classes";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-accent/45 bg-accent text-accent-ink hover:bg-accent-hover disabled:hover:bg-accent",
  secondary:
    "border-white/10 bg-white/[0.05] text-text-muted hover:border-white/16 hover:bg-white/[0.075] hover:text-text-primary",
  ghost:
    "border-transparent bg-transparent text-text-muted hover:bg-white/[0.055] hover:text-text-primary",
  danger: "border-danger/35 bg-danger/15 text-danger-ink hover:border-danger/50 hover:bg-danger/20",
  soft: "border-accent/35 bg-accent/10 text-accent-hover hover:border-accent/50 hover:bg-accent/15",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-8 px-3 text-sm",
  md: "min-h-9 px-4 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        "inline-flex min-w-0 items-center justify-center gap-2 rounded-orbit border font-medium transition-[background,border-color,color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-55",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
});
