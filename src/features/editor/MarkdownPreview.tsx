import DOMPurify from "dompurify";
import { marked } from "marked";
import { useMemo } from "react";

type MarkdownPreviewProps = {
  body: string;
};

export function MarkdownPreview({ body }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    const rendered = marked.parse(body, { async: false, gfm: true, breaks: false });
    return DOMPurify.sanitize(rendered);
  }, [body]);

  if (body.trim().length === 0) {
    return (
      <div className="min-h-[22rem] text-base text-text-faint">
        Nothing to preview yet. Switch to Edit and start writing.
      </div>
    );
  }

  return (
    <div
      // Content is rendered from the user's own local Markdown and sanitized with DOMPurify.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized preview of local content
      dangerouslySetInnerHTML={{ __html: html }}
      className="markdown-preview min-h-[22rem] overflow-auto"
    />
  );
}
