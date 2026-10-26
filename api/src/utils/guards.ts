export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function rawString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
