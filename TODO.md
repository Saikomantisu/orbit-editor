# Orbit Editor TODO

This checklist tracks the work needed to reach the v0.1 MVP described in
[`docs/PRD.md`](docs/PRD.md). The goal is to keep Orbit Editor local-first,
Astro-native, and focused on editing Astro Content Collections without manual
frontmatter work.

## MVP Completion Criteria

Orbit Editor v0.1 is complete when a user can:

- [ ] Open an existing Astro project.
- [ ] Detect Astro Content Collections automatically.
- [ ] View all entries in a selected collection.
- [ ] Create a new entry.
- [ ] Edit frontmatter visually.
- [ ] Edit Markdown content.
- [ ] Save changes directly to disk.
- [ ] Preview the Astro site inside Orbit Editor.

## 1. Project Selection

- [x] Add project folder picker.
- [x] Validate selected folder as an Astro project.
- [x] Detect `package.json`.
- [x] Detect Astro dependency.
- [x] Detect `astro.config.*`.
- [x] Detect `src/content/`.
- [x] Detect `content.config.*` or `src/content.config.*`.
- [x] Return actionable validation errors for invalid projects.
- [x] Store and display recent projects.
- [x] Reopen a recent project.

## 2. Collection Detection

- [x] Scan `src/content/` for collection folders.
- [x] Detect Markdown entries with `.md`.
- [x] Detect MDX entries with `.mdx`.
- [x] Build a collection list from discovered folders.
- [x] Display collection names in the UI.
- [x] Handle projects with no collections.
- [x] Handle unreadable or malformed content directories.

## 3. Schema Detection

- [x] Read Astro content collection config files.
- [x] Detect basic schema fields.
- [x] Map schema fields to simple field types:
  - [x] `string`
  - [x] `number`
  - [x] `boolean`
  - [x] `date`
  - [x] `array`
  - [x] `image`
  - [x] `unknown`
- [x] Detect required fields where possible.
- [x] Fall back to inferred frontmatter fields when schema detection is limited.
- [x] Surface unsupported schema shapes clearly without blocking editing.

## 4. Entry List

- [x] Display entries for a selected collection.
- [x] Show entry title when available.
- [x] Show slug.
- [x] Show last modified time.
- [x] Show draft status when available.
- [x] Add entry search.
- [x] Add entry sorting.
- [x] Add create entry action.
- [x] Add delete entry action with confirmation.
- [x] Add duplicate entry action.
- [x] Handle empty collections.

## 5. Visual Frontmatter Editor

- [x] Generate frontmatter form fields from schema or inferred data.
- [x] Support text input fields.
- [x] Support textarea fields.
- [x] Support date fields.
- [x] Support checkbox fields.
- [x] Support dropdown fields where options are known.
- [x] Support tag or array fields.
- [x] Support image picker fields.
- [x] Support number fields.
- [x] Display validation errors next to affected fields.
- [x] Preserve unknown frontmatter fields.

## 6. Markdown Editor

- [ ] Add Markdown editing area.
- [ ] Add live Markdown preview.
- [ ] Add syntax highlighting.
- [ ] Support code blocks.
- [ ] Support undo and redo.
- [ ] Support image drag and drop.
- [ ] Keep Markdown body separate from frontmatter.
- [ ] Preserve Markdown body content on save.

## 7. File Saving

- [ ] Parse frontmatter and Markdown body from `.md` files.
- [ ] Parse frontmatter and Markdown body from `.mdx` files.
- [ ] Validate frontmatter before save.
- [ ] Serialize frontmatter to YAML.
- [ ] Combine serialized frontmatter with Markdown body.
- [ ] Write changes back to the original entry file.
- [ ] Avoid modifying unrelated project files.
- [ ] Preserve formatting where practical.
- [ ] Show actionable save errors.
- [ ] Handle invalid Markdown.
- [ ] Handle invalid frontmatter.
- [ ] Handle missing files.
- [ ] Handle write failures.

## 8. Assets

- [ ] Add image selection support.
- [ ] Optionally copy selected images into the Astro project.
- [ ] Generate correct image references for saved frontmatter or Markdown.
- [ ] Avoid accessing files outside the selected project unless the user chooses them.
- [ ] Show clear errors for missing or unreadable assets.

## 9. Astro Preview

- [ ] Detect the project dev command.
- [ ] Start the Astro dev server from the selected project.
- [ ] Stop the Astro dev server.
- [ ] Display preview inside Orbit Editor.
- [ ] Show dev server status.
- [ ] Show actionable errors when the server cannot start.
- [ ] Clean up the dev server process when closing or switching projects.

## 10. UX Quality

- [ ] Keep the interface fast and minimal.
- [ ] Make common actions keyboard-friendly.
- [ ] Use clear loading states.
- [ ] Use actionable empty states.
- [ ] Use actionable error messages.
- [ ] Avoid hiding the fact that real project files are being edited.
- [ ] Avoid adding cloud, account, or database assumptions.

## 11. Verification

- [ ] Test opening a valid Astro project.
- [ ] Test opening an invalid project.
- [ ] Test collection detection.
- [x] Test schema detection fallback behavior.
- [x] Test reading `.md` entries.
- [x] Test reading `.mdx` entries.
- [x] Test creating an entry.
- [ ] Test editing frontmatter.
- [ ] Test editing Markdown.
- [ ] Test saving changes.
- [ ] Test invalid frontmatter handling.
- [ ] Test missing file handling.
- [ ] Test delete confirmation.
- [x] Test duplicate entry behavior.
- [ ] Test preview start and stop behavior.

## Out Of Scope For v0.1

- [ ] Authentication.
- [ ] Cloud sync.
- [ ] Team collaboration.
- [ ] Remote CMS features.
- [ ] Database storage.
- [ ] Git hosting.
- [ ] Website deployment.
- [ ] AI writing features.
- [ ] Plugin marketplace.
- [ ] Localization.
- [ ] Visual diff viewer.
- [ ] Extension API.
- [ ] Automatic updates.
