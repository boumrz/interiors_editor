import type { DerivePlanFacesResult } from "../domain/derive-plan-faces";
import type { ResolveOrthogonalPlanFacesResult } from "../domain/derived-orthogonal-plan-faces";
import type { ParametricFloorItemPlacementAssessment } from "../domain/parametric-item";
import type { ParametricWallItemPlacementRejectionReason } from "../domain/parametric-wall-item";
import type { WallOpeningRejection } from "../domain/wall-opening";
import type { StaticGlbImportPreflight } from "../domain/static-glb-import";

export type RuntimeV1ProjectValidationReason =
	| "BACKUP_SCHEMA_UNREADABLE"
	| "BACKUP_PROJECT_LIMIT"
	| Extract<DerivePlanFacesResult, { readonly kind: "rejected" }>["reasonCode"]
	| Extract<
			ResolveOrthogonalPlanFacesResult,
			{ readonly kind: "rejected" }
	  >["reasonCode"]
	| Extract<
			ParametricFloorItemPlacementAssessment,
			{ readonly kind: "invalid" }
	  >["reasonCode"]
	| ParametricWallItemPlacementRejectionReason
	| WallOpeningRejection["reasonCode"];

export type PortableBackupIngressReason =
	| "PROJECT_BACKUP_ENVELOPE_EXCEEDED"
	| RuntimeV1ProjectValidationReason
	| Extract<
			StaticGlbImportPreflight,
			{ readonly kind: "rejected" }
	  >["reasonCode"]
	| "BACKUP_PATH_UNSAFE"
	| "BACKUP_MANIFEST_INVALID"
	| "BACKUP_CHECKSUM_MISMATCH"
	| "BACKUP_RESOURCE_MISSING"
	| "BACKUP_CANCELLED"
	| "BACKUP_CONTAINER_UNSUPPORTED"
	| "BACKUP_CONTAINER_BYTES_LIMIT"
	| "BACKUP_ENTRY_LIMIT"
	| "BACKUP_UNPACKED_BYTES_LIMIT"
	| "BACKUP_COMPRESSION_RATIO";
