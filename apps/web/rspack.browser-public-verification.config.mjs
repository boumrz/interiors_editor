import webConfig from "./rspack.config.mjs";
import { rspack } from "@rspack/core";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { groupPlan } from "./scripts/additive-public-contract.mjs";
export default (env, args) => {
	const base = webConfig(env, args),
		group = groupPlan(process.env.ADDITIVE_PUBLIC_GROUP),
		output = process.env.ADDITIVE_PUBLIC_OUTPUT;
	if (!output)
		throw Error("ADDITIVE_PUBLIC_PROOF_INVALID: owned output required");
	const paths = new Set(
		Object.values(
			JSON.parse(
				readFileSync(
					"tests/verification/browser-public-native-subjects.json",
					"utf8",
				),
			),
		).map((p) => resolve(p)),
	);
	return {
		...base,
		entry: "./" + group.entry,
		cache: false,
		output: { ...base.output, path: resolve(output, "dist") },
		module: {
			...base.module,
			rules: [
				...(base.module?.rules ?? []),
				{
					enforce: "pre",
					include: (p) => paths.has(p),
					use: [
						{
							loader: resolve(
								"tests/verification/common205-subject-loader.cjs",
							),
						},
					],
				},
			],
		},
		plugins: [
			new rspack.DefinePlugin({ __INTERIORS_TEST_SEAM__: "false" }),
			new rspack.HtmlRspackPlugin({
				template: "./tests/verification/common205-harness.html",
			}),
		],
	};
};
