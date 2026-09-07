import { Button, Label, Modal, ProgressBar } from "@heroui/react";
import type { UpdateStatus } from "../electron/updates.js";

export function UpdateDialog({ status, onDismiss, onDownload, onInstall }: {
  status: UpdateStatus; onDismiss(): void; onDownload(): void; onInstall(): void;
}) {
  const ready = status.state === "ready", downloading = status.state === "downloading";
  return <Modal.Backdrop isOpen onOpenChange={open => { if (!open) onDismiss(); }}>
    <Modal.Container><Modal.Dialog className="sm:max-w-md">
      <Modal.CloseTrigger />
      <Modal.Header><Modal.Heading>{ready ? "Update ready" : downloading ? "Downloading update" : "Update available"}</Modal.Heading></Modal.Header>
      <Modal.Body>
        <p>{ready ? `Version ${status.nextVersion} is downloaded. Restart to apply the update.`
          : status.state === "error" ? "The update download failed. You can try again."
          : downloading ? "You can continue working while the update downloads."
          : `Version ${status.nextVersion} is available. Download it now?`}</p>
        {downloading && <ProgressBar className="mt-4" value={status.percent ?? 0}>
          <Label>Download</Label><ProgressBar.Output /><ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
        </ProgressBar>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onPress={onDismiss}>{downloading ? "Continue working" : "Not now"}</Button>
        {!downloading && <Button onPress={ready ? onInstall : onDownload}>{ready ? "Restart and update" : status.state === "error" ? "Retry download" : "Download update"}</Button>}
      </Modal.Footer>
    </Modal.Dialog></Modal.Container>
  </Modal.Backdrop>;
}
