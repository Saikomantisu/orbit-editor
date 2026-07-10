import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="grid place-items-center gap-2.5 rounded-orbit border border-dashed border-white/10 bg-white/[0.025] px-5 py-6 text-center">
      <div className="text-text-faint">{icon}</div>
      <strong className="text-[0.9rem] font-black text-text-muted">{title}</strong>
      {children ? (
        <div className="max-w-[24rem] text-[0.8rem] leading-5 text-text-faint">{children}</div>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
