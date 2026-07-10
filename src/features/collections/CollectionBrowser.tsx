import { AlertCircle, ArrowLeft, FileCode2, FileText, Folder, RefreshCw } from "lucide-react";
import type { CollectionScan, CollectionSummary, ProjectValidation } from "../../lib/tauri";

type CollectionBrowserProps = {
  project: ProjectValidation;
  scan: CollectionScan | null;
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onBackHome: () => void;
};

export function CollectionBrowser({
  project,
  scan,
  isLoading,
  errorMessage,
  onRetry,
  onBackHome,
}: CollectionBrowserProps) {
  return (
    <section className="collection-browser" aria-label="Content collections">
      <div className="workspace-heading">
        <div className="workspace-title-group">
          <div className="workspace-title-nav">
            <button
              className="workspace-back-button"
              type="button"
              onClick={onBackHome}
              title="Back to home"
            >
              <ArrowLeft aria-hidden="true" size={15} strokeWidth={2.4} />
              <span>Home</span>
            </button>
            <span className="workspace-kicker">Project</span>
          </div>
          <h1>{project.name}</h1>
          <p title={project.path}>{project.path}</p>
        </div>

        <button
          className="icon-text-button"
          type="button"
          onClick={onRetry}
          disabled={isLoading}
          title="Rescan collections"
        >
          <RefreshCw aria-hidden="true" size={16} strokeWidth={2.2} />
          {isLoading ? "Scanning" : "Rescan"}
        </button>
      </div>

      {isLoading ? <p className="workspace-message">Scanning collections...</p> : null}

      {errorMessage ? (
        <div className="workspace-alert" role="alert">
          <AlertCircle aria-hidden="true" size={18} strokeWidth={2.2} />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {!isLoading && scan?.warnings.length ? (
        <div className="warning-list">
          {scan.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      {!isLoading && !errorMessage && scan?.collections.length === 0 ? (
        <div className="empty-collections">
          <Folder aria-hidden="true" size={22} strokeWidth={2.1} />
          <h2>No content collections found.</h2>
          <p title={scan.contentPath}>{scan.contentPath}</p>
        </div>
      ) : null}

      {!isLoading && scan && scan.collections.length > 0 ? (
        <div className="collection-list">
          {scan.collections.map((collection) => (
            <CollectionRow collection={collection} key={collection.path} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function CollectionRow({ collection }: { collection: CollectionSummary }) {
  const markdownCount = collection.entries.filter((entry) => entry.extension === "md").length;
  const mdxCount = collection.entries.filter((entry) => entry.extension === "mdx").length;
  const entryLabel = collection.entries.length === 1 ? "entry" : "entries";

  return (
    <article className="collection-row">
      <div className="collection-main">
        <Folder aria-hidden="true" size={18} strokeWidth={2.1} />
        <div className="collection-name-group">
          <h2 title={collection.name}>{collection.name}</h2>
          <p title={collection.path}>{collection.path}</p>
        </div>
      </div>

      <div className="collection-counts">
        <span>
          {collection.entries.length} {entryLabel}
        </span>
        <span title="Markdown entries">
          <FileText aria-hidden="true" size={14} strokeWidth={2.1} />
          {markdownCount}
        </span>
        <span title="MDX entries">
          <FileCode2 aria-hidden="true" size={14} strokeWidth={2.1} />
          {mdxCount}
        </span>
      </div>

      {collection.warnings.length > 0 ? (
        <div className="collection-warnings">
          {collection.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
    </article>
  );
}
