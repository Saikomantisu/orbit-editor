import type { ProjectValidation } from "../lib/tauri";

type StatusBarProps = {
  project: ProjectValidation | null;
};

/**
 * Persistent bottom status bar. In a desktop tool the always-true facts —
 * which project is open and its state — should never be more than a glance
 * away. As the app grows this is where unsaved-changes and dev-server state
 * will live (see design.md §5).
 */
export function StatusBar({ project }: StatusBarProps) {
  const state = project ? (project.isValid ? "ok" : "error") : "idle";
  const label = project
    ? project.isValid
      ? "Ready to open"
      : "Needs attention"
    : "No project open";

  return (
    <footer className="status-bar">
      <span className="status-item">
        <span className="status-dot" data-state={state} aria-hidden="true" />
        {label}
      </span>

      {project ? (
        <span className="status-item path" title={project.path}>
          <span>{project.path}</span>
        </span>
      ) : null}

      <span className="status-spacer" />
      <span className="status-item">Orbit Editor · v0.1</span>
    </footer>
  );
}
