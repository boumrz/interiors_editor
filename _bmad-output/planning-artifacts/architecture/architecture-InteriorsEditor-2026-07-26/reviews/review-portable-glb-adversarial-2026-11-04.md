# Adversarial review — portable GLB и hash aliases

Дата: 2026-11-04. Проверены раздел «Техническая GLB-проверка и действующая admission policy» в `telegram-portable-v1-disposition-2026-11-04.md` и затронутые существующие source paths. Это review архитектурного текста, не исполнение тестов и не разрешение реализации.

## Verdict: PASS с открытым source-owner решением и evidence

- Раздел сохраняет default 25 MiB для custom/catalog и относит portable 50 MiB только к явно выбранной технической проверке, не объявляя её достаточной для новой custom admission. Применимость фактического 25-MiB hard к 25–50 MiB при portable import/repair передана SPEC/asset-policy owner до зависимой Durable publication; licensing и scope не меняются.
- Текущий smoke делает предварительную структурную проверку и disposable Project geometry projection; его результат не выдан за GLB decode/GPU rendering или самостоятельную гарантию безопасности. Необходимо сохранить существующие structural/resource budgets и применимые downstream decode/no-network проверки.
- Проверка exact hash распространяется не только на smoke: текст прямо учитывает raw-string SHA comparison в feasibility, controller/recovery, import/export и 25-MiB hydration в `AppShell`. Оригинальный case-sensitive key остаётся адресом, каждый alias проверяется независимо, архивная дедупликация допускается только после сравнения bytes, size и всех 256 hash bits; missing/conflicting keys не публикуются.
- При подсчёте 180 MiB используется множество исходных references до archive dedup, поэтому case aliases одного digest не скрывают превышение суммы. Оговорены границы 25 MiB, 25 MiB+1, 50 MiB и 50 MiB+1, malformed/resource cases, reopen/hydration и exact repair.

Остаётся проверить фактическую реализацию на target WebView, включая peak memory нескольких копий archive/resource и отсутствие сетевого доступа при decode. Новый технический seam, source-owner решение, end-to-end persistence и 25–50 MiB file/device evidence здесь не доказаны. Ожидающая ambiguity/sole-copy recovery и другие независимые readiness gates этим review не закрываются.
