import type { DurablePublicationCandidate } from './ports';

/**
 * The hard resource envelope from Project & Portable Backup Contract §1.
 * Session history uses the same ceiling so no existing undo/redo root is
 * silently discarded to make room for a prospective command.
 */
export const alphaSessionRetentionLimits = {
  maxResourceBytes: 180 * 1024 * 1024,
  maxResourceEntries: 900
} as const;

export interface SessionRetentionLimits {
  readonly maxResourceBytes: number;
  readonly maxResourceEntries: number;
}

export interface SessionRetentionAssessmentInput {
  readonly current: DurablePublicationCandidate;
  readonly limits?: SessionRetentionLimits;
  readonly prospective: DurablePublicationCandidate;
  readonly redo: readonly DurablePublicationCandidate[];
  readonly undo: readonly DurablePublicationCandidate[];
}

export type SessionRetentionDecision =
  | {
      readonly kind: 'accepted';
      readonly resourceBytes: number;
      readonly resourceEntries: number;
    }
  | {
      readonly kind: 'rejected';
      readonly limit: number;
      readonly measured: number;
      readonly metric: 'resource-bytes' | 'resource-entries';
      readonly reasonCode: 'PROJECT_HISTORY_RESOURCE_LIMIT';
    };

/**
 * Evaluates a prospective command against every active history root. This
 * function deliberately does not alter the input stacks: branch replacement
 * remains an atomic post-publication controller transition.
 */
export function assessSessionRetention(
  input: SessionRetentionAssessmentInput
): SessionRetentionDecision {
  const limits = input.limits ?? alphaSessionRetentionLimits;
  const resources = new Map<string, number>();

  for (const candidate of [input.current, ...input.undo, ...input.redo, input.prospective]) {
    for (const definition of candidate.project.assetDefinitionRefs) {
      const existingByteLength = resources.get(definition.resourceHash);

      // A digest addresses immutable bytes. If a corrupt in-memory fixture
      // claims different lengths for the same digest, retain the larger value
      // so admission never understates the retained resource envelope.
      resources.set(
        definition.resourceHash,
        Math.max(existingByteLength ?? 0, definition.byteLength)
      );
    }
  }

  const resourceEntries = resources.size;
  const resourceBytes = [...resources.values()].reduce((total, byteLength) => total + byteLength, 0);

  if (resourceEntries > limits.maxResourceEntries) {
    return {
      kind: 'rejected',
      limit: limits.maxResourceEntries,
      measured: resourceEntries,
      metric: 'resource-entries',
      reasonCode: 'PROJECT_HISTORY_RESOURCE_LIMIT'
    };
  }

  if (resourceBytes > limits.maxResourceBytes) {
    return {
      kind: 'rejected',
      limit: limits.maxResourceBytes,
      measured: resourceBytes,
      metric: 'resource-bytes',
      reasonCode: 'PROJECT_HISTORY_RESOURCE_LIMIT'
    };
  }

  return { kind: 'accepted', resourceBytes, resourceEntries };
}
