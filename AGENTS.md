# AGENTS.md

# Orbit Editor - AI Agent Instructions

Welcome to the Orbit Editor project.

This document defines how AI coding agents should contribute to the codebase.

---

# Before You Do Anything

Before taking **any** action on this project, you **must** read the following documents in order:

1. `docs/principles.md`
2. `docs/architecture.md`
3. `docs/PRD.md`

These documents are the project's source of truth and define:

- Project vision
- Product scope
- Design philosophy
- Technical architecture
- Development principles

Do **not** begin implementing features, making architectural decisions, or refactoring code until you understand these documents.

---

# Project Overview

Orbit Editor is a local-first desktop application for visually editing Astro Content Collections.

Orbit Editor works directly with an existing Astro project.

It does **not** introduce a database, proprietary file format, or cloud dependency.

The user's Astro project is always the source of truth.

---

# Technology Stack

## Desktop

- Tauri v2

## Frontend

- React
- TypeScript
- Vite

## Backend

- Rust

## Package Manager

- pnpm

---

# Primary Objective

Your objective is to build the simplest, most reliable, and most maintainable implementation that satisfies the current product requirements.

Avoid unnecessary complexity.

---

# Scope

Unless explicitly instructed otherwise, only implement features defined in the current PRD.

Examples of features that are **out of scope** include:

- Authentication
- Cloud sync
- AI assistants
- Team collaboration
- Git hosting
- Deployment
- Plugin marketplace
- Analytics
- Databases

Do not expand the project scope on your own.

---

# Development Principles

When making decisions, follow these priorities:

1. Simplicity
2. Readability
3. Maintainability
4. Performance
5. Developer Experience

Prefer boring, well-understood solutions over clever implementations.

---

# Code Quality

Write code that is:

- Readable
- Modular
- Strongly typed
- Well named
- Easy to maintain

Avoid:

- Premature abstraction
- Deep inheritance
- Large functions
- Unnecessary dependencies
- Dead code

---

# Project Structure

Keep related functionality together.

Do not create generic folders such as:

```
utils/
helpers/
misc/
common/
```

unless they naturally emerge from repeated use.

Favor feature-based organization where appropriate.

---

# Frontend Responsibilities

The React application is responsible for:

- Rendering the UI
- User interaction
- State management
- Validation
- Displaying errors

The frontend should **never** directly interact with the filesystem.

All filesystem operations must go through Tauri commands.

---

# Backend Responsibilities

Rust is responsible for:

- Filesystem access
- Reading projects
- Detecting Astro projects
- Reading collections
- Parsing Markdown
- Parsing frontmatter
- Saving files
- Running Astro
- Managing processes

Business logic involving the operating system belongs in Rust.

---

# File Operations

Orbit Editor edits real project files.

Always:

- Preserve existing project structure
- Preserve user content
- Minimize unnecessary file changes
- Avoid modifying unrelated files

Never introduce proprietary file formats.

---

# Error Handling

Errors should be actionable.

Whenever possible, explain:

- What happened
- Why it happened
- How the user can fix it

Avoid generic messages like:

```
Something went wrong.
```

---

# Dependencies

Before introducing a dependency, ask:

- Is it necessary?
- Is it actively maintained?
- Does it simplify the project?
- Can the same result be achieved with existing code?

Prefer fewer dependencies.

---

# Performance

Optimize for responsiveness.

Avoid:

- Blocking the UI thread
- Repeated filesystem scans
- Unnecessary parsing
- Duplicate work

Cache only when it provides measurable benefits.

---

# Security

Orbit Editor is local-first.

Never:

- Access files outside the selected project unless explicitly requested
- Upload project data
- Execute arbitrary commands without user intent

Respect user data at all times.

---

# Testing

Before considering work complete, verify:

- Happy path
- Invalid Astro projects
- Invalid Markdown
- Invalid frontmatter
- Missing files
- Save operations
- Error handling

Assume user input can be invalid.

---

# Decision Making

If multiple implementations are possible:

1. Follow `principles.md`.
2. Follow `architecture.md`.
3. Follow `prd.md`.
4. Choose the simplest solution.
5. Choose the most maintainable solution.

If documentation conflicts with existing code, **the documentation takes precedence** unless instructed otherwise.

---

# Communication

When implementing significant changes:

- Explain why the approach was chosen.
- Keep explanations concise.
- Highlight trade-offs where relevant.

Avoid unnecessary implementation detail unless requested.

---

# Goal

Every contribution should move Orbit Editor closer to its core mission:

> Make editing Astro Content Collections as effortless as possible while remaining completely Astro-native, local-first, and transparent.
