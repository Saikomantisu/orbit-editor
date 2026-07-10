# Product Requirements Document (PRD)

# Orbit Editor

**Version:** v0.1 MVP  
**Status:** Draft  
**Author:** Ravinath Rajapakshe  
**Target Platform:** Desktop (Windows, macOS, Linux)

---

# 1. Overview

Orbit Editor is a local-first desktop application for editing Astro Content Collections through a visual interface.

Instead of manually creating Markdown files and repeatedly writing frontmatter metadata, developers can create, edit, preview, and manage content using forms generated directly from their Astro schemas.

Orbit Editor does **not** replace Astro or become a CMS. It is a developer tool that works directly with an existing Astro project.

---

# 2. Problem Statement

Astro's Content Collections provide excellent type safety and flexibility, but authoring content can become repetitive.

Current workflow:

- Create a new Markdown file
- Copy existing frontmatter
- Rename fields
- Fill metadata manually
- Ensure schema matches
- Save in the correct directory
- Preview changes

This process becomes tedious for websites containing:

- Blogs
- Portfolio items
- Products
- Services
- Team members
- Testimonials
- Documentation

Developers often wish for a visual editor without introducing a full CMS.

---

# 3. Vision

Orbit Editor should become the easiest way to manage Astro Content Collections.

The application should feel like opening Figma for designs—but for Astro content.

---

# 4. Goals

## Primary Goals

- Eliminate manual frontmatter editing
- Generate forms automatically from Astro schemas
- Edit Markdown visually
- Work directly with local files
- Preserve complete compatibility with Astro

## Non Goals

The MVP will NOT include:

- Authentication
- Cloud sync
- Team collaboration
- Remote CMS
- Database storage
- Git hosting
- Website deployment
- AI writing features
- Plugin marketplace

---

# 5. Target Users

Primary users:

- Astro developers
- Freelance web developers
- Agencies building Astro websites
- Technical content creators

Secondary users:

- Clients who occasionally edit content
- Small businesses managing Astro sites

---

# 6. User Stories

### Project

As a developer,
I want to open an existing Astro project,
so Orbit Editor can manage its content.

---

As a developer,
I want Orbit Editor to automatically detect Content Collections,
so I don't configure anything manually.

---

### Collections

As a developer,
I want to see all collections,
so I can quickly navigate my content.

---

### Entries

As a developer,
I want to create new entries,
without manually writing frontmatter.

---

As a developer,
I want to edit existing entries,
using a clean interface.

---

As a developer,
I want Markdown changes to be saved directly,
so my Astro project stays unchanged.

---

### Preview

As a developer,
I want to preview my Astro website,
without leaving Orbit Editor.

---

# 7. Core Features

## 7.1 Project Selection

Users can:

- Open existing Astro project
- Reopen recent projects
- Validate Astro installation

Orbit Editor should detect:

- astro.config.*
- package.json
- src/content/
- content.config.*

---

## 7.2 Collection Detection

Automatically discover every collection.

Example:

```
Blog
Projects
Authors
Products
Testimonials
```

No manual configuration required.

---

## 7.3 Schema Detection

Orbit Editor reads the Content Collection schema.

Example:

```ts
title: string
description: string
published: boolean
date: date
author: string
tags: string[]
cover: image()
```

The UI is generated automatically.

---

## 7.4 Entry List

Each collection displays:

- Title
- Slug
- Last modified
- Draft status (if available)

Users can:

- Search
- Sort
- Create
- Delete
- Duplicate

---

## 7.5 Visual Frontmatter Editor

Instead of YAML:

```yaml
title:
description:
published:
tags:
```

Display native controls:

- Text inputs
- Textareas
- Date picker
- Checkbox
- Dropdown
- Tag editor
- Image picker
- Number input

---

## 7.6 Markdown Editor

Features:

- Markdown editing
- Live preview
- Syntax highlighting
- Image drag & drop
- Code block support
- Undo / Redo

---

## 7.7 File Saving

Saving should:

- Update frontmatter
- Preserve Markdown body
- Preserve formatting where possible
- Save directly into Astro project

No proprietary file formats.

---

## 7.8 Astro Preview

Users can:

- Start Astro dev server
- Stop server
- Open preview inside Orbit Editor

---

# 8. Functional Requirements

## Project

- Open folder
- Validate Astro project
- Remember recent projects

---

## Collections

- Read Content Collections
- Detect schema
- Display entries

---

## Editing

- Create entry
- Edit entry
- Delete entry
- Duplicate entry
- Save changes

---

## Markdown

- Edit content
- Preview content
- Preserve formatting

---

## Assets

- Select image
- Copy image into project (optional)
- Reference image correctly

---

# 9. Technical Requirements

## Frontend

- React
- TypeScript
- Vite

---

## Desktop

- Tauri

---

## Backend

- Rust

Responsibilities:

- File system access
- Reading projects
- Running Astro
- Parsing Markdown
- Managing assets

---

## Package Manager

- pnpm

---

## Supported Content Types

- Markdown (.md)
- MDX (.mdx)

---

## Supported Platforms

- Windows
- macOS
- Linux

---

# 10. UX Principles

Orbit Editor should feel:

- Fast
- Native
- Minimal
- Developer-first
- Keyboard friendly

Every common action should require as few clicks as possible.

---

# 11. Success Metrics

MVP is successful if users can:

- Open an Astro project
- Detect collections automatically
- Create new content
- Edit existing content
- Save without errors
- Preview changes

without manually editing frontmatter.

---

# 12. Future Ideas (Out of Scope)

Potential future features include:

- Git integration
- Image optimization
- AI metadata generation
- AI writing assistance
- Localization support
- Cloud sync
- Team collaboration
- Plugin system
- Custom field components
- Visual diff viewer
- Theme customization
- Command palette
- Extension API
- Auto-generated slugs
- Content validation
- Search across projects
- Asset manager
- Release channels
- Automatic updates

---

# 13. Design Principles

Orbit Editor should never:

- Replace Astro
- Lock users into a proprietary format
- Require cloud services
- Hide project files

Orbit Editor should always:

- Work directly with Astro files
- Respect existing project structure
- Be transparent
- Feel lightweight
- Stay local-first

---

# 14. MVP Definition

Orbit Editor v0.1 is complete when a user can:

1. Open an Astro project
2. Detect Content Collections automatically
3. View all entries
4. Create a new entry
5. Edit frontmatter visually
6. Edit Markdown
7. Save changes directly to disk
8. Preview the Astro site

No additional features are required before the initial release.
