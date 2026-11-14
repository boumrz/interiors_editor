import { describe, expect, it } from "@rstest/core";

import {
	planItemSilhouetteKindFor,
	planItemSilhouettePathsFor,
} from "./plan-item-silhouette";

describe("plan item silhouettes", () => {
	it("maps familiar catalog labels to compact technical-plan silhouettes", () => {
		expect(planItemSilhouetteKindFor("Диван Oslo")).toBe("sofa");
		expect(planItemSilhouetteKindFor("Кресло Eames")).toBe("chair");
		expect(planItemSilhouetteKindFor("Обеденный стол")).toBe("table");
		expect(planItemSilhouetteKindFor("Двуспальная кровать")).toBe("bed");
		expect(planItemSilhouetteKindFor("Шкаф для одежды")).toBe("storage");
	});

	it("keeps unknown models as a neutral technical block", () => {
		expect(planItemSilhouetteKindFor("Пользовательская модель")).toBe(
			"generic",
		);
	});

	it("uses a few quiet inner lines for known furniture while leaving generic models unadorned", () => {
		expect(planItemSilhouettePathsFor("sofa")).toHaveLength(4);
		expect(planItemSilhouettePathsFor("bed")).toHaveLength(3);
		expect(planItemSilhouettePathsFor("generic")).toEqual([]);
	});
});
