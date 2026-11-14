/** The resource key's spelling is retained; only its SHA-256 digest bits compare. */
export function isSha256ResourceHash(value: string): boolean {
	return /^[a-fA-F0-9]{64}$/.test(value);
}

/** Resource bytes use SHA-256; this is not a Revision-checksum compatibility rule. */
export function sameSha256ResourceHashBits(
	expected: string,
	actual: string,
): boolean {
	if (!isSha256ResourceHash(expected) || !isSha256ResourceHash(actual))
		return false;
	for (let offset = 0; offset < 64; offset += 2) {
		if (
			Number.parseInt(expected.slice(offset, offset + 2), 16) !==
			Number.parseInt(actual.slice(offset, offset + 2), 16)
		)
			return false;
	}
	return true;
}
