# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor-workspace-e2e.spec.ts >> CATALOG-E2E-01G: choosing a wall model after a Window keeps explicit placement accessible
- Location: tests/browser/editor-workspace-e2e.spec.ts:11339:1

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - main [ref=e3]:
    - generic [ref=e4]:
      - img "План помещения" [ref=e5]:
        - generic [ref=e7]:
          - generic [ref=e10]:
            - generic [ref=e11] [cursor=pointer]
            - button "Переместить окно вдоль стены" [ref=e12]
          - generic [ref=e14] [cursor=pointer]
          - generic [ref=e16] [cursor=pointer]
          - generic [ref=e18] [cursor=pointer]
      - group "Масштаб плана" [ref=e19]:
        - button "Приблизить" [ref=e20] [cursor=pointer]: +
        - button "Отдалить" [ref=e21] [cursor=pointer]: −
      - generic:
        - button "Вернуться к проектам" [ref=e22] [cursor=pointer]: ‹Назад
        - button "Переименовать проект Бра после окна" [ref=e23] [cursor=pointer]:
          - generic [ref=e24]: Бра после окна
        - status [ref=e25]: Сохранено
        - button "Открыть остальные действия" [ref=e26] [cursor=pointer]
        - generic [ref=e31]:
          - group "Переключить вид редактора" [ref=e32]:
            - button "План 2D" [pressed] [ref=e34] [cursor=pointer]: План
            - button "3D" [ref=e35] [cursor=pointer]
          - button "Настроить размеры" [disabled] [ref=e36]:
            - generic [ref=e39]: Размеры
      - navigation "Инструменты редактора" [ref=e40]:
        - generic [ref=e41]:
          - button "Добавить проём" [ref=e42] [cursor=pointer]
          - button "Рука и выбор" [pressed] [ref=e47] [cursor=pointer]
          - button "Свойства" [ref=e52] [cursor=pointer]
          - button "Предметы интерьера" [active] [ref=e56] [cursor=pointer]:
            - generic [ref=e60]: Предмет
      - group "История изменений" [ref=e61]:
        - 'button "Отменить действие: изменение плана" [ref=e62] [cursor=pointer]': ↶
        - button "Повторить действие" [disabled] [ref=e63]: ↷
      - complementary "Свойства выбранной стены" [ref=e64]:
        - generic [ref=e65]:
          - strong [ref=e69]: Свойства стены
          - button "Закрыть свойства стены" [ref=e70] [cursor=pointer]: Закрыть
        - status [ref=e71]:
          - strong [ref=e72]: Размещение настенного предмета
          - generic [ref=e73]: "Смещение от начала стены: 2050 мм · 220 мм × 280 мм"
          - group "Сторона размещения предмета" [ref=e74]:
            - button "Разместить на левой стороне стены" [pressed] [ref=e76] [cursor=pointer]: Слева
            - button "Разместить на правой стороне стены" [ref=e77] [cursor=pointer]: Справа
          - button "Подтвердить размещение" [ref=e78] [cursor=pointer]
          - button "Отменить" [ref=e79] [cursor=pointer]
        - button "Переместить стену жестом" [ref=e80] [cursor=pointer]
        - generic [ref=e81]:
          - generic [ref=e82]:
            - text: Ширина окна, мм
            - status [ref=e83]: 1200 мм
          - button "Изменить окно" [ref=e84] [cursor=pointer]
          - button "Удалить окно" [ref=e85] [cursor=pointer]
        - button "Удалить стену" [ref=e86] [cursor=pointer]
  - iframe [ref=e87]:
    - generic [ref=f1e2]:
      - generic [ref=f1e3]: "Uncaught runtime errors:"
      - button "Dismiss" [ref=f1e4] [cursor=pointer]: ×
      - generic [ref=f1e6]:
        - generic [ref=f1e7]: ERROR
        - generic [ref=f1e8]: ResizeObserver loop completed with undelivered notifications. at handleError (http://127.0.0.1:48177/vendors-node_modules_pnpm_react-dom_19_2_8_react_19_2_8_node_modules_react-dom_client_js-node-d944ea.js:3969:66) at http://127.0.0.1:48177/vendors-node_modules_pnpm_react-dom_19_2_8_react_19_2_8_node_modules_react-dom_client_js-node-d944ea.js:3987:13
```