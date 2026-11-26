import { supportPlateY } from "../../domain/interior-support";
import type { SceneBox } from "./rectangular-room-projection";
import type {
	FurnitureGreyboxPart,
	FurnitureGreyboxRole,
} from "./webgl2-room-renderer-shared";

export interface CatalogProfile {
	readonly axis?: "y" | "z";
	readonly outline?: "oval" | "rounded";
	readonly cornerRadius?: number;
	readonly openStart?: true;
	readonly openEnd?: true;
	/** The profile can turn inward and descend again to form a hollow bowl. */
	readonly rings: readonly (readonly [
		at: number,
		xSize: number,
		transverseSize: number,
		xOffset?: number,
		transverseOffset?: number,
	])[];
}

type Interval = readonly [min: number, max: number];

interface PartFinish {
	readonly tone?: FurnitureGreyboxPart["tone"];
	readonly color?: string;
	readonly rounded?: number;
	readonly profile?: CatalogProfile;
	readonly opacity?: number;
}

export type CatalogPartBuilder = (
	role: FurnitureGreyboxRole,
	x: Interval,
	y: Interval,
	z: Interval,
	finish?: PartFinish,
) => FurnitureGreyboxPart;

export function catalogPartBuilder(item: SceneBox): CatalogPartBuilder {
	const cosine = Math.cos(item.yawRadians ?? 0);
	const sine = Math.sin(item.yawRadians ?? 0);
	return (role, [left, right], [bottom, top], [rear, front], finish = {}) => {
		const x = ((left + right) / 2 - 0.5) * item.widthM;
		const z = ((rear + front) / 2 - 0.5) * item.depthM;
		const widthM = (right - left) * item.widthM;
		const depthM = (front - rear) * item.depthM;
		const [minY, maxY] = role === "tabletop" && item.material?.furnitureKind === "catalog:open-shelf"
			? supportPlateY([bottom, top], item.heightM * 1000).map(value => value / 1000) as [number, number]
			: [bottom * item.heightM, top * item.heightM];
		const heightM = maxY - minY;
		return {
			role,
			tone: finish.tone ?? "base",
			...(finish.color === undefined ? {} : { fixedColor: finish.color }),
			...(finish.rounded === undefined
				? {}
				: {
						edgeRadiusM: Math.min(
							finish.rounded,
							0.45 * Math.min(widthM, depthM, heightM),
						),
					}),
			...(finish.profile === undefined ? {} : { profile: finish.profile }),
			...(finish.opacity === undefined ? {} : { opacity: finish.opacity }),
			box: {
				...item,
				centerXM: item.centerXM + cosine * x + sine * z,
				centerYM: item.centerYM + (maxY + minY - item.heightM) / 2,
				centerZM: item.centerZM - sine * x + cosine * z,
				widthM,
				heightM,
				depthM,
			},
		};
	};
}
