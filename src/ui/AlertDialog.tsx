import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import { Button } from "./Button";

type AlertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  cancelLabel?: string;
  actionLabel: string;
  isWorking?: boolean;
  onAction: () => void;
};

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel = "Cancel",
  actionLabel,
  isWorking = false,
  onAction,
}: AlertDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-x-0 bottom-0 top-[44px] z-40 bg-[#050510]/65 backdrop-blur-[10px]" />
        <AlertDialogPrimitive.Content className="fixed left-1/2 top-[calc(44px+50%)] z-50 w-[min(360px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-orbit border border-white/10 bg-[#0e1022]/98 shadow-[0_24px_80px_rgb(0_0_0/0.38)] focus:outline-none">
          <div className="grid gap-3 border-b border-white/[0.09] px-3.5 py-3">
            <AlertDialogPrimitive.Title className="m-0 text-lg font-semibold text-text-primary">
              {title}
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="m-0 text-base leading-5 text-text-subtle">
              {description}
            </AlertDialogPrimitive.Description>
          </div>
          <div className="flex justify-end gap-2 p-3.5">
            <AlertDialogPrimitive.Cancel asChild>
              <Button disabled={isWorking} size="sm" variant="secondary">
                {cancelLabel}
              </Button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <Button disabled={isWorking} size="sm" variant="danger" onClick={onAction}>
                {isWorking ? "Working..." : actionLabel}
              </Button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
