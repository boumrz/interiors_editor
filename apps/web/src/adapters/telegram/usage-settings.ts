/** Telegram CloudStorage is scoped by bot and Telegram account. It stores just the choice. */
export function telegramReturnSettings(
	call: (name: string, ...args: unknown[]) => unknown,
	active: () => boolean,
) {
	const key = "interiors_return_permission_v1";
	function invoke(method: string, args: unknown[]): Promise<unknown> {
		return new Promise((resolve, reject) => {
			if (!active()) {
				reject(Error("Telegram context closed"));
				return;
			}
			const timer = setTimeout(
				() => reject(Error("Telegram settings unavailable")),
				3500,
			);
			try {
				call(method, key, ...args, (error: unknown, result: unknown) => {
					clearTimeout(timer);
					if (error || !active())
						reject(Error("Telegram settings unavailable"));
					else resolve(result);
				});
			} catch (e) {
				clearTimeout(timer);
				reject(e);
			}
		});
	}
	return {
		async get() {
			const raw = await invoke("getItem", []);
			if (raw == null) return "";
			if (typeof raw !== "string") throw Error("Invalid Telegram setting");
			return raw;
		},
		async set(value: string) {
			const result = await invoke("setItem", [value]);
			if (result !== true) throw Error("Telegram did not persist settings");
		},
	};
}
