import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Executes cn logic.
 *
 * How: Encapsulates the operation in one reusable function.
 * @returns mergedTw
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
