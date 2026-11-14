# Корректировка Alpha: убрать корзину проектов

**Дата:** 2026-08-25  
**Статус:** утверждено владельцем продукта  
**Триггер:** владелец продукта потребовал убрать корзину: при подтверждённом
удалении Project должен удаляться окончательно.

## Проблема и решение

Двухшаговый маршрут «в корзину → восстановить/удалить навсегда» не приносит
ценности целевой Alpha и усложняет список проектов, persistence API, UX и
проверки. Он заменяется одним destructive route: пользователь из открытого
Project выбирает `Удалить проект`, видит явное предупреждение о необратимости
и либо отменяет действие без изменений, либо подтверждает удаление.

Подтверждённая операция в одном fenced metadata transaction удаляет Project
pointer, все принадлежащие ему Revision и staging record. Объекты ресурсов не
удаляются напрямую: их shared reachability остаётся задачей global GC, поэтому
ссылки другого Project или device-local library не повреждаются.

## Влияние

| Область | До | После |
|---|---|---|
| PRD FR-4 | Восстановимая корзина и окончательное удаление | Явно подтверждённое окончательное удаление без восстановления |
| CAP-1 | Не удалять Project без подтверждения | То же; после confirm нет Project Trash и undo/restore пути |
| Story 8.2 / V-14 | Trash, restore, permanent delete | Direct permanent deletion after confirm |
| Persistence | `active`/`trashed` pointer lifecycle | Один доступный pointer; delete удаляет owned metadata и revisions |
| UX | Список «Корзина», Restore и second confirm | Одна destructive confirm-панель у открытого Project |
| Resource safety | Trash удерживает GC roots | Удалённый Project больше не root; GC сохраняет shared/library/recovery/history roots |

Старые physical pointer records, где сохранён устаревший `lifecycle: "trashed"`,
не удаляются автоматически. При чтении Alpha воспринимает их как обычные
доступные cards, чтобы пользователь сам принял новое явное решение об
окончательном удалении.

## Выбранный путь

**Direct Adjustment, малое изменение объёма.** Новые epic не требуются и
порядок V-13 → V-14 → V-15 не меняется. Нужны: замена формулировки FR-4,
Story 8.2 и V-14; удаление Trash API/UI/state; migration-compatible directory
read; обновление SPEC companions, Architecture, UX, roadmap и тестов.

Не меняются: explicit confirmation, writer fencing, atomicity, local-first
backup/import, recovery от corruption, shared-resource GC и запрет
автоматического удаления данных.

## Критерии готовности

1. В интерфейсе и публичных портах нет `Trash`, `restore` или `trashed`
   lifecycle transition.
2. Cancel не меняет pointer или revisions; confirm удаляет pointer и все owned
   revisions в fenced transaction и возвращает к локальному списку Projects.
3. Stale writer не может удалить Project; общие resource bytes не удаляются
   напрямую.
4. Старый trashed pointer открывается как обычный Project, а не исчезает.
5. PRD, SPEC, Architecture, UX, Epic 8, roadmap, sprint status и tests
   описывают один и тот же direct-delete contract.

## Handoff

Владелец продукта уже дал явное письменное разрешение на эту корректировку.
Разработчик выполняет изменение с RED → GREEN → mutation → validation; новой
координации или изменения Alpha roadmap sequencing не требуется.
