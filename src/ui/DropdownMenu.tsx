import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import type { ReactElement, ReactNode } from "react";
import { cx } from "../lib/classes";

type DropdownMenuItem = {
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  onSelect: () => void;
};

type DropdownMenuProps = {
  label: string;
  trigger: ReactElement;
  items: DropdownMenuItem[];
};

export function DropdownMenu({ label, trigger, items }: DropdownMenuProps) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild aria-label={label}>
        {trigger}
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          side="right"
          align="start"
          sideOffset={8}
          className="z-50 grid min-w-32 gap-1 rounded-orbit border border-white/10 bg-[#0e1022]/98 p-1.5 shadow-[0_14px_34px_rgb(0_0_0/0.34)]"
        >
          {items.map((item) => (
            <DropdownMenuPrimitive.Item
              key={item.label}
              onSelect={item.onSelect}
              className={cx(
                "flex min-h-[30px] cursor-pointer select-none items-center gap-2 rounded px-2 text-[0.76rem] font-extrabold outline-none transition-colors data-[highlighted]:bg-accent/10 data-[highlighted]:text-accent-hover",
                item.destructive
                  ? "text-text-muted data-[highlighted]:bg-danger/12 data-[highlighted]:text-danger-ink"
                  : "text-text-muted",
              )}
            >
              {item.icon}
              {item.label}
            </DropdownMenuPrimitive.Item>
          ))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
