import { syntaxTree } from "@codemirror/language";
import { type Extension, type Range, RangeSet } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";

/**
 * A CodeMirror extension that turns the source editor into an Obsidian-style "Live Preview":
 * Markdown syntax markers are hidden while you write and revealed only on the line (or inline
 * span) your cursor is touching, list markers become bullets, task list items become real
 * checkboxes, thematic breaks render as rules, and links become clickable.
 *
 * It rebuilds a DecorationSet from the syntax tree whenever the document or the selection
 * changes, and leans on the existing prose highlighting for the actual typography (bold,
 * headings, code color) — it only decides what to hide, what to replace, and what to decorate.
 *
 * Block-level decorations that change line height (the horizontal rule widget) must come from
 * the plugin's `decorations` too, so the plugin is registered as providing block decorations.
 */

type SelectionRanges = readonly { from: number; to: number }[];

// A span [from, to] is "touched" when any part of the selection overlaps it (inclusive of the
// edges, so arrowing onto a marker reveals it).
function touches(ranges: SelectionRanges, from: number, to: number): boolean {
  for (const range of ranges) {
    if (range.from <= to && range.to >= from) {
      return true;
    }
  }
  return false;
}

class BulletWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const dot = document.createElement("span");
    dot.className = "cm-bullet";
    dot.textContent = "•";
    return dot;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly from: number,
    readonly to: number,
  ) {
    super();
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.from === this.from;
  }
  toDOM() {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.className = "cm-task-checkbox";
    box.checked = this.checked;
    box.dataset.from = String(this.from);
    box.dataset.to = String(this.to);
    return box;
  }
  ignoreEvent() {
    // Let clicks through to the view-level mousedown handler that toggles the marker.
    return false;
  }
}

class RuleWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const hr = document.createElement("div");
    hr.className = "cm-hr";
    return hr;
  }
}

const bulletDeco = Decoration.replace({ widget: new BulletWidget() });
// An inline (non-block) replacement styled to fill the line, so it can be supplied from the
// view plugin — CodeMirror forbids plugins from contributing block decorations.
const ruleDeco = Decoration.replace({ widget: new RuleWidget() });
const hiddenDeco = Decoration.replace({});
const strongDeco = Decoration.mark({ class: "cm-strong" });
const emphasisDeco = Decoration.mark({ class: "cm-emphasis" });
const strikethroughDeco = Decoration.mark({ class: "cm-strikethrough" });
const inlineCodeDeco = Decoration.mark({ class: "cm-inline-code" });
const codeBlockLine = Decoration.line({ class: "cm-codeblock-line" });
const blockquoteLine = Decoration.line({ class: "cm-blockquote-line" });

const ORDERED_MARK = /^\d+[.)]$/;

function buildDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const ranges = state.selection.ranges;
  const decos: Range<Decoration>[] = [];

  const hide = (from: number, to: number) => {
    if (to > from) {
      decos.push(hiddenDeco.range(from, to));
    }
  };

  // Reveal a block marker whenever the cursor sits anywhere on its line.
  const lineActive = (pos: number) => {
    const line = state.doc.lineAt(pos);
    return touches(ranges, line.from, line.to);
  };

  const slice = (from: number, to: number) => state.doc.sliceString(from, to);
  const tree = syntaxTree(state);

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter: (node) => {
        switch (node.name) {
          case "ATXHeading1":
          case "ATXHeading2":
          case "ATXHeading3":
          case "ATXHeading4":
          case "ATXHeading5":
          case "ATXHeading6":
          case "SetextHeading1":
          case "SetextHeading2": {
            const level = node.name.endsWith("1")
              ? 1
              : node.name.endsWith("2")
                ? 2
                : Number(node.name.at(-1));
            decos.push(
              Decoration.line({ class: `cm-heading cm-heading-${level}` }).range(
                state.doc.lineAt(node.from).from,
              ),
            );
            break;
          }

          case "HeaderMark": {
            // Leading `#` markers (ATX). Hide the hashes plus the single trailing space so the
            // heading text sits flush.
            if (!lineActive(node.from)) {
              const end = slice(node.to, node.to + 1) === " " ? node.to + 1 : node.to;
              hide(node.from, end);
            }
            break;
          }

          case "StrongEmphasis":
          case "Emphasis":
          case "Strikethrough": {
            const first = node.node.firstChild;
            const last = node.node.lastChild;
            const contentFrom = first?.name.endsWith("Mark") ? first.to : node.from;
            const contentTo = last?.name.endsWith("Mark") ? last.from : node.to;
            const decoration =
              node.name === "StrongEmphasis"
                ? strongDeco
                : node.name === "Emphasis"
                  ? emphasisDeco
                  : strikethroughDeco;
            if (contentTo > contentFrom) {
              decos.push(decoration.range(contentFrom, contentTo));
            }
            break;
          }

          case "QuoteMark": {
            if (!lineActive(node.from)) {
              const end = slice(node.to, node.to + 1) === " " ? node.to + 1 : node.to;
              hide(node.from, end);
            }
            break;
          }

          case "EmphasisMark":
          case "StrikethroughMark": {
            const parent = node.node.parent;
            if (parent && !touches(ranges, parent.from, parent.to)) {
              hide(node.from, node.to);
            }
            break;
          }

          case "CodeMark": {
            // Only hide the backticks of *inline* code; fenced-code fences stay visible.
            const parent = node.node.parent;
            if (parent?.name === "InlineCode" && !touches(ranges, parent.from, parent.to)) {
              hide(node.from, node.to);
            }
            break;
          }

          case "InlineCode": {
            decos.push(inlineCodeDeco.range(node.from, node.to));
            break;
          }

          case "ListMark": {
            const item = node.node.parent;
            if (item?.getChild("Task")) {
              // The checkbox widget stands in for the marker; drop the raw `-`/`*`.
              const end = slice(node.to, node.to + 1) === " " ? node.to + 1 : node.to;
              hide(node.from, end);
            } else if (!ORDERED_MARK.test(slice(node.from, node.to)) && !lineActive(node.from)) {
              decos.push(bulletDeco.range(node.from, node.to));
            }
            break;
          }

          case "TaskMarker": {
            const checked = /[xX]/.test(slice(node.from, node.to));
            decos.push(
              Decoration.replace({
                widget: new CheckboxWidget(checked, node.from, node.to),
              }).range(node.from, node.to),
            );
            break;
          }

          case "HorizontalRule": {
            if (!lineActive(node.from)) {
              const line = state.doc.lineAt(node.from);
              decos.push(ruleDeco.range(line.from, line.to));
            }
            break;
          }

          case "Blockquote": {
            const startLine = state.doc.lineAt(node.from).number;
            const endLine = state.doc.lineAt(node.to).number;
            for (let n = startLine; n <= endLine; n += 1) {
              decos.push(blockquoteLine.range(state.doc.line(n).from));
            }
            break;
          }

          case "FencedCode": {
            const startLine = state.doc.lineAt(node.from).number;
            const endLine = state.doc.lineAt(Math.min(node.to, state.doc.length)).number;
            for (let n = startLine; n <= endLine; n += 1) {
              decos.push(codeBlockLine.range(state.doc.line(n).from));
            }
            break;
          }

          case "Link": {
            decorateLink(node.node, slice, ranges, decos, hide);
            break;
          }

          default:
            break;
        }
      },
    });
  }

  return RangeSet.of(decos, true);
}

function decorateLink(
  link: SyntaxNode,
  slice: (from: number, to: number) => string,
  ranges: SelectionRanges,
  decos: Range<Decoration>[],
  hide: (from: number, to: number) => void,
) {
  if (touches(ranges, link.from, link.to)) {
    return;
  }

  // Identify the `[`, `]` and the trailing `(url)` by inspecting the LinkMark children.
  let open: SyntaxNode | null = null;
  let close: SyntaxNode | null = null;
  let url = "";
  let child = link.firstChild;
  while (child) {
    if (child.name === "LinkMark") {
      const text = slice(child.from, child.to);
      if (text === "[") {
        open = child;
      } else if (text === "]") {
        close = child;
      }
    } else if (child.name === "URL") {
      url = slice(child.from, child.to);
    }
    child = child.nextSibling;
  }

  if (!open || !close || close.from <= open.to) {
    return;
  }

  hide(open.from, open.to);
  hide(close.from, link.to);
  decos.push(
    Decoration.mark({
      class: "cm-link",
      attributes: url ? { "data-href": url } : undefined,
    }).range(open.to, close.from),
  );
}

// Toggle a task checkbox when its widget is clicked, and open links on Cmd/Ctrl-click.
const interactionHandlers = EditorView.domEventHandlers({
  mousedown(event, view) {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return false;
    }

    const checkbox = target.closest<HTMLInputElement>(".cm-task-checkbox");
    if (checkbox) {
      event.preventDefault();
      const from = Number(checkbox.dataset.from);
      const to = Number(checkbox.dataset.to);
      if (Number.isNaN(from) || Number.isNaN(to)) {
        return true;
      }
      const current = view.state.doc.sliceString(from, to);
      const next = /[xX]/.test(current) ? "[ ]" : "[x]";
      view.dispatch({ changes: { from, to, insert: next } });
      return true;
    }

    const link = target.closest<HTMLElement>(".cm-link[data-href]");
    if (link && (event.metaKey || event.ctrlKey)) {
      const href = link.dataset.href;
      if (href) {
        event.preventDefault();
        window.open(href, "_blank", "noopener,noreferrer");
        return true;
      }
    }

    return false;
  },
});

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

const liveTheme = EditorView.theme({
  ".cm-strong": {
    color: "#f5f6ff",
    fontWeight: "800",
  },
  ".cm-emphasis": {
    fontStyle: "italic",
  },
  ".cm-strikethrough": {
    textDecoration: "line-through",
    textDecorationThickness: "1.5px",
  },
  ".cm-heading": {
    color: "#f5f6ff",
    fontWeight: "800",
    lineHeight: "1.35",
  },
  ".cm-heading-1": {
    fontSize: "1.55em",
  },
  ".cm-heading-2": {
    fontSize: "1.32em",
  },
  ".cm-heading-3": {
    fontSize: "1.15em",
  },
  ".cm-bullet": {
    color: "#8b8fbf",
    fontWeight: "700",
  },
  ".cm-task-checkbox": {
    appearance: "none",
    width: "1.05em",
    height: "1.05em",
    margin: "0 0.15em 0 0",
    verticalAlign: "-0.15em",
    borderRadius: "4px",
    border: "1.5px solid #5b608a",
    background: "transparent",
    cursor: "pointer",
    position: "relative",
  },
  ".cm-task-checkbox:checked": {
    background: "#9d8cff",
    borderColor: "#9d8cff",
  },
  ".cm-task-checkbox:checked::after": {
    content: '""',
    position: "absolute",
    left: "0.3em",
    top: "0.12em",
    width: "0.25em",
    height: "0.5em",
    border: "solid #14162b",
    borderWidth: "0 2px 2px 0",
    transform: "rotate(45deg)",
  },
  ".cm-inline-code": {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    background: "rgba(255, 255, 255, 0.06)",
    borderRadius: "5px",
    padding: "0.1em 0.35em",
  },
  ".cm-codeblock-line": {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    background: "rgba(0, 0, 0, 0.28)",
  },
  ".cm-blockquote-line": {
    borderLeft: "3px solid rgba(157, 140, 255, 0.6)",
    paddingLeft: "0.9em",
    color: "#a8adcf",
  },
  ".cm-hr": {
    display: "inline-block",
    width: "100%",
    verticalAlign: "middle",
    borderTop: "1px solid rgba(255, 255, 255, 0.16)",
    margin: "0.6em 0",
  },
  ".cm-link": {
    color: "#c4b8ff",
    textDecoration: "underline",
    cursor: "pointer",
  },
});

export function livePreview(): Extension {
  return [livePreviewPlugin, interactionHandlers, liveTheme];
}
