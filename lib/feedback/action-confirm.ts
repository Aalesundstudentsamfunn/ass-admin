"use client";

export type ActionConfirmVariant = "default" | "destructive";

export type ActionConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ActionConfirmVariant;
};

type ActionConfirmRequest = ActionConfirmOptions & {
  resolve: (confirmed: boolean) => void;
};

type ActionConfirmHandler = (request: ActionConfirmRequest) => void;

let actionConfirmHandler: ActionConfirmHandler | null = null;

/**
 * Registers global handler used by the shared action-confirm dialog provider.
 */
export function registerActionConfirmHandler(handler: ActionConfirmHandler) {
  actionConfirmHandler = handler;
  return () => {
    if (actionConfirmHandler === handler) {
      actionConfirmHandler = null;
    }
  };
}

/**
 * Opens shared confirm dialog and resolves to true when user confirms.
 * If provider is missing, fail safe by returning false in production.
 */
export function requestActionConfirm(options: ActionConfirmOptions): Promise<boolean> {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  if (!actionConfirmHandler) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error("ActionConfirmProvider is not mounted.");
    }
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    actionConfirmHandler?.({
      ...options,
      resolve,
    });
  });
}
