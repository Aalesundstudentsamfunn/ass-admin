export type PrintableMember = {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
};

export const AUTO_PRINT_DEFAULT = true;

/**
 * Normalizes persisted auto-print setting values.
 * Only the explicit string "false" disables auto-print.
 */
export const parseAutoPrint = (raw: string) => raw !== "false";

export const serializeAutoPrint = (value: boolean) => (value ? "true" : "false");

/**
 * Reads auto-print from form data in a server-safe way.
 * Missing value defaults to enabled.
 */
export const shouldAutoPrint = (value: FormDataEntryValue | null) =>
  value === null ? AUTO_PRINT_DEFAULT : parseAutoPrint(String(value));
