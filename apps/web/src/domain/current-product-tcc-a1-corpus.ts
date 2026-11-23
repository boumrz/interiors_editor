/**
 * The current-product TCC-A1 corpus composes the active detached domain
 * boundaries.  It is evidence only: its executor has no Project repository,
 * revision, writer-fence or allocation-store port.
 */

import { addWallSegment } from "./add-wall-segment";
import { classifyActiveAlphaProjectBytes } from "./current-ppj-a1-legacy-classifier";
import {
	deriveBoundedOrthogonalFaces,
	type PlanGraph,
} from "./derive-plan-faces";
import { resolveOrthogonalPlanFaces } from "./derived-orthogonal-plan-faces";
import { deriveEmptyPlanGraphWallCandidate } from "./empty-plan-graph-wall-candidate";
import { addDoorOpeningToProject } from "./door-opening-project";
import { createInitialProject } from "./initial-project";
import {
	createInitialWallMaterializationTccA1Executor,
	initialWallMaterializationTccA1Corpus,
} from "./initial-wall-materialization-tcc-a1-corpus";
import {
	measureDistance,
	type MeasurementRequest,
} from "./measurement-request";
import { formatLengthMm } from "./measurement-format";
import { createParametricWallItem } from "./parametric-wall-item";
import { configureRectangularRoom } from "./rectangular-room";
import {
	addGeneralWallToProject,
	deleteGeneralWallWithConsequenceResolution,
	deleteGeneralWallWithOpeningResolution,
	previewOpeningConflictForWallDeletion,
	previewWallAddHostConflict,
	splitGeneralWall,
} from "./general-wall-project";
import type { Project } from "./project";
import {
	TCC_A1_CONTRACT_ID,
	TCC_A1_CONTRACT_VERSION,
	type TccA1CorpusExecutor,
	type TccA1CorpusManifest,
	type TccA1FixtureHashPort,
	type TccA1Outcome,
} from "./tcc-a1-corpus-runner";
import type { ContentHashPort } from "./materialize-initial-wall-segment";

type DirectionVector =
	| "negative-zero"
	| "cardinal-east"
	| "diagonal-ne"
	| "diagonal-nw"
	| "diagonal-se"
	| "diagonal-sw"
	| "length-only-ne"
	| "bounds"
	| "zero"
	| "unsupported";

type ContactVector =
	| "endpoint-vertex"
	| "endpoint-interior-t"
	| "candidate-interior-junction"
	| "one-x"
	| "multi-x"
	| "fractional-contact"
	| "duplicate-identity"
	| "collinear-overlap"
	| "zero-partition"
	| "short-partition"
	| "retained-short-partition";

type FaceVector =
	| "exterior"
	| "multi-room"
	| "void-ring"
	| "repeated-walk"
	| "touching-ring"
	| "nested-ring"
	| "odd-miter-bevel"
	| "usable-collapse";

type LineageVector =
	| "merge-choice-reentry"
	| "opening-cancel-preview"
	| "opening-delete"
	| "one-to-one-room"
	| "add-split-height"
	| "opening-rehome"
	| "wall-surface-rehome"
	| "host-conflict-preview";

type CurrentProductTccA1Intent =
	| {
			readonly family: "directions";
			readonly kind: "raw-wall";
			readonly vector: DirectionVector;
	  }
	| { readonly family: "contacts"; readonly kind: ContactVector }
	| { readonly family: "faces"; readonly kind: FaceVector }
	| { readonly family: "lineage-and-hosts"; readonly kind: LineageVector }
	| {
			readonly family: "measurement-and-projections";
			readonly kind: "exact-distance";
			readonly vector:
				| "exact-distance"
				| "stale"
				| "target-unavailable"
				| "shared-format";
	  }
	| {
			readonly family: "commands-and-lifecycle";
			readonly kind: "initial-wall-lifecycle";
			readonly vector: "cancelled" | "stale-base" | "lost-fence";
	  };

type CurrentProductKernelIntent = CurrentProductTccA1Intent;

type CurrentProductLegacyVector =
	| "current-ppj-a1"
	| "v1-like"
	| "v2-like"
	| "unregistered-future";

type CurrentProductLegacyTccA1Intent = {
	readonly family: "legacy-and-ingress";
	readonly kind: "classify-active-alpha-bytes";
	readonly vector: CurrentProductLegacyVector;
};

const EMPTY_GRAPH_DIGEST =
	"26674bcb07ee4e553621347ee3bcdd03c70088ddb02c35a54149ed272c885bcb";
const DIRECTIONS_BASE = "tcc-a1:current-product:directions:empty";
const CONTACTS_BASE = "tcc-a1:current-product:contacts:normalized";
const FACES_BASE = "tcc-a1:current-product:faces:rectangle-graph";
const LINEAGE_BASE = "tcc-a1:current-product:lineage:room-1";
const MEASUREMENT_BASE = "tcc-a1:current-product:measurement:revision-1";
const LEGACY_BASE = "tcc-a1:current-product:legacy-and-ingress";

/** Fixed ASCII fixture bytes and source-owned SHA-256 declarations. */
const raw = {
	directions:
		'{"family":"directions","kind":"diagonal-length","start":{"xMm":"0","zMm":"0"},"lengthMm":"1414","quadrant":"NE"}',
	lifecycle:
		'{"family":"commands-and-lifecycle","kind":"initial-wall-materialization","reservation":"Cancelled"}',
	measurement:
		'{"family":"measurement-and-projections","kind":"distance","from":{"xMm":0,"zMm":0},"to":{"xMm":3000,"zMm":4000}}',
} as const;

export const historicalCurrentProductTccA1CorpusRevision1: TccA1CorpusManifest<CurrentProductKernelIntent> =
	{
		contractId: TCC_A1_CONTRACT_ID,
		contractVersion: TCC_A1_CONTRACT_VERSION,
		corpusId: "interiors.tcc-a1.current-product-boundaries",
		corpusRevision: 1,
		executorRole: "domain-kernel",
		fixtures: [
			directionFixture(
				"TCC-A1-DIR-NEGZERO",
				"negative-zero",
				'{"family":"directions","vector":"negative-zero","kind":"endpoints"}',
				"e90161f1ba374ae7533516024ae7075c8d3e37602c67a9f8e674625032842be0",
				"tcc-a1:detached-plan-graph:wall:0,0:1000,0",
			),
			directionFixture(
				"TCC-A1-DIR-E",
				"cardinal-east",
				'{"family":"directions","vector":"cardinal-east","kind":"endpoints"}',
				"2b76217bc7c6e4ccce7cb2d740e752bf75cd21ab6da34bf9d5893a35d2db970c",
				"tcc-a1:detached-plan-graph:wall:0,0:1000,0",
			),
			directionFixture(
				"TCC-A1-DIR-NE",
				"diagonal-ne",
				'{"family":"directions","vector":"diagonal-ne","kind":"endpoints"}',
				"790a7ee6fc44038f2974f0a6d08593bde3bf4a659d4f764a719dbf42572ecc42",
				"tcc-a1:detached-plan-graph:wall:0,0:1000,1000",
			),
			directionFixture(
				"TCC-A1-DIR-NW",
				"diagonal-nw",
				'{"family":"directions","vector":"diagonal-nw","kind":"endpoints"}',
				"3705d65d3079996240a0ff0ad3ef3ef1dce6b874c6b3b3afc6bf8486a4c3d441",
				"tcc-a1:detached-plan-graph:wall:0,0:-1000,1000",
			),
			directionFixture(
				"TCC-A1-DIR-SE",
				"diagonal-se",
				'{"family":"directions","vector":"diagonal-se","kind":"endpoints"}',
				"6570e112802784788e9207578ae17365cb3c302a123df05f9b292681786e81ad",
				"tcc-a1:detached-plan-graph:wall:0,0:1000,-1000",
			),
			directionFixture(
				"TCC-A1-DIR-SW",
				"diagonal-sw",
				'{"family":"directions","vector":"diagonal-sw","kind":"endpoints"}',
				"573c11c11ee9dbd6976b860c2b3725cd05af56af965f9a4e901b6d4972ae1376",
				"tcc-a1:detached-plan-graph:wall:0,0:-1000,-1000",
			),
			directionFixture(
				"TCC-A1-DIR-LENGTH",
				"length-only-ne",
				'{"family":"directions","vector":"length-only-ne","kind":"diagonal-length"}',
				"591e5f0e2945f9ad6b968178a8c0dc92a86aa3b219481325a889e1fb19c0052d",
				"tcc-a1:detached-plan-graph:wall:0,0:1000,1000",
			),
			directionRejectFixture(
				"TCC-A1-DIR-BOUNDS",
				"bounds",
				'{"family":"directions","vector":"bounds","kind":"endpoints"}',
				"6da695994576c61a669947c7289623ddef9c9b7c35ac8a5eee0fe8f5006f61ce",
				"PROJECT_BOUNDS_EXCEEDED",
			),
			directionRejectFixture(
				"TCC-A1-DIR-ZERO",
				"zero",
				'{"family":"directions","vector":"zero","kind":"endpoints"}',
				"3d906d118b4f9a3d9d182164fabcfad153d00c0dd5067bec820d293108d263d0",
				"ZERO_LENGTH",
			),
			directionRejectFixture(
				"TCC-A1-DIR-UNSUPPORTED",
				"unsupported",
				'{"family":"directions","vector":"unsupported","kind":"endpoints"}',
				"e5dff8304ff6dc4e3e4caca4e215ee7a55d246ef10959c5a3f6c5fe18d1c1178",
				"UNSUPPORTED_DIRECTION",
			),
			contactFixture(
				"TCC-A1-CONTACT-ENDPOINT",
				"endpoint-vertex",
				'{"family":"contacts","vector":"endpoint-vertex","kind":"add-wall"}',
				"8adb88bb8a1742469fef3e1c9c8e9f72bacbcc82620f4edc6543c1e111afa4b1",
			),
			contactFixture(
				"TCC-A1-CONTACT-T",
				"endpoint-interior-t",
				'{"family":"contacts","vector":"endpoint-interior-t","kind":"add-wall"}',
				"40db7968d27df8d0eba5bb744c21a3c64badfa4527b1ba780767134618c55f88",
			),
			contactFixture(
				"TCC-A1-CONTACT-JUNCTION",
				"candidate-interior-junction",
				'{"family":"contacts","vector":"candidate-interior-junction","kind":"add-wall"}',
				"31a1d5992add8169db2c29d5d9867fb431ca47fa53d6fdedfd38e7d5c48fc273",
			),
			contactFixture(
				"TCC-A1-CONTACT-X",
				"one-x",
				'{"family":"contacts","vector":"one-x","kind":"add-wall"}',
				"91cd4011850b6572b0681a3d89df05cfa3592654aa67984878711e768ee1f36f",
			),
			contactFixture(
				"TCC-A1-CONTACT-MULTI-X",
				"multi-x",
				'{"family":"contacts","vector":"multi-x","kind":"add-wall"}',
				"1987b92d4c8a690b751169e0995158f209187f16e6fd4fbd8f45d903532fbc40",
			),
			contactFixture(
				"TCC-A1-CONTACT-FRACTIONAL",
				"fractional-contact",
				'{"family":"contacts","vector":"fractional-contact","kind":"add-wall"}',
				"54d0f60cb0c24bf88ccbd519c000844c6831f09b2765e60edb30b44744e90f2b",
			),
			contactFixture(
				"TCC-A1-CONTACT-DUPLICATE",
				"duplicate-identity",
				'{"family":"contacts","vector":"duplicate-identity","kind":"add-wall"}',
				"191a979b96e81bdbbfdeb58f4f4f6917ede64d8e3a6bcb6d96bc7b5a20fa2671",
			),
			contactFixture(
				"TCC-A1-CONTACT-OVERLAP",
				"collinear-overlap",
				'{"family":"contacts","vector":"collinear-overlap","kind":"add-wall"}',
				"7c92092355809cda106a97df0565166d77bacb548bd3ec5cf64939d5906ae9fa",
			),
			contactFixture(
				"TCC-A1-CONTACT-ZERO-PARTITION",
				"zero-partition",
				'{"family":"contacts","vector":"zero-partition","kind":"add-wall"}',
				"813480668afa5aa47f656c9224247d13492a3690708cb4d192d683a9669b082d",
			),
			contactFixture(
				"TCC-A1-CONTACT-SHORT-PARTITION",
				"short-partition",
				'{"family":"contacts","vector":"short-partition","kind":"add-wall"}',
				"1f123172acd28cad53ddd6a6da6f16f8a174166125e97a32703c2fb3d7bed5fd",
			),
			faceFixture(
				"TCC-A1-FACE-EXTERIOR",
				"exterior",
				'{"family":"faces","vector":"exterior","kind":"derive"}',
				"fee03b60d8ac36bea567832cc2c6d0ddd1461dbc97d461dd583aa5d3cf8a76d0",
			),
			faceFixture(
				"TCC-A1-FACE-MULTI-ROOM",
				"multi-room",
				'{"family":"faces","vector":"multi-room","kind":"derive"}',
				"422bd856742b8dabea7d4213f09187a01e4a49eb43e472d07c606e0c1b202ff7",
			),
			faceFixture(
				"TCC-A1-FACE-VOID-RING",
				"void-ring",
				'{"family":"faces","vector":"void-ring","kind":"derive"}',
				"74a32203c157451a96538440872d88a8bf5867ad9a960ca559047812c9b04f31",
			),
			faceFixture(
				"TCC-A1-FACE-REPEATED-WALK",
				"repeated-walk",
				'{"family":"faces","vector":"repeated-walk","kind":"derive"}',
				"be0b5317058574fa6c9cdff0bcafa6097a95acf917f3f3618712455baa5ba6d9",
			),
			faceFixture(
				"TCC-A1-FACE-TOUCHING-RING",
				"touching-ring",
				'{"family":"faces","vector":"touching-ring","kind":"derive"}',
				"4cc799d58dced3c4386bd2490cb419e367a44be5498be3fd35b626d5734bcf7c",
			),
			faceFixture(
				"TCC-A1-FACE-NESTED-RING",
				"nested-ring",
				'{"family":"faces","vector":"nested-ring","kind":"derive"}',
				"282b9231ba1d34af5a719ce792017c1d826d07aa697d232948649b1603b9617c",
			),
			faceFixture(
				"TCC-A1-FACE-ODD-MITER",
				"odd-miter-bevel",
				'{"family":"faces","vector":"odd-miter-bevel","kind":"derive"}',
				"eb59b95f3dbbc71612aa363dfaf34666db2cc3352d76a340901413d93deb5997",
			),
			faceFixture(
				"TCC-A1-FACE-USABLE-COLLAPSE",
				"usable-collapse",
				'{"family":"faces","vector":"usable-collapse","kind":"derive"}',
				"d96ab19256350b615c86e174a7d29d9046302db88bd8460a2d12ac33c7e48025",
			),
			lineageFixture(
				"TCC-A1-LINEAGE-ONE-TO-ONE",
				"one-to-one-room",
				'{"family":"lineage-and-hosts","vector":"one-to-one-room","kind":"project-command"}',
				"376fccf493f5327a1cf17451325039826b3c7cd9fbf3905ac0a6ee66e26b6232",
			),
			lineageFixture(
				"TCC-A1-LINEAGE-MERGE-CHOICE-REENTRY",
				"merge-choice-reentry",
				'{"family":"lineage-and-hosts","vector":"merge-choice-reentry","kind":"project-command"}',
				"f420bd5e1668874d1b60aa67556b0988de54edb3f028ccea23da24f7b52ce79b",
			),
			lineageFixture(
				"TCC-A1-LINEAGE-ADD-SPLIT-HEIGHT",
				"add-split-height",
				'{"family":"lineage-and-hosts","vector":"add-split-height","kind":"project-command"}',
				"0c80c93dd1874c11f59314d1c02ad21986f31462cbc638ac736ce452b045ef46",
			),
			lineageFixture(
				"TCC-A1-LINEAGE-OPENING-REHOME",
				"opening-rehome",
				'{"family":"lineage-and-hosts","vector":"opening-rehome","kind":"project-command"}',
				"b613be5ea0f02b3975e23c5b3e1f51b5995157b539acf8e2c00d99f02571f0a5",
			),
			lineageFixture(
				"TCC-A1-LINEAGE-OPENING-DELETE",
				"opening-delete",
				'{"family":"lineage-and-hosts","vector":"opening-delete","kind":"project-command"}',
				"b355f47e643dfd5ddb72e7c63e2aefc4059ce6a624df13a043c38b337082b850",
			),
			lineageFixture(
				"TCC-A1-LINEAGE-OPENING-CANCEL-PREVIEW",
				"opening-cancel-preview",
				'{"family":"lineage-and-hosts","vector":"opening-cancel-preview","kind":"project-command"}',
				"59fd25b1d89821fec30a32a12432cb1f1e9045769ea7d2effa0c93082f07380e",
			),
			lineageFixture(
				"TCC-A1-LINEAGE-WALL-SURFACE-REHOME",
				"wall-surface-rehome",
				'{"family":"lineage-and-hosts","vector":"wall-surface-rehome","kind":"project-command"}',
				"424dff30f3a5f75f6c5c505440292c1e0583e9afca5627367ddb8c868b6821f1",
			),
			lineageFixture(
				"TCC-A1-LINEAGE-HOST-CONFLICT-PREVIEW",
				"host-conflict-preview",
				'{"family":"lineage-and-hosts","vector":"host-conflict-preview","kind":"project-command"}',
				"27443dcc1e23d602b433e969d9a0ec9f80a089b61f1ed775556544b9720372ce",
			),
			fixture(
				"TCC-A1-CURRENT-005",
				MEASUREMENT_BASE,
				{
					family: "measurement-and-projections",
					kind: "exact-distance",
					vector: "exact-distance",
				},
				raw.measurement,
				"5c75fc5ef500609726db732505e2a74567752896f1867e4677cbb985d62bd9c6",
				{
					allocationIntent: [],
					inverseStateDigest: MEASUREMENT_BASE,
					kind: "accepted",
					opaqueCandidateRefs: [],
					postStateDigest: "tcc-a1:current-product:measurement:distance=5000",
				},
			),
			fixture(
				"TCC-A1-MEASURE-STALE",
				MEASUREMENT_BASE,
				{
					family: "measurement-and-projections",
					kind: "exact-distance",
					vector: "stale",
				},
				'{"family":"measurement-and-projections","vector":"stale","kind":"distance"}',
				"05cef56ade1397fc2bcd538b32befbf3bfae3d9846c3e05e6287671877849251",
				{
					allocationIntent: [],
					kind: "transient",
					postStateDigest: MEASUREMENT_BASE,
					transientKind: "stale-base",
				},
			),
			fixture(
				"TCC-A1-MEASURE-UNAVAILABLE",
				MEASUREMENT_BASE,
				{
					family: "measurement-and-projections",
					kind: "exact-distance",
					vector: "target-unavailable",
				},
				'{"family":"measurement-and-projections","vector":"target-unavailable","kind":"distance"}',
				"2ae7fe7591225c676d167d785426b85ecb4a0f58abfa415d681bcf680933e0ea",
				{
					allocationIntent: [],
					kind: "transient",
					postStateDigest: MEASUREMENT_BASE,
					transientKind: "selection-unavailable",
				},
			),
			fixture(
				"TCC-A1-MEASURE-FORMAT",
				MEASUREMENT_BASE,
				{
					family: "measurement-and-projections",
					kind: "exact-distance",
					vector: "shared-format",
				},
				'{"family":"measurement-and-projections","vector":"shared-format","kind":"format"}',
				"bcd76e0143c3e30f2d5f86cb0988e162e39569ce257acd35f157d61d6186ae5f",
				{
					allocationIntent: [],
					inverseStateDigest: MEASUREMENT_BASE,
					kind: "accepted",
					opaqueCandidateRefs: [],
					postStateDigest:
						"tcc-a1:current-product:measurement:formatted=5000 мм",
				},
			),
			fixture(
				"TCC-A1-CURRENT-006",
				EMPTY_GRAPH_DIGEST,
				{ family: "commands-and-lifecycle", kind: "initial-wall-lifecycle", vector: "cancelled" },
				raw.lifecycle,
				"2bf1a369d52813d6af7778fbc5d0de9dd0de4f770f91844b2b115068dede124b",
				{
					allocationIntent: [],
					kind: "transient",
					postStateDigest: EMPTY_GRAPH_DIGEST,
					transientKind: "cancelled",
				},
			),
			fixture(
				"TCC-A1-LIFE-STALE",
				EMPTY_GRAPH_DIGEST,
				{ family: "commands-and-lifecycle", kind: "initial-wall-lifecycle", vector: "stale-base" },
				'{"family":"commands-and-lifecycle","vector":"stale-base","kind":"initial-wall-materialization"}',
				"7a56b940533b59e09474107f293f637e88c340a600a0fbca11ec9a751ad50754",
				{ allocationIntent: [], kind: "transient", postStateDigest: EMPTY_GRAPH_DIGEST, transientKind: "stale-base" },
			),
			fixture(
				"TCC-A1-LIFE-FENCE",
				EMPTY_GRAPH_DIGEST,
				{ family: "commands-and-lifecycle", kind: "initial-wall-lifecycle", vector: "lost-fence" },
				'{"family":"commands-and-lifecycle","vector":"lost-fence","kind":"initial-wall-materialization"}',
				"f4584ea11f89e34e032f5040fa77c964855fe90a00a2e5cb0c21de7796944471",
				{ allocationIntent: [], kind: "transient", postStateDigest: EMPTY_GRAPH_DIGEST, transientKind: "lost-fence" },
			),
		],
		policyReferences: [
			"geometry-contract.md#1-mm-ingress-and-exact-direction-semantics",
			"geometry-contract.md#5-plan-graph-contacts-and-commands",
			"topology-corpus-contract.md#2-fixture-outcome-contract",
			"topology-corpus-contract.md#3-obyazatelnye-suite-families",
			"topology-corpus-contract.md#4-v1v2-classification-migration-and-recovery-matrix",
		],
	};

/** Revision 2 supersedes only SHORT-PARTITION; revision 1 remains historical evidence. */
export const currentProductTccA1Corpus: TccA1CorpusManifest<CurrentProductKernelIntent> = {
	...historicalCurrentProductTccA1CorpusRevision1,
	corpusRevision: 2,
	fixtures: historicalCurrentProductTccA1CorpusRevision1.fixtures.map((entry) => entry.fixtureId === "TCC-A1-CONTACT-SHORT-PARTITION"
		? contactFixture(
			"TCC-A1-CONTACT-RETAINED-SHORT-PARTITION-R2",
			"retained-short-partition",
			'{"family":"contacts","vector":"retained-short-partition","kind":"add-wall"}',
			"ff400024677c306645b15f80499110c6fe0f04d7ebff5e47578b07a022e6de3d",
		) : entry),
	policyReferences: [
		...historicalCurrentProductTccA1CorpusRevision1.policyReferences,
		"contracts/tma-ui-and-wall-contact-2026-11-14.md",
	],
};

/**
 * The source-owned Alpha §4 closure intentionally has one current selector
 * and no V1/V2 grammar or decoder. The remaining rows prove that input bytes
 * stay diagnostic-only and take no mutation/publish path.
 */
export const currentProductLegacyTccA1Corpus: TccA1CorpusManifest<CurrentProductLegacyTccA1Intent> =
	{
		contractId: TCC_A1_CONTRACT_ID,
		contractVersion: TCC_A1_CONTRACT_VERSION,
		corpusId: "interiors.tcc-a1.current-product-legacy-boundary",
		corpusRevision: 1,
		executorRole: "legacy-classifier",
		fixtures: [
			legacyFixture(
				"TCC-A1-LEGACY-CURRENT-PPJ-A1",
				"current-ppj-a1",
				'{"projectSchemaId":"interiors.project/alpha-1","schemaVersion":1}',
				"f46755668b4e34f1b0b539060556c63627fde961ad1bf8d703a51fa6f3ad3f59",
				"current-ppj-a1",
				"current-ingress",
			),
			legacyFixture(
				"TCC-A1-LEGACY-V1-LIKE",
				"v1-like",
				'{"schemaVersion":1,"walls":[]}',
				"d49395e2f27599fc4b021111deb37bbb4eb6730dcc618e74c1751a61ca11df02",
				"legacy-unreadable",
				"ordinary-ingress-precedence",
			),
			legacyFixture(
				"TCC-A1-LEGACY-V2-LIKE",
				"v2-like",
				'{"projectSchemaId":"interiors.project/alpha-1","schemaVersion":2}',
				"01e282f284e2314ef6e4d90ce9df232161732098c8395635821c3f10c0ac285c",
				"legacy-unreadable",
				"ordinary-ingress-precedence",
			),
			legacyFixture(
				"TCC-A1-LEGACY-UNREGISTERED-FUTURE",
				"unregistered-future",
				'{"projectSchemaId":"interiors.project/beta-2","schemaVersion":1}',
				"a8c9d98b746f5122ecd3c8d0fbfb6b800391416038de3ac863dcaa2e674ddd06",
				"legacy-unreadable",
				"ordinary-ingress-precedence",
			),
		],
		policyReferences: [
			"topology-corpus-contract.md#4-v1v2-classification-migration-and-recovery-matrix",
			"project-and-backup-contract.md#41-legacy-topologyproject-v1v2-boundary",
			"portable-backup-ingress-registry.md#alpha-current-ppj-a1-legacy-closure",
		],
	};

export const webCryptoTccA1HashPort: ContentHashPort & TccA1FixtureHashPort = {
	sha256: async (bytes) => hex(await cryptoDigest(bytes)),
	sha256Utf8Ascii: async (preimage) =>
		hex(await cryptoDigest(Uint8Array.from(asciiBytes(preimage)))),
};

export function createCurrentProductTccA1Executor(
	hashPort: ContentHashPort = webCryptoTccA1HashPort,
): TccA1CorpusExecutor<CurrentProductKernelIntent> {
	const materializationExecutor =
		createInitialWallMaterializationTccA1Executor(hashPort);
	return {
		evaluate: async (input): Promise<TccA1Outcome> => {
			switch (input.intent.family) {
				case "directions":
					return directionOutcome(
						input.baseStateDigest,
						input.intent.kind,
						input.intent.vector,
					);
				case "contacts":
					return contactOutcome(input.baseStateDigest, input.intent.kind);
				case "faces":
					return facesOutcome(input.baseStateDigest, input.intent.kind);
				case "lineage-and-hosts":
					return lineageOutcome(input.baseStateDigest, input.intent.kind);
				case "measurement-and-projections":
					return measurementOutcome(
						input.baseStateDigest,
						input.intent.kind,
						input.intent.vector,
					);
				case "commands-and-lifecycle":
					return lifecycleOutcome(
						input.baseStateDigest,
						input.intent.kind,
						input.intent.vector,
						materializationExecutor,
					);
			}
		},
	};
}

/**
 * This adapter deliberately only classifies a raw byte snapshot. It has no
 * ingress, Project, resource or publication capability, so a current selector
 * is a handoff label rather than a successful import claim.
 */
export function createCurrentProductLegacyTccA1Executor(): TccA1CorpusExecutor<CurrentProductLegacyTccA1Intent> {
	return {
		evaluate: (input): TccA1Outcome => {
			const classification = classifyActiveAlphaProjectBytes(
				input.rawInputBytes,
			);
			return {
				allocationIntent: [],
				classifierResult: classification.kind,
				handoff:
					classification.kind === "current-ppj-a1"
						? "current-ingress"
						: "ordinary-ingress-precedence",
				kind: "legacy-classification",
				postStateDigest: input.baseStateDigest,
			};
		},
	};
}

function fixture<Intent>(
	fixtureId: string,
	baseStateDigest: string,
	intent: Intent,
	source: string,
	rawInputSha256: string,
	expected: TccA1Outcome,
): TccA1CorpusManifest<Intent>["fixtures"][number] {
	return {
		baseStateDigest,
		expected,
		fixtureId,
		intent,
		rawInputBytes: asciiBytes(source),
		rawInputSha256,
	};
}

function legacyFixture(
	fixtureId: string,
	vector: CurrentProductLegacyVector,
	source: string,
	rawInputSha256: string,
	classifierResult: "current-ppj-a1" | "legacy-unreadable",
	handoff: "current-ingress" | "ordinary-ingress-precedence",
): TccA1CorpusManifest<CurrentProductLegacyTccA1Intent>["fixtures"][number] {
	const baseStateDigest = `${LEGACY_BASE}:${vector}:bytes`;
	return fixture(
		fixtureId,
		baseStateDigest,
		{ family: "legacy-and-ingress", kind: "classify-active-alpha-bytes", vector },
		source,
		rawInputSha256,
		{
			allocationIntent: [],
			classifierResult,
			handoff,
			kind: "legacy-classification",
			postStateDigest: baseStateDigest,
		},
	);
}

function directionFixture(
	fixtureId: string,
	vector: Exclude<DirectionVector, "bounds" | "zero" | "unsupported">,
	source: string,
	rawInputSha256: string,
	postStateDigest: string,
): TccA1CorpusManifest<CurrentProductKernelIntent>["fixtures"][number] {
	return fixture(
		fixtureId,
		DIRECTIONS_BASE,
		{ family: "directions", kind: "raw-wall", vector },
		source,
		rawInputSha256,
		{
			allocationIntent: ["vertex:start", "vertex:end", "wall:initial"],
			inverseStateDigest: DIRECTIONS_BASE,
			kind: "accepted",
			opaqueCandidateRefs: [
				"candidate:vertex:start",
				"candidate:vertex:end",
				"candidate:wall:initial",
			],
			postStateDigest,
		},
	);
}

/**
 * Each contact starts from a separately named immutable graph snapshot. The
 * digest name is intentionally part of the declared fixture rather than an
 * inferred result of the runner: the executor verifies that same binding
 * before it calls the production PlanGraph command.
 */
function contactBase(vector: ContactVector): string {
	return `${CONTACTS_BASE}:${vector}:base`;
}

function contactFixture(
	fixtureId: string,
	vector: ContactVector,
	source: string,
	rawInputSha256: string,
): TccA1CorpusManifest<CurrentProductKernelIntent>["fixtures"][number] {
	const baseStateDigest = contactBase(vector);
	const accepted = (
		allocationIntent: readonly string[],
		opaqueCandidateRefs: readonly string[],
	) => ({
		allocationIntent,
		inverseStateDigest: baseStateDigest,
		kind: "accepted" as const,
		opaqueCandidateRefs,
		postStateDigest: `${CONTACTS_BASE}:${vector}:accepted`,
	});
	switch (vector) {
		case "endpoint-vertex":
			return fixture(
				fixtureId,
				baseStateDigest,
				{ family: "contacts", kind: vector },
				source,
				rawInputSha256,
				accepted(
					["vertex:end", "wall:added"],
					["vertex:endpoint-new", "wall:endpoint-wall"],
				),
			);
		case "endpoint-interior-t":
			return fixture(
				fixtureId,
				baseStateDigest,
				{ family: "contacts", kind: vector },
				source,
				rawInputSha256,
				accepted(
					[
						"vertex:contact",
						"vertex:end",
						"wall:bottom-tail",
						"wall:divider",
					],
					[
						"vertex:t-contact",
						"vertex:t-end",
						"wall:bottom-tail",
						"wall:t-divider",
					],
				),
			);
		case "candidate-interior-junction":
			return fixture(
				fixtureId,
				baseStateDigest,
				{ family: "contacts", kind: vector },
				source,
				rawInputSha256,
				accepted(
					["vertex:start", "vertex:end", "wall:below", "wall:above"],
					[
						"vertex:junction-start",
						"vertex:junction-end",
						"wall:junction-below",
						"wall:junction-above",
					],
				),
			);
		case "one-x":
			return fixture(
				fixtureId,
				baseStateDigest,
				{ family: "contacts", kind: vector },
				source,
				rawInputSha256,
				accepted(
					[
						"vertex:bottom",
						"vertex:cross",
						"vertex:top",
						"wall:horizontal-tail",
						"wall:vertical-bottom",
						"wall:vertical-top",
					],
					[
						"vertex:x-bottom",
						"vertex:x-cross",
						"vertex:x-top",
						"wall:x-horizontal-tail",
						"wall:x-vertical-bottom",
						"wall:x-vertical-top",
					],
				),
			);
		case "multi-x":
			return fixture(
				fixtureId,
				baseStateDigest,
				{ family: "contacts", kind: vector },
				source,
				rawInputSha256,
				accepted(
					[
						"vertex:start",
						"vertex:first-cross",
						"vertex:second-cross",
						"vertex:end",
						"wall:first-horizontal-tail",
						"wall:second-horizontal-tail",
						"wall:vertical-first",
						"wall:vertical-middle",
						"wall:vertical-last",
					],
					[
						"vertex:multi-start",
						"vertex:multi-first-cross",
						"vertex:multi-second-cross",
						"vertex:multi-end",
						"wall:multi-first-horizontal-tail",
						"wall:multi-second-horizontal-tail",
						"wall:multi-vertical-first",
						"wall:multi-vertical-middle",
						"wall:multi-vertical-last",
					],
				),
			);
		case "zero-partition":
			return fixture(
				fixtureId,
				baseStateDigest,
				{ family: "contacts", kind: vector },
				source,
				rawInputSha256,
				accepted(
					["vertex:end", "wall:added"],
					["vertex:zero-partition-end", "wall:zero-partition"],
				),
			);
		case "fractional-contact":
			return rejectedContactFixture(
				fixtureId,
				baseStateDigest,
				vector,
				source,
				rawInputSha256,
				"DIAGONAL_WALL_CONTACT_UNSUPPORTED",
			);
		case "duplicate-identity":
			return rejectedContactFixture(
				fixtureId,
				baseStateDigest,
				vector,
				source,
				rawInputSha256,
				"INVALID_PLAN_GRAPH",
			);
		case "collinear-overlap":
			return rejectedContactFixture(
				fixtureId,
				baseStateDigest,
				vector,
				source,
				rawInputSha256,
				"COLLINEAR_OVERLAP",
			);
		case "short-partition":
			return rejectedContactFixture(
				fixtureId,
				baseStateDigest,
				vector,
				source,
				rawInputSha256,
				"TOO_SHORT_WALL",
			);
		case "retained-short-partition":
			return fixture(fixtureId, baseStateDigest, { family: "contacts", kind: vector }, source, rawInputSha256,
				accepted(
					["vertex:bottom", "vertex:cross", "vertex:top", "wall:horizontal-tail", "wall:vertical-bottom", "wall:vertical-top"],
					["vertex:short-bottom", "vertex:short-cross", "vertex:short-top", "wall:short-horizontal-tail", "wall:short-vertical-bottom", "wall:short-vertical-top"],
				));
	}
}

function rejectedContactFixture(
	fixtureId: string,
	baseStateDigest: string,
	vector: Extract<
		ContactVector,
		| "fractional-contact"
			| "duplicate-identity"
			| "collinear-overlap"
			| "short-partition"
	>,
	source: string,
	rawInputSha256: string,
	reasonCode:
		| "COLLINEAR_OVERLAP"
		| "DIAGONAL_WALL_CONTACT_UNSUPPORTED"
		| "INVALID_PLAN_GRAPH"
		| "TOO_SHORT_WALL",
): TccA1CorpusManifest<CurrentProductKernelIntent>["fixtures"][number] {
	return fixture(
		fixtureId,
		baseStateDigest,
		{ family: "contacts", kind: vector },
		source,
		rawInputSha256,
		{
			allocationIntent: [],
			kind: "rejected",
			postStateDigest: baseStateDigest,
			reasonCode,
		},
	);
}

function faceBase(vector: FaceVector): string {
	return `${FACES_BASE}:${vector}:base`;
}

function faceFixture(
	fixtureId: string,
	vector: FaceVector,
	source: string,
	rawInputSha256: string,
): TccA1CorpusManifest<CurrentProductKernelIntent>["fixtures"][number] {
	const baseStateDigest = faceBase(vector);
	if (
		vector === "exterior" ||
		vector === "multi-room" ||
		vector === "odd-miter-bevel"
	) {
		return fixture(
			fixtureId,
			baseStateDigest,
			{ family: "faces", kind: vector },
			source,
			rawInputSha256,
			{
				allocationIntent: [],
				inverseStateDigest: baseStateDigest,
				kind: "accepted",
				opaqueCandidateRefs: [],
				postStateDigest: `${FACES_BASE}:${vector}:accepted`,
			},
		);
	}
	return fixture(
		fixtureId,
		baseStateDigest,
		{ family: "faces", kind: vector },
		source,
		rawInputSha256,
		{
			allocationIntent: [],
			kind: "rejected",
			postStateDigest: baseStateDigest,
			reasonCode:
				vector === "usable-collapse"
					? "UNSUPPORTED_FACE_SHAPE"
					: "AMBIGUOUS_BOUNDED_WALK",
		},
	);
}

function lineageBase(vector: LineageVector): string {
	return `${LINEAGE_BASE}:${vector}:base`;
}

function lineageFixture(
	fixtureId: string,
	vector: LineageVector,
	source: string,
	rawInputSha256: string,
): TccA1CorpusManifest<CurrentProductKernelIntent>["fixtures"][number] {
	const baseStateDigest = lineageBase(vector);
	if (
		vector === "host-conflict-preview" ||
		vector === "opening-cancel-preview"
	) {
		return fixture(
			fixtureId,
			baseStateDigest,
			{ family: "lineage-and-hosts", kind: vector },
			source,
			rawInputSha256,
			{
				allocationIntent: [],
				kind: "transient",
				postStateDigest: baseStateDigest,
				transientKind: "conflict-preview",
			},
		);
	}
	const allocationsByVector: Record<
		Exclude<
			LineageVector,
			"host-conflict-preview" | "opening-cancel-preview"
		>,
		readonly string[]
	> = {
		"add-split-height": [
			"vertex:bottom",
			"vertex:top",
			"wall:bottom-tail",
			"wall:top-tail",
			"wall:divider",
			"room:successor",
		],
		"merge-choice-reentry": [
			"vertex:bottom",
			"vertex:top",
			"wall:bottom-tail",
			"wall:top-tail",
			"wall:divider",
			"room:reentry",
		],
		"opening-delete": [],
		"one-to-one-room": ["vertex:split", "wall:tail"],
		"opening-rehome": [
			"vertex:contact",
			"vertex:end",
			"wall:tail",
			"wall:branch",
		],
		"wall-surface-rehome": [
			"vertex:contact",
			"vertex:end",
			"wall:tail",
			"wall:branch",
		],
	};
	return fixture(
		fixtureId,
		baseStateDigest,
		{ family: "lineage-and-hosts", kind: vector },
		source,
		rawInputSha256,
		{
			allocationIntent: allocationsByVector[vector],
			inverseStateDigest: baseStateDigest,
			kind: "accepted",
			opaqueCandidateRefs: allocationsByVector[vector].map(
				(label) => `candidate:${label}`,
			),
			postStateDigest: `${LINEAGE_BASE}:${vector}:accepted`,
		},
	);
}

function directionRejectFixture(
	fixtureId: string,
	vector: Extract<DirectionVector, "bounds" | "zero" | "unsupported">,
	source: string,
	rawInputSha256: string,
	reasonCode:
		| "PROJECT_BOUNDS_EXCEEDED"
		| "UNSUPPORTED_DIRECTION"
		| "ZERO_LENGTH",
): TccA1CorpusManifest<CurrentProductKernelIntent>["fixtures"][number] {
	return fixture(
		fixtureId,
		DIRECTIONS_BASE,
		{ family: "directions", kind: "raw-wall", vector },
		source,
		rawInputSha256,
		{
			allocationIntent: [],
			kind: "rejected",
			postStateDigest: DIRECTIONS_BASE,
			reasonCode,
		},
	);
}

function directionOutcome(
	baseStateDigest: string,
	kind: "raw-wall",
	vector: DirectionVector,
): TccA1Outcome {
	if (baseStateDigest !== DIRECTIONS_BASE || kind !== "raw-wall")
		throw new TypeError("Direction fixture is not bound to its base");
	const result = deriveEmptyPlanGraphWallCandidate(
		directionRawGeometry(vector),
		{ maxAbsoluteCoordinateMm: 100_000 },
	);
	if (result.kind === "rejected")
		return { ...result, postStateDigest: DIRECTIONS_BASE };
	const expectedDirection =
		vector === "negative-zero" || vector === "cardinal-east"
			? "E"
			: vector === "diagonal-ne" || vector === "length-only-ne"
				? "NE"
				: vector === "diagonal-nw"
					? "NW"
					: vector === "diagonal-se"
						? "SE"
						: "SW";
	if (result.candidate.wallCenterlines[0].direction !== expectedDirection)
		throw new TypeError("The declared signed direction did not resolve");
	return { ...result, inverseStateDigest: DIRECTIONS_BASE };
}

function directionRawGeometry(vector: DirectionVector): unknown {
	switch (vector) {
		case "negative-zero":
			return {
				end: { xMm: "1000", zMm: "-0" },
				kind: "endpoints",
				start: { xMm: "-0", zMm: "0" },
			};
		case "cardinal-east":
			return {
				end: { xMm: "1000", zMm: "0" },
				kind: "endpoints",
				start: { xMm: "0", zMm: "0" },
			};
		case "diagonal-ne":
			return {
				end: { xMm: "1000", zMm: "1000" },
				kind: "endpoints",
				start: { xMm: "0", zMm: "0" },
			};
		case "diagonal-nw":
			return {
				end: { xMm: "-1000", zMm: "1000" },
				kind: "endpoints",
				start: { xMm: "0", zMm: "0" },
			};
		case "diagonal-se":
			return {
				end: { xMm: "1000", zMm: "-1000" },
				kind: "endpoints",
				start: { xMm: "0", zMm: "0" },
			};
		case "diagonal-sw":
			return {
				end: { xMm: "-1000", zMm: "-1000" },
				kind: "endpoints",
				start: { xMm: "0", zMm: "0" },
			};
		case "length-only-ne":
			return {
				kind: "diagonal-length",
				lengthMm: "1414",
				quadrant: "NE",
				start: { xMm: "0", zMm: "0" },
			};
		case "bounds":
			return {
				end: { xMm: "100001", zMm: "0" },
				kind: "endpoints",
				start: { xMm: "0", zMm: "0" },
			};
		case "zero":
			return {
				end: { xMm: "0", zMm: "0" },
				kind: "endpoints",
				start: { xMm: "0", zMm: "0" },
			};
		case "unsupported":
			return {
				end: { xMm: "1000", zMm: "500" },
				kind: "endpoints",
				start: { xMm: "0", zMm: "0" },
			};
	}
}

function contactOutcome(
	baseStateDigest: string,
	vector: ContactVector,
): TccA1Outcome {
	if (baseStateDigest !== contactBase(vector))
		throw new TypeError("Contact fixture is not bound to its base snapshot");
	const accepted = (
		allocationIntent: readonly string[],
		opaqueCandidateRefs: readonly string[],
	): TccA1Outcome => ({
		allocationIntent,
		inverseStateDigest: baseStateDigest,
		kind: "accepted",
		opaqueCandidateRefs,
		postStateDigest: `${CONTACTS_BASE}:${vector}:accepted`,
	});
	const rejected = (
		reasonCode:
			| "COLLINEAR_OVERLAP"
			| "DIAGONAL_WALL_CONTACT_UNSUPPORTED"
			| "INVALID_PLAN_GRAPH"
			| "TOO_SHORT_WALL",
	): TccA1Outcome => ({
		allocationIntent: [],
		kind: "rejected",
		postStateDigest: baseStateDigest,
		reasonCode,
	});

	switch (vector) {
		case "endpoint-vertex": {
			const result = addWallSegment(
				horizontalSegmentGraph(),
				{
					end: { xMm: 0, zMm: 900 },
					start: { xMm: 0, zMm: 0 },
					thicknessMm: 100,
				},
				ids("endpoint-new", "endpoint-wall"),
			);
			const graph = requireAcceptedPlanGraph(result, "endpoint contact");
			if (
				!hasVertex(graph, "a", 0, 0) ||
				!hasVertex(graph, "endpoint-new", 0, 900) ||
				!hasWall(graph, "endpoint-wall", "a", "endpoint-new")
			) {
				throw new TypeError("Endpoint contact did not reuse the source Vertex");
			}
			return accepted(
				["vertex:end", "wall:added"],
				["vertex:endpoint-new", "wall:endpoint-wall"],
			);
		}
		case "endpoint-interior-t": {
			const result = addWallSegment(
				rectangleGraph(),
				{
					end: { xMm: 2000, zMm: 1200 },
					start: { xMm: 2000, zMm: 0 },
					thicknessMm: 100,
				},
				ids("t-contact", "t-end", "bottom-tail", "t-divider"),
			);
			const graph = requireAcceptedPlanGraph(result, "T contact");
			if (
				!hasVertex(graph, "t-contact", 2000, 0) ||
				!hasWall(graph, "bottom-tail", "t-contact", "b") ||
				!hasWall(graph, "t-divider", "t-contact", "t-end")
			) {
				throw new TypeError("T contact did not split the crossed Wall");
			}
			return accepted(
				[
					"vertex:contact",
					"vertex:end",
					"wall:bottom-tail",
					"wall:divider",
				],
				["vertex:t-contact", "vertex:t-end", "wall:bottom-tail", "wall:t-divider"],
			);
		}
		case "candidate-interior-junction": {
			const result = addWallSegment(
				junctionGraph(),
				{
					end: { xMm: 1000, zMm: 1000 },
					start: { xMm: 1000, zMm: -1000 },
					thicknessMm: 100,
				},
				ids("junction-start", "junction-end", "junction-below", "junction-above"),
			);
			const graph = requireAcceptedPlanGraph(result, "candidate-interior junction");
			if (
				!hasVertex(graph, "junction", 1000, 0) ||
				!hasWall(graph, "junction-below", "junction-start", "junction") ||
				!hasWall(graph, "junction-above", "junction", "junction-end")
			) {
				throw new TypeError("Candidate interior did not preserve the junction Vertex");
			}
			return accepted(
				["vertex:start", "vertex:end", "wall:below", "wall:above"],
				[
					"vertex:junction-start",
					"vertex:junction-end",
					"wall:junction-below",
					"wall:junction-above",
				],
			);
		}
		case "one-x": {
			const result = addWallSegment(
				horizontalCrossingGraph(),
				{
					end: { xMm: 1000, zMm: 2000 },
					start: { xMm: 1000, zMm: 0 },
					thicknessMm: 100,
				},
				ids(
					"x-bottom",
					"x-cross",
					"x-top",
					"x-horizontal-tail",
					"x-vertical-bottom",
					"x-vertical-top",
				),
			);
			const graph = requireAcceptedPlanGraph(result, "one X contact");
			if (
				!hasVertex(graph, "x-cross", 1000, 1000) ||
				graph.wallSegments.filter(
					(wall) =>
						wall.startVertexId === "x-cross" || wall.endVertexId === "x-cross",
				).length !== 4
			) {
				throw new TypeError("One X contact did not normalize to four Wall pieces");
			}
			return accepted(
				[
					"vertex:bottom",
					"vertex:cross",
					"vertex:top",
					"wall:horizontal-tail",
					"wall:vertical-bottom",
					"wall:vertical-top",
				],
				[
					"vertex:x-bottom",
					"vertex:x-cross",
					"vertex:x-top",
					"wall:x-horizontal-tail",
					"wall:x-vertical-bottom",
					"wall:x-vertical-top",
				],
			);
		}
		case "multi-x": {
			const result = addWallSegment(
				multiCrossingGraph(),
				{
					end: { xMm: 1000, zMm: 3000 },
					start: { xMm: 1000, zMm: -1000 },
					thicknessMm: 100,
				},
				ids(
					"multi-start",
					"multi-first-cross",
					"multi-second-cross",
					"multi-end",
					"multi-first-horizontal-tail",
					"multi-second-horizontal-tail",
					"multi-vertical-first",
					"multi-vertical-middle",
					"multi-vertical-last",
				),
			);
			const graph = requireAcceptedPlanGraph(result, "multiple X contacts");
			if (
				!hasVertex(graph, "multi-first-cross", 1000, 0) ||
				!hasVertex(graph, "multi-second-cross", 1000, 2000) ||
				graph.wallSegments.length !== 7
			) {
				throw new TypeError("Multiple X contacts were not normalized atomically");
			}
			return accepted(
				[
					"vertex:start",
					"vertex:first-cross",
					"vertex:second-cross",
					"vertex:end",
					"wall:first-horizontal-tail",
					"wall:second-horizontal-tail",
					"wall:vertical-first",
					"wall:vertical-middle",
					"wall:vertical-last",
				],
				[
					"vertex:multi-start",
					"vertex:multi-first-cross",
					"vertex:multi-second-cross",
					"vertex:multi-end",
					"wall:multi-first-horizontal-tail",
					"wall:multi-second-horizontal-tail",
					"wall:multi-vertical-first",
					"wall:multi-vertical-middle",
					"wall:multi-vertical-last",
				],
			);
		}
		case "fractional-contact": {
			const result = addGeneralWallToProject(
				fractionalContactProject(),
				{
					end: { xMm: 3101, zMm: 0 },
					start: { xMm: 0, zMm: 3101 },
					thicknessMm: 100,
				},
				idsThatMustNotAllocate(),
				"2026-08-30T12:00:02.000Z",
			);
			if (
				result.kind !== "rejected" ||
				result.reasonCode !== "DIAGONAL_WALL_CONTACT_UNSUPPORTED"
			) {
				throw new TypeError("A half-mm diagonal contact was rounded or materialized");
			}
			return rejected("DIAGONAL_WALL_CONTACT_UNSUPPORTED");
		}
		case "duplicate-identity": {
			const result = addWallSegment(
				{
					vertices: [
						{ vertexId: "duplicate-a", xMm: 0, zMm: 0 },
						{ vertexId: "duplicate-b", xMm: 0, zMm: 0 },
					],
					wallSegments: [],
				},
				{
					end: { xMm: 1000, zMm: 0 },
					start: { xMm: 0, zMm: 0 },
					thicknessMm: 100,
				},
				idsThatMustNotAllocate(),
			);
			if (result.kind !== "rejected" || result.reasonCode !== "INVALID_PLAN_GRAPH")
				throw new TypeError("Duplicate source identity did not fail before allocation");
			return rejected("INVALID_PLAN_GRAPH");
		}
		case "collinear-overlap": {
			const result = addWallSegment(
				rectangleGraph(),
				{
					end: { xMm: 3000, zMm: 0 },
					start: { xMm: 1000, zMm: 0 },
					thicknessMm: 100,
				},
				idsThatMustNotAllocate(),
			);
			if (result.kind !== "rejected" || result.reasonCode !== "COLLINEAR_OVERLAP")
				throw new TypeError("Collinear overlap unexpectedly materialized");
			return rejected("COLLINEAR_OVERLAP");
		}
		case "zero-partition": {
			const result = addWallSegment(
				horizontalSegmentGraph(),
				{
					end: { xMm: 1000, zMm: 900 },
					start: { xMm: 1000, zMm: 0 },
					thicknessMm: 100,
				},
				ids("zero-partition-end", "zero-partition"),
			);
			const graph = requireAcceptedPlanGraph(result, "zero partition endpoint contact");
			if (
				graph.vertices.length !== 3 ||
				graph.wallSegments.length !== 2 ||
				!hasWall(graph, "zero-partition", "b", "zero-partition-end")
			) {
				throw new TypeError("Endpoint touch invented a zero-length partition");
			}
			return accepted(
				["vertex:end", "wall:added"],
				["vertex:zero-partition-end", "wall:zero-partition"],
			);
		}
		case "short-partition":
			throw new TypeError("Historical short-partition fixture requires the revision-1 contact policy");
		case "retained-short-partition": {
			const result = addWallSegment(
				horizontalSegmentGraph(),
				{
					end: { xMm: 100, zMm: 500 },
					start: { xMm: 100, zMm: -500 },
					thicknessMm: 100,
				},
				ids("short-bottom", "short-cross", "short-top", "short-horizontal-tail", "short-vertical-bottom", "short-vertical-top"),
			);
			const graph = requireAcceptedPlanGraph(result, "retained short partition");
			if (graph.vertices.length !== 5 || graph.wallSegments.length !== 4 ||
				!hasVertex(graph, "short-cross", 100, 0) ||
				!hasWall(graph, "horizontal", "a", "short-cross") ||
				!hasWall(graph, "short-horizontal-tail", "short-cross", "b") ||
				!hasWall(graph, "short-vertical-bottom", "short-bottom", "short-cross") ||
				!hasWall(graph, "short-vertical-top", "short-cross", "short-top"))
				throw new TypeError("Short contact fragments were moved, deleted or disconnected");
			return accepted(
				["vertex:bottom", "vertex:cross", "vertex:top", "wall:horizontal-tail", "wall:vertical-bottom", "wall:vertical-top"],
				["vertex:short-bottom", "vertex:short-cross", "vertex:short-top", "wall:short-horizontal-tail", "wall:short-vertical-bottom", "wall:short-vertical-top"],
			);
		}
	}
}

function facesOutcome(
	baseStateDigest: string,
	vector: FaceVector,
): TccA1Outcome {
	if (baseStateDigest !== faceBase(vector))
		throw new TypeError("Face fixture is not bound to its base snapshot");
	const accepted = (): TccA1Outcome => ({
		allocationIntent: [],
		inverseStateDigest: baseStateDigest,
		kind: "accepted",
		opaqueCandidateRefs: [],
		postStateDigest: `${FACES_BASE}:${vector}:accepted`,
	});
	const rejected = (
		reasonCode: "AMBIGUOUS_BOUNDED_WALK" | "UNSUPPORTED_FACE_SHAPE",
	): TccA1Outcome => ({
		allocationIntent: [],
		kind: "rejected",
		postStateDigest: baseStateDigest,
		reasonCode,
	});

	switch (vector) {
		case "exterior": {
			const result = deriveBoundedOrthogonalFaces(rectangleGraph());
			if (
				result.kind !== "accepted" ||
				result.faces.length !== 1 ||
				result.faces[0]?.fingerprint !==
					"orthogonal-face:0:0|0:3000|4000:3000|4000:0"
			) {
				throw new TypeError("Exterior traversal was emitted as a Room face");
			}
			return accepted();
		}
		case "multi-room": {
			const result = deriveBoundedOrthogonalFaces(partitionedRectangleGraph());
			if (
				result.kind !== "accepted" ||
				result.faces.length !== 2 ||
				result.faces.some(
					(face) =>
						face.areaMm2.rationalNumerator !== 6_000_000n ||
						face.areaMm2.sqrt2Numerator !== 0n ||
						face.areaMm2.denominator !== 1n,
				)
			) {
				throw new TypeError("Normalized partition did not derive two bounded Rooms");
			}
			return accepted();
		}
		case "void-ring":
		case "nested-ring": {
			const result = deriveBoundedOrthogonalFaces(nestedRingGraph());
			if (result.kind !== "rejected" || result.reasonCode !== "AMBIGUOUS_BOUNDED_WALK")
				throw new TypeError("Nested void ring was partially materialized");
			return rejected("AMBIGUOUS_BOUNDED_WALK");
		}
		case "repeated-walk": {
			const result = deriveBoundedOrthogonalFaces(repeatedWalkGraph());
			if (result.kind !== "rejected" || result.reasonCode !== "AMBIGUOUS_BOUNDED_WALK")
				throw new TypeError("Repeated bounded walk was not rejected");
			return rejected("AMBIGUOUS_BOUNDED_WALK");
		}
		case "touching-ring": {
			const result = deriveBoundedOrthogonalFaces(touchingRingGraph());
			if (result.kind !== "rejected" || result.reasonCode !== "AMBIGUOUS_BOUNDED_WALK")
				throw new TypeError("Touching rings were not rejected deterministically");
			return rejected("AMBIGUOUS_BOUNDED_WALK");
		}
		case "odd-miter-bevel": {
			const project = diagonalTriangleProject(101);
			const result = resolveOrthogonalPlanFaces(project);
			const usable =
				result.kind === "accepted"
					? result.plan.rooms[0]?.usableFloorPolygonMm
					: undefined;
			if (
				result.kind !== "accepted" ||
				usable?.[0]?.zMm !== 50.5 ||
				result.plan.walls.find((wall) => wall.wallSegmentId === "diagonal")
					?.exteriorNormal?.x !== -1
			) {
				throw new TypeError("Odd-thickness miter/cap projection lost exact half-mm geometry");
			}
			return accepted();
		}
		case "usable-collapse": {
			const result = resolveOrthogonalPlanFaces(thinConcaveProject());
			if (result.kind !== "rejected" || result.reasonCode !== "UNSUPPORTED_FACE_SHAPE")
				throw new TypeError("Collapsed usable polygon was projected as a Room");
			return rejected("UNSUPPORTED_FACE_SHAPE");
		}
	}
}

function lineageOutcome(
	baseStateDigest: string,
	vector: LineageVector,
): TccA1Outcome {
	if (baseStateDigest !== lineageBase(vector))
		throw new TypeError("Lineage fixture is not bound to its base snapshot");
	const accepted = (
		allocationIntent: readonly string[],
	): TccA1Outcome => ({
		allocationIntent,
		inverseStateDigest: baseStateDigest,
		kind: "accepted",
		opaqueCandidateRefs: allocationIntent.map((label) => `candidate:${label}`),
		postStateDigest: `${LINEAGE_BASE}:${vector}:accepted`,
	});
	switch (vector) {
		case "merge-choice-reentry": {
			const divided = dividedRoomProject();
			const merged = deleteGeneralWallWithConsequenceResolution(
				divided,
				{
					itemIds: [],
					openingIds: [],
					roomIds: ["room-1", "room-successor"],
					roomMetadataResolutions: [
						{
							retainedRoomId: "room-1",
							targetFaceKey: "0:4100:0:3100:100:100:100:100",
						},
					],
					wallSegmentId: "divider-wall",
				},
				"2026-08-30T12:00:03.000Z",
			);
			if (
				merged.kind !== "accepted" ||
				merged.project.level.rooms.length !== 1 ||
				merged.project.level.rooms[0]?.roomId !== "room-1"
			) {
				throw new TypeError("Room merge did not require and apply an explicit retained ID");
			}
			const reentered = addGeneralWallToProject(
				merged.project,
				{
					end: { xMm: 2000, zMm: 3100 },
					start: { xMm: 2000, zMm: 0 },
					thicknessMm: 100,
				},
				ids(
					"reentry-bottom",
					"reentry-top",
					"reentry-bottom-tail",
					"reentry-top-tail",
					"reentry-divider",
					"room-reentry",
				),
				"2026-08-30T12:00:04.000Z",
			);
			if (
				reentered.kind !== "accepted" ||
				reentered.project.level.rooms.length !== 2 ||
				reentered.project.level.rooms.some((room) => room.heightMm !== 2600) ||
				!reentered.project.level.rooms.some((room) => room.roomId === "room-1") ||
				!reentered.project.level.rooms.some((room) => room.roomId === "room-reentry")
			) {
				throw new TypeError("Room re-entry did not preserve retained lineage and height");
			}
			return accepted([
				"vertex:bottom",
				"vertex:top",
				"wall:bottom-tail",
				"wall:top-tail",
				"wall:divider",
				"room:reentry",
			]);
		}
		case "one-to-one-room": {
			const result = splitGeneralWall(
				roomProject(),
				{ positionMm: 2000, wallSegmentId: "wall-1" },
				ids("vertex-split", "wall-tail"),
				"2026-08-30T12:00:00.000Z",
			);
			if (
				result.kind !== "accepted" ||
				result.project.level.rooms.length !== 1 ||
				result.project.level.rooms[0]?.roomId !== "room-1" ||
				result.project.level.rooms[0]?.heightMm !== 2600 ||
				!result.project.level.wallSegments.some(
					(wall) => wall.wallSegmentId === "wall-tail",
				)
			) {
				throw new TypeError("One-to-one Room lineage was not preserved on split");
			}
			return accepted(["vertex:split", "wall:tail"]);
		}
		case "add-split-height": {
			const result = addGeneralWallToProject(
				roomProject(),
				{
					end: { xMm: 2000, zMm: 3100 },
					start: { xMm: 2000, zMm: 0 },
					thicknessMm: 100,
				},
				ids(
					"divider-bottom",
					"divider-top",
					"bottom-tail",
					"top-tail",
					"divider-wall",
					"room-successor",
				),
				"2026-08-30T12:00:02.000Z",
			);
			if (
				result.kind !== "accepted" ||
				result.project.level.rooms.length !== 2 ||
				result.project.level.rooms.some((room) => room.heightMm !== 2600) ||
				!result.project.level.rooms.some(
					(room) => room.roomId === "room-1",
				) ||
				!result.project.level.rooms.some(
					(room) => room.roomId === "room-successor",
				)
			) {
				throw new TypeError("Every AddWall split successor must inherit Room.heightMm");
			}
			return accepted([
				"vertex:bottom",
				"vertex:top",
				"wall:bottom-tail",
				"wall:top-tail",
				"wall:divider",
				"room:successor",
			]);
		}
		case "opening-rehome": {
			const opened = projectWithDoor();
			const result = addGeneralWallToProject(
				opened,
				{
					end: { xMm: 1000, zMm: 1000 },
					start: { xMm: 1000, zMm: 0 },
					thicknessMm: 100,
				},
				ids("opening-contact", "opening-end", "opening-tail", "opening-branch"),
				"2026-08-30T12:00:03.000Z",
			);
			if (
				result.kind !== "accepted" ||
				result.project.level.openings[0]?.wallSegmentId !== "opening-tail" ||
				result.project.level.openings[0]?.offsetMm !== 1050
			) {
				throw new TypeError("Opening did not rehome to its physical successor");
			}
			return accepted([
				"vertex:contact",
				"vertex:end",
				"wall:tail",
				"wall:branch",
			]);
		}
		case "opening-delete": {
			const result = deleteGeneralWallWithOpeningResolution(
				projectWithDoor(),
				{ openingIds: ["door-1"], wallSegmentId: "wall-1" },
				"2026-08-30T12:00:03.000Z",
			);
			if (
				result.kind !== "accepted" ||
				result.project.level.openings.length !== 0 ||
				result.project.level.wallSegments.some(
					(wall) => wall.wallSegmentId === "wall-1",
				)
			) {
				throw new TypeError("Opening delete was not applied atomically with its host");
			}
			return accepted([]);
		}
		case "opening-cancel-preview": {
			const source = projectWithDoor();
			const before = JSON.stringify(source);
			const result = previewOpeningConflictForWallDeletion(source, {
				wallSegmentId: "wall-1",
			});
			if (
				result.kind !== "conflict" ||
				result.openingIds.length !== 1 ||
				result.openingIds[0] !== "door-1" ||
				JSON.stringify(source) !== before
			) {
				throw new TypeError("Opening cancel preview changed source state or lost its host");
			}
			return {
				allocationIntent: [],
				kind: "transient",
				postStateDigest: baseStateDigest,
				transientKind: "conflict-preview",
			};
		}
		case "wall-surface-rehome": {
			const surfaced = createParametricWallItem(
				roomProject(),
				{
					color: "#835a45",
					depthMm: 50,
					elevationMm: 1300,
					heightMm: 600,
					label: "TCC surface",
					offsetMm: 3000,
					side: "right",
					wallSegmentId: "wall-1",
					widthMm: 900,
				},
				ids("surface-1"),
				"2026-08-30T12:00:02.000Z",
			);
			if (surfaced.kind !== "accepted")
				throw new TypeError("Wall surface source fixture was not accepted");
			const result = addGeneralWallToProject(
				surfaced.project,
				{
					end: { xMm: 2000, zMm: 1000 },
					start: { xMm: 2000, zMm: 0 },
					thicknessMm: 100,
				},
				ids("surface-contact", "surface-end", "surface-tail", "surface-branch"),
				"2026-08-30T12:00:03.000Z",
			);
			if (
				result.kind !== "accepted" ||
				result.project.assetInstances[0]?.anchorClass !== "wall" ||
				result.project.assetInstances[0]?.wallSegmentId !== "surface-tail" ||
				result.project.assetInstances[0]?.offsetMm !== 1000
			) {
				throw new TypeError("Wall surface host did not reconcile to its successor");
			}
			return accepted([
				"vertex:contact",
				"vertex:end",
				"wall:tail",
				"wall:branch",
			]);
		}
		case "host-conflict-preview": {
			const surfaced = createParametricWallItem(
				roomProject(),
				{
					color: "#835a45",
					depthMm: 50,
					elevationMm: 1300,
					heightMm: 600,
					label: "TCC collision surface",
					offsetMm: 2000,
					side: "right",
					wallSegmentId: "wall-1",
					widthMm: 900,
				},
				ids("surface-conflict"),
				"2026-08-30T12:00:02.000Z",
			);
			if (surfaced.kind !== "accepted")
				throw new TypeError("Conflict-preview source fixture was not accepted");
			const result = previewWallAddHostConflict(surfaced.project, {
				end: { xMm: 2000, zMm: 1000 },
				start: { xMm: 2000, zMm: 0 },
				thicknessMm: 100,
			});
			if (
				result.kind !== "conflict" ||
				result.itemIds.length !== 1 ||
				result.itemIds[0] !== "surface-conflict" ||
				result.openingIds.length !== 0
			) {
				throw new TypeError("Host conflict preview did not remain allocation-free");
			}
			return {
				allocationIntent: [],
				kind: "transient",
				postStateDigest: baseStateDigest,
				transientKind: "conflict-preview",
			};
		}
	}
}

function measurementOutcome(
	baseStateDigest: string,
	kind: "exact-distance",
	vector: "exact-distance" | "stale" | "target-unavailable" | "shared-format",
): TccA1Outcome {
	if (baseStateDigest !== MEASUREMENT_BASE || kind !== "exact-distance")
		throw new TypeError("Measurement fixture is not bound to its base");
	const project = roomProject();
	if (vector === "shared-format") {
		if (formatLengthMm(5000) !== "5000 мм")
			throw new TypeError("Shared measurement formatting changed");
		return {
			allocationIntent: [],
			inverseStateDigest: MEASUREMENT_BASE,
			kind: "accepted",
			opaqueCandidateRefs: [],
			postStateDigest: "tcc-a1:current-product:measurement:formatted=5000 мм",
		};
	}
	const request: MeasurementRequest = {
		baseRevisionChecksum: "checksum-1",
		baseRevisionId: "revision-1",
		operation: "Distance",
		projectId: project.projectId,
		targets: [
			{ kind: "PlanPoint", xMm: 0, zMm: 0 },
			{ kind: "PlanPoint", xMm: 3000, zMm: 4000 },
		],
	};
	const result = measureDistance(
		project,
		vector === "target-unavailable"
			? {
					...request,
					targets: [
						{ kind: "VertexPoint", vertexId: "missing" },
						request.targets[1],
					],
				}
			: request,
		vector === "stale"
			? {
					checksum: "checksum-2",
					projectId: project.projectId,
					revisionId: "revision-2",
				}
			: {
					checksum: "checksum-1",
					projectId: project.projectId,
					revisionId: "revision-1",
				},
	);
	if (vector === "stale") {
		if (result.kind !== "stale")
			throw new TypeError("Measurement stale identity was retargeted");
		return {
			allocationIntent: [],
			kind: "transient",
			postStateDigest: MEASUREMENT_BASE,
			transientKind: "stale-base",
		};
	}
	if (vector === "target-unavailable") {
		if (result.kind !== "target-unavailable")
			throw new TypeError("Unavailable measurement target was materialized");
		return {
			allocationIntent: [],
			kind: "transient",
			postStateDigest: MEASUREMENT_BASE,
			transientKind: "selection-unavailable",
		};
	}
	if (result.kind !== "measured" || result.distanceMm !== 5000) {
		throw new TypeError(
			"The measurement kernel no longer preserves the declared exact distance",
		);
	}
	return {
		allocationIntent: [],
		inverseStateDigest: MEASUREMENT_BASE,
		kind: "accepted",
		opaqueCandidateRefs: [],
		postStateDigest: "tcc-a1:current-product:measurement:distance=5000",
	};
}

async function lifecycleOutcome(
	baseStateDigest: string,
	kind: "initial-wall-lifecycle",
	vector: "cancelled" | "stale-base" | "lost-fence",
	executor: TccA1CorpusExecutor<unknown>,
): Promise<TccA1Outcome> {
	if (
		baseStateDigest !== EMPTY_GRAPH_DIGEST ||
		kind !== "initial-wall-lifecycle"
	) {
		throw new TypeError("Lifecycle fixture is not bound to its base");
	}
	const fixtureId = vector === "cancelled" ? "TCC-A1-INITIAL-WALL-006" : vector === "stale-base" ? "TCC-A1-INITIAL-WALL-007" : "TCC-A1-INITIAL-WALL-008";
	const fixture = initialWallMaterializationTccA1Corpus.fixtures.find((candidate) => candidate.fixtureId === fixtureId);
	if (!fixture)
		throw new TypeError("The declared cancellation fixture is unavailable");
	return executor.evaluate({
		baseStateDigest: fixture.baseStateDigest,
		fixtureId: fixture.fixtureId,
		intent: fixture.intent,
		rawInputBytes: fixture.rawInputBytes,
	});
}

function roomProject(): Project {
	const configured = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-30T12:00:00.000Z",
			levelId: "level-1",
			name: "TCC-A1 room",
			projectId: "project-tcc-a1",
		}),
		{ depthMm: "3000", heightMm: "2600", widthMm: "4000" },
		ids(
			"v-1",
			"v-2",
			"v-3",
			"v-4",
			"wall-1",
			"wall-2",
			"wall-3",
			"wall-4",
			"room-1",
		),
		"2026-08-30T12:00:01.000Z",
	);
	if (configured.kind !== "accepted")
		throw new TypeError("TCC-A1 fixture project is invalid");
	return configured.project;
}

function dividedRoomProject(): Project {
	const divided = addGeneralWallToProject(
		roomProject(),
		{
			end: { xMm: 2000, zMm: 3100 },
			start: { xMm: 2000, zMm: 0 },
			thicknessMm: 100,
		},
		ids(
			"divider-bottom",
			"divider-top",
			"bottom-tail",
			"top-tail",
			"divider-wall",
			"room-successor",
		),
		"2026-08-30T12:00:02.000Z",
	);
	if (divided.kind !== "accepted")
		throw new TypeError("Lineage merge source divider was not accepted");
	return divided.project;
}

function projectWithDoor(): Project {
	const opened = addDoorOpeningToProject(
		roomProject(),
		{
			heightMm: 2100,
			offsetMm: 2050,
			sillMm: 0,
			wallSegmentId: "wall-1",
			widthMm: 900,
		},
		ids("door-1"),
		"2026-08-30T12:00:02.000Z",
	);
	if (opened.kind !== "accepted")
		throw new TypeError("Opening source fixture was not accepted");
	return opened.project;
}

function rectangleGraph(): PlanGraph {
	return {
		vertices: [
			{ vertexId: "a", xMm: 0, zMm: 0 },
			{ vertexId: "b", xMm: 4000, zMm: 0 },
			{ vertexId: "c", xMm: 4000, zMm: 3000 },
			{ vertexId: "d", xMm: 0, zMm: 3000 },
		],
		wallSegments: [
			{
				endVertexId: "b",
				startVertexId: "a",
				thicknessMm: 100,
				wallSegmentId: "bottom",
			},
			{
				endVertexId: "c",
				startVertexId: "b",
				thicknessMm: 100,
				wallSegmentId: "right",
			},
			{
				endVertexId: "d",
				startVertexId: "c",
				thicknessMm: 100,
				wallSegmentId: "top",
			},
			{
				endVertexId: "a",
				startVertexId: "d",
				thicknessMm: 100,
				wallSegmentId: "left",
			},
		],
	};
}

function partitionedRectangleGraph(): PlanGraph {
	return {
		vertices: [
			{ vertexId: "a", xMm: 0, zMm: 0 },
			{ vertexId: "b", xMm: 2000, zMm: 0 },
			{ vertexId: "c", xMm: 4000, zMm: 0 },
			{ vertexId: "d", xMm: 4000, zMm: 3000 },
			{ vertexId: "e", xMm: 2000, zMm: 3000 },
			{ vertexId: "f", xMm: 0, zMm: 3000 },
		],
		wallSegments: [
			{ endVertexId: "a", startVertexId: "f", thicknessMm: 100, wallSegmentId: "left" },
			{ endVertexId: "b", startVertexId: "a", thicknessMm: 100, wallSegmentId: "bottom-left" },
			{ endVertexId: "c", startVertexId: "b", thicknessMm: 100, wallSegmentId: "bottom-right" },
			{ endVertexId: "d", startVertexId: "c", thicknessMm: 100, wallSegmentId: "right" },
			{ endVertexId: "e", startVertexId: "d", thicknessMm: 100, wallSegmentId: "top-right" },
			{ endVertexId: "f", startVertexId: "e", thicknessMm: 100, wallSegmentId: "top-left" },
			{ endVertexId: "e", startVertexId: "b", thicknessMm: 100, wallSegmentId: "divider" },
		],
	};
}

function nestedRingGraph(): PlanGraph {
	const ring = (prefix: string, minX: number, minZ: number, maxX: number, maxZ: number) => ({
		vertices: [
			{ vertexId: `${prefix}-a`, xMm: minX, zMm: minZ },
			{ vertexId: `${prefix}-b`, xMm: maxX, zMm: minZ },
			{ vertexId: `${prefix}-c`, xMm: maxX, zMm: maxZ },
			{ vertexId: `${prefix}-d`, xMm: minX, zMm: maxZ },
		],
		wallSegments: [
			{ endVertexId: `${prefix}-b`, startVertexId: `${prefix}-a`, thicknessMm: 100, wallSegmentId: `${prefix}-bottom` },
			{ endVertexId: `${prefix}-c`, startVertexId: `${prefix}-b`, thicknessMm: 100, wallSegmentId: `${prefix}-right` },
			{ endVertexId: `${prefix}-d`, startVertexId: `${prefix}-c`, thicknessMm: 100, wallSegmentId: `${prefix}-top` },
			{ endVertexId: `${prefix}-a`, startVertexId: `${prefix}-d`, thicknessMm: 100, wallSegmentId: `${prefix}-left` },
		],
	});
	const outer = ring("outer", 0, 0, 6000, 5000);
	const inner = ring("inner", 2000, 1500, 4000, 3500);
	return {
		vertices: [...outer.vertices, ...inner.vertices],
		wallSegments: [...outer.wallSegments, ...inner.wallSegments],
	};
}

function repeatedWalkGraph(): PlanGraph {
	const graph = rectangleGraph();
	return {
		...graph,
		wallSegments: [
			...graph.wallSegments,
			{
				endVertexId: "a",
				startVertexId: "b",
				thicknessMm: 100,
				wallSegmentId: "bottom-repeated",
			},
		],
	};
}

function touchingRingGraph(): PlanGraph {
	return {
		vertices: [
			{ vertexId: "a", xMm: 0, zMm: 0 },
			{ vertexId: "b", xMm: 1000, zMm: 0 },
			{ vertexId: "touch", xMm: 1000, zMm: 1000 },
			{ vertexId: "d", xMm: 0, zMm: 1000 },
			{ vertexId: "e", xMm: 2000, zMm: 1000 },
			{ vertexId: "f", xMm: 2000, zMm: 2000 },
			{ vertexId: "g", xMm: 1000, zMm: 2000 },
		],
		wallSegments: [
			{ endVertexId: "b", startVertexId: "a", thicknessMm: 100, wallSegmentId: "first-bottom" },
			{ endVertexId: "touch", startVertexId: "b", thicknessMm: 100, wallSegmentId: "first-right" },
			{ endVertexId: "d", startVertexId: "touch", thicknessMm: 100, wallSegmentId: "first-top" },
			{ endVertexId: "a", startVertexId: "d", thicknessMm: 100, wallSegmentId: "first-left" },
			{ endVertexId: "e", startVertexId: "touch", thicknessMm: 100, wallSegmentId: "second-bottom" },
			{ endVertexId: "f", startVertexId: "e", thicknessMm: 100, wallSegmentId: "second-right" },
			{ endVertexId: "g", startVertexId: "f", thicknessMm: 100, wallSegmentId: "second-top" },
			{ endVertexId: "touch", startVertexId: "g", thicknessMm: 100, wallSegmentId: "second-left" },
		],
	};
}

function diagonalTriangleProject(bottomThicknessMm = 100): Project {
	const source = createInitialProject({
		createdAt: "2026-08-30T12:00:00.000Z",
		levelId: "triangle-level",
		name: "Odd miter triangle",
		projectId: "odd-miter-triangle",
	});
	return {
		...source,
		level: {
			...source.level,
			rooms: [
				{
					faceFingerprint: "orthogonal-face:0:0|2000:0|2000:2000",
					heightMm: 2600,
					roomId: "triangle-room",
				},
			],
			vertices: [
				{ vertexId: "a", xMm: 0, zMm: 0 },
				{ vertexId: "b", xMm: 2000, zMm: 0 },
				{ vertexId: "c", xMm: 2000, zMm: 2000 },
			],
			wallSegments: [
				{ endVertexId: "b", startVertexId: "a", thicknessMm: bottomThicknessMm, wallSegmentId: "bottom" },
				{ endVertexId: "c", startVertexId: "b", thicknessMm: 100, wallSegmentId: "right" },
				{ endVertexId: "a", startVertexId: "c", thicknessMm: 100, wallSegmentId: "diagonal" },
			],
		},
	};
}

function thinConcaveProject(): Project {
	const source = createInitialProject({
		createdAt: "2026-08-30T12:00:00.000Z",
		levelId: "thin-level",
		name: "Collapsed usable polygon",
		projectId: "thin-concave-project",
	});
	const vertices = [
		{ vertexId: "thin-1", xMm: 0, zMm: 0 },
		{ vertexId: "thin-2", xMm: 400, zMm: 0 },
		{ vertexId: "thin-3", xMm: 400, zMm: 400 },
		{ vertexId: "thin-4", xMm: 250, zMm: 400 },
		{ vertexId: "thin-5", xMm: 250, zMm: 50 },
		{ vertexId: "thin-6", xMm: 150, zMm: 50 },
		{ vertexId: "thin-7", xMm: 150, zMm: 400 },
		{ vertexId: "thin-8", xMm: 0, zMm: 400 },
	] as const;
	return {
		...source,
		level: {
			...source.level,
			rooms: [
				{
					faceFingerprint: "orthogonal-face:0:0|0:400|150:400|150:50|250:50|250:400|400:400|400:0",
					heightMm: 2600,
					roomId: "thin-room",
				},
			],
			vertices,
			wallSegments: vertices.map((vertex, index) => ({
				endVertexId: vertices[(index + 1) % vertices.length]?.vertexId ?? "",
				startVertexId: vertex.vertexId,
				thicknessMm: 100,
				wallSegmentId: `thin-wall-${index + 1}`,
			})),
		},
	};
}

function horizontalSegmentGraph(): PlanGraph {
	return {
		vertices: [
			{ vertexId: "a", xMm: 0, zMm: 0 },
			{ vertexId: "b", xMm: 1000, zMm: 0 },
		],
		wallSegments: [
			{
				endVertexId: "b",
				startVertexId: "a",
				thicknessMm: 100,
				wallSegmentId: "horizontal",
			},
		],
	};
}

function junctionGraph(): PlanGraph {
	return {
		vertices: [
			{ vertexId: "a", xMm: 0, zMm: 0 },
			{ vertexId: "junction", xMm: 1000, zMm: 0 },
			{ vertexId: "b", xMm: 2000, zMm: 0 },
		],
		wallSegments: [
			{
				endVertexId: "junction",
				startVertexId: "a",
				thicknessMm: 100,
				wallSegmentId: "left",
			},
			{
				endVertexId: "b",
				startVertexId: "junction",
				thicknessMm: 100,
				wallSegmentId: "right",
			},
		],
	};
}

function horizontalCrossingGraph(): PlanGraph {
	return {
		vertices: [
			{ vertexId: "left", xMm: 0, zMm: 1000 },
			{ vertexId: "right", xMm: 2000, zMm: 1000 },
		],
		wallSegments: [
			{
				endVertexId: "right",
				startVertexId: "left",
				thicknessMm: 100,
				wallSegmentId: "horizontal",
			},
		],
	};
}

function multiCrossingGraph(): PlanGraph {
	return {
		vertices: [
			{ vertexId: "first-left", xMm: 0, zMm: 0 },
			{ vertexId: "first-right", xMm: 3000, zMm: 0 },
			{ vertexId: "second-left", xMm: 0, zMm: 2000 },
			{ vertexId: "second-right", xMm: 3000, zMm: 2000 },
		],
		wallSegments: [
			{
				endVertexId: "first-right",
				startVertexId: "first-left",
				thicknessMm: 100,
				wallSegmentId: "first-horizontal",
			},
			{
				endVertexId: "second-right",
				startVertexId: "second-left",
				thicknessMm: 100,
				wallSegmentId: "second-horizontal",
			},
		],
	};
}

function fractionalContactProject(): Project {
	const configured = configureRectangularRoom(
		createInitialProject({
			createdAt: "2026-08-30T12:00:00.000Z",
			levelId: "fractional-level",
			name: "Fractional contact",
			projectId: "fractional-contact-project",
		}),
		{ depthMm: "3000", heightMm: "2600", widthMm: "3000" },
		ids("f-v-1", "f-v-2", "f-v-3", "f-v-4", "f-wall-1", "f-wall-2", "f-wall-3", "f-wall-4", "f-room-1"),
		"2026-08-30T12:00:01.000Z",
	);
	if (configured.kind !== "accepted")
		throw new TypeError("Fractional-contact source Project is invalid");
	const diagonal = addGeneralWallToProject(
		configured.project,
		{
			end: { xMm: 0, zMm: 0 },
			start: { xMm: 3100, zMm: 3100 },
			thicknessMm: 100,
		},
		ids("fractional-diagonal", "fractional-room-2"),
		"2026-08-30T12:00:01.500Z",
	);
	if (diagonal.kind !== "accepted")
		throw new TypeError("Fractional-contact diagonal source was not accepted");
	return diagonal.project;
}

function requireAcceptedPlanGraph(
	result: ReturnType<typeof addWallSegment>,
	label: string,
): PlanGraph {
	if (result.kind !== "accepted")
		throw new TypeError(`${label} unexpectedly rejected: ${result.reasonCode}`);
	return result.graph;
}

function hasVertex(
	graph: PlanGraph,
	vertexId: string,
	xMm: number,
	zMm: number,
): boolean {
	return graph.vertices.some(
		(vertex) =>
			vertex.vertexId === vertexId &&
			vertex.xMm === xMm &&
			vertex.zMm === zMm,
	);
}

function hasWall(
	graph: PlanGraph,
	wallSegmentId: string,
	startVertexId: string,
	endVertexId: string,
): boolean {
	return graph.wallSegments.some(
		(wall) =>
			wall.wallSegmentId === wallSegmentId &&
			wall.startVertexId === startVertexId &&
			wall.endVertexId === endVertexId,
	);
}

function ids(...values: string[]) {
	let index = 0;
	return { next: () => values[index++] ?? `unexpected-${index}` };
}

function idsThatMustNotAllocate() {
	return {
		next: () => {
			throw new Error(
				"A rejected TCC-A1 fixture must not allocate an identity",
			);
		},
	};
}

function asciiBytes(value: string): readonly number[] {
	return Object.freeze([...value].map((character) => character.charCodeAt(0)));
}

async function cryptoDigest(bytes: Uint8Array): Promise<ArrayBuffer> {
	return (
		globalThis as unknown as {
			crypto: {
				subtle: {
					digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer>;
				};
			};
		}
	).crypto.subtle.digest("SHA-256", bytes);
}

function hex(buffer: ArrayBuffer): string {
	return [...new Uint8Array(buffer)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}
