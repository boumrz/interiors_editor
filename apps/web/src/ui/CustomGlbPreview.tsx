import { copy } from "./editor-language";
import { useEffect, useRef, useState } from "react";
import {
	Box3,
	Color,
	DirectionalLight,
	Group,
	HemisphereLight,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	Vector3,
	WebGLRenderer,
} from "three";

import styles from "./AppShell.module.css";
import { loadCustomGlbRuntime } from "./custom-glb-runtime-loader";

import { measuredDimensionsMmForGlbBounds } from "./glb-source-scale";
import { disposeThreeObject3D } from "./three-resource-disposal";

export interface MeasuredCustomGlbDimensions {
	readonly depthMm: number;
	readonly heightMm: number;
	readonly widthMm: number;
}

interface CustomGlbPreviewProps {
	readonly bytes: Uint8Array;
	readonly label: string;
	readonly onMeasuredDimensions?: (
		dimensions: MeasuredCustomGlbDimensions,
	) => void;
	readonly variant?: "catalog" | "review";
}

type PreviewState = "loading" | "ready" | "unavailable";

/**
 * An isolated renderer for a user-selected, already preflighted GLB.  It has
 * no URL resolver and therefore cannot reach external model resources.
 */
export function CustomGlbPreview({
	bytes,
	label,
	onMeasuredDimensions,
	variant = "review",
}: CustomGlbPreviewProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const measuredDimensionsRef = useRef(onMeasuredDimensions);
	const [state, setState] = useState<PreviewState>("loading");

	useEffect(() => {
		measuredDimensionsRef.current = onMeasuredDimensions;
	}, [onMeasuredDimensions]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return undefined;

		let disposed = false;
		let frame = 0;
		let parseFrame = 0;
		let renderer: WebGLRenderer | undefined;
		let resizeObserver: ResizeObserver | undefined;
		let modelRoot: Group | undefined;
		let azimuthRadians = Math.PI / 4;
		let elevationRadians = Math.PI / 7;
		let radius = 2;
		let lastPointer: { readonly x: number; readonly y: number } | undefined;
		const scene = new Scene();
		scene.background = new Color("#f3f0e9");
		const camera = new PerspectiveCamera(34, 1, 0.01, 1000);
		const target = new Vector3();
		scene.add(new HemisphereLight("#fff8ea", "#6f6a60", 2.4));
		const keyLight = new DirectionalLight("#fff7e7", 3.2);
		keyLight.position.set(4, 7, 5);
		scene.add(keyLight);
		const floor = new Mesh(
			new PlaneGeometry(200, 200),
			new MeshStandardMaterial({
				color: "#dcd6cc",
				metalness: 0,
				roughness: 1,
			}),
		);
		floor.rotation.x = -Math.PI / 2;
		floor.position.y = -0.004;
		scene.add(floor);

		const render = () => {
			if (!renderer || disposed) return;
			const width = Math.max(1, canvas.clientWidth);
			const height = Math.max(1, canvas.clientHeight);
			const pixelRatio = Math.min(1, window.devicePixelRatio || 1);
			renderer.setPixelRatio(pixelRatio);
			renderer.setSize(width, height, false);
			camera.aspect = width / height;
			camera.position.set(
				Math.cos(azimuthRadians) * Math.cos(elevationRadians) * radius,
				Math.sin(elevationRadians) * radius + target.y,
				Math.sin(azimuthRadians) * Math.cos(elevationRadians) * radius,
			);
			camera.lookAt(target);
			camera.updateProjectionMatrix();
			renderer.render(scene, camera);
		};

		try {
			renderer = new WebGLRenderer({
				alpha: false,
				antialias: false,
				canvas,
				preserveDrawingBuffer: false,
			});
		} catch {
			setState("unavailable");
			return undefined;
		}

		const resize = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(render);
		};
		resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(canvas);
		const onPointerDown = (event: PointerEvent) => {
			lastPointer = { x: event.clientX, y: event.clientY };
			canvas.setPointerCapture(event.pointerId);
		};
		const onPointerMove = (event: PointerEvent) => {
			if (!lastPointer) return;
			const next = { x: event.clientX, y: event.clientY };
			azimuthRadians -= (next.x - lastPointer.x) * 0.012;
			elevationRadians = Math.max(
				-0.15,
				Math.min(0.72, elevationRadians + (next.y - lastPointer.y) * 0.008),
			);
			lastPointer = next;
			render();
		};
		const onPointerEnd = (event: PointerEvent) => {
			lastPointer = undefined;
			if (canvas.hasPointerCapture(event.pointerId))
				canvas.releasePointerCapture(event.pointerId);
		};
		canvas.addEventListener("pointerdown", onPointerDown);
		canvas.addEventListener("pointermove", onPointerMove);
		canvas.addEventListener("pointerup", onPointerEnd);
		canvas.addEventListener("pointercancel", onPointerEnd);

		// Give React one frame to paint the loading state before the browser starts
		// GLB decoding and GPU texture upload on its main thread.
		parseFrame = requestAnimationFrame(() => {
			void loadCustomGlbRuntime(bytes).then((runtime) => {
				if (!runtime) {
					if (!disposed) setState("unavailable");
					return;
				}
				if (disposed) {
					disposeThreeObject3D(runtime.root);
					return;
				}
				modelRoot = new Group();
				modelRoot.add(runtime.root);
				const bounds = new Box3().setFromObject(modelRoot);
				const centre = bounds.getCenter(new Vector3());
				runtime.root.position.sub(centre);
				runtime.root.position.y += runtime.sourceDimensionsM.heightM / 2;
				target.set(0, runtime.sourceDimensionsM.heightM * 0.34, 0);
				radius =
					Math.max(
						runtime.sourceDimensionsM.widthM,
						runtime.sourceDimensionsM.heightM,
						runtime.sourceDimensionsM.depthM,
					) * 2.6;
				scene.add(modelRoot);
				measuredDimensionsRef.current?.(
					measuredDimensionsMmForGlbBounds(
						runtime.sourceDimensionsM,
						runtime.document,
					),
				);
				setState("ready");
				resize();
			});
		});

		return () => {
			disposed = true;
			cancelAnimationFrame(frame);
			cancelAnimationFrame(parseFrame);
			resizeObserver?.disconnect();
			canvas.removeEventListener("pointerdown", onPointerDown);
			canvas.removeEventListener("pointermove", onPointerMove);
			canvas.removeEventListener("pointerup", onPointerEnd);
			canvas.removeEventListener("pointercancel", onPointerEnd);
			disposeThreeObject3D(modelRoot ?? new Group());
			floor.geometry.dispose();
			(floor.material as MeshStandardMaterial).dispose();
			renderer?.dispose();
		};
	}, [bytes]);

	return (
		<div
			className={`${styles.customGlbPreview} ${
				variant === "catalog" ? styles.customGlbCatalogPreview : ""
			}`}
		>
			<canvas
				aria-label={copy(
					`Предпросмотр модели: ${label}`,
					`Model preview: ${label}`,
				)}
				data-testid="custom-glb-preview"
				ref={canvasRef}
				style={{ touchAction: "none" }}
			>
				{copy(
					"Предпросмотр модели требует WebGL.",
					"The model preview requires WebGL.",
				)}
			</canvas>
			<output aria-live="polite">
				{state === "loading"
					? copy("Подготавливаем 3D-предпросмотр", "Preparing 3D preview")
					: state === "ready"
						? ""
						: copy(
								"Не удалось открыть 3D-предпросмотр. Модель не добавлена.",
								"Could not open the 3D preview. The model was not added.",
							)}
			</output>
		</div>
	);
}
