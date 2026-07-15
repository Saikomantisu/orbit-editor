import { useCallback, useState } from "react";
import { importImageAsset, selectImageAsset } from "../../lib/tauri";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";

type PendingImport = {
  sourcePath: string;
  fileName: string;
  resolve: (reference: string | null) => void;
  reject: (error: unknown) => void;
};

export function useImageAssetPicker(projectPath: string, entryFilePath: string) {
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const chooseImage = useCallback(
    async (currentReference = "") => {
      const selection = await selectImageAsset(projectPath, entryFilePath, currentReference);
      if (!selection) {
        return null;
      }
      if (selection.kind === "project") {
        return selection.reference;
      }

      return await new Promise<string | null>((resolve, reject) => {
        setPendingImport({ ...selection, resolve, reject });
      });
    },
    [entryFilePath, projectPath],
  );

  const closeConfirmation = useCallback(
    (open: boolean) => {
      if (open || isImporting || !pendingImport) {
        return;
      }
      pendingImport.resolve(null);
      setPendingImport(null);
    },
    [isImporting, pendingImport],
  );

  const confirmImport = useCallback(async () => {
    if (!pendingImport) {
      return;
    }
    setIsImporting(true);
    try {
      const imported = await importImageAsset(projectPath, entryFilePath, pendingImport.sourcePath);
      pendingImport.resolve(imported.reference);
      setPendingImport(null);
    } catch (error) {
      pendingImport.reject(error);
      setPendingImport(null);
    } finally {
      setIsImporting(false);
    }
  }, [entryFilePath, pendingImport, projectPath]);

  const confirmation = (
    <Dialog
      description="Copy the selected image into this Astro project."
      onOpenChange={closeConfirmation}
      open={Boolean(pendingImport)}
      title="Copy image into project?"
      footer={
        <>
          <Button
            disabled={isImporting}
            size="sm"
            variant="secondary"
            onClick={() => closeConfirmation(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={isImporting}
            size="sm"
            variant="primary"
            onClick={() => void confirmImport()}
          >
            {isImporting ? "Copying..." : "Copy image"}
          </Button>
        </>
      }
    >
      <p className="m-0 text-base leading-5 text-text-subtle">
        Copy <strong className="text-text-primary">{pendingImport?.fileName}</strong> to this
        entry’s collection under{" "}
        <code className="text-text-primary">{assetDestination(entryFilePath)}</code>. The original
        file will not be changed.
      </p>
    </Dialog>
  );

  return { chooseImage, confirmation };
}

function assetDestination(entryFilePath: string) {
  const relativeContentPath = entryFilePath.replaceAll("\\", "/").split("/src/content/")[1];
  const collection = relativeContentPath?.split("/")[0];
  return collection ? `src/assets/${collection}/` : "src/assets/";
}
