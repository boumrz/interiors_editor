import { describe, expect, it } from "@rstest/core";

import { classifyActiveAlphaProjectBytes } from "./current-ppj-a1-legacy-classifier";

const encodeAscii = (source: string): readonly number[] =>
	Array.from(source, (character) => character.charCodeAt(0));

describe("active Alpha PPJ-A1 legacy classifier", () => {
	it.each([
		[
			"registered current PPJ-A1 selector",
			'{"projectSchemaId":"interiors.project/alpha-1","schemaVersion":1}',
			"current-ppj-a1",
		],
		[
			"V1-like bytes without the registered project selector",
			'{"schemaVersion":1,"walls":[]}',
			"legacy-unreadable",
		],
		[
			"V2-like bytes with an unregistered schema version",
			'{"projectSchemaId":"interiors.project/alpha-1","schemaVersion":2}',
			"legacy-unreadable",
		],
		[
			"unregistered future selector",
			'{"projectSchemaId":"interiors.project/beta-2","schemaVersion":1}',
			"legacy-unreadable",
		],
	] as const)("classifies %s without transforming the source bytes", (_label, source, expectedKind) => {
		const sourceBytes = encodeAscii(source);
		const inputBytes = [...sourceBytes];

		const result = classifyActiveAlphaProjectBytes(inputBytes);

		expect(result.kind).toBe(expectedKind);
		expect(result.originalBytes).toEqual([...sourceBytes]);
		expect(result.originalBytes).not.toBe(inputBytes);
		expect(Object.isFrozen(result.originalBytes)).toBe(true);
	});

	it("requires the registered closed numeric selector rather than semantic number coercion", () => {
		const result = classifyActiveAlphaProjectBytes(
			encodeAscii(
				'{"projectSchemaId":"interiors.project/alpha-1","schemaVersion":1.0}',
			),
		);

		expect(result.kind).toBe("legacy-unreadable");
	});

	it.each([
		["malformed raw JSON", '{"projectSchemaId":'],
		["a non-object raw root", "[]"],
		[
			"a current schema identifier with a missing schema version",
			'{"projectSchemaId":"interiors.project/alpha-1"}',
		],
	] as const)("fails closed for %s", (_label, source) => {
		expect(classifyActiveAlphaProjectBytes(encodeAscii(source))).toMatchObject({
			kind: "legacy-unreadable",
		});
	});
});
