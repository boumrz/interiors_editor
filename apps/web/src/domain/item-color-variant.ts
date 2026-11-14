export const alphaParametricItemColorVariants = [
	{
		color: "#a76a3b",
		label: "Тёплое дерево",
		slotId: "body",
		variantId: "alpha-warm-wood",
	},
	{
		color: "#416b91",
		label: "Глубокий синий",
		slotId: "body",
		variantId: "alpha-blue",
	},
	{
		color: "#716796",
		label: "Мягкий фиолетовый",
		slotId: "body",
		variantId: "alpha-violet",
	},
	{
		color: "#8c6e4c",
		label: "Орех",
		slotId: "body",
		variantId: "alpha-walnut",
	},
	{
		color: "#835a45",
		label: "Терракота",
		slotId: "body",
		variantId: "alpha-terracotta",
	},
	{
		color: "#536d62",
		label: "Лесной зелёный",
		slotId: "body",
		variantId: "alpha-forest",
	},
	{
		color: "#8a4f54",
		label: "Ягодный красный",
		slotId: "body",
		variantId: "alpha-berry",
	},
] as const;

export type ItemColorVariantId =
	(typeof alphaParametricItemColorVariants)[number]["variantId"];

export type AlphaParametricItemColorVariant =
	(typeof alphaParametricItemColorVariants)[number];

export const alphaParametricItemColors = alphaParametricItemColorVariants.map(
	(variant) => variant.color,
);

/** Resolves a stable domain reference; renderer-compatible color is projection data. */
export function alphaParametricItemColorVariantFor(
	variantId: string,
): AlphaParametricItemColorVariant | undefined {
	return alphaParametricItemColorVariants.find(
		(variant) => variant.variantId === variantId,
	);
}
