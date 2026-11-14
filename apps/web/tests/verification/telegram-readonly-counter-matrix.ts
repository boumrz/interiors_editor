/** Verification-only transformation; the caller reads/writes actual native metadata. */
export function renamedReadonlyCounter(value: unknown): { key: "a-counter"; lastReserved: string } {
 if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected genuine producer counter");
 const row = value as Record<string, unknown>;
 if (Object.keys(row).length !== 2 || row.key !== "counter" || typeof row.lastReserved !== "string") throw new Error("Expected exact genuine producer counter shape");
 return { key: "a-counter", lastReserved: row.lastReserved };
}
