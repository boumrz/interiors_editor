import type { ProjectController } from "./project-controller";

export type TrackOperation = <T>(operation: () => T | Promise<T>) => Promise<T>;

export function guardRegisteredProjectController(
	controller: ProjectController,
	active: () => boolean,
	signal: AbortSignal,
	subscriptions: Set<() => void>,
	track: TrackOperation,
	unavailableMessage: string,
): ProjectController {
	const synchronousQueries = new Set<PropertyKey>([
		"snapshot",
		"hasPendingPublication",
		"pendingPublicationIdentity",
		"persistenceRetryPolicy",
		"sessionHistory",
		"sessionHistoryCommandLabels",
		"currentRevisionIdentity",
		"sessionRetentionRoots",
		"writerAccess",
		"writerRecoveryCopy",
		"recoveryReadOnlyProject",
		"recoveryCustomGlbRemovalSummary",
	]);
	function guardSubscription<T>(subscribe: (listener: (value: T) => void) => () => void) {
		return (listener: (value: T) => void) => {
			if (signal.aborted) return () => undefined;
			let observing = true;
			const unsubscribe = subscribe((value) => {
				if (observing && !signal.aborted) listener(value);
			});
			const stop = () => {
				if (!observing) return;
				observing = false;
				subscriptions.delete(stop);
				unsubscribe();
			};
			subscriptions.add(stop);
			return stop;
		};
	}
	const bound = new Map<PropertyKey, unknown>();
	// Proxy retains the real ProjectController prototype/private nominal type;
	// its methods execute against the one actual shared core instance.
	return new Proxy(controller, {
		get(target, property) {
			const method: unknown = Reflect.get(target, property, target);
			if (typeof method !== "function" || property === "constructor")
				return method;
			if (bound.has(property)) return bound.get(property);
			let wrapped: unknown;
			if (synchronousQueries.has(property)) wrapped = method.bind(target);
			else if (property === "subscribe") {
				wrapped = guardSubscription(target.subscribe.bind(target));
			} else if (property === "subscribeProductMetrics") {
				wrapped = guardSubscription(target.subscribeProductMetrics.bind(target));
			} else if (property === "importProjectTransfer") {
				wrapped = (
					bytes: Uint8Array,
					options?: Parameters<ProjectController["importProjectTransfer"]>[1],
				) =>
					track(() =>
						target.importPortableBackup(bytes, {
							onStatus: options?.onPortableStatus,
							signal: options?.signal,
						}),
					);
			} else if (property === "startNewProject") {
				wrapped = (...args: unknown[]) => {
					if (!active()) throw new Error(unavailableMessage);
					return Reflect.apply(method, target, args);
				};
			} else {
				wrapped = (...args: unknown[]) =>
					track(() => {
						const result: unknown = Reflect.apply(method, target, args);
						return result;
					});
			}
			bound.set(property, wrapped);
			return wrapped;
		},
	});
}
