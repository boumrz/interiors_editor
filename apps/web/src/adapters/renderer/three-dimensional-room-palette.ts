/**
 * Presentation-only colours shared by both WebGL2 backends. They deliberately
 * belong to the disposable 3D projection, never to the durable Project.
 */
export const THREE_DIMENSIONAL_ROOM_PALETTE = {
	background: "#fafbfc",
	floor: "#e3e4e2",
	wall: "#cdd0cf",
} as const;

/**
 * Presentation-only studio lighting.  It is shared as data so the WebGL2
 * projection stays reproducible and no light choice leaks into Project state.
 */
export const THREE_DIMENSIONAL_ROOM_LIGHTING = {
	ambient: { color: "#ffffff", intensity: 1 },
	fill: {
		color: "#edf1f4",
		intensity: 0.52,
		position: [-4, 5, -3],
	},
	key: {
		color: "#ffffff",
		intensity: 2.1,
		position: [5, 8, 4],
	},
	skylight: { groundColor: "#c8cbca", intensity: 0.68, skyColor: "#f5f7fa" },
} as const;

export const THREE_DIMENSIONAL_ROOM_SURFACE_COLORS = {
	background: [0.98, 0.984, 0.988, 1],
	baseboard: [0.65, 0.66, 0.65, 1],
	floorDarkBoard: [0.85, 0.85, 0.84, 1],
	floorLightBoard: [0.89, 0.89, 0.88, 1],
	interiorWall: [0.8, 0.8, 0.79, 1],
	exteriorWall: [0.72, 0.73, 0.72, 1],
	wallOutline: [0.27, 0.28, 0.27, 1],
	wallUpperWash: [0.86, 0.87, 0.86, 1],
} as const;
