import { describe, expect, it, rstest } from "@rstest/core";
import { renderToStaticMarkup } from "react-dom/server";
import { createHostFileBridge, createTelegramHostFileBridge } from "../adapters/telegram/host-file-bridge";
import {
	LocalFileTransferSession,
	LocalFileTransferPanel,
} from "./local-file-transfer";

const archive = () => ({
	bytes: Uint8Array.of(1, 2, 3),
	filename: "Room.interiors",
	fileKind: "portable-backup" as const,
});

describe("explicit local file handoff", () => {
	it("requires an explicit password before uploading a private Android copy", async () => {
		const stage = rstest.fn(async () => "/download-capability");
		const download = rstest.fn(async () => "requested" as const);
		const session = new LocalFileTransferSession({
			...createHostFileBridge({ maximumBytes: 20, system: {} }),
			encryptedDownload: { available: () => true, stage, download },
		}, () => undefined);
		await session.prepare(async () => archive());
		const markup = renderToStaticMarkup(<LocalFileTransferPanel session={session} state={session.snapshot()} telegram />);
		expect(markup).toContain("Пароль для копии");
		expect(markup).toContain("15 минут");
		expect(stage).not.toHaveBeenCalled();
		await session.stageEncrypted("short");
		expect(stage).not.toHaveBeenCalled();
		await session.stageEncrypted("надёжный пароль");
		expect(stage).toHaveBeenCalledTimes(1);
		expect(download).not.toHaveBeenCalled();
		expect(session.snapshot().kind).toBe("encrypted-ready");
		await session.downloadEncrypted();
		expect(download).toHaveBeenCalledWith("/download-capability", expect.any(AbortSignal));
	});

	it("shows preparation and active handoff separately, blocks duplicate actions, and notifies its view", async () => {
		let release: (() => void) | undefined;
		const changes: string[] = [];
		const bridge = createHostFileBridge({
			maximumBytes: 20,
			system: {
				canShare: () => true,
				share: () =>
					new Promise<void>((resolve) => {
						release = resolve;
					}),
			},
		});
		const session = new LocalFileTransferSession(bridge, (state) =>
			changes.push(state.kind),
		);
		expect(session.snapshot()).toEqual({ kind: "idle" });
		await session.handoff();
		const prepare = session.prepare(async () => {
			await new Promise<void>((resolve) => {
				release = resolve;
			});
			return archive();
		});
		let markup = renderToStaticMarkup(
			<LocalFileTransferPanel session={session} state={session.snapshot()} />,
		);
		expect(markup).toContain("Подготовка файла…");
		expect(markup).toContain("Отменить");
		expect(markup).toContain('aria-busy="true"');
		await session.handoff();
		release?.();
		await prepare;
		markup = renderToStaticMarkup(
			<LocalFileTransferPanel session={session} state={session.snapshot()} />,
		);
		expect(markup).toContain("Файл проекта");
		expect(markup).toContain("Файл готов к передаче");
		expect(markup).toContain("Закрыть");
		expect(markup).not.toContain("не полный backup");
		expect(markup).toContain('aria-busy="false"');
		const transfer = session.handoff();
		markup = renderToStaticMarkup(
			<LocalFileTransferPanel session={session} state={session.snapshot()} />,
		);
		expect(markup).toContain("Передача файла…");
		expect(markup).toContain('<p role="status">Передача файла…</p>');
		expect(markup).toMatch(/<button[^>]*disabled[^>]*>Передача файла…<\/button>/);
		expect(markup).toContain("disabled");
		expect(markup).toContain("Отменить");
		release?.();
		await transfer;
		expect(changes).toEqual([
			"idle",
			"preparing",
			"prepared",
			"handing-off",
			"handoff-attempted",
		]);
	});
	it("does not prepare a cancelled archive, contains a reentrant preparation cancellation and unexpected handoff failures", async () => {
		const bridge = createHostFileBridge({ maximumBytes: 20, system: {} });
		let calls = 0;
		let release: (() => void) | undefined;
		const session = new LocalFileTransferSession(
			{
				...bridge,
				prepare: (...args) => {
					calls++;
					return bridge.prepare(...args);
				},
			},
			() => undefined,
		);
		const pending = session.prepare(async () => {
			await new Promise<void>((resolve) => {
				release = resolve;
			});
			return archive();
		});
		session.close();
		release?.();
		await pending;
		expect(calls).toBe(0);
		let reentrant: LocalFileTransferSession;
		reentrant = new LocalFileTransferSession(
			{
				...bridge,
				prepare: (...args) => {
					const result = bridge.prepare(...args);
					reentrant.close();
					return result;
				},
			},
			() => undefined,
		);
		await reentrant.prepare(async () => archive());
		expect(reentrant.snapshot()).toEqual({ kind: "idle" });
		for (const rejected of [false, true]) {
			const broken = new LocalFileTransferSession(
				{
					...bridge,
					handoff: async () => {
						if (rejected)
							return { kind: "rejected", reasonCode: "FILE_LIMIT_EXCEEDED" };
						throw new Error("System unavailable");
					},
				},
				() => undefined,
			);
			await broken.prepare(async () => archive());
			await broken.handoff();
			expect(broken.snapshot().kind).toBe("failed");
			expect(
				"prepared" in broken.snapshot() &&
					(broken.snapshot() as { prepared?: unknown }).prepared,
			).toBeTruthy();
		}
		for (const phase of ["prepare", "handoff"]) {
			let reject: ((reason: Error) => void) | undefined;
			const late = new LocalFileTransferSession(
				{
					...bridge,
					handoff: () =>
						new Promise((_, fail) => {
							reject = fail;
						}),
				},
				() => undefined,
			);
			if (phase === "handoff") await late.prepare(async () => archive());
			const work =
				phase === "prepare"
					? late.prepare(
							() =>
								new Promise((_, fail) => {
									reject = fail;
								}),
						)
					: late.handoff();
			late.close();
			reject?.(new Error("Late failure"));
			await work;
			expect(late.snapshot()).toEqual({ kind: "idle" });
		}
	});
	it("prepares a file without handing it off, then reports only the system attempt and allows retry", async () => {
		let shares = 0;
		const session = new LocalFileTransferSession(
			createHostFileBridge({
				maximumBytes: 20,
				system: {
					canShare: () => true,
					share: async ({ files }) => {
						shares++;
						expect(await files?.[0].arrayBuffer()).toEqual(
							Uint8Array.of(1, 2, 3).buffer,
						);
					},
				},
			}),
			() => undefined,
		);
		await session.prepare(async () => archive());
		expect(shares).toBe(0);
		expect(session.snapshot().kind).toBe("prepared");
		let markup = renderToStaticMarkup(
			<LocalFileTransferPanel session={session} state={session.snapshot()} />,
		);
		expect(markup).toContain("Передать файл");
		expect(markup).toContain("Room.interiors");
		expect(markup).not.toContain("Файл сохранён");
		await session.handoff();
		expect(shares).toBe(1);
		expect(session.snapshot().kind).toBe("handoff-attempted");
		markup = renderToStaticMarkup(
			<LocalFileTransferPanel session={session} state={session.snapshot()} />,
		);
		expect(markup).toContain("Проверьте файл вне приложения");
		expect(markup).toContain(">Повторить</button>");
		await session.retry();
		expect(shares).toBe(2);
	});
	it("discards late preparation and system outcomes after cancellation or replacement", async () => {
		let release: (() => void) | undefined;
		let prepareSignal: AbortSignal | undefined;
		const session = new LocalFileTransferSession(
			createHostFileBridge({ maximumBytes: 20, system: {} }),
			() => undefined,
		);
		const work = session.prepare(async (signal) => {
			prepareSignal = signal;
			await new Promise<void>((resolve) => {
				release = resolve;
			});
			return archive();
		});
		expect(session.snapshot().kind).toBe("preparing");
		session.close();
		expect(prepareSignal?.aborted).toBe(true);
		release?.();
		await work;
		expect(session.snapshot().kind).toBe("idle");
		await session.prepare(async () => archive());
		expect(session.snapshot().kind).toBe("prepared");
		const handed = new LocalFileTransferSession(
			createHostFileBridge({
				maximumBytes: 20,
				system: {
					canShare: () => true,
					share: () =>
						new Promise<void>((resolve) => {
							release = resolve;
						}),
				},
			}),
			() => undefined,
		);
		await handed.prepare(async () => archive());
		const transfer = handed.handoff();
		expect(handed.snapshot().kind).toBe("handing-off");
		handed.close();
		release?.();
		await transfer;
		expect(handed.snapshot().kind).toBe("idle");
	});
	it("keeps unsupported, failed and cancelled outcomes distinct and prevents duplicate active handoffs", async () => {
		for (const outcome of ["unsupported", "failed", "cancelled"] as const) {
			const session = new LocalFileTransferSession(
				createHostFileBridge({
					maximumBytes: 20,
					system:
						outcome === "unsupported"
							? {}
							: {
									canShare: () => true,
									share: async () => {
										throw new DOMException(
											"",
											outcome === "cancelled"
												? "AbortError"
												: "NotAllowedError",
										);
									},
								},
				}),
				() => undefined,
			);
			await session.prepare(async () => archive());
			await session.handoff();
			expect(session.snapshot().kind).toBe(outcome);
			const markup = renderToStaticMarkup(
				<LocalFileTransferPanel session={session} state={session.snapshot()} />,
			);
			expect(markup).toContain(
				outcome === "unsupported"
					? "Передача файла недоступна"
					: outcome === "failed"
						? "Не удалось передать файл"
						: "Передача отменена",
			);
			expect(markup).toContain(">Повторить</button>");
			expect(markup).toContain("Закрыть");
		}
		let shares = 0;
		const releases: (() => void)[] = [];
		const session = new LocalFileTransferSession(
			createHostFileBridge({
				maximumBytes: 20,
				system: {
					canShare: () => true,
					share: () => {
						shares++;
						return new Promise<void>((resolve) => {
							releases.push(resolve);
						});
					},
				},
			}),
			() => undefined,
		);
		await session.prepare(async () => archive());
		const first = session.handoff();
		const second = session.handoff();
		try {
			// Assert the public OS-dispatch count before awaiting the held work.
			expect(shares).toBe(1);
			await second;
		} finally {
			// Release every supplied operation, including incorrect duplicates.
			for (const release of releases) release();
			await Promise.allSettled([first, second]);
		}
	});
	it("contains preparation failures and limits, and labels a recovery draft separately", async () => {
		for (const produce of [
			async () => {
				throw new Error("read failed");
			},
			async () => undefined,
			async () => ({ ...archive(), bytes: new Uint8Array(21) }),
		]) {
			const session = new LocalFileTransferSession(
				createHostFileBridge({ maximumBytes: 20, system: {} }),
				() => undefined,
			);
			await session.prepare(produce);
			expect(session.snapshot().kind).toBe("failed");
		}
		const session = new LocalFileTransferSession(
			createHostFileBridge({ maximumBytes: 20, system: {} }),
			() => undefined,
		);
		await session.prepare(async () => ({
			...archive(),
			fileKind: "recovery-draft",
		}));
		const markup = renderToStaticMarkup(
			<LocalFileTransferPanel session={session} state={session.snapshot()} />,
		);
		expect(markup).toContain("Несохранённая правка");
		expect(markup).toContain("не полный backup");
		session.close();
		expect(
			renderToStaticMarkup(
				<LocalFileTransferPanel session={session} state={session.snapshot()} />,
			),
		).toBe("");
	});
});


it("explains an incomplete local save without attributing it to the user", async () => {
	rstest.stubGlobal("showSaveFilePicker", async () => {
		throw new DOMException("The user aborted a request", "AbortError");
	});
	try {
		const session = new LocalFileTransferSession(
			createTelegramHostFileBridge({ maximumBytes: 20 }),
			() => undefined,
		);
		await session.prepare(async () => archive());
		await session.handoff();
		const markup = renderToStaticMarkup(
			<LocalFileTransferPanel session={session} state={session.snapshot()} telegram />,
		);
		expect(markup).toContain("Система не завершила сохранение файла");
		expect(markup).toContain("сохранение может быть недоступно");
		expect(markup).toContain(">Повторить</button>");
	} finally {
		rstest.unstubAllGlobals();
	}
});

it("offers retry after a preparation failure and keeps the next transfer user-initiated", async () => {
	let attempts = 0;
	let shares = 0;
	const session = new LocalFileTransferSession(
		createHostFileBridge({ maximumBytes: 20, system: {
			canShare: () => true,
			share: async () => { shares++; },
		} }),
		() => undefined,
	);
	await session.prepare(async () => ++attempts === 1 ? undefined : archive());
	const markup = renderToStaticMarkup(
		<LocalFileTransferPanel session={session} state={session.snapshot()} telegram />,
	);
	expect(markup).toContain("Не удалось подготовить файл");
	expect(markup).toContain(">Повторить</button>");
	await session.retry();
	expect(session.snapshot().kind).toBe("prepared");
	expect(shares).toBe(0);
	await session.handoff();
	expect(shares).toBe(1);
	session.close();
	await session.retry();
	expect(attempts).toBe(2);
	expect(shares).toBe(1);
});

it("retries a transfer failure with the same file without recreating the archive", async () => {
	const bytes = archive();
	const attempted: File[] = [];
	let preparations = 0;
	const session = new LocalFileTransferSession(
		createHostFileBridge({ maximumBytes: 20, system: {
			canShare: () => true,
			share: async ({ files }) => {
				attempted.push(...(files ?? []));
				if (attempted.length === 1) throw new Error("Share failed");
			},
		} }),
		() => undefined,
	);
	await session.prepare(async () => {
		preparations++;
		return bytes;
	});
	await session.handoff();
	expect(session.snapshot().kind).toBe("failed");
	await session.retry();
	expect(session.snapshot().kind).toBe("handoff-attempted");
	expect(preparations).toBe(1);
	expect(attempted).toHaveLength(2);
	expect(attempted[1]).toBe(attempted[0]);
});

it("labels stored source as unverified data and never as a complete project backup or unsaved draft",async()=>{
 const session=new LocalFileTransferSession(createHostFileBridge({maximumBytes:20,system:{}}),()=>undefined);
 await session.prepare(async()=>({bytes:Uint8Array.of(123,125),filename:"stored-source.interiors-source.json",fileKind:"unverified-source"}));
 const markup=renderToStaticMarkup(<LocalFileTransferPanel session={session} state={session.snapshot()}/>);
 expect(markup).toContain("Непроверенная исходная запись");expect(markup).toContain("Это не резервная копия проекта и не файл несохранённой правки");expect(markup).toContain("Передать файл");expect(markup).not.toContain("<h2>Файл проекта</h2>");
});


it("keeps post-handoff source warnings distinct from backup and recovery-draft guidance", async () => {
	for (const fileKind of ["portable-backup", "recovery-draft", "unverified-source"] as const) {
		let shares = 0;
		const session = new LocalFileTransferSession(
			createHostFileBridge({ maximumBytes: 20, system: {
				canShare: () => true,
				share: async () => { shares++; },
			} }),
			() => undefined,
		);
		await session.prepare(async () => ({ ...archive(), fileKind }));
		expect(shares).toBe(0);
		await session.handoff();
		expect(shares).toBe(1);
		expect(session.snapshot().kind).toBe("handoff-attempted");
		const markup = renderToStaticMarkup(
			<LocalFileTransferPanel session={session} state={session.snapshot()} />,
		);
		expect(markup).toContain("Проверьте файл вне приложения");
		if (fileKind === "unverified-source") {
			expect(markup).toContain("Системное действие не подтверждает его сохранность");
			expect(markup).toContain("этот файл не восстанавливает проект автоматически");
			expect(markup).not.toContain("выберите полученный файл для проверки импорта");
		} else {
			expect(markup).toContain("выберите полученный файл для проверки импорта");
			expect(markup).not.toContain("Содержимое записи не проверено");
		}
	}
});
