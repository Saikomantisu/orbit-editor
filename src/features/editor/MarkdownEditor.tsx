import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownKeymap, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { drawSelection, dropCursor, EditorView, keymap, placeholder } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useRef, useState } from "react";
import { cx } from "../../lib/classes";
import { livePreview } from "./livePreview";

type MarkdownEditorProps = {
  value: string;
  onChange: (next: string) => void;
  /**
   * Called for each image dropped onto the editor. Should copy the file into the project and
   * return a Markdown-relative reference to insert, or null if the drop was rejected.
   */
  onDropImage?: (sourcePath: string) => Promise<string | null>;
};

const MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

// Prose-first highlighting: headings grow, marks (`#`, `*`, `` ` ``) fade back, everything reads
// like writing rather than code — closer to Obsidian's source view than a code editor.
const proseHighlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: "1.55em", fontWeight: "800", color: "#f5f6ff", lineHeight: "1.3" },
  { tag: t.heading2, fontSize: "1.32em", fontWeight: "800", color: "#f5f6ff", lineHeight: "1.3" },
  { tag: t.heading3, fontSize: "1.15em", fontWeight: "800", color: "#f5f6ff" },
  { tag: [t.heading4, t.heading5, t.heading6], fontWeight: "800", color: "#f5f6ff" },
  { tag: t.strong, fontWeight: "800", color: "#f5f6ff" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "#c4b8ff", textDecoration: "underline" },
  { tag: t.url, color: "#868bb2" },
  { tag: t.monospace, fontFamily: MONO_FONT, color: "#e7e9fb" },
  { tag: t.quote, color: "#a8adcf", fontStyle: "italic" },
  { tag: [t.list, t.contentSeparator], color: "#a8adcf" },
  // The literal markdown markers — keep them present but quiet.
  { tag: [t.processingInstruction, t.meta], color: "#5b608a" },
]);

const orbitTheme = EditorView.theme(
  {
    "&": { color: "#e7e9fb", backgroundColor: "transparent", height: "100%" },
    ".cm-scroller": {
      fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
      lineHeight: "1.75",
      overflow: "auto",
    },
    ".cm-content": {
      caretColor: "#c4b8ff",
      padding: "2px 2px 40vh",
      fontSize: "1rem",
    },
    ".cm-line": { padding: "0" },
    "&.cm-focused": { outline: "none" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#c4b8ff", borderLeftWidth: "2px" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(157, 140, 255, 0.25)",
    },
    ".cm-placeholder": { color: "#5b608a" },
  },
  { dark: true },
);

type MarkdownFormat = {
  prefix: string;
  suffix: string;
};

const formats: Record<string, MarkdownFormat> = {
  bold: { prefix: "**", suffix: "**" },
  italic: { prefix: "*", suffix: "*" },
  strikethrough: { prefix: "~~", suffix: "~~" },
  code: { prefix: "`", suffix: "`" },
  link: { prefix: "[", suffix: "](url)" },
};

function wrapSelection(view: EditorView, format: MarkdownFormat) {
  const selection = view.state.selection.main;
  if (selection.empty) {
    return false;
  }

  const selectedText = view.state.sliceDoc(selection.from, selection.to);
  view.dispatch({
    changes: {
      from: selection.from,
      to: selection.to,
      insert: `${format.prefix}${selectedText}${format.suffix}`,
    },
    selection: {
      anchor: selection.from + format.prefix.length,
      head: selection.to + format.prefix.length,
    },
    userEvent: "input.format",
  });
  view.focus();
  return true;
}

// Formatting is intentionally implemented as editor transactions instead of HTML styling.
// The Markdown source remains the source of truth, while selection-aware input makes common
// formatting feel like a rich-text editor.
const markdownFormatting = EditorView.domEventHandlers({
  keydown(event, view) {
    const modifier = event.metaKey || event.ctrlKey;

    if (modifier && !event.altKey) {
      const format =
        event.shiftKey && event.key.toLowerCase() === "x"
          ? formats.strikethrough
          : event.key.toLowerCase() === "b"
            ? formats.bold
            : event.key.toLowerCase() === "i"
              ? formats.italic
              : event.key.toLowerCase() === "e"
                ? formats.code
                : event.key.toLowerCase() === "k"
                  ? formats.link
                  : null;
      if (format && wrapSelection(view, format)) {
        event.preventDefault();
        return true;
      }
    }

    // A selected passage followed by an asterisk is the quick path to bold Markdown.
    // Other markers provide the matching basic inline Markdown formats.
    if (!modifier && !event.altKey && !event.isComposing && !view.state.selection.main.empty) {
      const format =
        event.key === "*"
          ? formats.bold
          : event.key === "_"
            ? { prefix: "_", suffix: "_" }
            : event.key === "~"
              ? formats.strikethrough
              : event.key === "`"
                ? formats.code
                : null;
      if (format && wrapSelection(view, format)) {
        event.preventDefault();
        return true;
      }
    }

    return false;
  },
});

export function MarkdownEditor({ value, onChange, onDropImage }: MarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [isDropTarget, setIsDropTarget] = useState(false);

  // Keep the latest callbacks/value without rebuilding the editor view.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onDropImageRef = useRef(onDropImage);
  onDropImageRef.current = onDropImage;
  const valueRef = useRef(value);
  valueRef.current = value;

  // Build the editor once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const view = new EditorView({
      doc: valueRef.current,
      parent: host,
      extensions: [
        history(),
        drawSelection(),
        dropCursor(),
        // GFM base unlocks task lists, strikethrough, tables and autolinks — matching Obsidian.
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(proseHighlight),
        livePreview(),
        markdownFormatting,
        EditorView.lineWrapping,
        // markdownKeymap first so Enter continues lists/quotes before the default binding runs.
        keymap.of([...markdownKeymap, ...defaultKeymap, ...historyKeymap]),
        placeholder("Start writing…"),
        orbitTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Reconcile external value changes (switching entries, reload after save) without
  // clobbering the cursor while the user is typing.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const current = view.state.doc.toString();
    if (value !== current) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  // OS file drops. With Tauri's drag-drop enabled, the webview does not receive HTML5 drop
  // events, so we listen to Tauri's event (which carries absolute file paths) instead.
  useEffect(() => {
    const webview = getCurrentWebview();
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    function isOverEditor(position: { x: number; y: number }) {
      const view = viewRef.current;
      if (!view) {
        return false;
      }
      const rect = view.dom.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const x = position.x / ratio;
      const y = position.y / ratio;
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }

    async function handleDrop(paths: string[], position: { x: number; y: number }) {
      const view = viewRef.current;
      const onDrop = onDropImageRef.current;
      if (!view || !onDrop || !isOverEditor(position)) {
        return;
      }

      const ratio = window.devicePixelRatio || 1;
      let insertAt =
        view.posAtCoords({ x: position.x / ratio, y: position.y / ratio }) ?? view.state.doc.length;

      for (const path of paths) {
        const reference = await onDrop(path);
        if (!reference) {
          continue;
        }
        const snippet = `![](${reference})`;
        view.dispatch({
          changes: { from: insertAt, insert: snippet },
          selection: { anchor: insertAt + snippet.length },
        });
        insertAt += snippet.length;
      }
      view.focus();
    }

    webview
      .onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type === "enter" || payload.type === "over") {
          setIsDropTarget(isOverEditor(payload.position));
        } else if (payload.type === "leave") {
          setIsDropTarget(false);
        } else if (payload.type === "drop") {
          setIsDropTarget(false);
          void handleDrop(payload.paths, payload.position);
        }
      })
      .then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={cx(
        "min-h-[24rem] rounded-orbit transition-shadow",
        isDropTarget ? "shadow-[0_0_0_2px_var(--color-accent)]" : "",
      )}
    />
  );
}
