# Помещения и размеры плана · 5 сентября 2026

Десять снимков работающего редактора из итогового браузерного прогона.
Данные созданы в изолированных тестовых профилях. Это эмуляция телефона,
не проверка на физическом устройстве. Ошибка хранилища воспроизведена тестом.

## Помещения

Выбор кухни-гостиной из двух комнат, имя, тип и высота 2800 мм. Изменения сохранены локально. Системные подписи, единицы измерения и кнопка сохранения. 393×852 CSS px.

![Помещения](/Users/romanzheltov/Desktop/frontentd-projects/InteriorsEditor/docs/progress/screenshots/inspectors-2026-09-05/room-properties.png)

## Размеры плана

Прямоугольный контур 4500×3000 мм, высота 2800 мм. Площадь и периметр пересчитаны после явного применения. 393×852 CSS px.

![Размеры плана](/Users/romanzheltov/Desktop/frontentd-projects/InteriorsEditor/docs/progress/screenshots/inspectors-2026-09-05/plan-dimensions.png)

## Ошибка размеров

Нулевая высота отклонена без публикации. Объяснение находится в форме рядом с действием; поля связаны с сообщением для скринридера. 393×852 CSS px.

![Ошибка размеров](/Users/romanzheltov/Desktop/frontentd-projects/InteriorsEditor/docs/progress/screenshots/inspectors-2026-09-05/plan-dimensions-error.png)

## Высота затрагивает окно

Уменьшение высоты комнаты до 2000 мм требует уменьшить окно либо удалить его. До явного подтверждения проект не изменяется. Карточка прокручена к выбору. 393×852 CSS px.

![Высота затрагивает окно](/Users/romanzheltov/Desktop/frontentd-projects/InteriorsEditor/docs/progress/screenshots/inspectors-2026-09-05/room-height-conflict.png)

## Не удалось сохранить изменение комнаты и окна

Сымитирована нехватка места перед публикацией. Введённая высота 1900 мм сохраняется в форме, прежний указатель версии и окно остаются неизменными; повтор сохранения доступен над панелью. 393×852 CSS px.

![Не удалось сохранить изменение комнаты и окна](/Users/romanzheltov/Desktop/frontentd-projects/InteriorsEditor/docs/progress/screenshots/inspectors-2026-09-05/room-conflict-save-failure.png)

## Помещения: крупный текст

360×480 CSS px, 200% текста. Панель прокручена к сохранению; каждый контрол проверен на доступность указателю и отсутствие горизонтального переполнения.

![Помещения: крупный текст](/Users/romanzheltov/Desktop/frontentd-projects/InteriorsEditor/docs/progress/screenshots/inspectors-2026-09-05/room-properties-large-text.png)

## Размеры: крупный текст и вырез экрана

360×480 CSS px, 200% текста, safe area сверху 59 px и снизу 34 px. Панель остаётся ниже шапки, прокручена к Apply. Общие шапка и dock на этом предельном размере требуют отдельной доработки: подписи тесноваты. Эта проверка подтверждает доступность формы, не завершение общего крупнотекстового режима.

![Размеры: крупный текст и вырез экрана](/Users/romanzheltov/Desktop/frontentd-projects/InteriorsEditor/docs/progress/screenshots/inspectors-2026-09-05/plan-dimensions-large-text.png)

## Конфликт высоты: крупный текст

360×480 CSS px, 200% текста. Карточка прокручена к подтверждению; вариант изменения окна, отмена и подтверждение доступны внутри прокручиваемой формы.

![Конфликт высоты: крупный текст](/Users/romanzheltov/Desktop/frontentd-projects/InteriorsEditor/docs/progress/screenshots/inspectors-2026-09-05/room-height-conflict-large-text.png)

## Меблированная квартира: план

Повторная регрессия всего редактора: четыре комнаты, проёмы и расставленные предметы. 393×852 CSS px.

![Меблированная квартира: план](/Users/romanzheltov/Desktop/frontentd-projects/InteriorsEditor/docs/progress/screenshots/inspectors-2026-09-05/reference-apartment-plan.png)

## Та же квартира после открытия в 3D

Сохранённая квартира повторно открыта в 3D. Снимок проверяет общий сценарий редактора после изменений панелей. 393×852 CSS px.

![Та же квартира после открытия в 3D](/Users/romanzheltov/Desktop/frontentd-projects/InteriorsEditor/docs/progress/screenshots/inspectors-2026-09-05/reference-apartment-3d-reopened.png)

План и оставшиеся этапы: [Calm Spatial Studio](/Users/romanzheltov/Desktop/frontentd-projects/InteriorsEditor/plans/calm-spatial-redesign-p0-2026-08-31.md).
