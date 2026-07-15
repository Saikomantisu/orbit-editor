import { Eye } from "lucide-react";
import { type PointerEvent, useCallback, useEffect, useState } from "react";
import { ProjectPicker } from "../features/projects/ProjectPicker";
import { ProjectWorkspace } from "../features/workspace/ProjectWorkspace";
import {
  type CollectionScan,
  openProject,
  type ProjectValidation,
  scanCollections,
  scanProject,
  startWindowDrag,
  stopDevServer,
} from "../lib/tauri";

const recentProjectsKey = "orbit-editor.recent-projects";

function loadRecentProjects() {
  try {
    const storedProjects = window.localStorage.getItem(recentProjectsKey);
    if (!storedProjects) {
      return [];
    }

    const parsedProjects = JSON.parse(storedProjects);
    return Array.isArray(parsedProjects)
      ? parsedProjects.filter((project): project is ProjectValidation =>
          Boolean(project?.path && project?.name),
        )
      : [];
  } catch {
    return [];
  }
}

function saveRecentProjects(projects: ProjectValidation[]) {
  window.localStorage.setItem(recentProjectsKey, JSON.stringify(projects));
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return fallback;
}

function getProjectRejectionMessage(project: ProjectValidation) {
  return project.errors[0] ?? "Choose an Astro project folder to continue.";
}

export function App() {
  const [selectedProject, setSelectedProject] = useState<ProjectValidation | null>(null);
  const [recentProjects, setRecentProjects] = useState<ProjectValidation[]>([]);
  const [isChoosing, setIsChoosing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [collectionScan, setCollectionScan] = useState<CollectionScan | null>(null);
  const [isScanningCollections, setIsScanningCollections] = useState(false);
  const [collectionErrorMessage, setCollectionErrorMessage] = useState<string | null>(null);
  const [previewRequest, setPreviewRequest] = useState(0);

  useEffect(() => {
    setRecentProjects(loadRecentProjects());
  }, []);

  const rememberProject = useCallback((project: ProjectValidation) => {
    if (!project.isValid) {
      return;
    }

    setRecentProjects((currentProjects) => {
      const nextProjects = [
        project,
        ...currentProjects.filter((currentProject) => currentProject.path !== project.path),
      ].slice(0, 6);

      saveRecentProjects(nextProjects);
      return nextProjects;
    });
  }, []);

  const loadCollections = useCallback(async (project: ProjectValidation) => {
    setIsScanningCollections(true);
    setCollectionErrorMessage(null);
    setCollectionScan(null);

    try {
      const scan = await scanCollections(project.path);
      setCollectionScan(scan);
    } catch (error) {
      setCollectionErrorMessage(getErrorMessage(error, "Could not scan content collections."));
    } finally {
      setIsScanningCollections(false);
    }
  }, []);

  const chooseProject = useCallback(async () => {
    setIsChoosing(true);
    setErrorMessage(null);

    try {
      const project = await openProject();
      if (!project) {
        return;
      }

      if (!project.isValid) {
        setErrorMessage(getProjectRejectionMessage(project));
        return;
      }

      setSelectedProject(project);
      rememberProject(project);
      void loadCollections(project);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not open project."));
    } finally {
      setIsChoosing(false);
    }
  }, [loadCollections, rememberProject]);

  const reopenProject = useCallback(
    async (projectPath: string) => {
      setIsChoosing(true);
      setErrorMessage(null);

      try {
        const project = await scanProject(projectPath);
        if (!project.isValid) {
          setRecentProjects((currentProjects) => {
            const nextProjects = currentProjects.filter(
              (currentProject) => currentProject.path !== projectPath,
            );
            saveRecentProjects(nextProjects);
            return nextProjects;
          });
          setErrorMessage(getProjectRejectionMessage(project));
          return;
        }

        setSelectedProject(project);
        rememberProject(project);
        void loadCollections(project);
      } catch (error) {
        setErrorMessage(getErrorMessage(error, "Could not reopen project."));
      } finally {
        setIsChoosing(false);
      }
    },
    [loadCollections, rememberProject],
  );

  const removeRecentProject = useCallback((projectPath: string) => {
    setRecentProjects((currentProjects) => {
      const nextProjects = currentProjects.filter(
        (currentProject) => currentProject.path !== projectPath,
      );
      saveRecentProjects(nextProjects);
      return nextProjects;
    });
  }, []);

  const retryCollectionScan = useCallback(() => {
    if (!selectedProject) {
      return Promise.resolve();
    }

    return loadCollections(selectedProject);
  }, [loadCollections, selectedProject]);

  const returnHome = useCallback(() => {
    void stopDevServer();
    setSelectedProject(null);
    setCollectionScan(null);
    setCollectionErrorMessage(null);
    setIsScanningCollections(false);
    setErrorMessage(null);
    setPreviewRequest(0);
  }, []);

  const handleHeaderPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }

    void startWindowDrag();
  }, []);

  // Native-style accelerator: ⌘O / Ctrl+O opens the folder picker.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        if (!isChoosing) {
          void chooseProject();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [chooseProject, isChoosing]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg-base">
      <header
        className="flex h-11 shrink-0 items-center gap-3.5 border-b border-white/10 bg-white/[0.03] px-[18px] pl-[94px]"
        data-tauri-drag-region
        onPointerDown={handleHeaderPointerDown}
      >
        <div
          className="flex w-[186px] shrink-0 items-center gap-2.5 min-w-0"
          data-tauri-drag-region
        >
          <span className="whitespace-nowrap text-base font-semibold leading-none text-text-primary/90">
            Orbit Editor
          </span>
          <span className="rounded-full bg-white/[0.05] px-1.5 py-0.5 text-2xs font-medium uppercase leading-none tracking-[0.08em] text-text-primary/35">
            Alpha
          </span>
        </div>

        <div className="mx-1.5 h-full w-px bg-white/10" aria-hidden="true" />

        <div
          className="min-w-[120px] flex-1 truncate text-base font-semibold text-text-primary"
          title={selectedProject?.path}
          data-tauri-drag-region
        >
          {selectedProject ? selectedProject.name : "New project"}
        </div>

        {selectedProject ? (
          <button
            className="inline-flex min-h-8 items-center gap-1.5 rounded-orbit border border-white/10 bg-white/[0.04] px-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-white/[0.08] hover:text-text-primary"
            type="button"
            onClick={() => setPreviewRequest((request) => request + 1)}
            title="Open Astro preview in a workspace tab"
          >
            <Eye aria-hidden="true" size={14} />
            Preview
          </button>
        ) : null}
      </header>

      <main
        className={
          selectedProject ? "min-h-0 flex-1 overflow-hidden" : "min-h-0 flex-1 overflow-auto p-10"
        }
      >
        {selectedProject ? (
          <ProjectWorkspace
            project={selectedProject}
            scan={collectionScan}
            isLoading={isScanningCollections}
            errorMessage={collectionErrorMessage}
            onRetry={retryCollectionScan}
            onBackHome={returnHome}
            previewRequest={previewRequest}
          />
        ) : (
          <div className="mx-auto flex min-h-full max-w-[720px] items-center justify-center">
            <ProjectPicker
              recentProjects={recentProjects}
              isChoosing={isChoosing}
              errorMessage={errorMessage}
              onChoose={chooseProject}
              onReopen={reopenProject}
              onRemoveRecent={removeRecentProject}
            />
          </div>
        )}
      </main>
    </div>
  );
}
