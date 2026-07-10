# Orbit Editor — Design Guide

Orbit Editor is a **native desktop application** (Tauri + Rust + React) for editing
Astro Content Collections on the user's own machine. It is **not** a website, it is
not served over the network, and it will never be deployed as one. Every design
decision in this document assumes a resizable application window running locally,
with native OS integration, offline availability, and direct access to files on
disk.

This guide is the single source of truth for how the UI looks and how the UX
behaves. The visual tokens below are lifted directly from the current
`src/app/styles.css` so the app stays consistent as it grows.

---

## 1. Design Principles (read these first)

1. **It is an application, not a page.** There is no "scroll down the page"
   metaphor, no hero section, no marketing copy, no footer. The window is a
   fixed workspace divided into regions (sidebar, list, editor, status). Regions
   scroll independently; the window itself does not.
2. **Local-first and honest.** Orbit edits real files on the user's disk. The UI
   must always make it obvious which project, collection, and file are being
   touched, and must never hide the fact that saving writes to disk.
3. **Fast and quiet.** No animation for its own sake, no network spinners for
   things that are local. Interactions should feel instant. Motion is limited to
   short, functional transitions (≤160ms).
4. **Keyboard-first.** Every common action has a shortcut. A power user should be
   able to open a project, pick a collection, edit an entry, and save without
   touching the mouse.
5. **Dense but calm.** Desktop users expect more information on screen than a web
   visitor. Use the space, but keep hierarchy clear with the type scale and the
   restrained palette below.
6. **Native feel over web habits.** Prefer OS conventions (native file dialogs,
   native menu bar, native context menus, native title bar behavior) over
   reinventing them in HTML.

---

## 2. Color Palette

The palette is a warm-tinted near-black canvas with a single mint-green accent and
two semantic status colors. Pulled directly from the current stylesheet.

### Core surfaces & ink

| Token                 | Value                     | Use |
|-----------------------|---------------------------|-----|
| `--bg-base`           | `#191a19`                 | Window base / deepest background |
| `--bg-gradient-mid`   | `#101511`                 | Mid stop of the ambient background gradient |
| `--bg-gradient-glow`  | `rgb(58 85 73 / 28%)`     | Soft radial glow, top-left corner only |
| `--chrome-header-top` | `rgb(31 33 31 / 96%)`     | Top stop of the title/nav bar background |
| `--chrome-header-bottom` | `rgb(25 26 25 / 94%)`  | Bottom stop of the title/nav bar background |
| `--chrome-status`     | `rgb(25 26 25 / 72%)`     | Status bar background |
| `--surface-panel`     | `rgb(12 15 14 / 78%)`     | Panels / cards over the base |
| `--surface-raised`    | `rgb(255 255 255 / 5%)`   | Rows, pills, secondary buttons |
| `--surface-raised-2`  | `rgb(255 255 255 / 4%)`   | Nested rows inside a panel |

### Text

| Token             | Value       | Use |
|-------------------|-------------|-----|
| `--text-primary`  | `#f8fbf4`   | Headings, entry titles, primary values |
| `--text-body`     | `#eff3ea`   | Default document ink (`:root`) |
| `--text-muted`    | `#aab4a8`   | Body copy, descriptions |
| `--text-subtle`   | `#899487`   | Paths, metadata, captions |
| `--text-faint`    | `#6f796e`   | Least important labels / hints |

### Accent (mint / signal green)

| Token                | Value                      | Use |
|----------------------|----------------------------|-----|
| `--accent`           | `#9df0b2`                  | Primary action, focus ring, brand mark, "valid" |
| `--accent-hover`     | `#c5ffd1`                  | Primary button hover |
| `--accent-ink`       | `#07100b`                  | Text/icon on top of a filled accent surface |
| `--accent-soft`      | `rgb(157 240 178 / 9%)`    | Hover fill for accent-tinted rows |
| `--accent-border`    | `rgb(157 240 178 / 40%)`   | Accent-tinted borders |

### Semantic status

| Token           | Value                     | Use |
|-----------------|---------------------------|-----|
| `--danger`      | `#ff6f61`                 | Errors, failed checks, destructive actions |
| `--danger-ink`  | `#ffd1ca`                 | Text inside error banners |
| `--warning`     | `#f1bc53`                 | Warnings, non-blocking issues |
| `--warning-ink` | `#f6d99a`                 | Text inside warning banners |
| `--success`     | `#9df0b2`                 | Same as accent — passed checks, saved state |

### Borders & lines

| Token             | Value                     | Use |
|-------------------|---------------------------|-----|
| `--border`        | `rgb(255 255 255 / 10%)`  | Default panel / control border |
| `--border-soft`   | `rgb(255 255 255 / 9%)`   | Dividers, list-item borders |
| `--border-dashed` | `rgb(255 255 255 / 14%)`  | Empty-state / drop-zone outlines |

**Rules**
- Exactly **one** accent. Mint green means "primary / go / valid." Do not
  introduce a second accent hue for decoration.
- Status colors (`--danger`, `--warning`) are reserved for status. Never use red
  or amber decoratively.
- Elevation is expressed with translucent white surfaces and shadow, not with
  lighter solid grays. Keep the warm near-black base visible through panels.

---

## 3. Typography

**Family:** `DM Sans`, falling back to `ui-sans-serif, system-ui, sans-serif`.

> **Desktop note:** the current CSS pulls DM Sans from Google Fonts over the
> network. A native app must work offline — **bundle the DM Sans woff2 files with
> the app** and load them via a local `@font-face` instead of a CDN `@import`.
> The system fallback stack above must remain so the UI is legible before/without
> the custom font.

Rendering settings (keep as-is from `:root`): `font-synthesis: none`,
`text-rendering: optimizeLegibility`, antialiased smoothing.

### Type scale

| Role                | Size / line-height        | Weight | Color            |
|---------------------|---------------------------|--------|------------------|
| Display (rare)      | up to `3.25rem` (desktop clamp) | 700 | `--text-primary` |
| Section title `h2`  | `0.95rem`                 | 700    | `--text-primary` |
| Entry / item title  | `1.2rem`                  | 700    | `--text-primary` |
| Body                | `1rem`–`1.1rem`, LH `1.55`| 400    | `--text-muted`   |
| Control label       | `0.95rem`                 | 700    | `--text-primary` |
| Meta / caption      | `0.9rem`                  | 400    | `--text-subtle`  |
| Eyebrow / pill      | `0.8rem`, UPPERCASE       | 700    | varies           |
| Button label        | inherit                   | 800    | context          |

**Notes**
- The oversized `5.5rem` marketing headline in the current project-selection
  screen is a **website hangover**. In a desktop app, reserve very large display
  type for at most one first-run/welcome moment; inside the working UI, the
  largest routine text is the entry title (`~1.2rem`). Prefer information density
  over billboard headers.
- Weights actually in use: 400 (body), 700 (labels/titles), 800 (buttons). Stick
  to these three.
- Uppercase + weight 700 + `0.8rem` is the standard "eyebrow / tag / required"
  treatment.

---

## 4. Shape, Spacing & Elevation

- **Radius:** `8px` for panels, buttons, cards, banners, inputs. `999px` for
  pills/status chips. `50%` for the orbit mark, check indicators, and empty-state
  medallions. Keep to these three; no arbitrary radii.
- **Spacing rhythm:** multiples of ~`4px` (`4, 8, 10, 12, 14, 18, 24, 36`). Panel
  padding is `24–36px`; row padding is `14px`; control gaps are `12px`.
- **Elevation:** panels use `0 24px 80px rgb(0 0 0 / 38%)` over the ambient
  gradient. Do not stack many shadow levels — this app is essentially two planes:
  the window background and the panels on top of it.
- **Borders do most of the separation work.** Prefer a `1px` translucent-white
  border + faint fill to define a region rather than a hard drop shadow.

---

## 5. Window & App Layout (desktop-specific)

The Tauri window is `1200×800` by default, min `900×640`. Design for a
**resizable window**, not a viewport of unknown size.

### Global structure

```
┌───────────────────────────────────────────────────────────┐
│  Title bar (native)                                        │
├───────────┬───────────────────────┬───────────────────────┤
│           │                       │                        │
│  Sidebar  │   Entry list          │   Editor / Preview     │
│ (project  │  (entries in the      │  (frontmatter form +   │
│  +        │   selected            │   markdown editor,     │
│  collec-  │   collection)         │   or live Astro        │
│  tions)   │                       │   preview)             │
│           │                       │                        │
├───────────┴───────────────────────┴───────────────────────┤
│  Status bar: project path · save state · dev-server state  │
└───────────────────────────────────────────────────────────┘
```

- **Three-pane workspace** is the target layout once projects are open: a
  navigation sidebar (project + collections), a middle list (entries), and a
  primary work area (editor or preview). This is the classic desktop
  content-tool shape (think a mail client / IDE), not a web dashboard.
- **Panes are resizable** with draggable splitters, and their widths persist
  between sessions. Give sensible min-widths so no pane collapses to unusable.
- **Panes scroll independently.** The window never scrolls as a whole. There is
  no page that grows downward.
- **No responsive/mobile breakpoints as a design goal.** The existing
  `@media (max-width: 880px)` rule exists only to keep a small window from
  breaking — it is a graceful-degradation safety net, **not** a phone layout.
  Never design mobile-first or add touch-only affordances.
- **A persistent status bar** along the bottom communicates the always-true
  facts of a desktop tool: which project is open, whether there are unsaved
  changes, and the Astro dev-server state.

### First-run / project selection

The current single-screen "Open an Astro workspace" view is the entry point
before a project is loaded. Keep it purposeful and application-like:
- A single quiet panel with the product title, a short description, the
  **Open project** primary action, and the recent-projects list.
- Project checks happen internally. Invalid folders stay on the welcome screen
  and show one actionable rejection message instead of a separate checks panel.
- Once a valid project is opened, transition into the three-pane workspace above.

---

## 6. Components

### Buttons
- **Primary:** filled `--accent`, ink `--accent-ink`, weight 800, min-height
  `48px`, radius `8px`. Hover → `--accent-hover` + `translateY(-1px)`. One primary
  action per context.
- **Secondary / list buttons:** `--surface-raised` fill, `--border-soft` border,
  `--text-primary` label, left-aligned when they represent a record (recent
  project, entry row). Hover → `--accent-border` border + `--accent-soft` fill.
- **Disabled:** `opacity: 0.58`, `cursor: not-allowed`. Show it, don't hide it.
- **Loading:** swap the label to a present-tense verb ("Choosing…", "Saving…"),
  keep the button in place. Don't replace the whole UI with a spinner for local
  work.

### Pills / status chips
- Radius `999px`, `0.8rem`/700, `--surface-raised` fill, `--border` border.
- Data-driven color: valid → accent border+ink; invalid → danger; neutral →
  `--text-subtle`. Mirror the `data-valid` / `data-tone` pattern already in CSS.

### List rows (recent projects, entries, checks)
- `1px` `--border-soft` border, faint fill, `14px` padding, `8px` radius.
- Primary line: `--text-primary`, weight 700. Secondary line (path/slug/meta):
  `--text-subtle`, ellipsis-truncated on one line — **paths must never wrap**.
- A leading status dot (`12px`, `50%`) with a soft ring conveys ok/error at a
  glance (`--success` vs `--danger`), as in the check rows today.

### Banners / message stacks
- Error: `--danger` border+fill tint, `--danger-ink` text.
- Warning: `--warning` border+fill tint, `--warning-ink` text.
- Always **actionable** — say what's wrong and what to do, never a bare code.

### Empty states
- Centered, dashed `--border-dashed` outline, a circular medallion, and one line
  of copy that tells the user the next concrete action. Empty ≠ blank.

### Inputs / forms (frontmatter editor — to build)
- Inherit font (`font: inherit` is already set). Radius `8px`, `--surface-raised`
  fill, `--border` border, `--text-primary` value text.
- Field label: control-label style (`0.95rem`/700). Required marker uses the
  uppercase eyebrow treatment.
- Inline validation: message sits directly beneath the field in `--danger-ink`;
  the field border turns `--danger`. Never rely on a far-away summary alone.
- Preserve unknown frontmatter fields visibly rather than dropping them.

---

## 7. Focus, Input & Accessibility

- **Focus ring:** `2px solid --accent`, `outline-offset: 3px`. Every interactive
  element must show it. This is critical for a keyboard-first desktop tool.
- **Keyboard:** wire real accelerators through the native menu / Tauri
  (e.g. Save `⌘/Ctrl+S`, Open `⌘/Ctrl+O`, entry search `⌘/Ctrl+F`, new entry
  `⌘/Ctrl+N`). Shortcuts shown in menus must match what actually fires.
- **Context menus:** use native right-click menus for row actions (open,
  duplicate, delete) instead of hover-only web affordances.
- **Contrast:** body text on the near-black base clears AA. When placing text on
  the accent fill, use `--accent-ink` (dark), never white.
- **Motion:** functional only, ≤160ms, `ease`. Respect
  `prefers-reduced-motion` — drop the transforms/transitions when it's set.
- **Hit targets:** ≥`44–48px` height for primary controls; comfortable but dense
  is fine for list rows since this is a pointer-first desktop context.

---

## 8. Voice & Copy

- Plain, direct, technical-but-kind. "Needs attention," "Ready to open,"
  "Choose folder." No marketing tone, no exclamation-heavy hype.
- Name real things: "package.json," "Astro dependency," "src/content/." Users are
  developers editing their own repo — respect that.
- Errors state the cause and the fix. Warnings say why they're non-blocking.

---

## 9. Do / Don't (desktop guardrails)

**Do**
- Treat the window as a workspace of independently scrolling panes.
- Persist window size, pane widths, and recent projects.
- Use native dialogs, menus, and context menus.
- Keep one accent, three font weights, three radii.
- Make the current project / file / save-state always visible.

**Don't**
- Don't build a scrolling landing page, hero, or footer.
- Don't add a top nav bar, breadcrumbs-to-nowhere, or web-style routing chrome.
- Don't depend on the network for fonts, assets, or core behavior — it must work
  offline.
- Don't design for phones or add touch-only gestures.
- Don't introduce new accent colors, gradients-as-decoration, or extra shadow
  layers.
- Don't hide that saving writes real files to the user's disk.
```
