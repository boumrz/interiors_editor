import { useReducer } from 'react';

import {
  createDemoEditorState,
  type EditorTool,
  reduceEditorState
} from './editor-state';
import styles from './PocApp.module.css';

const tools: Array<{
  icon: string;
  label: string;
  tool: EditorTool;
}> = [
  { icon: '↖', label: 'Выбор', tool: 'select' },
  { icon: '╋', label: 'Перегородка', tool: 'divider' },
  { icon: '□', label: 'Объект', tool: 'object' }
];

interface PlanCanvasProps {
  dividerVisible: boolean;
  focusMode: boolean;
}

function PlanCanvas({ dividerVisible, focusMode }: PlanCanvasProps) {
  return (
    <div className={styles.planFrame}>
      <div className={styles.planFrameHeader}>
        <span>ПЛАН / 01</span>
        <span>{focusMode ? 'МАСШТАБ 1:50' : 'ДЕМО-СЦЕНА'}</span>
      </div>
      <svg
        aria-label="Демонстрационный план квартиры"
        className={styles.plan}
        role="img"
        viewBox="0 0 360 470"
      >
        <rect className={styles.paper} height="470" width="360" />
        <g className={styles.measurements}>
          <path d="M51 37H309M51 31V43M309 31V43" />
          <text x="156" y="29">8 400 мм</text>
          <path d="M28 64V425M22 64H34M22 425H34" />
          <text transform="rotate(-90 18 282)" x="18" y="282">
            11 200 мм
          </text>
        </g>
        <g className={styles.roomFill}>
          <path d="M52 65H184V225H52Z" />
          <path d="M184 65H309V225H184Z" />
          <path d="M52 225H251V425H52Z" />
          <path d="M251 225H309V425H251Z" />
        </g>
        <g className={styles.walls}>
          <path d="M52 65H309V425H52Z" />
          <path d="M184 65V225M52 225H309M251 225V425M52 340H251" />
          {dividerVisible ? (
            <path data-testid="demo-divider" d="M184 225V340" />
          ) : null}
        </g>
        <g className={styles.doorways}>
          <path d="M78 65V95A30 30 0 0 1 108 65M252 225V255A30 30 0 0 1 282 225" />
          <path d="M52 300H80A28 28 0 0 0 52 328" />
        </g>
        <g className={styles.furniture}>
          <rect height="54" rx="3" width="92" x="72" y="114" />
          <rect height="29" rx="2" width="57" x="211" y="117" />
          <circle cx="239" cy="286" r="27" />
          <rect height="46" rx="2" width="104" x="91" y="365" />
          <rect height="74" rx="2" width="31" x="270" y="281" />
        </g>
        <g className={styles.roomLabels}>
          <text x="93" y="190">ГОСТИНАЯ</text>
          <text x="104" y="207">23.4 м²</text>
          <text x="211" y="185">КУХНЯ</text>
          <text x="216" y="202">8.1 м²</text>
          <text x="103" y="294">СПАЛЬНЯ</text>
          <text x="119" y="311">15.7 м²</text>
          <text x="263" y="388">ХОЛЛ</text>
        </g>
        <g className={styles.scaleMark}>
          <path d="M65 448H125M65 443V453M95 443V453M125 443V453" />
          <text x="65" y="465">2 м</text>
        </g>
      </svg>
    </div>
  );
}

export function PocApp() {
  const [state, dispatch] = useReducer(reduceEditorState, createDemoEditorState());
  const dividerVisible = state.wallCount === 9;
  const selectedToolLabel =
    tools.find(({ tool }) => tool === state.selectedTool)?.label ?? state.selectedTool;

  return (
    <main
      className={`${styles.shell} ${state.inAppFocus ? styles.focusShell : ''}`}
      data-testid={state.inAppFocus ? 'focus-editor' : undefined}
    >
      <header className={styles.header}>
        <div className={styles.brandBlock}>
          <span className={styles.brandMark}>S/01</span>
          <span className={styles.projectName}>Квартира 42</span>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.pocBadge}>POC</span>
          {state.inAppFocus ? (
            <button
              aria-label="Выйти из фокус-режима"
              className={styles.iconButton}
              onClick={() => dispatch({ type: 'exit-focus' })}
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>
          ) : (
            <button
              aria-label="Открыть фокус-режим"
              className={styles.iconButton}
              onClick={() => dispatch({ type: 'enter-focus' })}
              type="button"
            >
              <span aria-hidden="true">⤢</span>
            </button>
          )}
        </div>
      </header>

      <section className={styles.statusRow} aria-label="Статус POC">
        <span className={styles.statusDot} aria-hidden="true" />
        <span>POC · demo data · not saved</span>
        <span className={styles.statusDivider} aria-hidden="true" />
        <span data-testid="wall-count">{state.wallCount} сегментов стен</span>
      </section>

      {!state.inAppFocus ? (
        <section className={styles.context}>
          <p className={styles.eyebrow}>ТЕЛЕФОННЫЙ РЕДАКТОР</p>
          <h1>Соберите пространство<br />в несколько касаний.</h1>
          <p className={styles.contextCopy}>
            Выберите инструмент и добавьте одну перегородку в демонстрационный план.
          </p>
        </section>
      ) : (
        <section className={styles.focusLabel}>
          <span>РЕЖИМ ФОКУСА</span>
          <span data-testid="focus-active-tool">ИНСТРУМЕНТ: {selectedToolLabel}</span>
        </section>
      )}

      <section className={styles.planSection} aria-label="Редактор плана">
        <PlanCanvas dividerVisible={dividerVisible} focusMode={state.inAppFocus} />
      </section>

      <p aria-live="polite" className={styles.notice} data-testid="editor-notice" role="status">
        {state.notice}
      </p>

      <section className={styles.controlDock} aria-label="Инструменты редактора">
        <div className={styles.toolRail}>
          {tools.map(({ icon, label, tool }) => (
            <button
              aria-pressed={state.selectedTool === tool}
              className={`${styles.toolButton} ${state.selectedTool === tool ? styles.selectedTool : ''}`}
              key={tool}
              onClick={() => dispatch({ type: 'select-tool', tool })}
              type="button"
            >
              <span aria-hidden="true" className={styles.toolIcon}>
                {icon}
              </span>
              <span>{label}</span>
            </button>
          ))}
        </div>
        <button
          className={styles.primaryAction}
          disabled={dividerVisible}
          onClick={() => dispatch({ type: 'add-divider' })}
          type="button"
        >
          <span aria-hidden="true">＋</span>
          Добавить перегородку
        </button>
      </section>
    </main>
  );
}
