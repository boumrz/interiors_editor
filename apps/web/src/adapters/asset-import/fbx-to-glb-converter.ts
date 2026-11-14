import {
  preflightStaticFbxImport,
  type StaticFbxImportPreflight
} from '../../domain/fbx-import-preflight';
import type { FbxSidecarResource } from './fbx-bundle-import';

const MAXIMUM_FBX_CONVERSION_OUTPUT_BYTES = 25 * 1024 * 1024;
const MAXIMUM_FBX_SIDECAR_BYTES = 13 * 1024 * 1024;
const DEFAULT_FBX_CONVERSION_TIMEOUT_MS = 15_000;

export type FbxConversionReasonCode =
  | 'FBX_BINARY_HEADER_REQUIRED'
  | 'FBX_CONVERSION_CANCELLED'
  | 'FBX_CONVERSION_FAILED'
  | 'FBX_CONVERSION_OUTPUT_LIMIT'
  | 'FBX_CONVERSION_TIMEOUT'
  | 'FBX_EXTERNAL_RESOURCE'
  | 'FBX_FILE_BYTES_LIMIT'
  | 'FBX_SIDECAR_BYTES_LIMIT'
  | 'FBX_UNSUPPORTED_SCENE_CONTENT'
  | 'UNSUPPORTED_FBX_VERSION';

export type StaticFbxConversionResult =
  | {
      readonly fbxVersion: number;
      readonly glbBytes: Uint8Array;
      readonly inputBytes: number;
      readonly kind: 'converted';
      readonly warningCode?: 'FBX_LARGE_FILE';
    }
  | { readonly kind: 'rejected'; readonly reasonCode: FbxConversionReasonCode };

interface ConvertStaticFbxWorkerRequest {
  readonly kind: 'convert-static-fbx';
  readonly sidecarResources: readonly {
    readonly bytes: ArrayBuffer;
    readonly mimeType: FbxSidecarResource['mimeType'];
    readonly name: string;
  }[];
  readonly sourceBytes: ArrayBuffer;
}

type ConvertStaticFbxWorkerResponse =
  | { readonly glbBytes: ArrayBuffer; readonly kind: 'converted' }
  | {
      readonly kind: 'rejected';
      readonly reasonCode:
        | 'FBX_CONVERSION_FAILED'
        | 'FBX_CONVERSION_OUTPUT_LIMIT'
        | 'FBX_EXTERNAL_RESOURCE'
        | 'FBX_UNSUPPORTED_SCENE_CONTENT';
    };

interface FbxConversionWorkerPort {
  addEventListener(
    type: 'error' | 'message',
    listener: ((event: ErrorEvent) => void) | ((event: MessageEvent<unknown>) => void)
  ): void;
  postMessage(message: ConvertStaticFbxWorkerRequest, transfer: Transferable[]): void;
  removeEventListener(
    type: 'error' | 'message',
    listener: ((event: ErrorEvent) => void) | ((event: MessageEvent<unknown>) => void)
  ): void;
  terminate(): void;
}

export interface ConvertStaticFbxOptions {
  readonly createWorker?: () => FbxConversionWorkerPort;
  readonly sidecarResources?: readonly FbxSidecarResource[];
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

export async function convertStaticFbxToGlb(
  sourceBytes: Uint8Array,
  options: ConvertStaticFbxOptions = {}
): Promise<StaticFbxConversionResult> {
  const preflight = preflightStaticFbxImport(sourceBytes);
  if (preflight.kind === 'rejected') {
    return preflight;
  }
  if (options.signal?.aborted) {
    return { kind: 'rejected', reasonCode: 'FBX_CONVERSION_CANCELLED' };
  }

  const sidecarResources = options.sidecarResources ?? [];
  if (
    sidecarResources.reduce((total, resource) => total + resource.bytes.byteLength, 0) >
    MAXIMUM_FBX_SIDECAR_BYTES
  ) {
    return { kind: 'rejected', reasonCode: 'FBX_SIDECAR_BYTES_LIMIT' };
  }

  const worker = (options.createWorker ?? createBrowserFbxConversionWorker)();
  const sourceCopy = sourceBytes.slice();
  const sidecarCopies = sidecarResources.map((resource) => ({
    bytes: resource.bytes.slice().buffer,
    mimeType: resource.mimeType,
    name: resource.name
  }));
  const timeoutMs = Math.max(0, options.timeoutMs ?? DEFAULT_FBX_CONVERSION_TIMEOUT_MS);
  return new Promise((resolve) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (timeout !== undefined) clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
      worker.removeEventListener('error', error);
      worker.removeEventListener('message', message);
      worker.terminate();
    };
    const finish = (result: StaticFbxConversionResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    const abort = () =>
      finish({ kind: 'rejected', reasonCode: 'FBX_CONVERSION_CANCELLED' });
    const error = () =>
      finish({ kind: 'rejected', reasonCode: 'FBX_CONVERSION_FAILED' });
    const message = (event: MessageEvent<unknown>) => {
      const response = parseWorkerResponse(event.data);
      if (!response) {
        error();
        return;
      }
      if (response.kind === 'rejected') {
        finish(response);
        return;
      }
      if (response.glbBytes.byteLength > MAXIMUM_FBX_CONVERSION_OUTPUT_BYTES) {
        finish({ kind: 'rejected', reasonCode: 'FBX_CONVERSION_OUTPUT_LIMIT' });
        return;
      }
      finish(convertedResult(preflight, new Uint8Array(response.glbBytes)));
    };

    worker.addEventListener('error', error);
    worker.addEventListener('message', message);
    options.signal?.addEventListener('abort', abort, { once: true });
    timeout = setTimeout(
      () => finish({ kind: 'rejected', reasonCode: 'FBX_CONVERSION_TIMEOUT' }),
      timeoutMs
    );
    try {
      worker.postMessage(
        {
          kind: 'convert-static-fbx',
          sidecarResources: sidecarCopies,
          sourceBytes: sourceCopy.buffer
        },
        [sourceCopy.buffer, ...sidecarCopies.map((resource) => resource.bytes)]
      );
    } catch {
      error();
    }
  });
}

function convertedResult(
  preflight: Extract<StaticFbxImportPreflight, { readonly kind: 'accepted' }>,
  glbBytes: Uint8Array
): StaticFbxConversionResult {
  return {
    fbxVersion: preflight.fbxVersion,
    glbBytes,
    inputBytes: preflight.inputBytes,
    kind: 'converted',
    ...(preflight.warningCode ? { warningCode: preflight.warningCode } : {})
  };
}

function createBrowserFbxConversionWorker(): FbxConversionWorkerPort {
  return new Worker(new URL('./fbx-to-glb.worker.ts', import.meta.url), {
    name: 'interiors-fbx-to-glb',
    type: 'module'
  });
}

function parseWorkerResponse(value: unknown): ConvertStaticFbxWorkerResponse | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const response = value as Partial<ConvertStaticFbxWorkerResponse>;
  if (response.kind === 'converted' && response.glbBytes instanceof ArrayBuffer) {
    return { glbBytes: response.glbBytes, kind: 'converted' };
  }
  if (
    response.kind === 'rejected' &&
    (response.reasonCode === 'FBX_CONVERSION_FAILED' ||
      response.reasonCode === 'FBX_CONVERSION_OUTPUT_LIMIT' ||
      response.reasonCode === 'FBX_EXTERNAL_RESOURCE' ||
      response.reasonCode === 'FBX_UNSUPPORTED_SCENE_CONTENT')
  ) {
    return { kind: 'rejected', reasonCode: response.reasonCode };
  }
  return undefined;
}
