import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ReactElement, ReactNode } from "react";

type TooltipProps = {
  content: ReactNode;
  children: ReactElement;
};

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={7}
          className="z-50 max-w-64 rounded-md border border-white/10 bg-[#101226] px-2.5 py-1.5 text-xs font-normal text-text-muted shadow-[0_14px_34px_rgb(0_0_0/0.35)]"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-[#101226]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
