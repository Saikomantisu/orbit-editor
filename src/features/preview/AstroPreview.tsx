import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Play,
  RotateCw,
  Square,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPreviewStatus,
  openPreviewInBrowser,
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

type PreviewCommand = "back" | "forward" | "reload";

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

function isPreviewLocationMessage(
  value: unknown,
): value is { type: "orbit:preview-location"; url: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "orbit:preview-location" &&
    "url" in value &&
    typeof value.url === "string"
  );
}

function originFrom(url: string | null) {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

export function AstroPreview({ projectPath }: AstroPreviewProps) {
  const [status, setStatus] = useState<PreviewStatus>(stoppedStatus);
  const [isWorking, setIsWorking] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [browserError, setBrowserError] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
    if (status.url) {
      setAddress(status.url);
    }
  }, [status.url]);

  useEffect(() => {
    const previewOrigin = originFrom(status.url);
    if (!previewOrigin) {
      return;
    }

    const updateAddressFromPreview = (event: MessageEvent<unknown>) => {
      if (
        event.source !== iframeRef.current?.contentWindow ||
        event.origin !== previewOrigin ||
        !isPreviewLocationMessage(event.data)
      ) {
        return;
      }

      const nextOrigin = originFrom(event.data.url);
      if (nextOrigin === previewOrigin) {
        setAddress(event.data.url);
      }
    };

    window.addEventListener("message", updateAddressFromPreview);
    return () => window.removeEventListener("message", updateAddressFromPreview);
  }, [status.url]);

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

  const openInBrowser = useCallback(async () => {
    setBrowserError(null);
    try {
      await openPreviewInBrowser();
    } catch (error) {
      setBrowserError(messageFrom(error));
    }
  }, []);

  const sendPreviewCommand = useCallback(
    (command: PreviewCommand) => {
      const previewOrigin = originFrom(status.url);
      iframeRef.current?.contentWindow?.postMessage(
        { type: "orbit:preview-command", command },
        previewOrigin ?? "*",
      );
    },
    [status.url],
  );

  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg-base"
      aria-label="Astro site preview"
    >
      {status.state === "running" && status.url ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-14 items-center gap-1.5 border-b border-white/10 bg-surface-panel px-4">
            <button
              aria-label="Go back"
              className="inline-flex size-8 items-center justify-center rounded-orbit text-text-muted transition-colors hover:bg-white/[0.055] hover:text-text-primary"
              onClick={() => sendPreviewCommand("back")}
              title="Back"
              type="button"
            >
              <ChevronLeft aria-hidden="true" size={18} />
            </button>
            <button
              aria-label="Go forward"
              className="inline-flex size-8 items-center justify-center rounded-orbit text-text-muted transition-colors hover:bg-white/[0.055] hover:text-text-primary"
              onClick={() => sendPreviewCommand("forward")}
              title="Forward"
              type="button"
            >
              <ChevronRight aria-hidden="true" size={18} />
            </button>
            <div className="min-w-0 flex flex-1">
              <label className="sr-only" htmlFor="preview-address">
                Preview address
              </label>
              <input
                aria-readonly="true"
                className="h-8 min-w-0 flex-1 cursor-default rounded-orbit border border-white/10 bg-white/[0.035] px-3 text-sm text-text-muted outline-none"
                id="preview-address"
                readOnly
                title="Preview address"
                value={address}
              />
            </div>
            <button
              aria-label="Reload preview"
              className="inline-flex size-8 items-center justify-center rounded-orbit text-text-muted transition-colors hover:bg-white/[0.055] hover:text-text-primary"
              onClick={() => setFrameKey((key) => key + 1)}
              title="Reload"
              type="button"
            >
              <RotateCw aria-hidden="true" size={15} />
            </button>
            <button
              type="button"
              className="inline-flex min-h-8 items-center gap-1.5 rounded-orbit px-2.5 text-sm font-medium text-text-muted hover:bg-white/[0.055] hover:text-text-primary"
              onClick={() => void openInBrowser()}
            >
              <ExternalLink aria-hidden="true" size={14} />
              Browser
            </button>
            <Button size="sm" variant="danger" disabled={isWorking} onClick={() => void stop()}>
              <Square aria-hidden="true" size={13} fill="currentColor" />
              Stop
            </Button>
          </div>
          {browserError ? (
            <p
              className="m-0 border-b border-danger/25 bg-danger/10 px-4 py-2 text-sm text-danger-ink"
              role="alert"
            >
              {browserError}
            </p>
          ) : null}
          <iframe
            key={frameKey}
            className="min-h-0 w-full flex-1 border-0 bg-white"
            ref={iframeRef}
            src={address || status.url}
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
            <p className="m-0">Start the project’s own dev server to view the real site here.</p>
            <Button
              className="mt-4"
              size="sm"
              variant="primary"
              disabled={isWorking}
              onClick={() => void start()}
            >
              <Play aria-hidden="true" size={14} fill="currentColor" />
              Start preview
            </Button>
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
