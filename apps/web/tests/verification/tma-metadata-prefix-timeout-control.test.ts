import { it } from "@rstest/core";

it("reported infrastructure body timeout is inconclusive, never Killed", async () => {
	await new Promise<never>(() => undefined);
});
