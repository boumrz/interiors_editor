const FBX_BINARY_HEADER_BYTES = [
  0x4b, 0x61, 0x79, 0x64, 0x61, 0x72, 0x61, 0x20, 0x46, 0x42, 0x58, 0x20,
  0x42, 0x69, 0x6e, 0x61, 0x72, 0x79, 0x20, 0x20, 0x00, 0x1a, 0x00
] as const;

const FBX_VERSION_OFFSET_BYTES = FBX_BINARY_HEADER_BYTES.length;
const FBX_MINIMUM_BINARY_BYTES = FBX_VERSION_OFFSET_BYTES + 4;
/**
 * A single furniture item can realistically be several MiB, but a mobile
 * editor must reserve memory for conversion and the rendered scene. 12 MiB
 * admits detailed single items while rejecting collection-sized FBX files
 * before a Worker receives them.
 */
const MAXIMUM_FBX_INPUT_BYTES = 12 * 1024 * 1024;
const LARGE_FBX_INPUT_WARNING_BYTES = 8 * 1024 * 1024;
const supportedFbxVersions = new Set([
  7100, 7200, 7300, 7400, 7500, 7600, 7700, 7800
]);

export type StaticFbxImportPreflight =
  | {
      readonly fbxVersion: number;
      readonly inputBytes: number;
      readonly kind: 'accepted';
      readonly warningCode?: 'FBX_LARGE_FILE';
    }
  | {
      readonly kind: 'rejected';
      readonly reasonCode:
        | 'FBX_BINARY_HEADER_REQUIRED'
        | 'FBX_FILE_BYTES_LIMIT'
        | 'UNSUPPORTED_FBX_VERSION';
    };

/**
 * Performs only the bounded container admission for an untrusted binary FBX.
 * It deliberately does not parse scene nodes or create any Project/resource
 * state: an accepted result must still pass isolated FBX-to-GLB conversion and
 * the complete static GLB validation path.
 */
export function preflightStaticFbxImport(
  fileBytes: Uint8Array
): StaticFbxImportPreflight {
  if (fileBytes.byteLength > MAXIMUM_FBX_INPUT_BYTES) {
    return { kind: 'rejected', reasonCode: 'FBX_FILE_BYTES_LIMIT' };
  }
  if (!hasBinaryFbxHeader(fileBytes)) {
    return { kind: 'rejected', reasonCode: 'FBX_BINARY_HEADER_REQUIRED' };
  }

  const fbxVersion = new DataView(
    fileBytes.buffer,
    fileBytes.byteOffset,
    fileBytes.byteLength
  ).getUint32(FBX_VERSION_OFFSET_BYTES, true);
  if (!supportedFbxVersions.has(fbxVersion)) {
    return { kind: 'rejected', reasonCode: 'UNSUPPORTED_FBX_VERSION' };
  }
  return {
    fbxVersion,
    inputBytes: fileBytes.byteLength,
    kind: 'accepted',
    ...(fileBytes.byteLength > LARGE_FBX_INPUT_WARNING_BYTES
      ? { warningCode: 'FBX_LARGE_FILE' as const }
      : {})
  };
}

function hasBinaryFbxHeader(fileBytes: Uint8Array): boolean {
  if (fileBytes.byteLength < FBX_MINIMUM_BINARY_BYTES) {
    return false;
  }
  return FBX_BINARY_HEADER_BYTES.every(
    (expectedByte, index) => fileBytes[index] === expectedByte
  );
}
