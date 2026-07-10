import { X } from "lucide-react";
import { useState } from "react";
import type { ProjectValidation } from "../../lib/tauri";

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
  const [projectPendingRemoval, setProjectPendingRemoval] = useState<string | null>(null);

  function handleRemoveRecent(projectPath: string) {
    onRemoveRecent(projectPath);
    setProjectPendingRemoval(null);
  }

  return (
    <section className="brand-panel" aria-label="Open a project">
      <h1>Orbit Editor</h1>
      <p className="intro-copy">
        Edit Astro Content Collections locally, without changing your project.
      </p>

      <div className="primary-actions">
        <button className="primary-button" type="button" onClick={onChoose} disabled={isChoosing}>
          {isChoosing ? "Opening..." : "Open project"}
          {!isChoosing ? <span className="shortcut-hint">⌘O</span> : null}
        </button>
      </div>

      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

      <div className="recent-section">
        <div className="section-heading">
          <h2>Recent projects</h2>
        </div>

        {recentProjects.length > 0 ? (
          <div className="recent-list">
            {recentProjects.map((project) => {
              const isConfirmingRemoval = projectPendingRemoval === project.path;

              return (
                <div className="recent-project" key={project.path}>
                  <button
                    className="recent-project-main"
                    type="button"
                    onClick={() => onReopen(project.path)}
                    disabled={isChoosing || isConfirmingRemoval}
                    title={project.path}
                  >
                    <span>{project.name}</span>
                    <small>{project.path}</small>
                  </button>

                  {isConfirmingRemoval ? (
                    <fieldset
                      className="recent-remove-confirm"
                      aria-label={`Remove ${project.name} from recent projects?`}
                    >
                      <span>Remove from recents?</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRecent(project.path)}
                        disabled={isChoosing}
                      >
                        Remove
                      </button>
                      <button type="button" onClick={() => setProjectPendingRemoval(null)}>
                        Cancel
                      </button>
                    </fieldset>
                  ) : (
                    <button
                      className="recent-remove-button"
                      type="button"
                      onClick={() => setProjectPendingRemoval(project.path)}
                      disabled={isChoosing}
                      aria-label={`Remove ${project.name} from recent projects`}
                      title="Remove from recents"
                    >
                      <X aria-hidden="true" size={14} strokeWidth={2.4} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="empty-state">Previously opened projects will appear here.</p>
        )}
      </div>
    </section>
  );
}
