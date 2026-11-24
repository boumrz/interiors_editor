import { describe, expect, it } from '@rstest/core';

import {
  AddDoorOpeningToProjectUseCase,
  AddWindowOpeningToProjectUseCase,
  DeleteDoorOpeningFromProjectUseCase,
  MoveDoorOpeningInProjectUseCase,
  UpdateDoorOpeningInProjectUseCase
} from './door-opening-project';
import { canonicalProjectSerializer } from './create-project';
import type { DurablePublicationCandidate, PublicationCandidate } from './ports';
import { createInitialProject } from '../domain/initial-project';
import { configureRectangularRoom } from '../domain/rectangular-room';
import { addWindowOpeningToProject } from '../domain/door-opening-project';
import { createParametricWallItem } from '../domain/parametric-wall-item';

function ids(...values: string[]) {
  let index = 0;
  return { next: () => values[index++] ?? `unexpected-${index}` };
}

function baseCandidate(): PublicationCandidate {
  const room = configureRectangularRoom(
    createInitialProject({ createdAt: '2026-08-12T10:00:00.000Z', levelId: 'level-1', name: 'План', projectId: 'project-1' }),
    { depthMm: '3000', heightMm: '2600', widthMm: '4000' },
    ids('v-1', 'v-2', 'v-3', 'v-4', 'wall-1', 'wall-2', 'wall-3', 'wall-4', 'room-1'),
    '2026-08-12T10:01:00.000Z'
  );
  if (room.kind !== 'accepted') {
    throw new Error('Expected room fixture');
  }
  return {
    project: room.project,
    revision: {
      checksum: 'base', createdAt: room.project.updatedAt, projectId: 'project-1', revisionId: 'revision-1', schemaVersion: 1,
      serializedProject: canonicalProjectSerializer.serialize(room.project)
    }
  };
}

function candidateWithDoor(): PublicationCandidate {
  const base = baseCandidate();
  const project = {
    ...base.project,
    level: {
      ...base.project.level,
      openings: [{ heightMm: 2100, kind: 'Door' as const, offsetMm: 2050, openingId: 'door-1', sillMm: 0, wallSegmentId: 'wall-1', widthMm: 900 }]
    }
  };
  return {
    project,
    revision: { ...base.revision, serializedProject: canonicalProjectSerializer.serialize(project) }
  };
}

function candidateWithWindows(sills: readonly number[], addPanel = false): PublicationCandidate {
  const base = baseCandidate();
  const withWindows = sills.reduce((project, sillMm, index) => {
    const added = addWindowOpeningToProject(project, {
      heightMm: 600, offsetMm: 550 + index * 950, sillMm, wallSegmentId: 'wall-1', widthMm: 600
    }, ids(`window-${index + 1}`), project.updatedAt);
    if (added.kind !== 'accepted') throw new Error('Expected valid window fixture');
    return added.project;
  }, base.project);
  const panel = addPanel ? createParametricWallItem(withWindows, {
    color: '#416b91', depthMm: 50, elevationMm: 1300, heightMm: 100,
    label: 'Панель', offsetMm: 1500, side: 'left', wallSegmentId: 'wall-1', widthMm: 300
  }, ids('panel-1'), withWindows.updatedAt) : undefined;
  if (panel?.kind === 'rejected') throw new Error('Expected panel above existing window');
  const project = panel?.project ?? withWindows;
  return { project, revision: { ...base.revision, serializedProject: canonicalProjectSerializer.serialize(project) } };
}

const alignWindows = { kind: 'align-matching-windows', openingId: 'window-1' } as const;

function dependencies(idsPort = ids('door-1', 'revision-2')) {
  return {
    checksum: { sha256: async () => 'sum:door' },
    clock: { now: () => '2026-08-12T10:02:00.000Z' },
    ids: idsPort,
    repository: {
      publishNextRevision: async () => ({ kind: 'durable' as const })
    },
    serializer: canonicalProjectSerializer
  };
}

describe('door opening Project use cases', () => {
	it('publishes one fenced revision with both corrected window sills', async () => {
		const publications: { candidate: DurablePublicationCandidate; baseId: string }[] = [];
		const statuses: string[] = [];
		const base = candidateWithWindows([300, 600]);
		const update = new UpdateDoorOpeningInProjectUseCase({
			...dependencies(ids('aligned-revision')),
			repository: {
				publishNextRevision: async (candidate, baseId) => {
					publications.push({ candidate, baseId });
					return { kind: 'durable' };
				}
			}
		});
		await expect(update.execute(base, alignWindows, ({ kind }) => statuses.push(kind)))
			.resolves.toEqual({ kind: 'durable', projectId: 'project-1', revisionId: 'aligned-revision' });
		expect(statuses).toEqual(['saving', 'saved']);
		expect(publications.map(({ baseId, candidate }) => ({
			baseId, sills: candidate.project.level.openings.map(({ sillMm }) => sillMm)
		}))).toEqual([{ baseId: 'revision-1', sills: [900, 900] }]);
		expect(base.project.level.openings.map(({ sillMm }) => sillMm)).toEqual([300, 600]);
	});

	it('allocates no revision on a collision or when another update already aligned the pair', async () => {
		const update = new UpdateDoorOpeningInProjectUseCase({
			...dependencies({ next: () => { throw new Error('Must not allocate a revision'); } }),
			repository: { publishNextRevision: async () => { throw new Error('Must not publish a revision'); } }
		});
		const notify = () => { throw new Error('Must not change save status'); };
		await expect(update.execute(candidateWithWindows([300, 600], true), alignWindows, notify))
			.resolves.toEqual({ kind: 'rejected', reasonCode: 'WALL_OPENING_COLLISION' });
		await expect(update.execute(candidateWithWindows([300, 300]), alignWindows, notify))
			.resolves.toEqual({ kind: 'unchanged' });
	});

	it('keeps a stale Door candidate out of durable history', async () => {
		const expectedBaseRevisionIds: string[] = [];
		let unconditionalPublishes = 0;
		const statuses: string[] = [];
		const repository = {
			loadCurrent: async () => ({ kind: 'empty' as const }),
			publish: async () => {
				unconditionalPublishes += 1;
				return { kind: 'durable' as const };
			},
			publishNextRevision: async (
				_candidate: import('./ports').PublicationCandidate,
				expectedBaseRevisionId: string,
			) => {
				expectedBaseRevisionIds.push(expectedBaseRevisionId);
				return { kind: 'stale-base' as const };
			},
			recover: async () => ({ kind: 'recovered' as const })
		};
		const useCase = new AddDoorOpeningToProjectUseCase({
			...dependencies(),
			repository
		});

		await expect(useCase.execute(
			baseCandidate(),
			{ heightMm: 2100, offsetMm: 2050, sillMm: 0, wallSegmentId: 'wall-1', widthMm: 900 },
			(status) => statuses.push(status.kind)
		)).resolves.toEqual({ kind: 'stale-base', reasonCode: 'STALE_BASE_REVISION' });

		expect(expectedBaseRevisionIds).toEqual(['revision-1']);
		expect(unconditionalPublishes).toBe(0);
		expect(statuses).toEqual(['saving', 'stale-base']);
	});

	it('uses the exact base revision for moved and edited Doors', async () => {
		const expectedBaseRevisionIds: string[] = [];
		const repository = {
			publishNextRevision: async (
				_candidate: import('./ports').PublicationCandidate,
				expectedBaseRevisionId: string,
			) => {
				expectedBaseRevisionIds.push(expectedBaseRevisionId);
				return { kind: 'durable' as const };
			}
		};
		const base = candidateWithDoor();
		const move = new MoveDoorOpeningInProjectUseCase({
			...dependencies(ids('revision-move')),
			repository
		});
		const update = new UpdateDoorOpeningInProjectUseCase({
			...dependencies(ids('revision-update')),
			repository
		});

		await expect(move.execute(base, { openingId: 'door-1', offsetMm: 1800 }, () => undefined))
			.resolves.toEqual({ kind: 'durable', projectId: 'project-1', revisionId: 'revision-move' });
		await expect(update.execute(base, { openingId: 'door-1', swingSide: 'right', widthMm: 1000 }, () => undefined))
			.resolves.toEqual({ kind: 'durable', projectId: 'project-1', revisionId: 'revision-update' });

		expect(expectedBaseRevisionIds).toEqual(['revision-1', 'revision-1']);
	});

	it('rejects an invalid Door before allocating or publishing a revision', async () => {
		let allocations = 0;
		let publications = 0;
		const useCase = new AddDoorOpeningToProjectUseCase({
			...dependencies({
				next: () => {
					allocations += 1;
					return 'unexpected';
				}
			}),
			repository: {
				publishNextRevision: async () => {
					publications += 1;
					return { kind: 'durable' as const };
				}
			}
		});

		await expect(useCase.execute(
			baseCandidate(),
			{ heightMm: 2100, offsetMm: 2050, sillMm: 0, wallSegmentId: 'wall-1', widthMm: 799 },
			() => undefined
		)).resolves.toEqual({ kind: 'rejected', reasonCode: 'DOOR_WIDTH_BELOW_MINIMUM' });

		expect(allocations).toBe(0);
		expect(publications).toBe(0);
	});

	it('reports an exact-base persistence failure without pretending that a Door is saved', async () => {
		const statuses: string[] = [];
		const useCase = new AddDoorOpeningToProjectUseCase({
			...dependencies(),
			repository: {
				publishNextRevision: async () => ({
					kind: 'persist-failed' as const,
					reasonCode: 'PERSISTENCE_WRITE_FAILED' as const
				})
			}
		});

		await expect(useCase.execute(
			baseCandidate(),
			{ heightMm: 2100, offsetMm: 2050, sillMm: 0, wallSegmentId: 'wall-1', widthMm: 900 },
			(status) => statuses.push(status.kind)
		)).resolves.toEqual({ kind: 'persist-failed', reasonCode: 'PERSISTENCE_WRITE_FAILED' });

		expect(statuses).toEqual(['saving', 'persist-failed']);
	});

	it('publishes a wall-hosted window through the durable revision boundary', async () => {
		const published: import('./ports').DurablePublicationCandidate[] = [];
		const dependencySet = dependencies(ids('window-1', 'revision-2'));
		const useCase = new AddWindowOpeningToProjectUseCase({
			...dependencySet,
			repository: { ...dependencySet.repository, publishNextRevision: async (candidate) => { published.push(candidate); return { kind: 'durable' as const }; } }
		});

		await expect(useCase.execute(
			baseCandidate(),
			{ heightMm: 1200, offsetMm: 2050, sillMm: 900, wallSegmentId: 'wall-1', widthMm: 1200 },
			() => undefined
		)).resolves.toEqual({ kind: 'durable', projectId: 'project-1', revisionId: 'revision-2' });
		expect(published[0]?.project.level.openings).toEqual([
			expect.objectContaining({ kind: 'Window', openingId: 'window-1', wallSegmentId: 'wall-1' })
		]);
	});

  it('publishes a selected wall-hosted door through the same durable revision boundary', async () => {
    const published: import('./ports').DurablePublicationCandidate[] = [];
    const statuses: string[] = [];
    const dependencySet = dependencies();
    const useCase = new AddDoorOpeningToProjectUseCase({
      ...dependencySet,
      repository: { ...dependencySet.repository, publishNextRevision: async (candidate) => { published.push(candidate); return { kind: 'durable' as const }; } }
    });

    await expect(useCase.execute(
      baseCandidate(),
      { heightMm: 2100, offsetMm: 2050, sillMm: 0, wallSegmentId: 'wall-1', widthMm: 900 },
      (status) => statuses.push(status.kind)
    )).resolves.toEqual({ kind: 'durable', projectId: 'project-1', revisionId: 'revision-2' });
    expect(published[0]?.project.level.openings).toEqual([
      expect.objectContaining({ kind: 'Door', openingId: 'door-1', wallSegmentId: 'wall-1' })
    ]);
    expect(statuses).toEqual(['saving', 'saved']);
  });

  it('can publish removal of one selected doorway', async () => {
    const added = new AddDoorOpeningToProjectUseCase(dependencies()).execute(
      baseCandidate(),
      { heightMm: 2100, offsetMm: 2050, sillMm: 0, wallSegmentId: 'wall-1', widthMm: 900 },
      () => undefined
    );
    await expect(added).resolves.toEqual({ kind: 'durable', projectId: 'project-1', revisionId: 'revision-2' });

    const candidate = candidateWithDoor();
    const published: import('./ports').DurablePublicationCandidate[] = [];
    const useCase = new DeleteDoorOpeningFromProjectUseCase({
      ...dependencies(ids('revision-3')),
      repository: {
        publishNextRevision: async (next) => { published.push(next); return { kind: 'durable' as const }; }
      }
    });

    await expect(useCase.execute(candidate, { openingId: 'door-1' }, () => undefined))
      .resolves.toEqual({ kind: 'durable', projectId: 'project-1', revisionId: 'revision-3' });
    expect(published[0]?.project.level.openings).toEqual([]);
  });
});
