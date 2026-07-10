# Architecture

# Orbit Editor

**Version:** v0.1 MVP  
**Stack:** Tauri, React, Rust, pnpm

---

# 1. Overview

Orbit Editor is a local-first desktop editor for Astro Content Collections.

The app opens an existing Astro project, scans its content structure, detects collections, reads Markdown/MDX files, and allows users to edit content through a visual interface.

Orbit Editor does not store content in a database. The Astro project remains the source of truth.

---

# 2. High-Level Architecture

```txt
Orbit Editor
├── React Frontend
│   ├── Project UI
│   ├── Collection Browser
│   ├── Entry Editor
│   ├── Markdown Editor
│   └── Preview Panel
│
├── Tauri Bridge
│   └── Frontend ↔ Rust Commands
│
├── Rust Backend
│   ├── Project Scanner
│   ├── Collection Reader
│   ├── Markdown Parser
│   ├── File Writer
│   ├── Asset Manager
│   └── Process Runner
│
└── Local Astro Project
    ├── astro.config.*
    ├── package.json
    ├── src/content/
    └── content.config.*
```

---

# 3. Frontend

The frontend is built with:

- React
- TypeScript
- Vite
- pnpm

Responsibilities:

- Display project dashboard
- Show collections
- Show entries
- Render visual frontmatter forms
- Provide Markdown editor
- Show validation errors
- Trigger save actions
- Display Astro preview

The frontend should not directly access the file system. All file operations go through Tauri commands.

---

# 4. Tauri Bridge

Tauri connects the React frontend with the Rust backend.

Frontend calls backend commands such as:

```ts
open_project();
scan_project();
read_collection();
read_entry();
save_entry();
delete_entry();
start_dev_server();
stop_dev_server();
```

The frontend should treat these commands as the main application API.

---

# 5. Rust Backend

The Rust backend handles all local system operations.

Responsibilities:

- Read files
- Write files
- Scan folders
- Parse Markdown frontmatter
- Manage assets
- Run external commands
- Start and stop Astro dev server
- Validate project structure

Rust should be responsible for anything that touches the local machine.

---

# 6. Local Project Detection

Orbit Editor should validate that a selected folder is an Astro project.

Detection checks:

```txt
astro.config.*
package.json
src/
src/content/
content.config.*
```

A project is considered valid if it contains:

- `package.json`
- Astro dependency
- Astro config file or Astro content structure

---

# 7. Content Collection Detection

Orbit Editor scans the Astro content directory.

Supported locations:

```txt
src/content/
src/content.config.ts
content.config.ts
```

The app should detect collections such as:

```txt
src/content/blog/
src/content/projects/
src/content/products/
```

Each collection maps to a folder containing `.md` or `.mdx` files.

---

# 8. Entry Model

Internally, each content entry should use a simple model.

```ts
type Entry = {
  id: string;
  collection: string;
  filePath: string;
  slug: string;
  frontmatter: Record<string, unknown>;
  body: string;
  extension: "md" | "mdx";
  lastModified: string;
};
```

---

# 9. Collection Model

```ts
type Collection = {
  name: string;
  path: string;
  entries: EntrySummary[];
  schema?: CollectionSchema;
};
```

---

# 10. Schema Model

Schema detection should eventually support Astro Content Collection schemas.

For MVP, schema support can start simple:

```ts
type FieldSchema = {
  name: string;
  type:
    "string" | "number" | "boolean" | "date" | "array" | "image" | "unknown";
  required: boolean;
};
```

The frontend uses this schema to generate fields automatically.

---

# 11. Markdown Parsing

Each Markdown/MDX file is split into:

```txt
frontmatter
body
```

Example:

```md
---
title: Hello World
draft: false
tags:
  - astro
  - editor
---

This is the Markdown body.
```

Orbit Editor should parse the frontmatter into structured data and preserve the Markdown body separately.

---

# 12. Saving Strategy

When saving an entry:

1. Validate frontmatter
2. Serialize frontmatter to YAML
3. Combine YAML with Markdown body
4. Write file back to disk

Output format:

```md
---
title: Example
description: Example description
draft: false
---

Markdown content here.
```

The app should avoid changing unrelated project files.

---

# 13. Asset Handling

MVP asset support should be simple.

Users can:

- Select image
- Copy image into project
- Reference image in frontmatter or Markdown

Possible asset locations:

```txt
public/
src/assets/
src/content/<collection>/
```

Orbit Editor should not force one structure in v0.1.

---

# 14. Astro Preview

Orbit Editor can run the Astro dev server using the project’s package manager.

Example commands:

```txt
pnpm dev
npm run dev
yarn dev
```

For v0.1, prefer:

```txt
pnpm dev
```

The preview panel loads the local development URL.

Default:

```txt
http://localhost:4321
```

---

# 15. Process Management

Rust backend manages dev server process lifecycle.

Responsibilities:

- Start server
- Stop server
- Capture logs
- Detect running state
- Prevent duplicate servers

---

# 16. Error Handling

Errors should be shown clearly in the UI.

Examples:

```txt
This folder is not an Astro project.
No content collections found.
Could not parse frontmatter.
Could not save file.
Astro dev server failed to start.
```

Avoid technical stack traces unless the user opens developer details.

---

# 17. Data Storage

Orbit Editor stores only app preferences locally.

Examples:

```txt
recent projects
theme
window size
last opened project
```

Content remains inside the Astro project.

No database is required for v0.1.

---

# 18. Security

Orbit Editor should only access files inside the selected project unless the user explicitly chooses another file.

Rules:

- Do not scan entire system
- Do not upload files
- Do not run unknown commands automatically
- Ask before destructive actions
- Keep everything local-first

---

# 19. Initial Folder Structure

```txt
orbit-editor/
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   │   ├── projects/
│   │   ├── collections/
│   │   ├── entries/
│   │   ├── editor/
│   │   └── preview/
│   ├── lib/
│   └── main.tsx
│
├── src-tauri/
│   ├── src/
│   │   ├── commands/
│   │   ├── project/
│   │   ├── content/
│   │   ├── markdown/
│   │   ├── preview/
│   │   └── main.rs
│   └── tauri.conf.json
│
├── package.json
├── pnpm-lock.yaml
└── README.md
```

---

# 20. Architecture Rule

The architecture should stay simple:

```txt
React handles UI.
Rust handles the machine.
Astro project remains the source of truth.
```
