# Principles

# Orbit Editor

**Version:** v0.1 MVP

---

# 1. Local First

Orbit Editor should work directly on the user’s local Astro project.

No cloud account.  
No database.  
No remote storage.  
No lock-in.

The project files are always the source of truth.

---

# 2. Astro Native

Orbit Editor should respect how Astro already works.

It should support Astro Content Collections instead of inventing a new content system.

The app should fit into existing Astro projects, not force projects to fit the app.

---

# 3. Visual, Not Magical

Orbit Editor should make content editing easier, but it should not hide what is happening.

Users should understand that the app is editing Markdown, MDX, frontmatter, and assets inside their project.

---

# 4. No Proprietary Format

Orbit Editor must never require a custom file format.

Content should remain portable and readable outside the app.

A user should be able to uninstall Orbit Editor and continue working in VS Code without losing anything.

---

# 5. Developer First

Orbit Editor is a developer tool first.

It should be fast, predictable, keyboard-friendly, and transparent.

The app should help developers move faster without removing control.

---

# 6. Small Core, Strong Experience

The MVP should do a few things very well:

```txt
Open project
Read collections
Edit entries
Save files
Preview site
```

Avoid adding large features before the core workflow feels excellent.

---

# 7. Respect Existing Structure

Orbit Editor should not reorganize the user’s project.

It should read the current folder structure and work with it.

The app should avoid renaming, moving, or modifying files unless the user clearly chooses to do so.

---

# 8. Safe File Operations

Saving should be predictable.

Deleting should require confirmation.

Destructive actions should be reversible where possible.

The app should never silently overwrite important user work.

---

# 9. Zero Config When Possible

Orbit Editor should automatically detect:

```txt
Astro project
Content collections
Markdown entries
Frontmatter fields
Assets
Dev server command
```

Configuration should only exist when automatic detection is not enough.

---

# 10. Clear Errors

When something fails, the user should know:

```txt
what happened
why it happened
how to fix it
```

Avoid vague errors like:

```txt
Something went wrong.
```

Prefer:

```txt
Could not parse frontmatter in blog/hello-world.md.
Check that the YAML block is valid.
```

---

# 11. Preserve User Work

Orbit Editor should preserve formatting and content as much as possible.

It should avoid unnecessary file changes.

Saving one entry should not modify unrelated files.

---

# 12. Lightweight by Default

Orbit Editor should feel fast.

Startup should be quick.  
Opening projects should be quick.  
Saving should be instant.  
The app should avoid heavy background processes unless needed.

---

# 13. Transparent Preview

Preview should use the user’s actual Astro project.

Orbit Editor should run the project’s own dev command instead of creating a fake preview environment.

---

# 14. Build for Extension Later

The MVP should stay simple, but the structure should allow future features such as:

```txt
Git integration
AI metadata generation
Image optimization
Localization
Custom field components
Cloud sync
```

Future flexibility should not make the MVP complicated.

---

# 15. The Main Promise

Orbit Editor exists to make one workflow better:

```txt
Editing Astro Content Collections without manually writing frontmatter.
```

Every feature should support that promise.
