/**
 * ID generation utilities.
 */

/** Generate a random ID string (8 hex characters) */
export function generateId(): string {
  return Math.random().toString(16).slice(2, 10);
}

/** Generate a UUID v4 */
export function uuid(): string {
  return crypto.randomUUID();
}
