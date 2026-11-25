"""Russian and English strings shown by the Telegram bot."""

COMMANDS = {
    "start": ("Открыть редактор", "Open editor"),
    "support": ("Сообщить о проблеме", "Report a problem"),
    "language": ("Изменить язык", "Change language"),
    "help": ("Показать команды", "Show commands"),
    "cancel": ("Отменить черновик или закрыть приём фото", "Cancel the draft or close photo submissions"),
}

MESSAGES = {
    "editor": ("Открыть редактор", "Open editor"),
    "support": ("Написать в поддержку", "Contact support"),
    "send": ("Отправить", "Send"),
    "cancel": ("Отмена", "Cancel"),
    "choose_language": ("Выберите язык", "Choose a language"),
    "language_saved": ("Выбран русский язык.", "English selected."),
    "language_editor_pending": (
        "Язык бота сохранён. Выбор для редактора пока недоступен.",
        "Bot language saved. The editor language choice is currently unavailable.",
    ),
    "help": (
        "Доступные команды\n/start — открыть редактор\n/support — сообщить о проблеме\n"
        "/language — изменить язык\n/help — показать команды",
        "Available commands\n/start — open the editor\n/support — report a problem\n"
        "/language — change the language\n/help — show commands",
    ),
    "welcome": (
        "Создайте план комнаты в 2D, расставьте мебель и посмотрите результат в 3D. "
        "Проекты хранятся на вашем устройстве. Для обращения воспользуйтесь /support.",
        "Create a 2D room plan, add furniture and see the result in 3D. "
        "Your projects are stored on your device. Use /support to report a problem.",
    ),
    "old_draft": (
        "У вас есть черновик. Чтобы передать его владельцу, нажмите «Отправить» под этим сообщением. "
        "Для нового обращения отмените черновик и снова откройте /support.",
        "You have a draft. Tap Send below to share it with the owner. "
        "To start a new report, cancel this draft and open /support again.",
    ),
    "support_intro": (
        "Напишите, что случилось, и отправьте сообщение обычной кнопкой Telegram. "
        "Описание и до пяти скриншотов получит владелец InteriorsEditor в личный чат. "
        "Скриншоты отправляйте как фото. Их можно добавить до описания или в течение 15 минут после него. "
        "Уберите из обращения адреса, пароли и коды. Для отмены используйте /cancel. Условия обработки\n{policy}",
        "Describe what happened and use Telegram's send button. The InteriorsEditor owner will receive "
        "your description and up to five screenshots in a private chat. Send screenshots as photos before "
        "your description or within 15 minutes afterward. Remove addresses, passwords and codes. "
        "Use /cancel to stop. Support privacy notice\n{policy}",
    ),
    "progress": ("Принято фото: {count} из {limit}. ", "Photos received: {count} of {limit}. "),
    "check_attachments": ("Проверьте вложения и нажмите «Отправить».", "Check your attachments and tap Send."),
    "add_description": ("Добавьте описание проблемы.", "Add a description of the problem."),
    "draft_cancelled": ("Черновик обращения отменён.", "Report draft cancelled."),
    "photo_window_closed": ("Приём фото к обращению закрыт.", "The report is closed to new photos."),
    "wait_for_intro": ("Дождитесь инструкции от бота и отправьте сообщение ещё раз.",
                       "Wait for the bot's instructions, then send your message again."),
    "invalid_attachment": ("Добавьте описание текстом, а скриншот отправьте как фото.",
                           "Write a description and send any screenshot as a photo."),
    "description_limit": ("Сократите описание до {limit} символов.", "Shorten your description to {limit} characters."),
    "photo_limit": ("Уже принято максимальное число фото — {limit}.", "The maximum of {limit} photos has been reached."),
    "photo_before_description": (
        "Получено фото: {count} из {limit}. Теперь пришлите описание проблемы.",
        "Photos received: {count} of {limit}. Now send a description of the problem.",
    ),
    "already_closed": ("Этот черновик уже закрыт. Для нового обращения используйте /support.",
                       "This draft is already closed. Use /support to start a new report."),
    "received": ("Обращение принято.", "Report received."),
    "receipt": ("Обращение №{number} принято. Ответ придёт в этот чат.",
                "Report #{number} was received. The reply will appear in this chat."),
    "receipt_photos": (" Скриншоты можно добавить в течение 15 минут после отправки описания. "
                       "Чтобы закрыть приём фото, отправьте /cancel.",
                       " You can add screenshots for 15 minutes after sending the description. "
                       "Send /cancel to close the report to new photos."),
    "owner_report": ("Обращение №{number}\n\n{description}\n\n"
                     "Чтобы ответить автору, ответьте на это сообщение или на скриншот обращения.",
                     "Report #{number}\n\n{description}\n\n"
                     "To reply to the author, reply to this message or one of the screenshots."),
    "photo_receipt": ("Фото добавлено к обращению №{number}. Получено {count} из {limit}.",
                      "Photo added to report #{number}. Received {count} of {limit}."),
    "owner_photo": ("Скриншот к обращению №{number}", "Screenshot for report #{number}"),
    "owner_ticket_missing": ("Привязка к обращению не найдена или срок ответа истёк.",
                             "The report could not be found or the reply window has expired."),
    "owner_reply_limit": ("Ответьте текстом длиной до {limit} символов.",
                          "Send a text reply of up to {limit} characters."),
    "reply": ("Ответ по обращению №{number}\n\n{text}", "Reply to report #{number}\n\n{text}"),
    "reply_delivered": ("Ответ по обращению №{number} доставлен.", "Reply to report #{number} was delivered."),
    "reply_uncertain": ("Статус ответа по обращению №{number} неизвестен. Проверьте отправку.",
                        "Delivery of the reply to report #{number} is uncertain. Check the conversation."),
    "reply_rejected": ("Бот не смог доставить ответ по обращению №{number}.",
                       "The bot could not deliver the reply to report #{number}."),
}


def copy(language, key, **values):
    return MESSAGES[key][0 if language == "ru" else 1].format(**values)


def bot_commands(language):
    index = 0 if language == "ru" else 1
    return [{"command": name, "description": description[index]} for name, description in COMMANDS.items()]
