import { AlertCircle, ExternalLink, Loader2, Play, RotateCw, Square } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  getPreviewStatus,
  type PreviewStatus,
  startDevServer,
  stopDevServer,
  stopProcessOnPreviewPort,
} from "../../lib/tauri";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";

type AstroPreviewProps = {
  projectPath: string;
};

const stoppedStatus: PreviewStatus = {
  state: "stopped",
  url: null,
  command: null,
  message: null,
  canStopPortProcess: false,
};

function messageFrom(error: unknown) {
  return error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "Preview failed.";
}

function isSameStatus(current: PreviewStatus, next: PreviewStatus) {
  return (
    current.state === next.state &&
    current.url === next.url &&
    current.command === next.command &&
    current.message === next.message &&
    current.canStopPortProcess === next.canStopPortProcess
  );
}

export function AstroPreview({ projectPath }: AstroPreviewProps) {
  const [status, setStatus] = useState<PreviewStatus>(stoppedStatus);
  const [isWorking, setIsWorking] = useState(false);
  const [frameKey, setFrameKey] = useState(0);

  const updateStatus = useCallback((nextStatus: PreviewStatus) => {
    setStatus((currentStatus) =>
      isSameStatus(currentStatus, nextStatus) ? currentStatus : nextStatus,
    );
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      updateStatus(await getPreviewStatus());
    } catch (error) {
      updateStatus({ ...stoppedStatus, state: "error", message: messageFrom(error) });
    }
  }, [updateStatus]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (status.state !== "starting") {
      return;
    }
    const timer = window.setInterval(() => void refreshStatus(), 500);
    return () => window.clearInterval(timer);
  }, [refreshStatus, status.state]);

  const start = useCallback(async () => {
    setIsWorking(true);
    try {
      updateStatus(await startDevServer(projectPath));
      setFrameKey((key) => key + 1);
    } catch (error) {
      updateStatus({ ...stoppedStatus, state: "error", message: messageFrom(error) });
    } finally {
      setIsWorking(false);
    }
  }, [projectPath, updateStatus]);

  const stop = useCallback(async () => {
    setIsWorking(true);
    try {
      updateStatus(await stopDevServer());
    } catch (error) {
      updateStatus({ ...stoppedStatus, state: "error", message: messageFrom(error) });
    } finally {
      setIsWorking(false);
    }
  }, [updateStatus]);

  const stopPortProcessAndStart = useCallback(async () => {
    setIsWorking(true);
    try {
      await stopProcessOnPreviewPort();
      updateStatus(await startDevServer(projectPath));
      setFrameKey((key) => key + 1);
    } catch (error) {
      updateStatus({ ...stoppedStatus, state: "error", message: messageFrom(error) });
    } finally {
      setIsWorking(false);
    }
  }, [projectPath, updateStatus]);

  const isActive = status.state === "starting" || status.state === "running";

  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg-base"
      aria-label="Astro site preview"
    >
      <header className="flex min-h-16 items-center gap-3 border-b border-white/10 bg-surface-panel px-5">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-lg font-semibold text-text-primary">Astro Preview</h2>
          <p className="m-0 mt-0.5 truncate text-xs font-normal text-text-faint">
            {status.command ?? "Uses this project's package.json dev script"}
          </p>
        </div>
        {isActive ? (
          <Button size="sm" variant="danger" disabled={isWorking} onClick={() => void stop()}>
            <Square aria-hidden="true" size={13} fill="currentColor" />
            Stop
          </Button>
        ) : (
          <Button size="sm" variant="primary" disabled={isWorking} onClick={() => void start()}>
            <Play aria-hidden="true" size={14} fill="currentColor" />
            Start preview
          </Button>
        )}
      </header>

      {status.state === "running" && status.url ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-10 items-center gap-2 border-b border-white/10 bg-white/[0.025] px-4">
            <span className="min-w-0 flex-1 truncate text-sm font-normal text-text-muted">
              {status.url}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setFrameKey((key) => key + 1)}>
              <RotateCw aria-hidden="true" size={14} />
              Reload
            </Button>
            <a
              className="inline-flex min-h-8 items-center gap-1.5 rounded-orbit px-2.5 text-sm font-medium text-text-muted hover:bg-white/[0.055] hover:text-text-primary"
              href={status.url}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink aria-hidden="true" size={14} />
              Browser
            </a>
          </div>
          <iframe
            key={frameKey}
            className="min-h-0 w-full flex-1 border-0 bg-white"
            src={status.url}
            title="Astro website preview"
          />
        </div>
      ) : null}

      {status.state === "starting" ? (
        <div className="flex h-full items-center justify-center">
          <EmptyState
            icon={<Loader2 aria-hidden="true" className="animate-spin" size={26} />}
            title="Starting preview"
          >
            Waiting for Astro at {status.url ?? "the local preview address"}…
          </EmptyState>
        </div>
      ) : null}

      {status.state === "stopped" ? (
        <div className="flex h-full items-center justify-center p-8">
          <EmptyState icon={<Play aria-hidden="true" size={26} />} title="Preview your Astro site">
            Start the project’s own dev server to view the real site here.
          </EmptyState>
        </div>
      ) : null}

      {status.state === "error" ? (
        <div className="flex h-full items-center justify-center p-8">
          <div
            className="grid max-w-xl gap-3 rounded-orbit border border-danger/25 bg-danger/10 p-4 text-danger-ink"
            role="alert"
          >
            <div className="flex gap-2">
              <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
              <div>
                <strong className="block text-base">Could not start preview</strong>
                <p className="m-0 mt-1 text-base leading-5">{status.message}</p>
              </div>
            </div>
            <Button
              className="w-fit"
              size="sm"
              variant="danger"
              disabled={isWorking}
              onClick={() => void start()}
            >
              Try again
            </Button>
            {status.canStopPortProcess ? (
              <Button
                className="w-fit"
                size="sm"
                variant="danger"
                disabled={isWorking}
                onClick={() => void stopPortProcessAndStart()}
              >
                Stop process and start preview
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
