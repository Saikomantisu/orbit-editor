import { X } from "lucide-react";
import { useState } from "react";
import type { ProjectValidation } from "../../lib/tauri";
import { AlertDialog } from "../../ui/AlertDialog";
import { Button } from "../../ui/Button";
import { IconButton } from "../../ui/IconButton";

type ProjectPickerProps = {
  recentProjects: ProjectValidation[];
  isChoosing: boolean;
  errorMessage: string | null;
  onChoose: () => void;
  onReopen: (path: string) => void;
  onRemoveRecent: (path: string) => void;
};

/**
 * First-run screen: identity, the primary open action, and recent projects.
 */
export function ProjectPicker({
  recentProjects,
  isChoosing,
  errorMessage,
  onChoose,
  onReopen,
  onRemoveRecent,
}: ProjectPickerProps) {
  const [projectPendingRemoval, setProjectPendingRemoval] = useState<ProjectValidation | null>(
    null,
  );

  function handleRemoveRecent(project: ProjectValidation) {
    onRemoveRecent(project.path);
    setProjectPendingRemoval(null);
  }

  return (
    <section className="flex min-h-[480px] w-full min-w-0 flex-col" aria-label="Open a project">
      <h1 className="m-0 mb-3 max-w-[460px] text-4xl font-black leading-tight text-text-primary">
        Orbit Editor
      </h1>
      <p className="mb-7 max-w-[480px] text-[1.02rem] leading-7 text-text-muted">
        Edit Astro Content Collections locally, without changing your project.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button
          className="min-h-12 px-5"
          variant="primary"
          onClick={onChoose}
          disabled={isChoosing}
        >
          {isChoosing ? "Opening..." : "Open project"}
          {!isChoosing ? (
            <span className="rounded bg-accent-ink/10 px-1.5 py-0.5 text-[0.7rem] font-black text-accent-ink/70">
              ⌘O
            </span>
          ) : null}
        </Button>
      </div>

      {errorMessage ? (
        <p
          className="mb-4 rounded-orbit border border-danger/28 bg-danger/12 px-3 py-2.5 text-[0.86rem] leading-5 text-danger-ink"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-2">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="m-0 text-[0.72rem] font-black uppercase tracking-[0.08em] text-text-faint">
            Recent projects
          </h2>
        </div>

        {recentProjects.length > 0 ? (
          <div className="grid gap-2">
            {recentProjects.map((project) => (
              <div
                className="group flex min-w-0 items-center gap-2 rounded-orbit border border-white/10 bg-white/[0.035] p-1.5 transition-colors hover:bg-white/[0.055] focus-within:bg-white/[0.055]"
                key={project.path}
              >
                <button
                  className="grid min-w-0 flex-1 gap-0.5 rounded-md bg-transparent px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
                  type="button"
                  onClick={() => onReopen(project.path)}
                  disabled={isChoosing || projectPendingRemoval?.path === project.path}
                  title={project.path}
                >
                  <span className="truncate text-[0.9rem] font-black text-text-primary">
                    {project.name}
                  </span>
                  <small className="truncate text-[0.74rem] font-bold text-text-faint">
                    {project.path}
                  </small>
                </button>

                <IconButton
                  label={`Remove ${project.name} from recent projects`}
                  tooltip="Remove from recents"
                  variant="danger"
                  onClick={() => setProjectPendingRemoval(project)}
                  disabled={isChoosing}
                  className="opacity-70 group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  <X aria-hidden="true" size={14} strokeWidth={2.4} />
                </IconButton>
              </div>
            ))}
          </div>
        ) : (
          <p className="m-0 rounded-orbit border border-dashed border-white/10 px-4 py-5 text-center text-[0.84rem] text-text-faint">
            Previously opened projects will appear here.
          </p>
        )}
      </div>

      {projectPendingRemoval ? (
        <AlertDialog
          open
          title={`Remove "${projectPendingRemoval.name}"?`}
          description="This removes the project from recents only. It does not delete files from disk."
          actionLabel="Remove"
          isWorking={isChoosing}
          onOpenChange={(open) => {
            if (!open) {
              setProjectPendingRemoval(null);
            }
          }}
          onAction={() => handleRemoveRecent(projectPendingRemoval)}
        />
      ) : null}
    </section>
  );
}
