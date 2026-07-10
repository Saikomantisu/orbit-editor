import { invoke } from "@tauri-apps/api/core";

export function openProject() {
  return invoke("open_project");
}

export function scanProject(projectPath: string) {
  return invoke("scan_project", { projectPath });
}
