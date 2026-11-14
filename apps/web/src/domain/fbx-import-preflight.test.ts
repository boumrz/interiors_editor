import { describe, expect, it } from '@rstest/core';

import { preflightStaticFbxImport } from './fbx-import-preflight';

const binaryHeader = [
  0x4b, 0x61, 0x79, 0x64, 0x61, 0x72, 0x61, 0x20, 0x46, 0x42, 0x58, 0x20,
  0x42, 0x69, 0x6e, 0x61, 0x72, 0x79, 0x20, 0x20,
  0x00,
  0x1a,
  0x00
] as const;

function binaryFbx(version: number, trailingBytes = 0): Uint8Array {
  const bytes = new Uint8Array(binaryHeader.length + 4 + trailingBytes);
  bytes.set(binaryHeader);
  new DataView(bytes.buffer).setUint32(binaryHeader.length, version, true);
  return bytes;
}

function asciiBytes(value: string): Uint8Array {
  return new Uint8Array(
    Array.from(value, (character) => character.charCodeAt(0))
  );
}

describe('preflightStaticFbxImport', () => {
  it('accepts a bounded binary FBX candidate before its later isolated conversion to GLB', () => {
    const fileBytes = binaryFbx(7400, 12);

    expect(preflightStaticFbxImport(fileBytes)).toEqual({
      fbxVersion: 7400,
      inputBytes: fileBytes.byteLength,
      kind: 'accepted'
    });
  });

  it('rejects a text FBX even when a browser file picker describes it as an FBX file', () => {
    const fileBytes = asciiBytes('; FBX 7.4.0 project file');

    expect(preflightStaticFbxImport(fileBytes)).toEqual({
      kind: 'rejected',
      reasonCode: 'FBX_BINARY_HEADER_REQUIRED'
    });
  });

  it('requires every byte of the binary magic, not just a matching prefix', () => {
    const fileBytes = binaryFbx(7400);
    fileBytes[8] = 0x00;

    expect(preflightStaticFbxImport(fileBytes)).toEqual({
      kind: 'rejected',
      reasonCode: 'FBX_BINARY_HEADER_REQUIRED'
    });
  });

  it('rejects an unknown binary FBX version before a converter can touch its scene data', () => {
    expect(preflightStaticFbxImport(binaryFbx(9999))).toEqual({
      kind: 'rejected',
      reasonCode: 'UNSUPPORTED_FBX_VERSION'
    });
  });

  it('rejects a file above the hard ingress byte budget before inspecting its header', () => {
    const fileBytes = binaryFbx(7400, 12 * 1024 * 1024);

    expect(preflightStaticFbxImport(fileBytes)).toEqual({
      kind: 'rejected',
      reasonCode: 'FBX_FILE_BYTES_LIMIT'
    });
  });

  it('warns about a large but still allowed single-item FBX before it enters the converter', () => {
    const fileBytes = binaryFbx(7400, 8 * 1024 * 1024 - binaryHeader.length - 3);

    expect(preflightStaticFbxImport(fileBytes)).toEqual({
      fbxVersion: 7400,
      inputBytes: 8 * 1024 * 1024 + 1,
      kind: 'accepted',
      warningCode: 'FBX_LARGE_FILE'
    });
  });

  it('accepts a file exactly at the hard ingress byte budget', () => {
    const fileBytes = binaryFbx(7400, 12 * 1024 * 1024 - binaryHeader.length - 4);

    expect(preflightStaticFbxImport(fileBytes)).toEqual({
      fbxVersion: 7400,
      inputBytes: 12 * 1024 * 1024,
      kind: 'accepted',
      warningCode: 'FBX_LARGE_FILE'
    });
  });
});
