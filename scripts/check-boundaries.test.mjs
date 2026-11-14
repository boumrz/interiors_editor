import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { checkBoundaries } from "./check-boundaries.mjs";

function checkFixture(files) {
	const root = mkdtempSync(join(tmpdir(), "interiors-boundaries-"));
	try {
		for (const [name, source] of Object.entries(files)) {
			const path = join(root, name);
			mkdirSync(dirname(path), { recursive: true });
			writeFileSync(path, source);
		}
		return checkBoundaries({ sourceRoot: root });
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
}

test("allows domain values, application ports and renderer projections without restricting UI imports", () => {
	assert.deepEqual(checkFixture({
		"domain/value.ts": "export const value = 1;",
		"application/ports.ts": "export interface Port { save(): void; }",
		"application/use-case.ts": "import {value} from '../domain/value'; import type {Port} from './ports'; export function run(port: Port) { port.save(); return value; }",
		"adapters/renderer/shared.ts": "export const color = '#fff';",
		"adapters/renderer/scene.ts": "export {color} from './shared';",
		"ui/screen.tsx": "import React from 'react'; import {color} from '../adapters/renderer/scene'; export const screen = <div>{color}</div>;",
	}), []);
});

test("rejects a domain-to-application type import with its source line", () => {
	const issues = checkFixture({
		"application/ports.ts": "export interface Port {}",
		"domain/value.ts": "// domain cannot depend on application\nimport type {Port} from '../application/ports'; export type Value = Port;",
	});
	assert.equal(issues.length, 1);
	assert.equal(issues[0].code, "FORBIDDEN_LAYER_IMPORT");
	assert.equal(issues[0].file, "domain/value.ts");
	assert.equal(issues[0].line, 2);
});

test("rejects application access to concrete persistence even through a type re-export", () => {
	const issues = checkFixture({
		"adapters/persistence/store.ts": "export interface Store {}",
		"application/use-case.ts": "export type {Store} from '../adapters/persistence/store';",
	});
	assert.equal(issues[0]?.code, "FORBIDDEN_LAYER_IMPORT");
});

test("rejects UI, engine, storage, Node and network packages in inner layers", () => {
	const issues = checkFixture({
		"domain/value.ts": "import type {ReactNode} from 'react'; import {Mesh} from 'three'; import {readFile} from 'node:fs';",
		"application/use-case.ts": "import axios from 'axios'; import {openDB} from 'idb';",
	});
	assert.equal(issues.length, 5);
	assert.ok(issues.every((issue) => issue.code === "FORBIDDEN_LAYER_IMPORT"));
});

test("inspects dynamic imports, import types and require rather than only static import declarations", () => {
	const issues = checkFixture({
		"adapters/renderer/scene.ts": "export const value=1;",
		"application/use-case.ts": "export const load=()=>import('../adapters/renderer/scene'); export type T=import('../adapters/renderer/scene').T; const store=require('idb');",
	});
	assert.equal(issues.length, 3);
	assert.ok(issues.every((issue) => issue.code === "FORBIDDEN_LAYER_IMPORT"));
});

test("unresolved relative imports fail closed instead of hiding missing graph edges", () => {
	const issues = checkFixture({"domain/value.ts": "import {value} from './missing';"});
	assert.equal(issues[0]?.code, "UNRESOLVED_IMPORT");
});

test("resolves relative directory index imports before checking their destination layer", () => {
	const issues = checkFixture({
		"adapters/persistence/index.ts": "export const value=1;",
		"domain/value.ts": "export {value} from '../adapters/persistence';",
	});
	assert.equal(issues[0]?.code, "FORBIDDEN_LAYER_IMPORT");
});

test("lets the compiler resolve valid aliases and rejects aliases crossing an inner-layer boundary", () => {
	const issues = checkFixture({
		"tsconfig.json": JSON.stringify({compilerOptions: {module: "esnext", moduleResolution: "bundler", paths: {"@domain/*": ["./domain/*"], "@infra/*": ["./adapters/*"]}}}),
		"domain/value.ts": "export const value=1;",
		"adapters/renderer/scene.ts": "export const scene=1;",
		"application/use-case.ts": "export {value} from '@domain/value';",
		"domain/invalid.ts": "export {scene} from '@infra/renderer/scene';",
	});
	assert.equal(issues.length, 1);
	assert.equal(issues[0].code, "FORBIDDEN_LAYER_IMPORT");
	assert.equal(issues[0].file, "domain/invalid.ts");
});

test("a source root with no production files fails closed", () => {
	assert.equal(checkFixture({})[0]?.code, "NO_SOURCE_FILES");
});

test("reports a renderer runtime cycle through dynamic imports and re-exports", () => {
	const issues = checkFixture({
		"adapters/renderer/a.ts": "export const load=()=>import('./b');",
		"adapters/renderer/b.ts": "export {load} from './a';",
	});
	assert.equal(issues.length, 1);
	assert.equal(issues[0].code, "RENDERER_RUNTIME_CYCLE");
	assert.match(issues[0].message, /adapters\/renderer\/a\.ts/);
	assert.match(issues[0].message, /adapters\/renderer\/b\.ts/);
});

test("counts a named value import beside a type import as a runtime edge", () => {
	const issues = checkFixture({
		"adapters/renderer/a.ts": "import {type T, value} from './b'; export const a=value;",
		"adapters/renderer/b.ts": "export type T=number; export {a as value} from './a';",
	});
	assert.equal(issues[0]?.code, "RENDERER_RUNTIME_CYCLE");
});

test("does not turn type-only renderer references into a runtime cycle", () => {
	assert.deepEqual(checkFixture({
		"adapters/renderer/a.ts": "import type {B} from './b'; export interface A {b?:B}",
		"adapters/renderer/b.ts": "import {type A} from './a'; export type {A} from './a'; export interface B {a?:A}",
	}), []);
});

test("ignores test files but forbids production code from importing them", () => {
	const issues = checkFixture({
		"domain/value.test.ts": "import React from 'react'; export const fixture=1;",
		"domain/value.ts": "import {fixture} from './value.test';",
	});
	assert.equal(issues.length, 1);
	assert.equal(issues[0].code, "PRODUCTION_IMPORTS_TEST");
});

test("forbids direct browser, storage and network globals in domain/application", () => {
	const issues = checkFixture({
		"domain/value.ts": "export const value=window.location;",
		"application/use-case.ts": "export const network=()=>fetch('/project'); export const store=globalThis['indexedDB'];",
	});
	assert.equal(issues.length, 3);
	assert.ok(issues.every((issue) => issue.code === "FORBIDDEN_PLATFORM_GLOBAL"));
});

test("allows local names and neutral byte conversion rather than banning words in strings or properties", () => {
	assert.deepEqual(checkFixture({
		"domain/value.ts": "export const document={fetch:'window.indexedDB'}; export const value=document.fetch;",
		"application/use-case.ts": "export const run=(fetch:()=>string)=>fetch(); export const decoder=globalThis.TextDecoder;",
	}), []);
});
