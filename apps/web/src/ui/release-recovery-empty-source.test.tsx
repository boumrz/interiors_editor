import { expect, it, rs } from "@rstest/core";
import { Children, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReleaseRecoveryScreen } from "../app/editor-app";

for (const embedded of [false, true])
	it(`offers an available empty raw recovery source in ${embedded ? "supplemental" : "standalone"} presentation`, () => {
		const html = renderToStaticMarkup(
			<ReleaseRecoveryScreen
				recovery={{ serializedProject: "" }}
				embedded={embedded}
			/>,
		);
		expect(html).toContain("Скачать копию для восстановления");
		expect(html).not.toContain(
			"Доступной для экспорта читаемой копии не найдено",
		);
	});

it("issues an actual zero-byte local recovery Blob and revokes only its download URL", async () => {
	const screen = ReleaseRecoveryScreen({
		recovery: { projectId: "empty", serializedProject: "" },
	});
	const button = Children.toArray(screen.props.children).find(
		(node) => isValidElement(node) && node.type === "button",
	);
	expect(button).toBeDefined();
	if (!isValidElement<{ onClick: () => void }>(button))
		throw Error("No recovery download action");
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
	const anchor = { href: "", download: "", click: rs.fn() };
	let emitted: Blob | undefined;
	const create = rs.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
		if (!(blob instanceof Blob)) throw Error("Recovery must produce a Blob");
		emitted = blob;
		return "blob:empty-recovery-test";
	});
	const revoke = rs
		.spyOn(URL, "revokeObjectURL")
		.mockImplementation(() => undefined);
	try {
		Object.defineProperty(globalThis, "document", {
			configurable: true,
			value: {
				createElement: (tag: string) => {
					expect(tag).toBe("a");
					return anchor;
				},
			},
		});
		button.props.onClick();
		expect(emitted).toBeDefined();
		if (!emitted) throw Error("No local recovery bytes were issued");
		expect(emitted.size).toBe(0);
		expect(emitted.type).toBe("application/json");
		expect(await emitted.text()).toBe("");
		expect(anchor.href).toBe("blob:empty-recovery-test");
		expect(anchor.download).toBe("empty-recovery.json");
		expect(anchor.click).toHaveBeenCalledTimes(1);
		expect(revoke).toHaveBeenCalledTimes(1);
		expect(revoke).toHaveBeenCalledWith("blob:empty-recovery-test");
	} finally {
		create.mockRestore();
		revoke.mockRestore();
		if (descriptor) Object.defineProperty(globalThis, "document", descriptor);
		else Reflect.deleteProperty(globalThis, "document");
	}
});
