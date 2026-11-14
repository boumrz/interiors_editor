export const DEVELOPMENT_RELOAD_KEY = "interiors-editor-dev-worker-reset-v1";
export type DevelopmentStartupResult =
	| { readonly kind: "ready" | "reload-requested" }
	| {
			readonly kind: "blocked";
			readonly reason: "cleanup-unavailable" | "reload-already-requested";
	  };
export interface DevelopmentStartupDependencies {
	readonly origin: string;
	readonly serviceWorker?: {
		registrations(): Promise<
			readonly {
				readonly scope: string;
				readonly scriptURLs: readonly string[];
				unregister(): Promise<boolean>;
			}[]
		>;
		controllerPresent(): boolean;
	};
	readonly caches?: {
		keys(): Promise<readonly string[]>;
		delete(name: string): Promise<boolean>;
	};
	readonly reloadState?: {
		read(): string | null;
		write(): void;
		clear(): void;
	};
	readonly reload: () => void;
}
export function createDevelopmentStartupGate(
	dependencies: DevelopmentStartupDependencies,
) {
	let flight: Promise<DevelopmentStartupResult> | undefined;
	const unavailable = (): DevelopmentStartupResult => ({
		kind: "blocked",
		reason: "cleanup-unavailable",
	});
	const reloadControlledDocument = (): DevelopmentStartupResult => {
		if (!dependencies.reloadState) return unavailable();
		if (dependencies.reloadState.read() !== null)
			return { kind: "blocked", reason: "reload-already-requested" };
		dependencies.reloadState.write();
		dependencies.reload();
		return { kind: "reload-requested" };
	};
	const prepare = async (): Promise<DevelopmentStartupResult> => {
		try {
			const scriptURL = new URL("/sw.js", dependencies.origin).href;
			const scope = new URL("/", dependencies.origin).href;
			const registrations =
				(await dependencies.serviceWorker?.registrations()) ?? [];
			const owned = registrations.filter(
				(registration) =>
					registration.scope === scope &&
					registration.scriptURLs.includes(scriptURL),
			);
			const removals = await Promise.allSettled(
				owned.map((registration) =>
					Promise.resolve().then(() => registration.unregister()),
				),
			);
			if (removals.some((result) => result.status === "rejected"))
				return unavailable();
			if (dependencies.serviceWorker?.controllerPresent())
				return reloadControlledDocument();
			const cacheStorage = dependencies.caches;
			if (cacheStorage) {
				const names = await cacheStorage.keys();
				const cleared = await Promise.allSettled(
					names
						.filter(
							(name) =>
								name.startsWith("interiors-editor-shell-") ||
								name.startsWith("interiors-editor-browse-"),
						)
						.map((name) =>
							Promise.resolve().then(() => cacheStorage.delete(name)),
						),
				);
				if (cleared.some((result) => result.status === "rejected"))
					return unavailable();
			}
			if (dependencies.serviceWorker?.controllerPresent())
				return reloadControlledDocument();
			dependencies.reloadState?.clear();
			return { kind: "ready" };
		} catch {
			return unavailable();
		}
	};
	return {
		start(): Promise<DevelopmentStartupResult> {
			if (flight) return flight;
			let finish: (result: DevelopmentStartupResult) => void = () => undefined;
			flight = new Promise((resolve) => {
				finish = resolve;
			});
			void prepare().then(finish, () => finish(unavailable()));
			return flight;
		},
	};
}
