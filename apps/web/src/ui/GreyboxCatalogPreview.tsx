import { copy } from "./editor-language";
import { greyboxPreviewPartsFor } from './greybox-catalog-preview';
import type { GreyboxFurniturePreset } from './greybox-furniture';
import styles from './AppShell.module.css';

interface GreyboxCatalogPreviewProps {
  readonly preset: GreyboxFurniturePreset;
}

/** A local isometric sketch for a procedural placeholder, not a renderer thumbnail. */
export function GreyboxCatalogPreview({ preset }: GreyboxCatalogPreviewProps) {
	const parts = greyboxPreviewPartsFor(preset.id);
	return (
		<svg
			aria-label={copy(
				`Эскиз предмета: ${preset.label}`,
				`Item preview: ${preset.label}`,
			)}
			className={styles.greyboxPreview}
			role="img"
			viewBox="0 0 100 100"
		>
			<rect
				className={styles.previewFloor}
				height="68"
				width="80"
				x="10"
				y="20"
			/>
			<g transform="translate(8 3) skewY(-12)">
				{parts.map((part) => (
					<rect
						className={styles[`preview${part.tone}`]}
						fill={preset.color}
						height={part.height}
						key={`${part.role}-${part.tone}-${part.x}-${part.y}`}
						rx="2"
						width={part.width}
						x={part.x}
						y={part.y}
					/>
				))}
			</g>
		</svg>
	);
}
