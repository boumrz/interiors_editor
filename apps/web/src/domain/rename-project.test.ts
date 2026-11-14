import { describe, expect, it } from '@rstest/core';

import { createInitialProject } from './initial-project';
import { renameProject } from './rename-project';

describe('renameProject', () => {
  it('publishes a trimmed name while preserving the opaque identity and every untouched canonical member', () => {
    const source = createInitialProject({
      createdAt: '2026-08-15T14:10:00.000Z',
      levelId: 'level-1',
      name: 'Исходный план',
      projectId: 'project-1'
    });
    const before = JSON.stringify(source);

    expect(renameProject(source, '  План кухни  ', '2026-08-15T14:11:00.000Z')).toEqual({
      kind: 'accepted',
      project: {
        ...source,
        name: 'План кухни',
        updatedAt: '2026-08-15T14:11:00.000Z'
      }
    });
    expect(JSON.stringify(source)).toBe(before);
  });

  it('rejects whitespace rather than producing an unnamed durable Project', () => {
    const source = createInitialProject({
      createdAt: '2026-08-15T14:10:00.000Z',
      levelId: 'level-1',
      name: 'Исходный план',
      projectId: 'project-1'
    });

    expect(renameProject(source, ' \n\t ', '2026-08-15T14:11:00.000Z')).toEqual({
      kind: 'rejected',
      reasonCode: 'PROJECT_NAME_REQUIRED'
    });
  });
});
