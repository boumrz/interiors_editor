import { describe, expect, it } from "@rstest/core";
import { strFromU8, unzipSync } from "fflate";

import { FflatePortableBackupEncoder } from "./fflate-portable-backup-encoder";

describe("FflatePortableBackupEncoder", () => {
	it("writes every explicitly supplied canonical entry into a readable ZIP", () => {
		const archive = new FflatePortableBackupEncoder().encode({
			"checksums.json": new TextEncoder().encode('{"algorithm":"sha-256"}'),
			"manifest.json": new TextEncoder().encode('{"complete":true}'),
			"project/project.json": new TextEncoder().encode('{"schemaVersion":1}'),
		});

		const entries = unzipSync(archive);
		expect(Object.keys(entries).sort()).toEqual([
			"checksums.json",
			"manifest.json",
			"project/project.json",
		]);
		expect(strFromU8(entries["project/project.json"] ?? new Uint8Array())).toBe(
			'{"schemaVersion":1}',
		);
	});
});
