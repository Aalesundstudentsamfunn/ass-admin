import { randomBytes } from "crypto";

/**
 * Generates a temporary one-time password used for invite/bootstrap flows.
 *
 * How: Uses cryptographically random bytes and maps them to an allowed character set.
 * @returns string
 */
export function generateTemporaryPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = randomBytes(18);
  let password = "";
  for (let i = 0; i < bytes.length; i += 1) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

