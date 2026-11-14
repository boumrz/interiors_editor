# Восстановление TMA350, 6 ноября 2026

Текущая v8 квалификация: 13/13 PASS, независимый Root ACK ещё нужен. Root нашёл stale-navigation пробел в v7: он воспроизведён RED и закрыт проверкой latest page navigation в runtime и policy. v7 архивы сохранены как superseded. Полный gate350 не выполнен; score отсутствует.

Сохранены самостоятельный source/context, fixture, политика фаз, все исходные13 вызовов, raw/formatted reporter, BODY/navigation/evaluation journals, build bytes и terminal receipts. Все члены обоих архивов повторно прочитаны и проверены по SHA-256; индексы рядом.

Политика не меняет deadline2000/2500: только ожидавший токен того же case/worker/page/navigation после настоящего rejected BODY и фактических page/context close плюс fulfilled framework close получает отдельную отмену. Это не fulfilled операция продукта. Во время BODY, после fulfilled BODY, при чужом owner/Source, недоказанном close/terminal и cleanup failure — технический отказ. Старые ошибочные и частичные результаты не переименованы.

Проверки:30 новых lifecycle controls и7 guarded scheduling controls (включая настоящую Promise/event очередь),42 сохранённых controller controls, Telegram types и13 реальных квалификационных вызовов. Первый relocated17 отказал до Native; следующий145 прошёл, но внешний verifier обнаружил старый абсолютный discovery root. Эти попытки сохранены отдельно.

`qualification13-v8-final.json` и `checkpoint.json` связывают exact hashes. Повторное чтение всех13: pinned Node24.19.0 запускает `replay13-v8.mjs` из восстановленного корня. Команда работает в `workspace/apps/web`; никакой Native не запускается. Root должен проверить результат независимо до ACK/полного350.

Все13 v8 вызовов используют собственный node_modules link farm и собственный .cache; перед каждым вызовом только owned regular results.json сбрасывается к frozen ABSENT seed. SHAseed включён в983immutable inputs. У17 один test file. Исторические sharedcache writes сохранены как известный побочный эффект с неизвестным прежним значением, без обещания отката.

Главный проект и его production Source не изменены; добавлено только это evidence.
