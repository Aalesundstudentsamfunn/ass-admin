import { randomInt } from "crypto";

const LOWERCASE_CHARS = "abcdefghijklmnopqrstuvwxyz";
const UPPERCASE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const NUMBER_CHARS = "0123456789";
const SYMBOL_CHARS = "!@#$%";
const REQUIRED_SETS = [LOWERCASE_CHARS, UPPERCASE_CHARS, NUMBER_CHARS];
const ALL_CHARS = `${LOWERCASE_CHARS}${UPPERCASE_CHARS}${NUMBER_CHARS}${SYMBOL_CHARS}`;
const DEFAULT_PASSWORD_LENGTH = 18;

/**
 * Returns one random character from a character set.
 */
function pickRandomChar(charset: string) {
  return charset[randomInt(charset.length)];
}

/**
 * Shuffles characters in place using Fisher-Yates.
 */
function shuffleChars(chars: string[]) {
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
}

/**
 * Generates a temporary one-time password used for invite/bootstrap flows.
 *
 * Rules:
 * - at least one lowercase letter
 * - at least one uppercase letter
 * - at least one number
 *
 * How: Starts with required categories, fills remaining chars from full charset,
 * then shuffles to avoid predictable positions.
 * @returns string
 */
export function generateTemporaryPassword(length = DEFAULT_PASSWORD_LENGTH) {
  if (length < REQUIRED_SETS.length) {
    throw new Error(
      `Temporary password length must be at least ${REQUIRED_SETS.length}.`,
    );
  }

  const chars: string[] = REQUIRED_SETS.map((set) => pickRandomChar(set));
  while (chars.length < length) {
    chars.push(pickRandomChar(ALL_CHARS));
  }

  shuffleChars(chars);
  return chars.join("");
}
