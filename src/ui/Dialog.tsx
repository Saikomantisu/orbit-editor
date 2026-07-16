import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ReactNode } from "react";
import { IconButton } from "./IconButton";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-x-0 bottom-0 top-[44px] z-40 bg-[#050510]/65 backdrop-blur-[10px]" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[calc(44px+50%)] z-50 w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-orbit border border-white/10 bg-[#0e1022]/98 shadow-[0_24px_80px_rgb(0_0_0/0.38)] focus:outline-none">
          <header className="flex min-w-0 items-center justify-between gap-3 border-b border-white/[0.09] px-3.5 py-3">
            <DialogPrimitive.Title className="m-0 truncate text-lg font-semibold text-text-primary">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton label="Close">
                <X aria-hidden="true" size={14} strokeWidth={2.4} />
              </IconButton>
            </DialogPrimitive.Close>
          </header>
          {description ? (
            <DialogPrimitive.Description className="sr-only">
              {description}
            </DialogPrimitive.Description>
          ) : null}
          <div className="grid gap-3 p-3.5">{children}</div>
          {footer ? (
            <footer className="flex justify-end gap-2 px-3.5 pb-3.5">{footer}</footer>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
