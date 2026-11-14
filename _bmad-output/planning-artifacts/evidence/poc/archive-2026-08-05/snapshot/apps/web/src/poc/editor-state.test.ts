import { describe, expect, it } from '@rstest/core';

import { createDemoEditorState, reduceEditorState } from './editor-state';

describe('phone POC editor flow', () => {
  it('starts from an explicit source-controlled demo state', () => {
    expect(createDemoEditorState()).toEqual({
      inAppFocus: false,
      notice: 'POC · demo data · not saved',
      selectedTool: 'select',
      wallCount: 8
    });
  });

  it('adds a divider to the ephemeral demo plan after the matching tool is selected', () => {
    const initial = reduceEditorState(createDemoEditorState(), {
      type: 'select-tool',
      tool: 'divider'
    });

    const next = reduceEditorState(initial, { type: 'add-divider' });

    expect(next.wallCount).toBe(initial.wallCount + 1);
    expect(next.selectedTool).toBe('divider');
    expect(next.notice).toBe('Перегородка добавлена только в эту сессию');
  });

  it('keeps the one-divider demo bounded when the matching action is repeated', () => {
    const withDividerTool = reduceEditorState(createDemoEditorState(), {
      type: 'select-tool',
      tool: 'divider'
    });
    const once = reduceEditorState(withDividerTool, { type: 'add-divider' });
    const twice = reduceEditorState(once, { type: 'add-divider' });

    expect(twice).toEqual(once);
    expect(twice.wallCount).toBe(9);
  });

  it('enters and exits InApp Focus without changing the selected tool or demo plan', () => {
    const beforeFocus = reduceEditorState(
      reduceEditorState(createDemoEditorState(), {
        type: 'select-tool',
        tool: 'object'
      }),
      { type: 'add-divider' }
    );

    const focused = reduceEditorState(beforeFocus, { type: 'enter-focus' });
    const afterExit = reduceEditorState(focused, { type: 'exit-focus' });

    expect(focused.inAppFocus).toBe(true);
    expect(afterExit.inAppFocus).toBe(false);
    expect(afterExit.selectedTool).toBe('object');
    expect(afterExit.wallCount).toBe(beforeFocus.wallCount);
  });

  it('keeps the demo plan unchanged until the divider tool is selected', () => {
    const initial = createDemoEditorState();
    const blocked = reduceEditorState(initial, { type: 'add-divider' });
    const recovered = reduceEditorState(
      reduceEditorState(blocked, { type: 'select-tool', tool: 'divider' }),
      { type: 'add-divider' }
    );

    expect(blocked.wallCount).toBe(initial.wallCount);
    expect(blocked.notice).toBe('Выберите инструмент «Перегородка»');
    expect(recovered.wallCount).toBe(initial.wallCount + 1);
  });
});
