import { describe, expect, it } from '@rstest/core';

import { convertStaticFbxToGlb } from './fbx-to-glb-converter';

const binaryHeader = [
  0x4b, 0x61, 0x79, 0x64, 0x61, 0x72, 0x61, 0x20, 0x46, 0x42, 0x58, 0x20,
  0x42, 0x69, 0x6e, 0x61, 0x72, 0x79, 0x20, 0x20, 0x00, 0x1a, 0x00
] as const;
const maximumPortableGlbBytes = 25 * 1024 * 1024;

function binaryFbx(version = 7400): Uint8Array {
  const bytes = new Uint8Array(binaryHeader.length + 4);
  bytes.set(binaryHeader);
  new DataView(bytes.buffer).setUint32(binaryHeader.length, version, true);
  return bytes;
}

class FakeFbxConversionWorker {
  public disposed = false;
  public request: unknown;
  private readonly errorListeners = new Set<(event: ErrorEvent) => void>();
  private readonly messageListeners = new Set<(event: MessageEvent<unknown>) => void>();

  public addEventListener(
    type: 'error' | 'message',
    listener: ((event: ErrorEvent) => void) | ((event: MessageEvent<unknown>) => void)
  ): void {
    if (type === 'error') {
      this.errorListeners.add(listener as (event: ErrorEvent) => void);
      return;
    }
    this.messageListeners.add(listener as (event: MessageEvent<unknown>) => void);
  }

  public emitError(): void {
    this.errorListeners.forEach((listener) => {
      listener({} as ErrorEvent);
    });
  }

  public emitMessage(data: unknown): void {
    this.messageListeners.forEach((listener) => {
      listener({ data } as MessageEvent<unknown>);
    });
  }

  public postMessage(message: unknown): void {
    this.request = message;
  }

  public removeEventListener(
    type: 'error' | 'message',
    listener: ((event: ErrorEvent) => void) | ((event: MessageEvent<unknown>) => void)
  ): void {
    if (type === 'error') {
      this.errorListeners.delete(listener as (event: ErrorEvent) => void);
      return;
    }
    this.messageListeners.delete(listener as (event: MessageEvent<unknown>) => void);
  }

  public terminate(): void {
    this.disposed = true;
  }
}

describe('convertStaticFbxToGlb', () => {
  it('rejects an inadmissible file before creating a Worker', async () => {
    let workerWasCreated = false;

    await expect(
      convertStaticFbxToGlb(new Uint8Array([1, 2, 3]), {
        createWorker: () => {
          workerWasCreated = true;
          return new FakeFbxConversionWorker();
        }
      })
    ).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'FBX_BINARY_HEADER_REQUIRED'
    });

    expect(workerWasCreated).toBe(false);
  });

  it('uses one disposable Worker and returns only its GLB output', async () => {
    const worker = new FakeFbxConversionWorker();
    const conversion = convertStaticFbxToGlb(binaryFbx(), {
      createWorker: () => worker
    });

    expect(worker.request).toMatchObject({ kind: 'convert-static-fbx' });
    worker.emitMessage({
      glbBytes: new Uint8Array([0x67, 0x6c, 0x54, 0x46]).buffer,
      kind: 'converted'
    });

    await expect(conversion).resolves.toEqual({
      fbxVersion: 7400,
      glbBytes: new Uint8Array([0x67, 0x6c, 0x54, 0x46]),
      inputBytes: binaryFbx().byteLength,
      kind: 'converted'
    });
    expect(worker.disposed).toBe(true);
  });

  it('passes selected local texture sidecars to the isolated converter without a URL', async () => {
    const worker = new FakeFbxConversionWorker();
    const conversion = convertStaticFbxToGlb(binaryFbx(), {
      createWorker: () => worker,
      sidecarResources: [
        {
          bytes: new Uint8Array([137, 80, 78, 71]),
          mimeType: 'image/png',
          name: 'chair-albedo.png'
        }
      ]
    });

    expect(worker.request).toMatchObject({
      kind: 'convert-static-fbx',
      sidecarResources: [{ mimeType: 'image/png', name: 'chair-albedo.png' }]
    });
    worker.emitMessage({
      glbBytes: new Uint8Array([0x67, 0x6c, 0x54, 0x46]).buffer,
      kind: 'converted'
    });

    await expect(conversion).resolves.toMatchObject({ kind: 'converted' });
    expect(worker.disposed).toBe(true);
  });

  it('rejects an image selection that exceeds the remaining mobile import budget before starting a Worker', async () => {
    let workerWasCreated = false;

    await expect(
      convertStaticFbxToGlb(binaryFbx(), {
        createWorker: () => {
          workerWasCreated = true;
          return new FakeFbxConversionWorker();
        },
        sidecarResources: [
          {
            bytes: new Uint8Array(13 * 1024 * 1024 + 1),
            mimeType: 'image/jpeg',
            name: 'oversized-albedo.jpg'
          }
        ]
      })
    ).resolves.toEqual({ kind: 'rejected', reasonCode: 'FBX_SIDECAR_BYTES_LIMIT' });

    expect(workerWasCreated).toBe(false);
  });

  it('allows selected textures exactly at the remaining mobile import budget', async () => {
    const worker = new FakeFbxConversionWorker();
    const conversion = convertStaticFbxToGlb(binaryFbx(), {
      createWorker: () => worker,
      sidecarResources: [
        {
          bytes: new Uint8Array(13 * 1024 * 1024),
          mimeType: 'image/jpeg',
          name: 'albedo-at-limit.jpg'
        }
      ]
    });
    worker.emitMessage({
      glbBytes: new Uint8Array([0x67, 0x6c, 0x54, 0x46]).buffer,
      kind: 'converted'
    });

    await expect(conversion).resolves.toMatchObject({ kind: 'converted' });
    expect(worker.disposed).toBe(true);
  });

  it('returns a stable worker rejection without changing project state', async () => {
    const worker = new FakeFbxConversionWorker();
    const conversion = convertStaticFbxToGlb(binaryFbx(), {
      createWorker: () => worker
    });
    worker.emitMessage({ kind: 'rejected', reasonCode: 'FBX_EXTERNAL_RESOURCE' });

    await expect(conversion).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'FBX_EXTERNAL_RESOURCE'
    });
    expect(worker.disposed).toBe(true);
  });

  it('does not retain a converted result whose byte budget is exceeded', async () => {
    const worker = new FakeFbxConversionWorker();
    const conversion = convertStaticFbxToGlb(binaryFbx(), {
      createWorker: () => worker
    });
    worker.emitMessage({
      glbBytes: new Uint8Array(maximumPortableGlbBytes + 1).buffer,
      kind: 'converted'
    });

    await expect(conversion).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'FBX_CONVERSION_OUTPUT_LIMIT'
    });
    expect(worker.disposed).toBe(true);
  });

  it('retains a converted result exactly at the portable output byte budget', async () => {
    const worker = new FakeFbxConversionWorker();
    const conversion = convertStaticFbxToGlb(binaryFbx(), {
      createWorker: () => worker
    });
    const outputBytes = new Uint8Array(maximumPortableGlbBytes);
    worker.emitMessage({ glbBytes: outputBytes.buffer, kind: 'converted' });

    const result = await conversion;

    expect(result.kind).toBe('converted');
    if (result.kind === 'converted') {
      expect(result.glbBytes.byteLength).toBe(maximumPortableGlbBytes);
    }
    expect(worker.disposed).toBe(true);
  });

  it('terminates conversion immediately when the user cancels', async () => {
    const abortController = new AbortController();
    const worker = new FakeFbxConversionWorker();
    const conversion = convertStaticFbxToGlb(binaryFbx(), {
      createWorker: () => worker,
      signal: abortController.signal
    });

    abortController.abort();

    await expect(conversion).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'FBX_CONVERSION_CANCELLED'
    });
    expect(worker.disposed).toBe(true);
  });

  it('turns an unclassified worker failure into a stable retryable rejection', async () => {
    const worker = new FakeFbxConversionWorker();
    const conversion = convertStaticFbxToGlb(binaryFbx(), {
      createWorker: () => worker
    });
    worker.emitError();

    await expect(conversion).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'FBX_CONVERSION_FAILED'
    });
    expect(worker.disposed).toBe(true);
  });

  it('terminates a converter that exceeds its finite processing deadline', async () => {
    const worker = new FakeFbxConversionWorker();

    await expect(
      convertStaticFbxToGlb(binaryFbx(), {
        createWorker: () => worker,
        timeoutMs: 0
      })
    ).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'FBX_CONVERSION_TIMEOUT'
    });

    expect(worker.disposed).toBe(true);
  });
});
