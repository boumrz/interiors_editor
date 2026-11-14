export type EditorTool = 'select' | 'divider' | 'object';

export interface EditorState {
  inAppFocus: boolean;
  notice: string;
  selectedTool: EditorTool;
  wallCount: number;
}

export type EditorAction =
  | { type: 'select-tool'; tool: EditorTool }
  | { type: 'add-divider' }
  | { type: 'enter-focus' }
  | { type: 'exit-focus' };

export function createDemoEditorState(): EditorState {
  return {
    inAppFocus: false,
    notice: 'POC · demo data · not saved',
    selectedTool: 'select',
    wallCount: 8
  };
}

export function reduceEditorState(
  state: EditorState,
  action: EditorAction
): EditorState {
  switch (action.type) {
    case 'select-tool':
      return { ...state, selectedTool: action.tool };
    case 'add-divider':
      if (state.selectedTool !== 'divider') {
        return {
          ...state,
          notice: 'Выберите инструмент «Перегородка»'
        };
      }

      if (state.wallCount > 8) {
        return state;
      }

      return {
        ...state,
        notice: 'Перегородка добавлена только в эту сессию',
        wallCount: state.wallCount + 1
      };
    case 'enter-focus':
      return { ...state, inAppFocus: true };
    case 'exit-focus':
      return { ...state, inAppFocus: false };
  }
}
