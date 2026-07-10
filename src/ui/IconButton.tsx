import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cx } from "../lib/classes";
import { Tooltip } from "./Tooltip";

type IconButtonVariant = "ghost" | "soft" | "danger";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  tooltip?: string;
  variant?: IconButtonVariant;
};

const variantClasses: Record<IconButtonVariant, string> = {
  ghost:
    "border-transparent bg-transparent text-text-faint hover:border-white/10 hover:bg-white/[0.055] hover:text-text-muted",
  soft: "border-white/10 bg-white/[0.05] text-text-subtle hover:border-white/16 hover:bg-white/[0.075] hover:text-text-primary",
  danger:
    "border-transparent bg-transparent text-text-faint hover:border-danger/35 hover:bg-danger/15 hover:text-danger-ink",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, label, tooltip, variant = "soft", type = "button", ...props },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cx(
        "inline-grid h-[26px] w-[26px] shrink-0 place-items-center rounded-md border transition-[background,border-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-55",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );

  return tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button;
});
