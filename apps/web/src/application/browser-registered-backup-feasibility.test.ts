import { expect, it } from "@rstest/core";
import { createInitialProject } from "../domain/initial-project";
import { configureRectangularRoom } from "../domain/rectangular-room";
import { assessBackupFeasibility } from "./backup-feasibility-policy";
import { createBrowserRegisteredBackupFeasibility } from "./browser-registered-backup-feasibility";
import { canonicalProjectSerializer } from "./create-project";
import type { PublicationCandidate } from "./ports";

const browserRegisteredBackupFeasibility =
	createBrowserRegisteredBackupFeasibility({
		sha256Bytes: async () => {
			throw new Error("No resources in this fixture");
		},
	});
const instant = "2026-11-05T00:00:00.000Z";
function candidate(): PublicationCandidate {
	let n = 0;
	const configured = configureRectangularRoom(
		createInitialProject({
			projectId: "11111111-1111-4111-8111-111111111111",
			levelId: "level",
			name: "Valid",
			createdAt: instant,
		}),
		{ widthMm: "4000", depthMm: "3000", heightMm: "2600" },
		{ next: () => `geometry-${++n}` },
		instant,
	);
	if (configured.kind !== "accepted") throw new Error("Bad fixture");
	const project = configured.project;
	return {
		project,
		revision: {
			projectId: project.projectId,
			revisionId: "22222222-2222-4222-8222-222222222222",
			createdAt: instant,
			schemaVersion: 1,
			serializedProject: canonicalProjectSerializer.serialize(project),
			checksum: "not-used-by-size-policy",
		},
	};
}
it("keeps healthy ordinary candidates accepted by the real previous feasibility checks", async () => {
	expect(await browserRegisteredBackupFeasibility.assess(candidate())).toEqual({
		kind: "accepted",
	});
});
for (const value of ["own-undefined", "negative-zero"] as const) {
	it(`rejects newly produced ${value} before Durable even when ordinary legacy feasibility accepts its normalized internal JSON`, async () => {
		const c = candidate();
		const project =
			value === "own-undefined"
				? {
						...c.project,
						level: {
							...c.project.level,
							rooms: c.project.level.rooms.map((room) => ({
								...room,
								name: undefined,
							})),
						},
					}
				: {
						...c.project,
						level: {
							...c.project.level,
							vertices: c.project.level.vertices.map((v, index) =>
								index === 0 ? { ...v, xMm: -0 } : v,
							),
						},
					};
		const changed = {
			project,
			revision: {
				...c.revision,
				serializedProject: canonicalProjectSerializer.serialize(project),
			},
		};
		expect(await assessBackupFeasibility(changed)).toEqual({
			kind: "accepted",
		});
		expect(await browserRegisteredBackupFeasibility.assess(changed)).toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
		});
	});
}

it("rejects a non-V1 Project or Revision even if the old serialized size/envelope assessment accepts it", async () => {
	for (const field of ["project", "revision"] as const) {
		const value = candidate();
		Reflect.set(value[field], "schemaVersion", 2);
		expect(await assessBackupFeasibility(value)).toEqual({ kind: "accepted" });
		expect(await browserRegisteredBackupFeasibility.assess(value)).toEqual({
			kind: "rejected",
			reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
		});
	}
});
it("preserves old malformed internal JSON refusal for an otherwise representable resource-free Project", async () => {
	const value = candidate(),
		broken = {
			...value,
			revision: { ...value.revision, serializedProject: "{" },
		};
	expect(await assessBackupFeasibility(broken)).toEqual({
		kind: "rejected",
		reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
	});
	expect(await browserRegisteredBackupFeasibility.assess(broken)).toEqual({
		kind: "rejected",
		reasonCode: "PROJECT_BACKUP_ENVELOPE_EXCEEDED",
	});
});
