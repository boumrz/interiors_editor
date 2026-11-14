# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor-workspace-e2e.spec.ts >> PLAN-E2E-04K: a phone user can cancel and durably move a closed-room corner onto its exact 45-degree line
- Location: tests/browser/editor-workspace-e2e.spec.ts:3489:1

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - img "План помещения" [ref=e5]
    - group "Масштаб плана" [ref=e9]:
      - button "Приблизить" [ref=e10] [cursor=pointer]: +
      - button "Отдалить" [ref=e11] [cursor=pointer]: −
    - status [ref=e12]:
      - strong [ref=e13]: "Стена: 5100 мм"
      - generic [ref=e14]: "Направление: горизонтально"
      - generic [ref=e15]:
        - button "Подтвердить стену" [ref=e16] [cursor=pointer]
        - button "Отменить стену" [ref=e17] [cursor=pointer]
    - generic:
      - button "Вернуться к проектам" [ref=e18] [cursor=pointer]: ‹Назад
      - button "Переименовать проект Правка угла комнаты" [ref=e19] [cursor=pointer]:
        - generic [ref=e20]: Правка угла комнаты
      - status [ref=e21]: Сохранено
      - button "Открыть остальные действия" [ref=e22] [cursor=pointer]
      - generic [ref=e27]:
        - group "Переключить вид редактора" [ref=e28]:
          - button "План 2D" [pressed] [ref=e30] [cursor=pointer]: План
          - button "3D" [disabled] [ref=e31]
        - button "Настроить размеры" [disabled] [ref=e32]:
          - generic [ref=e35]: Размеры
    - navigation "Инструменты редактора" [ref=e36]:
      - generic [ref=e37]:
        - button "Комната" [disabled] [ref=e38]
        - button "Рука и выбор" [ref=e42] [cursor=pointer]
        - button "Стена" [active] [pressed] [ref=e47] [cursor=pointer]
        - button "Предметы интерьера" [ref=e51] [cursor=pointer]:
          - generic [ref=e55]: Предмет
    - group "История изменений" [ref=e56]:
      - button "Отменить действие" [disabled] [ref=e57]: ↶
      - button "Повторить действие" [disabled] [ref=e58]: ↷
    - form "Размеры стартового контура" [ref=e59]:
      - generic [ref=e60]: СТАРТОВЫЙ КОНТУР
      - generic [ref=e61]:
        - generic [ref=e62]:
          - text: Ширина, мм
          - textbox "Ширина, мм" [ref=e63]: "4000"
        - generic [ref=e64]:
          - text: Глубина, мм
          - textbox "Глубина, мм" [ref=e65]: "3000"
        - generic [ref=e66]:
          - text: Высота, мм
          - textbox "Высота, мм" [ref=e67]: "2600"
      - button "Создать контур" [ref=e68] [cursor=pointer]
```