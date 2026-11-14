import { describe, expect, it } from "@rstest/core";
import { createInitialProject } from "../domain/initial-project";
import { canonicalProjectSerializer } from "./create-project";
import { encodeBrowserBackupUtf8 } from "./browser-backup-representability";
import { ImportPortableBackupUseCase } from "./import-portable-backup";
import type {
	PortableBackupImportAdmissionFailure,
	PortableBackupImportProfilePort,
	PublicationCandidate,
} from "./ports";

function fixture(
	selection?: (
		proposed: string,
	) => Promise<
		| { readonly kind: "selected"; readonly projectId: string }
		| PortableBackupImportAdmissionFailure
	>,
) {
	const source = createInitialProject({
		projectId: "source",
		levelId: "level",
		name: "Source",
		createdAt: "2026-11-04T12:00:00.000Z",
	});
	const events: string[] = [];
	let ids = 0;
	let published: PublicationCandidate | undefined;
	const profile: PortableBackupImportProfilePort = {
		source,
		...(selection
			? {
					selectProjectId: async (proposed: string) => {
						events.push("select");
						return selection(proposed);
					},
				}
			: {}),
		seal: async (candidate) => {
			events.push("seal");
			return { kind: "accepted", candidate };
		},
		beforePublish: async () => ({ kind: "accepted" }),
	};
	const useCase = new ImportPortableBackupUseCase({
		decoder: {
			decode: async () => ({
				kind: "accepted",
				projectBytes: encodeBrowserBackupUtf8(
					canonicalProjectSerializer.serialize(source),
				),
			}),
		},
		smoke: {
			verify: async () => {
				events.push("smoke");
				return true;
			},
		},
		admission: {
			prepare: async () => {
				events.push("bootstrap");
				return { kind: "accepted", profile };
			},
			isRetryBlocked: () => false,
		},
		ids: {
			next: () => {
				events.push("id");
				return ["proposed-project", "revision"][ids++];
			},
		},
		clock: { now: () => "2026-11-05T00:00:00.000Z" },
		checksum: {
			sha256: async (value) => {
				events.push("checksum");
				return value;
			},
		},
		serializer: {
			serialize: (project) => {
				events.push("serialize");
				return canonicalProjectSerializer.serialize(project);
			},
		},
		repository: {
			loadCurrent: async () => ({ kind: "empty" }),
			recover: async () => ({ kind: "recovered" }),
			publish: async (candidate) => {
				events.push("publish");
				if (
					candidate.project.schemaVersion !== 1 ||
					candidate.revision.schemaVersion !== 1
				)
					throw new Error("V1 fixture expected");
				published = {
					project: candidate.project,
					revision: candidate.revision,
				};
				return { kind: "durable" };
			},
		},
	});
	return {
		useCase,
		events,
		get ids() {
			return ids;
		},
		get published() {
			return published;
		},
	};
}

describe("registered Project identity selection hook", () => {
	it("uses the asynchronously selected exact ID in Project, internal serialization, checksum and Revision before any publication", async () => {
		const f = fixture(async (proposed) => {
			expect(proposed).toBe("proposed-project");
			return { kind: "selected", projectId: "selected-project" };
		});
		expect(
			await f.useCase.execute(Uint8Array.of(80, 75), () => undefined),
		).toEqual({
			kind: "durable",
			projectId: "selected-project",
			revisionId: "revision",
		});
		expect(f.published?.project.projectId).toBe("selected-project");
		expect(f.published?.revision.projectId).toBe("selected-project");
		const published = f.published;
		if (!published) throw new Error("Missing published fixture");
		expect(published.revision.serializedProject).toBe(
			canonicalProjectSerializer.serialize(published.project),
		);
		expect(f.published?.revision.checksum).toBe(
			f.published?.revision.serializedProject,
		);
		expect(f.events).toEqual([
			"smoke",
			"bootstrap",
			"id",
			"select",
			"serialize",
			"checksum",
			"id",
			"seal",
			"publish",
		]);
	});
	for (const result of [
		{ kind: "verification-unavailable" },
		{ kind: "rejected", reasonCode: "BACKUP_SCHEMA_UNREADABLE" },
	] as const) {
		it(`preserves ${result.kind} identity failure before Revision allocation, serialization, staging or publication`, async () => {
			const f = fixture(async () => result),
				statuses: string[] = [];
			expect(
				await f.useCase.execute(Uint8Array.of(80, 75), (status) =>
					statuses.push(status.kind),
				),
			).toBe(result);
			expect(f.ids).toBe(1);
			expect(f.events).toEqual(["smoke", "bootstrap", "id", "select"]);
			expect(statuses).toEqual(["validating", "checking-render"]);
		});
	}
	it("keeps late cancellation and a throwing identity verifier unavailable without labeling the file corrupt", async () => {
		for (const cancel of [false, true]) {
			const signal = { aborted: false };
			const f = fixture(async () => {
				if (cancel) signal.aborted = true;
				throw new Error("Lookup unavailable");
			});
			expect(
				await f.useCase.execute(Uint8Array.of(80, 75), () => undefined, signal),
			).toEqual(
				cancel
					? { kind: "rejected", reasonCode: "PORTABLE_BACKUP_CANCELLED" }
					: { kind: "verification-unavailable" },
			);
			expect(f.events).toEqual(["smoke", "bootstrap", "id", "select"]);
			expect(f.ids).toBe(1);
		}
	});
	it("preserves the existing two allocations and order when the optional hook is absent", async () => {
		const f = fixture();
		expect(
			await f.useCase.execute(Uint8Array.of(80, 75), () => undefined),
		).toEqual({
			kind: "durable",
			projectId: "proposed-project",
			revisionId: "revision",
		});
		expect(f.ids).toBe(2);
		expect(f.events).toEqual([
			"smoke",
			"bootstrap",
			"id",
			"serialize",
			"checksum",
			"id",
			"seal",
			"publish",
		]);
	});
});
