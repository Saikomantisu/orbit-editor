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
      return;
    }

    void loadCollections(selectedProject);
  }, [loadCollections, selectedProject]);

  const returnHome = useCallback(() => {
    setSelectedProject(null);
    setCollectionScan(null);
    setCollectionErrorMessage(null);
    setIsScanningCollections(false);
    setErrorMessage(null);
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
    <div className="app-window">
      <header className="app-header" data-tauri-drag-region onPointerDown={handleHeaderPointerDown}>
        <div className="brand-cluster" data-tauri-drag-region>
          <span className="wordmark">Orbit Editor</span>
          <span className="alpha-badge">Alpha</span>
        </div>

        <div className="header-divider" aria-hidden="true" />

        <div className="header-context" title={selectedProject?.path} data-tauri-drag-region>
          {selectedProject ? selectedProject.name : "New project"}
        </div>
      </header>

      <main className="workspace" data-view={selectedProject ? "project" : "home"}>
        {selectedProject ? (
          <ProjectWorkspace
            project={selectedProject}
            scan={collectionScan}
            isLoading={isScanningCollections}
            errorMessage={collectionErrorMessage}
            onRetry={retryCollectionScan}
            onBackHome={returnHome}
          />
        ) : (
          <div className="project-selection">
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
