import { mountTelegramBrowserEditor } from "../../src/app/telegram-editor-app";
const root = document.getElementById("root");
if (!root) throw new Error("Usage metrics fixture root missing");
mountTelegramBrowserEditor(root);
