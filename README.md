# Orbit Editor

A local-first visual editor for Astro Content Collections.

Orbit Editor lets developers create and edit Markdown content through a clean desktop interface without manually writing frontmatter.

---

## Why?

Astro Content Collections are fantastic, but creating content often means:

- Creating Markdown files manually
- Copying frontmatter
- Rewriting metadata
- Managing filenames
- Switching between editors and browser previews

Orbit Editor removes that friction while keeping your project 100% Astro-compatible.

---

## Features

### Project Management

- Open existing Astro projects
- Detect Content Collections automatically
- Recent projects

### Content Editing

- Visual frontmatter editor
- Markdown editor
- Live preview
- Create new entries
- Duplicate entries
- Delete entries

### Astro Integration

- Works directly with Astro projects
- Reads existing collections
- Supports Markdown and MDX
- No custom database
- No proprietary format

### Preview

- Launch Astro dev server
- Preview website inside Orbit Editor

---

## Tech Stack

| Layer           | Technology |
| --------------- | ---------- |
| Desktop         | Tauri v2   |
| Frontend        | React      |
| Language        | TypeScript |
| Backend         | Rust       |
| Build Tool      | Vite       |
| Package Manager | pnpm       |

---

## Principles

Orbit Editor is built around a few simple ideas.

- Local-first
- Astro-native
- Developer-first
- No vendor lock-in
- Minimal configuration
- Fast and lightweight

Your Astro project always remains the source of truth.

---

## Roadmap

### v0.1

- Open Astro project
- Detect collections
- View entries
- Create entries
- Edit frontmatter visually
- Edit Markdown
- Save changes
- Preview Astro site

### Future

- Git integration
- Image optimization
- AI metadata generation
- Localization
- Asset manager
- Team collaboration
- Plugin system

---

## Getting Started

### Prerequisites

- Node.js
- pnpm
- Rust
- Tauri v2

---

### Install

```bash
pnpm install
```

---

### Development

```bash
pnpm tauri dev
```

---

### Build

```bash
pnpm tauri build
```

---

## Project Structure

```
orbit-editor/
├── src/
├── src-tauri/
├── public/
├── package.json
└── README.md
```

---

## Philosophy

Orbit Editor is **not** a CMS.

It does not replace Astro.

It simply makes editing Astro content collections significantly easier.

Open your project.

Edit your content.

Save.

Continue building with Astro.

---

## License

MIT
