import { describe, expect, it } from '@rstest/core';

import { DurableProjectRepository, MemoryVersionedProjectStore } from '../adapters/persistence/durable-project-repository';
import { encodeLocalProjectJson } from '../domain/project-json-transfer';
import type { Project } from '../domain/project';
import { canonicalProjectSerializer } from './create-project';
import { ImportLocalProjectJsonUseCase } from './import-local-project-json';

function asciiBytes(value: string): Uint8Array {
  return new Uint8Array(Array.from(value, (character) => character.charCodeAt(0)));
}

function sourceProject(): Project {
  return {
    assetDefinitionRefs: [],
    assetInstances: [],
    createdAt: '2026-08-15T10:00:00.000Z',
    level: { levelId: 'source-level', openings: [], rooms: [], vertices: [], wallSegments: [] },
    lifecycle: 'active',
    name: 'Transfer plan',
    projectId: 'source-project',
    schemaVersion: 1,
    updatedAt: '2026-08-15T10:00:00.000Z'
  };
}

const checksum = async (value: string): Promise<string> => `checksum:${value.length}`;

describe('ImportLocalProjectJsonUseCase', () => {
  it('publishes a validated transfer as a separate Project and leaves the source identity in the file untouched', async () => {
    const store = new MemoryVersionedProjectStore();
    const repository = new DurableProjectRepository(store, checksum);
    const file = await encodeLocalProjectJson(sourceProject(), checksum);
    const useCase = new ImportLocalProjectJsonUseCase({
      checksum: { sha256: checksum },
      clock: { now: () => '2026-08-15T11:00:00.000Z' },
      ids: { next: (() => { const values = ['imported-project', 'imported-revision']; return () => values.shift() ?? 'unexpected-id'; })() },
      repository,
      serializer: canonicalProjectSerializer
    });
    const statuses: string[] = [];

    const result = await useCase.execute(asciiBytes(file), (status) => statuses.push(status.kind));

    expect(result).toEqual({
      kind: 'durable',
      projectId: 'imported-project',
      revisionId: 'imported-revision'
    });
    expect(statuses).toEqual(['saving', 'saved']);
    await expect(repository.loadProject('source-project')).resolves.toEqual({ kind: 'empty' });
    await expect(repository.loadProject('imported-project')).resolves.toEqual({
      kind: 'durable',
      candidate: expect.objectContaining({
        project: expect.objectContaining({
          createdAt: '2026-08-15T10:00:00.000Z',
          projectId: 'imported-project',
          updatedAt: '2026-08-15T11:00:00.000Z'
        }),
        revision: expect.objectContaining({ projectId: 'imported-project', revisionId: 'imported-revision' })
      })
    });
  });

  it('does not write a staging record for an invalid file', async () => {
    const store = new MemoryVersionedProjectStore();
    const repository = new DurableProjectRepository(store, checksum);
    const useCase = new ImportLocalProjectJsonUseCase({
      checksum: { sha256: checksum },
      clock: { now: () => '2026-08-15T11:00:00.000Z' },
      ids: { next: () => 'must-not-be-used' },
      repository,
      serializer: canonicalProjectSerializer
    });

    await expect(useCase.execute(asciiBytes('{"not":"a project"}'), () => undefined)).resolves.toEqual({
      kind: 'rejected',
      reasonCode: 'PROJECT_JSON_INVALID'
    });
    await expect(repository.listProjects()).resolves.toEqual({ kind: 'empty' });
    expect(store.events()).toEqual([]);
  });
});
