import { zipSync } from "fflate";

import type { PortableBackupEncoderPort } from "../../application/ports";

/** Browser-local ZIP encoder; callers own the complete, allowlisted entry set. */
export class FflatePortableBackupEncoder implements PortableBackupEncoderPort {
	public encode(entries: Readonly<Record<string, Uint8Array>>): Uint8Array {
		// Store mode keeps the bounded container reader on one simple, auditable
		// path. Resource-free Alpha backups are small; compression is not worth a
		// second deflate compatibility surface before resource imports ship.
		return zipSync(entries, { level: 0 });
	}
}
