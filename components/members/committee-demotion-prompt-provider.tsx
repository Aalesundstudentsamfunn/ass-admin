"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  registerCommitteeDemotionPromptHandler,
  type CommitteeDemotionDecision,
  type CommitteeDemotionPromptRequest,
} from "@/lib/members/committee-demotion-prompt";

/**
 * Global provider that renders a custom confirmation dialog for committee demotion handling.
 */
export function CommitteeDemotionPromptProvider() {
  const queueRef = React.useRef<CommitteeDemotionPromptRequest[]>([]);
  const [currentRequest, setCurrentRequest] =
    React.useState<CommitteeDemotionPromptRequest | null>(null);

  const resolveCurrent = React.useCallback((decision: CommitteeDemotionDecision) => {
    setCurrentRequest((current) => {
      if (!current) {
        return current;
      }
      current.resolve(decision);
      return null;
    });
  }, []);

  React.useEffect(() => {
    const unregister = registerCommitteeDemotionPromptHandler((request) => {
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

  return (
    <Dialog
      open={Boolean(currentRequest)}
      onOpenChange={(open) => {
        if (!open) {
          resolveCurrent(null);
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fjerne komité?</DialogTitle>
          <DialogDescription>
            Denne endringen senker tilgangsnivået under Frivillig for{" "}
            <span className="font-medium text-foreground">
              {currentRequest?.targetLabel ?? "brukeren"}
            </span>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => resolveCurrent(null)}>
            Avbryt
          </Button>
          <Button variant="destructive" onClick={() => resolveCurrent(true)}>
            Fjern komité
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
