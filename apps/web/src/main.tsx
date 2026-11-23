import {
	lazy,
	StrictMode,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createRoot } from "react-dom/client";

import "./ui/global.css";
import {
	createDevelopmentStartupGate,
	DEVELOPMENT_RELOAD_KEY,
} from "./app/development-startup";
import type {
	PwaBrowseCache,
	PwaBrowseCacheCleanupResult,
	PwaInstall,
	PwaInstallPromptOutcome,
	PwaUpdate,
} from "./ui/AppShell";
import { pwaInstallCapabilities } from "./ui/pwa-install-capabilities";
import { BrowserLegalAccess } from "./ui/browser-legal-access";

declare const __INTERIORS_TEST_SEAM__: boolean;

const EditorApp = lazy(async () =>
	import(/* webpackChunkName: "editor-app" */ "./app/browser-editor-app").then(
		(module) => ({ default: module.BrowserEditorApp }),
	),
);

const root = document.getElementById("root");

const ProjectBackups = lazy(async () =>
	import(/* webpackChunkName: "editor-app" */ "./app/browser-editor-app").then(
		(module) => ({ default: module.BrowserProjectBackups }),
	),
);

if (!root) {
	throw new Error("Missing #root element");
}

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	readonly userChoice: Promise<{ readonly outcome: "accepted" | "dismissed" }>;
}

function currentInstallCapabilities() {
	return pwaInstallCapabilities(navigator, window);
}

function PwaAwareEditorApp() {
	const [waitingWorker, setWaitingWorker] = useState<ServiceWorker>();
	const [isReloadReady, setIsReloadReady] = useState(false);
	const [deferredInstallPrompt, setDeferredInstallPrompt] =
		useState<BeforeInstallPromptEvent>();
	const [installCapabilities, setInstallCapabilities] = useState(
		currentInstallCapabilities,
	);
	const activationRequested = useRef(false);

	useEffect(() => {
		const captureInstallPrompt = (event: Event) => {
			event.preventDefault();
			setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
		};
		const clearInstallPrompt = () => {
			setDeferredInstallPrompt(undefined);
			setInstallCapabilities(currentInstallCapabilities());
		};
		window.addEventListener("beforeinstallprompt", captureInstallPrompt);
		window.addEventListener("appinstalled", clearInstallPrompt);
		return () => {
			window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
			window.removeEventListener("appinstalled", clearInstallPrompt);
		};
	}, []);

	useEffect(() => {
		if (!("serviceWorker" in navigator)) {
			return;
		}
		if (__INTERIORS_TEST_SEAM__) {
			// Development cleanup finishes before this component or the lazy editor mounts.
			return;
		}

		let disposed = false;
		const showWaitingUpdate = (registration: ServiceWorkerRegistration) => {
			if (!disposed && navigator.serviceWorker.controller && registration.waiting) {
				setWaitingWorker(registration.waiting);
			}
		};
		const observeRegistration = (registration: ServiceWorkerRegistration) => {
			showWaitingUpdate(registration);
			registration.addEventListener("updatefound", () => {
				const installing = registration.installing;
				if (!installing) {
					return;
				}
				installing.addEventListener("statechange", () => {
					if (installing.state === "installed") {
						showWaitingUpdate(registration);
					}
				});
			});
		};
		const prepareReloadAfterRequestedActivation = () => {
			if (!activationRequested.current) return;
			activationRequested.current = false;
			setWaitingWorker(undefined);
			setIsReloadReady(true);
		};
		navigator.serviceWorker.addEventListener(
			"controllerchange",
			prepareReloadAfterRequestedActivation,
		);
		const register = () => {
			void navigator.serviceWorker.register("/sw.js").then(observeRegistration);
		};
		if (document.readyState === "complete") {
			register();
		} else {
			window.addEventListener("load", register, { once: true });
		}

		return () => {
			disposed = true;
			window.removeEventListener("load", register);
			navigator.serviceWorker.removeEventListener(
				"controllerchange",
				prepareReloadAfterRequestedActivation,
			);
		};
	}, []);

	const activateUpdate = useCallback(() => {
		activationRequested.current = true;
		setIsReloadReady(false);
		const activate = (worker: ServiceWorker | undefined) =>
			worker?.postMessage({ type: "INTERIORS_ACTIVATE_UPDATE" });
		// A waiting worker may be replaced while the editor remains open.  Send
		// the explicit, user-authorised activation to the rendered worker and
		// then re-read the registration so Safari/WebKit cannot leave the visible
		// update notice bound to an obsolete ServiceWorker object.
		activate(waitingWorker);
		void navigator.serviceWorker
			.getRegistration()
			.then((registration) => activate(registration?.waiting ?? undefined));
	}, [waitingWorker]);
	const reloadUpdatedApp = useCallback(() => {
		window.location.reload();
	}, []);
	const pwaUpdate: PwaUpdate | undefined = waitingWorker || isReloadReady
		? {
				activate: activateUpdate,
				isReloadReady,
				isWaiting: waitingWorker !== undefined,
				reload: reloadUpdatedApp,
			}
		: undefined;
	const pwaInstall: PwaInstall = useMemo(
		() => ({
			...installCapabilities,
			promptInstall: deferredInstallPrompt
				? async (): Promise<PwaInstallPromptOutcome> => {
						try {
							await deferredInstallPrompt.prompt();
							const choice = await deferredInstallPrompt.userChoice;
							if (choice.outcome === "accepted") {
								setDeferredInstallPrompt(undefined);
							}
							return choice.outcome;
						} catch {
							return "unavailable";
						}
					}
				: undefined,
		}),
		[deferredInstallPrompt, installCapabilities],
	);
	const clearBrowseCache = useCallback(
		async (): Promise<PwaBrowseCacheCleanupResult> => {
			const worker = navigator.serviceWorker?.controller;
			if (!worker || typeof MessageChannel === "undefined") {
				return { kind: "unavailable" };
			}
			return new Promise((resolve) => {
				let settled = false;
				const complete = (result: PwaBrowseCacheCleanupResult) => {
					if (settled) return;
					settled = true;
					window.clearTimeout(timeout);
					resolve(result);
				};
				const timeout = window.setTimeout(
					() => complete({ kind: "unavailable" }),
					3_000,
				);
				const channel = new MessageChannel();
				channel.port1.onmessage = (event: MessageEvent<unknown>) => {
					complete(
						event.data !== null &&
						typeof event.data === "object" &&
						"kind" in event.data &&
						event.data.kind === "cleared"
							? { kind: "cleared" }
							: { kind: "unavailable" },
					);
				};
				try {
					worker.postMessage(
						{ type: "INTERIORS_CLEAR_BROWSE_CACHE" },
						[channel.port2],
					);
				} catch {
					complete({ kind: "unavailable" });
				}
			});
		},
		[],
	);
	const pwaBrowseCache: PwaBrowseCache = useMemo(
		() => ({ clear: clearBrowseCache }),
		[clearBrowseCache],
	);

	return (
		<BrowserLegalAccess
			backups={<ProjectBackups />}
			editor={(onOpenSettings) => <EditorApp
				onOpenSettings={onOpenSettings}
				pwaBrowseCache={pwaBrowseCache}
				pwaInstall={pwaInstall}
				pwaUpdate={pwaUpdate}
			/>}
		/>
	);
}

const renderer = createRoot(root);
const renderEditor = () =>
	renderer.render(
		<StrictMode>
		<Suspense
			fallback={<main aria-busy="true" aria-label="Загрузка редактора" />}
		>
			<PwaAwareEditorApp />
		</Suspense>
	</StrictMode>,
	);

if (__INTERIORS_TEST_SEAM__) {
	renderer.render(<main aria-busy="true" aria-label="Загрузка редактора" />);
	const startup = createDevelopmentStartupGate({
		origin: window.location.origin,
		serviceWorker:
			"serviceWorker" in navigator
				? {
						registrations: async () =>
							(await navigator.serviceWorker.getRegistrations()).map(
								(registration) => ({
									scope: registration.scope,
									scriptURLs: [
										registration.active,
										registration.waiting,
										registration.installing,
									].flatMap((worker) => (worker ? [worker.scriptURL] : [])),
									unregister: () => registration.unregister(),
								}),
							),
						controllerPresent: () =>
							navigator.serviceWorker.controller !== null,
					}
				: undefined,
		caches:
			typeof caches === "undefined"
				? undefined
				: {
						keys: () => caches.keys(),
						delete: (name) => caches.delete(name),
					},
		reloadState: {
			read: () => window.sessionStorage.getItem(DEVELOPMENT_RELOAD_KEY),
			write: () =>
				window.sessionStorage.setItem(DEVELOPMENT_RELOAD_KEY, "requested"),
			clear: () => window.sessionStorage.removeItem(DEVELOPMENT_RELOAD_KEY),
		},
		reload: () => window.location.reload(),
	});
	void startup.start().then((outcome) => {
		if (outcome.kind === "ready") renderEditor();
		else if (outcome.kind === "blocked")
			renderer.render(
				<main role="status">
					<p>
						Не удалось отключить прежний кеш редактора. Обновите страницу, чтобы
						продолжить.
					</p>
					<button type="button" onClick={() => window.location.reload()}>
						Обновить страницу
					</button>
				</main>,
			);
	});
} else renderEditor();
