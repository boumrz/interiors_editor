import { expect, it } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import { TelegramItemColor } from "./telegram-item-color";

it.each(["placement", "selected-item"] as const)(
	"keeps the %s scene action short while naming its exact finish",
	(context) => {
		const html = renderToStaticMarkup(
			<TelegramItemColor
				color="#536d62"
				context={context}
				sceneTriggerRef={{ current: null }}
				disabled={false}
				onSelect={() => undefined}
			/>,
		);
		expect(html).toContain('aria-haspopup="dialog"');
		expect(html).toContain('aria-label="Цвет · Лесной зелёный"');
		expect(html).toContain(">Цвет</span>");
		expect(html).not.toContain("<details");
	},
);
