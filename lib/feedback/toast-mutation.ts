"use client";

import { toast } from "sonner";

type WithLoadingToastOptions<T> = {
  loadingMessage: string;
  action: () => Promise<T>;
  successMessage?: string;
  successDescription?: string;
  successDuration?: number;
  errorMessage: string;
  getErrorDescription?: (error: unknown) => string;
  errorDuration?: number;
};

/**
 * Runs async action with standardized loading/success/error toast lifecycle.
 */
export async function withLoadingToast<T>({
  loadingMessage,
  action,
  successMessage,
  successDescription,
  successDuration = 6000,
  errorMessage,
  getErrorDescription,
  errorDuration = Infinity,
}: WithLoadingToastOptions<T>): Promise<T | null> {
  const toastId = toast.loading(loadingMessage, { duration: 10000 });

  try {
    const result = await action();

    if (successMessage) {
      toast.success(successMessage, {
        id: toastId,
        description: successDescription,
        duration: successDuration,
      });
    } else {
      toast.dismiss(toastId);
    }

    return result;
  } catch (error: unknown) {
    const description = getErrorDescription
      ? getErrorDescription(error)
      : error instanceof Error
        ? error.message
        : "Ukjent feil.";

    toast.error(errorMessage, {
      id: toastId,
      description,
      duration: errorDuration,
    });

    return null;
  }
}
