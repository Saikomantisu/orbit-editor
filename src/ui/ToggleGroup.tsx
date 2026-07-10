import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import type { ReactNode } from "react";
import { cx } from "../lib/classes";

type ToggleGroupOption<TValue extends string> = {
  value: TValue;
  label: string;
  icon?: ReactNode;
};

type SingleToggleGroupProps<TValue extends string> = {
  label: string;
  value: TValue;
  options: ToggleGroupOption<TValue>[];
  onValueChange: (value: TValue) => void;
  columns?: 2 | 4;
};

export function SingleToggleGroup<TValue extends string>({
  label,
  value,
  options,
  onValueChange,
  columns = 2,
}: SingleToggleGroupProps<TValue>) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue) {
          onValueChange(nextValue as TValue);
        }
      }}
      className={cx(
        "grid min-w-0 gap-1 rounded-orbit border border-white/10 bg-white/[0.03] p-[3px]",
        columns === 4 ? "grid-cols-4" : "grid-cols-2",
      )}
    >
      {options.map((option) => (
        <ToggleGroupPrimitive.Item
          key={option.value}
          value={option.value}
          className="inline-flex min-h-[27px] min-w-0 items-center justify-center gap-1 rounded-md px-1 text-[0.68rem] font-black text-text-faint transition-[background,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 data-[state=on]:bg-accent/16 data-[state=on]:text-accent-hover hover:text-text-muted"
        >
          {option.icon ? <span className="shrink-0">{option.icon}</span> : null}
          <span className="truncate">{option.label}</span>
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}
