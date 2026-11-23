import { mountTelegramBrowserEditor as mount } from "../../src/app/telegram-editor-app";
import { fixtureEditionTime, fixtureSignedTime } from "./telegram-entry-signed-fixture";

// This module belongs only to the verified loopback browser test target.
export function mountTelegramBrowserEditor(element: HTMLElement) {
	if (location.hostname !== "127.0.0.1") throw Error("Expected an isolated loopback fixture");
	return mount(element, () => Date.now() - fixtureEditionTime + fixtureSignedTime);
}
