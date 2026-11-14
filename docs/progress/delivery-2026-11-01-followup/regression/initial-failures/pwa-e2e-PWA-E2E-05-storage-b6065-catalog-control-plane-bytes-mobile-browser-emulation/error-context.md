# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pwa-e2e.spec.ts >> PWA-E2E-05: storage-pressure cleanup removes only repeatable browse cache and never catalog-control-plane bytes
- Location: tests/browser/pwa-e2e.spec.ts:783:1

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- main [ref=f1e3]:
  - generic [ref=f1e4]:
    - status [ref=f1e5]:
      - strong [ref=f1e6]: Риск заполнения хранилища
      - paragraph [ref=f1e7]: "Локальное хранилище почти заполнено: занято не менее 90%. Экспортируйте проект до следующего изменения."
      - button "Запросить защиту хранилища" [ref=f1e8] [cursor=pointer]
      - button "Освободить место в кэше" [ref=f1e9] [cursor=pointer]
      - button "К проектам и экспорту" [ref=f1e10] [cursor=pointer]
    - img "План помещения" [ref=f1e11]
    - group "Масштаб плана" [ref=f1e15]:
      - button "Приблизить" [ref=f1e16] [cursor=pointer]: +
      - button "Отдалить" [ref=f1e17] [cursor=pointer]: −
    - generic:
      - button "Вернуться к проектам" [ref=f1e18] [cursor=pointer]: ‹Назад
      - button "Переименовать проект Кэш каталога" [ref=f1e19] [cursor=pointer]:
        - generic [ref=f1e20]: Кэш каталога
      - status [ref=f1e21]: Сохранено
      - button "Открыть остальные действия" [ref=f1e22] [cursor=pointer]
      - generic [ref=f1e27]:
        - group "Переключить вид редактора" [ref=f1e28]:
          - button "План 2D" [pressed] [ref=f1e30] [cursor=pointer]: План
          - button "3D" [disabled] [ref=f1e31]
        - button "Настроить размеры" [ref=f1e32] [cursor=pointer]:
          - generic [ref=f1e35]: Размеры
    - navigation "Инструменты редактора" [ref=f1e36]:
      - generic [ref=f1e37]:
        - button "Комната" [disabled] [ref=f1e38]
        - button "Рука и выбор" [pressed] [ref=f1e42] [cursor=pointer]
        - button "Стена" [ref=f1e47] [cursor=pointer]
        - button "Предметы интерьера" [active] [ref=f1e51] [cursor=pointer]:
          - generic [ref=f1e55]: Предмет
    - group "История изменений" [ref=f1e56]:
      - button "Отменить действие" [disabled] [ref=f1e57]: ↶
      - button "Повторить действие" [disabled] [ref=f1e58]: ↷
    - form "Размеры стартового контура" [ref=f1e59]:
      - generic [ref=f1e60]: СТАРТОВЫЙ КОНТУР
      - generic [ref=f1e61]:
        - generic [ref=f1e62]:
          - text: Ширина, мм
          - textbox "Ширина, мм" [ref=f1e63]: "4000"
        - generic [ref=f1e64]:
          - text: Глубина, мм
          - textbox "Глубина, мм" [ref=f1e65]: "3000"
        - generic [ref=f1e66]:
          - text: Высота, мм
          - textbox "Высота, мм" [ref=f1e67]: "2600"
      - button "Создать контур" [ref=f1e68] [cursor=pointer]
```