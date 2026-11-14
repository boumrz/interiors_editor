import { expect, it } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import { ReleaseRecoveryScreen } from "../app/editor-app";

it("keeps an omitted embedded prop as the legacy standalone main", () => {
 const html = renderToStaticMarkup(<ReleaseRecoveryScreen recovery={{}} />);
 expect(html.startsWith("<main")).toBe(true);
 expect(html).toContain("Безопасное восстановление проекта");
 expect(html).toContain("Доступной для экспорта читаемой копии не найдено");
});
