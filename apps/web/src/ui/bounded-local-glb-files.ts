import { alphaBackupFeasibilityLimits } from "../application/backup-feasibility-policy";
import { MAXIMUM_GLB_INPUT_BYTES } from "../domain/static-glb-import";

type LocalFile = Pick<File, "size" | "arrayBuffer">;
type LocalGlbRead =
 | { readonly kind: "rejected" }
 | { readonly kind: "read"; readonly bytes: readonly Uint8Array[] };

/** Check the complete declared envelope before reading any selected local file. */
export async function readBoundedLocalGlbFiles(
 files: readonly LocalFile[],
 purpose: "new-model" | "exact-repair",
): Promise<LocalGlbRead> {
 const single = purpose === "new-model";
 const maximumCount = single ? 1 : alphaBackupFeasibilityLimits.maxResourceEntries;
 const maximumFileBytes = single ? MAXIMUM_GLB_INPUT_BYTES : alphaBackupFeasibilityLimits.maxResourceBytesPerEntry;
 const maximumTotalBytes = single ? MAXIMUM_GLB_INPUT_BYTES : alphaBackupFeasibilityLimits.maxResourceBytes;
 if (files.length === 0 || files.length > maximumCount) return { kind: "rejected" };
 let total = 0;
 const sizes: number[] = [];
 for (const file of files) {
  const size = file.size;
  if (!Number.isSafeInteger(size) || size < 0 || size > maximumFileBytes || size > maximumTotalBytes - total) return { kind: "rejected" };
  sizes.push(size); total += size;
 }
 const bytes: Uint8Array[] = [];
 for (const [index, file] of files.entries()) {
  const buffer = await file.arrayBuffer();
  if (buffer.byteLength !== sizes[index]) return { kind: "rejected" };
  bytes.push(new Uint8Array(buffer));
 }
 return { kind: "read", bytes };
}
