import { expect, it } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import { ReleaseRecoveryScreen } from "../app/editor-app";

for (const embedded of [false, true])
	it(`preserves explicit legacy recovery export in a ${embedded ? "supplemental section" : "standalone main"}`, () => {
		const html = renderToStaticMarkup(
			<ReleaseRecoveryScreen
				recovery={{
					projectId: "legacy",
					serializedProject: '{"schemaVersion":7}',
				}}
				embedded={embedded}
			/>,
		);
		expect(html.startsWith(embedded ? "<section" : "<main")).toBe(true);
		expect(html).toContain("Безопасное восстановление проекта");
		expect(html).toContain("Скачать копию для восстановления");
		expect(html).not.toContain(
			"Доступной для экспорта читаемой копии не найдено",
		);
	});
it("does not offer a fabricated recovery file when its source is unavailable", () => {
	const html = renderToStaticMarkup(
		<ReleaseRecoveryScreen recovery={{}} embedded />,
	);
	expect(html).toContain("Доступной для экспорта читаемой копии не найдено");
	expect(html).not.toContain("Скачать копию для восстановления");
});
