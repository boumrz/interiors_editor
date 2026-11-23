export const licenseRevisionDate = "2026-11-22";
export const licenseRevision = "2026-11-22.2";
export const licenseEditionLabel = "Редакция 2 от 22 ноября 2026 года";
const earliestAcceptance = Date.parse(`${licenseRevisionDate}T00:00:00+03:00`);

export function licenseReceipts(
	storage: () => Pick<Storage, "getItem" | "setItem">,
	now = Date.now,
) {
	const key = (scope: string) =>
		`interiors:${scope}:license:${licenseRevision}`;
	return {
		has(scope: string) {
			try {
				const receipt = storage().getItem(key(scope));
				const time = Date.parse(String(receipt));
				return (
					time >= earliestAcceptance &&
					time <= now() &&
					new Date(time).toISOString() === receipt
				);
			} catch {
				return false;
			}
		},
		accept(scope: string) {
			try {
				const time = now();
				if (time < earliestAcceptance) return false;
				const date = new Date(time).toISOString();
				const store = storage();
				store.setItem(key(scope), date);
				return store.getItem(key(scope)) === date;
			} catch {
				return false;
			}
		},
	};
}
