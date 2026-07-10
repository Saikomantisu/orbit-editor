import type { HTMLAttributes } from "react";
import { cx } from "../lib/classes";

type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: "section" | "aside" | "div";
};

export function Panel({ as: Component = "section", className, ...props }: PanelProps) {
  return (
    <Component
      className={cx("min-w-0 border-white/10 bg-surface-panel text-text-body", className)}
      {...props}
    />
  );
}
