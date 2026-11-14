import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// TypeScript 7 exposes the native compiler through these pinned API entry points;
// the top-level package exports only the version, unlike TypeScript 5.
const requireWebDependency = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { API } = await import(pathToFileURL(requireWebDependency.resolve("typescript/unstable/sync")).href);
const ast = await import(pathToFileURL(requireWebDependency.resolve("typescript/unstable/ast")).href);
const defaultSourceRoot = fileURLToPath(new URL("../apps/web/src", import.meta.url));
const sourcePattern = /\.(?:[cm]?ts|tsx)$/;
const testPattern = /(?:^|\/)(?:__tests__|test|tests)\/|\.(?:test|spec)\.[cm]?tsx?$/;
const platformGlobals = new Set([
	"window", "document", "navigator", "localStorage", "sessionStorage",
	"indexedDB", "caches", "fetch", "XMLHttpRequest", "WebSocket", "EventSource",
	"HTMLElement", "HTMLCanvasElement", "Worker", "Image", "ImageBitmap",
	"OffscreenCanvas", "WebGLRenderingContext", "WebGL2RenderingContext",
]);

/**
 * Returns actionable source locations without changing any source or config.
 * Domain imports only domain; application imports domain/application/ports.
 * Runtime cycle enforcement covers components touching adapters/renderer.
 * This is an architecture check, not a sandbox for deliberately obfuscated code.
 */
export function checkBoundaries({ sourceRoot = defaultSourceRoot } = {}) {
	const root = realpathSync(sourceRoot);
	const files = productionFiles(root);
	if (files.length === 0) {
		return [{code: "NO_SOURCE_FILES", file: ".", line: 1, message: "No production TypeScript source files found"}];
	}
	const api = new API({ cwd: root });
	let snapshot;
	try {
		snapshot = api.updateSnapshot({ openFiles: files });
		const issues = [];
		const graph = new Map(files.map((file) => [file, new Set()]));
		for (const file of files) {
			const project = snapshot.getDefaultProjectForFile(file);
			const source = project?.program.getSourceFile(file);
			if (!source) {
				issues.push({code: "SOURCE_UNAVAILABLE", file: portable(relative(root, file)), line: 1, message: "Compiler could not parse this source"});
				continue;
			}
			const layer = portable(relative(root, file)).split("/")[0];
			const innerLayer = layer === "domain" || layer === "application";
			const report = (code, node, message) => issues.push({
				code,
				file: portable(relative(root, file)),
				line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
				message,
			});
			function inspect(node) {
				const imported = moduleReference(node);
				if (imported) {
					const specifier = imported.node.text;
					const target = resolveModule(specifier, file, project.checker, imported.node);
					if (target && testPattern.test(portable(relative(root, target)))) {
						report("PRODUCTION_IMPORTS_TEST", imported.node, `Production code imports test source: ${specifier}`);
					} else if (innerLayer && !allowedInnerImport(layer, target, root)) {
						const code = specifier.startsWith(".") && !target ? "UNRESOLVED_IMPORT" : "FORBIDDEN_LAYER_IMPORT";
						report(code, imported.node, `${layer} cannot import ${specifier}; use domain/application ports`);
					} else if (!target && (specifier.startsWith(".") || isAbsolute(specifier))) {
						report("UNRESOLVED_IMPORT", imported.node, `Cannot resolve relative source import: ${specifier}`);
					}
					if (target && imported.runtime && graph.has(target)) graph.get(file).add(target);
				}
				if (innerLayer) {
					const globalName = platformGlobalName(node);
					if (globalName && !locallyDeclared(node, project.checker, root)) {
						report("FORBIDDEN_PLATFORM_GLOBAL", node, `${layer} uses ${globalName} directly; inject an application port`);
					}
				}
				node.forEachChild(inspect);
			}
			inspect(source);
		}
		for (const component of cyclicComponents(graph)) {
			const paths = component.map((file) => portable(relative(root, file))).sort();
			if (!paths.some((file) => file.startsWith("adapters/renderer/"))) continue;
			issues.push({code: "RENDERER_RUNTIME_CYCLE", file: paths[0], line: 1, message: `Runtime import cycle includes: ${paths.join(" -> ")}`});
		}
		return issues.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.code.localeCompare(b.code));
	} finally {
		snapshot?.dispose();
		api.close();
	}
}

function portable(path) {
	return path.split(sep).join("/");
}

function productionFiles(root) {
	return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
		const path = resolve(root, entry.name);
		if (entry.isDirectory()) return entry.name === "node_modules" ? [] : productionFiles(path);
		return entry.isFile() && sourcePattern.test(path) && !testPattern.test(portable(path)) && !path.endsWith(".d.ts") ? [realpathSync(path)] : [];
	}).sort();
}

function inside(root, path) {
	const fromRoot = relative(root, path);
	return fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot);
}

function allowedInnerImport(layer, target, root) {
	if (!target || !inside(root, target)) return false;
	const targetLayer = portable(relative(root, target)).split("/")[0];
	return targetLayer === "domain" || (layer === "application" && (targetLayer === "application" || targetLayer === "ports"));
}

function moduleReference(node) {
	if (ast.isImportDeclaration(node) && ast.isStringLiteral(node.moduleSpecifier)) {
		const clause = node.importClause;
		const bindings = clause?.namedBindings;
		const namedTypesOnly = bindings && ast.isNamedImports(bindings) && bindings.elements.length > 0 && bindings.elements.every((item) => item.isTypeOnly);
		const typeOnly = clause && (clause.phaseModifier === ast.SyntaxKind.TypeKeyword || (!clause.name && namedTypesOnly));
		return { node: node.moduleSpecifier, runtime: !typeOnly };
	}
	if (ast.isExportDeclaration(node) && node.moduleSpecifier && ast.isStringLiteral(node.moduleSpecifier)) {
		const clause = node.exportClause;
		const namedTypesOnly = clause && ast.isNamedExports(clause) && clause.elements.length > 0 && clause.elements.every((item) => item.isTypeOnly);
		return { node: node.moduleSpecifier, runtime: !node.isTypeOnly && !namedTypesOnly };
	}
	if (ast.isImportTypeNode(node) && ast.isLiteralTypeNode(node.argument) && ast.isStringLiteral(node.argument.literal)) {
		return { node: node.argument.literal, runtime: false };
	}
	if (ast.isImportEqualsDeclaration(node) && ast.isExternalModuleReference(node.moduleReference) && ast.isStringLiteral(node.moduleReference.expression)) {
		return {node: node.moduleReference.expression, runtime: !node.isTypeOnly};
	}
	if (ast.isCallExpression(node) && (ast.isImportExpression(node.expression) || (ast.isIdentifier(node.expression) && node.expression.text === "require")) && node.arguments[0] && ast.isStringLiteral(node.arguments[0])) {
		return { node: node.arguments[0], runtime: true };
	}
	return undefined;
}

function resolveModule(specifier, importer, checker, node) {
	if (specifier.startsWith(".") || isAbsolute(specifier)) {
		const base = resolve(dirname(importer), specifier);
		const withoutJsExtension = /\.[cm]?jsx?$/.test(base) ? base.slice(0, -extname(base).length) : base;
		const candidates = [base, `${withoutJsExtension}.ts`, `${withoutJsExtension}.tsx`, `${withoutJsExtension}.mts`, `${withoutJsExtension}.cts`, resolve(base, "index.ts"), resolve(base, "index.tsx")];
		const target = candidates.find((path) => existsSync(path) && statSync(path).isFile());
		return target ? realpathSync(target) : undefined;
	}
	// The compiler owns paths/baseUrl aliases; external packages stay outside the
	// inner layer even if their module declaration resolves successfully.
	const symbol = checker.getSymbolAtLocation(node);
	const declaration = symbol?.declarations?.[0];
	return declaration ? declarationFile(declaration) : undefined;
}

function realPathIfPresent(path) {
	return existsSync(path) ? realpathSync(path) : undefined;
}

function declarationFile(declaration) {
	// Native compiler handles use canonical case-folded paths on macOS. Resolve
	// the source file so source-root comparisons also work on case-sensitive CI.
	const sourcePath = declaration.resolve()?.getSourceFile().fileName ?? declaration.path;
	return realPathIfPresent(sourcePath);
}

function platformGlobalName(node) {
	if ((ast.isPropertyAccessExpression(node) || ast.isElementAccessExpression(node)) && ast.isIdentifier(node.expression) && node.expression.text === "globalThis") {
		const name = ast.isPropertyAccessExpression(node) ? node.name.text : ast.isStringLiteral(node.argumentExpression) ? node.argumentExpression.text : undefined;
		return platformGlobals.has(name) ? name : undefined;
	}
	if (!ast.isIdentifier(node) || !platformGlobals.has(node.text)) return undefined;
	if (ast.isPropertyAccessExpression(node.parent) && node.parent.name === node) return undefined;
	return node.text;
}

function locallyDeclared(node, checker, root) {
	// globalThis storage/network access cannot be turned into a neutral value by
	// the checker resolving the property to a DOM declaration.
	if (!ast.isIdentifier(node)) return false;
	const symbol = checker.getSymbolAtLocation(node);
	return symbol?.declarations?.some((declaration) => {
		const file = declarationFile(declaration);
		return file !== undefined && inside(root, file);
	}) ?? false;
}

function cyclicComponents(graph) {
	let sequence = 0;
	const indices = new Map();
	const lowlinks = new Map();
	const stack = [];
	const active = new Set();
	const cycles = [];
	function visit(file) {
		indices.set(file, sequence);
		lowlinks.set(file, sequence++);
		stack.push(file);
		active.add(file);
		for (const target of graph.get(file)) {
			if (!indices.has(target)) {
				visit(target);
				lowlinks.set(file, Math.min(lowlinks.get(file), lowlinks.get(target)));
			} else if (active.has(target)) {
				lowlinks.set(file, Math.min(lowlinks.get(file), indices.get(target)));
			}
		}
		if (lowlinks.get(file) !== indices.get(file)) return;
		const component = [];
		let member;
		do {
			member = stack.pop();
			active.delete(member);
			component.push(member);
		} while (member !== file);
		if (component.length > 1 || graph.get(file).has(file)) cycles.push(component);
	}
	for (const file of graph.keys()) if (!indices.has(file)) visit(file);
	return cycles;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const issues = checkBoundaries({ sourceRoot: process.argv[2] ? resolve(process.argv[2]) : defaultSourceRoot });
	for (const issue of issues) console.error(`${issue.file}:${issue.line} [${issue.code}] ${issue.message}`);
	if (issues.length > 0) process.exitCode = 1;
	else console.log("Architecture boundaries and renderer runtime imports: PASS");
}
