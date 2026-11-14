import type { Page } from "@playwright/test";
export interface TelegramEntryAudit {
	opens: string[];
	deletes: number;
	registrations: number;
	unregisters: number;
	cacheDeletes: number;
	sdkReads: number;
	ready: number;
	closed: number;
	contexts: number;
	releasedContexts: number;
}
declare global {
	interface Window {
		readonly __telegramEntryProof: {
			audit: TelegramEntryAudit;
			host: {
				patch(values: Record<string, unknown>): void;
				emit(name: string, value?: unknown): void;
				listeners(): Record<string, number>;
				calls: string[];
			};
			installWorker(): Promise<void>;
		};
	}
}
export async function installEntryAudit(
	page: Page,
	sdk: "missing" | "invalid" | "signed" | "signed-ready-fails",
	signedExample = "",
) {
	await page.addInitScript(
		({ sdk, signedExample }) => {
			const audit: TelegramEntryAudit = {
				opens: [],
				deletes: 0,
				registrations: 0,
				unregisters: 0,
				cacheDeletes: 0,
				sdkReads: 0,
				ready: 0,
				closed: 0,
				contexts: 0,
				releasedContexts: 0,
			};
			const open = IDBFactory.prototype.open,
				remove = IDBFactory.prototype.deleteDatabase;
			IDBFactory.prototype.open = function (name, version) {
				audit.opens.push(name);
				return version === undefined
					? open.call(this, name)
					: open.call(this, name, version);
			};
			IDBFactory.prototype.deleteDatabase = function (name) {
				audit.deletes++;
				return remove.call(this, name);
			};
			const register = ServiceWorkerContainer.prototype.register;
			ServiceWorkerContainer.prototype.register = () => {
				audit.registrations++;
				throw new Error("Production Telegram must not register workers");
			};
			ServiceWorkerRegistration.prototype.unregister = () => {
				audit.unregisters++;
				throw new Error("Production Telegram must not unregister workers");
			};
			CacheStorage.prototype.delete = () => {
				audit.cacheDeletes++;
				throw new Error("Production Telegram must not delete caches");
			};
			const getContext = HTMLCanvasElement.prototype.getContext;
			Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
				configurable: true,
				writable: true,
				value: function (
					this: HTMLCanvasElement,
					type: string,
					options?: unknown,
				) {
					const context = Reflect.apply(getContext, this, [type, options]);
					if (type === "webgl2" && context instanceof WebGL2RenderingContext) {
						audit.contexts++;
						const extension = context.getExtension("WEBGL_lose_context");
						if (extension) {
							const lose = extension.loseContext;
							extension.loseContext = function () {
								audit.releasedContexts++;
								return lose.call(this);
							};
						}
					}
					return context;
				},
			});
			let host: Window["__telegramEntryProof"]["host"] = {
				patch() {
					throw new Error("Missing SDK test fixture");
				},
				emit() {
					throw new Error("Missing SDK test fixture");
				},
				listeners: () => ({}),
				calls: [],
			};
			if (sdk !== "missing") {
				const handlers = new Map<string, Set<(value?: unknown) => void>>(),
					calls: string[] = [];
				const app = {
					version: "8.0",
					colorScheme: "light",
					isActive: true,
					viewportHeight: 700,
					viewportStableHeight: 700,
					safeAreaInset: { top: 20, right: 0, bottom: 10, left: 0 },
					contentSafeAreaInset: { top: 30, right: 5, bottom: 15, left: 0 },
					BackButton: {
						isVisible: false,
						show() {
							this.isVisible = true;
							calls.push("show");
						},
						hide() {
							this.isVisible = false;
							calls.push("hide");
						},
					},
					isClosingConfirmationEnabled: false,
					isVerticalSwipesEnabled: true,
					enableClosingConfirmation() {
						this.isClosingConfirmationEnabled = true;
						calls.push("confirm-on");
					},
					disableClosingConfirmation() {
						this.isClosingConfirmationEnabled = false;
						calls.push("confirm-off");
					},
					enableVerticalSwipes() {
						this.isVerticalSwipesEnabled = true;
						calls.push("swipes-on");
					},
					disableVerticalSwipes() {
						this.isVerticalSwipesEnabled = false;
						calls.push("swipes-off");
					},
					onEvent(name: string, listener: (value?: unknown) => void) {
						let list = handlers.get(name);
						if (!list) {
							list = new Set();
							handlers.set(name, list);
						}
						list.add(listener);
					},
					offEvent(name: string, listener: (value?: unknown) => void) {
						handlers.get(name)?.delete(listener);
					},
					initData:
						sdk === "signed" || sdk === "signed-ready-fails"
							? signedExample
							: "",
					ready() {
						audit.ready++;
						if (sdk === "invalid")
							calls.push(document.getElementById("telegram-entry-heading")?.textContent === "Не удалось открыть редактор" ? "recovery-ready" : "recovery-missing");
						if (sdk === "signed-ready-fails")
							throw new Error("Test-only native SDK ready failure");
					},
					close() {
						audit.closed++;
					},
				};
				host = {
					patch: (values) => {
						Object.assign(app, values);
					},
					emit: (name, value) => {
						for (const listener of [...(handlers.get(name) ?? [])])
							listener(value);
					},
					listeners: () =>
						Object.fromEntries(
							[...handlers].map(([name, list]) => [name, list.size]),
						),
					calls,
				};
				Object.defineProperty(window, "Telegram", {
					value: {
						get WebApp() {
							audit.sdkReads++;
							return app;
						},
					},
				});
			}
			Object.defineProperty(window, "__telegramEntryProof", {
				value: {
					audit,
					host,
					async installWorker() {
						await register.call(
							navigator.serviceWorker,
							"/entry-proof-worker.js",
						);
						await navigator.serviceWorker.ready;
						if (!navigator.serviceWorker.controller)
							await new Promise<void>((resolve) =>
								navigator.serviceWorker.addEventListener(
									"controllerchange",
									() => resolve(),
									{ once: true },
								),
							);
					},
				},
			});
		},
		{ sdk, signedExample },
	);
}
export const audit = (page: Page) =>
	page.evaluate(() => window.__telegramEntryProof.audit);
export async function semanticRows(page: Page) {
	return page.evaluate(async () => {
		const name = window.__telegramEntryProof.audit.opens.find((value) =>
			value.startsWith("interiors-editor-projects:tma-v1-"),
		);
		if (!name) throw new Error("Expected actual scoped native DB");
		return new Promise<{ projects: unknown[]; revisions: unknown[] }>(
			(resolve, reject) => {
				const opening = indexedDB.open(name);
				opening.onerror = () => reject(opening.error);
				opening.onsuccess = () => {
					const db = opening.result,
						transaction = db.transaction(["projects", "revisions"], "readonly"),
						projects = transaction.objectStore("projects").getAll(),
						revisions = transaction.objectStore("revisions").getAll();
					transaction.oncomplete = () => {
						db.close();
						resolve({ projects: projects.result, revisions: revisions.result });
					};
					transaction.onabort = () => {
						db.close();
						reject(transaction.error);
					};
				};
			},
		);
	});
}
