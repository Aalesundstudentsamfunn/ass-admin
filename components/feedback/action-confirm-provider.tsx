"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  registerActionConfirmHandler,
  type ActionConfirmOptions,
} from "@/lib/feedback/action-confirm";

type ActionConfirmRequest = ActionConfirmOptions & {
  resolve: (confirmed: boolean) => void;
};

/**
 * Global provider for async confirm/cancel dialogs used across dashboard actions.
 */
export function ActionConfirmProvider() {
  const queueRef = React.useRef<ActionConfirmRequest[]>([]);
  const [currentRequest, setCurrentRequest] = React.useState<ActionConfirmRequest | null>(null);

  const resolveCurrent = React.useCallback((confirmed: boolean) => {
    setCurrentRequest((request) => {
      if (!request) {
        return request;
      }
      request.resolve(confirmed);
      return null;
    });
  }, []);

  React.useEffect(() => {
    const unregister = registerActionConfirmHandler((request) => {
      queueRef.current.push(request);
      setCurrentRequest((current) => current ?? queueRef.current.shift() ?? null);
    });
    return unregister;
  }, []);

  React.useEffect(() => {
    if (!currentRequest && queueRef.current.length > 0) {
      setCurrentRequest(queueRef.current.shift() ?? null);
    }
  }, [currentRequest]);

  const confirmLabel = currentRequest?.confirmLabel ?? "Bekreft";
  const cancelLabel = currentRequest?.cancelLabel ?? "Avbryt";
  const isDestructive = currentRequest?.variant === "destructive";

  return (
    <Dialog
      open={Boolean(currentRequest)}
      onOpenChange={(open) => {
        if (!open) {
          resolveCurrent(false);
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{currentRequest?.title ?? "Bekreft handling"}</DialogTitle>
          {currentRequest?.description ? (
            <DialogDescription>{currentRequest.description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => resolveCurrent(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            onClick={() => resolveCurrent(true)}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
