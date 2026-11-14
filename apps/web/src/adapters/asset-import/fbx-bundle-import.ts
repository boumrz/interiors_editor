import { unzipSync } from "fflate";

const MAXIMUM_FBX_ARCHIVE_BYTES = 25 * 1024 * 1024;
const MAXIMUM_FBX_ARCHIVE_ENTRIES = 32;
const MAXIMUM_FBX_BUNDLE_BYTES = 25 * 1024 * 1024;

export interface FbxSidecarResource {
	readonly bytes: Uint8Array;
	readonly mimeType: "image/jpeg" | "image/png" | "image/webp";
	readonly name: string;
}

export interface FbxImportFile {
	readonly bytes: Uint8Array;
	readonly name: string;
}

export type FbxImportBundle =
	| {
			readonly fbxBytes: Uint8Array;
			readonly fbxFilename: string;
			readonly kind: "accepted";
			readonly sidecarResources: readonly FbxSidecarResource[];
	  }
	| {
			readonly kind: "rejected";
			readonly reasonCode:
				| "FBX_ARCHIVE_BYTES_LIMIT"
				| "FBX_ARCHIVE_INVALID"
				| "FBX_ARCHIVE_RESOURCE_LIMIT"
				| "FBX_FILE_SELECTION_INVALID"
				| "FBX_SIDECAR_TYPE_UNSUPPORTED";
	  };

/**
 * Converts a user-selected FBX bundle into one local FBX and its local image
 * companions. Sketchfab commonly distributes this exact shape as a ZIP.
 */
export function prepareFbxImportBundle(
	files: readonly FbxImportFile[],
): FbxImportBundle {
	if (files.length === 1 && isZipFilename(files[0]?.name ?? "")) {
		return unpackFbxArchive(files[0] as FbxImportFile);
	}
	if (files.some((file) => isZipFilename(file.name))) {
		return reject("FBX_FILE_SELECTION_INVALID");
	}
	return classifyBundleFiles(files);
}

/**
 * FBX exporters frequently add redundant extensions, texture resolution tags,
 * or line-break artefacts to their reference path. Exact names still win; a
 * relaxed key is used only when it identifies exactly one user-selected file.
 */
export function findFbxTextureSidecar(
	resources: readonly FbxSidecarResource[],
	reference: string,
): FbxSidecarResource | undefined {
	const exactKey = textureExactKey(reference);
	const exactMatches = resources.filter(
		(resource) => textureExactKey(resource.name) === exactKey,
	);
	if (exactMatches.length === 1) return exactMatches[0];
	if (exactMatches.length > 1) return undefined;

	const relaxedKey = relaxedTextureKey(reference);
	const relaxedMatches = resources.filter(
		(resource) => relaxedTextureKey(resource.name) === relaxedKey,
	);
	if (relaxedMatches.length === 1) return relaxedMatches[0];
	if (relaxedMatches.length > 1) return undefined;

	// FBX exporters use both names for the PBR base-color channel. Treat only
	// the terminal channel token as an alias, then keep the same unique-match
	// rule as the ordinary relaxed lookup so an unrelated texture is never used.
	const semanticKey = semanticTextureKey(reference);
	const semanticMatches = resources.filter(
		(resource) => semanticTextureKey(resource.name) === semanticKey,
	);
	return semanticMatches.length === 1 ? semanticMatches[0] : undefined;
}

function unpackFbxArchive(archive: FbxImportFile): FbxImportBundle {
	if (archive.bytes.byteLength > MAXIMUM_FBX_ARCHIVE_BYTES) {
		return reject("FBX_ARCHIVE_BYTES_LIMIT");
	}
	try {
		const entries = Object.entries(unzipSync(archive.bytes));
		if (entries.length > MAXIMUM_FBX_ARCHIVE_ENTRIES) {
			return reject("FBX_ARCHIVE_RESOURCE_LIMIT");
		}
		const totalBytes = entries.reduce(
			(total, [, bytes]) => total + bytes.byteLength,
			0,
		);
		if (totalBytes > MAXIMUM_FBX_BUNDLE_BYTES) {
			return reject("FBX_ARCHIVE_RESOURCE_LIMIT");
		}
		return classifyBundleFiles(
			entries.map(([name, bytes]) => ({ bytes, name })),
			true,
		);
	} catch {
		return reject("FBX_ARCHIVE_INVALID");
	}
}

function classifyBundleFiles(
	files: readonly FbxImportFile[],
	ignoreArchiveExtras = false,
): FbxImportBundle {
	const fbxFiles = files.filter((file) => /\.fbx$/i.test(file.name));
	if (fbxFiles.length !== 1) return reject("FBX_FILE_SELECTION_INVALID");
	const fbx = fbxFiles[0] as FbxImportFile;
	const sidecarFiles = files.filter(
		(file) => file !== fbx && (!ignoreArchiveExtras || fbxTextureMimeType(file.name)),
	);
	const sidecarResources: FbxSidecarResource[] = [];
	for (const file of sidecarFiles) {
		const mimeType = fbxTextureMimeType(file.name);
		if (!mimeType) return reject("FBX_SIDECAR_TYPE_UNSUPPORTED");
		sidecarResources.push({ bytes: file.bytes, mimeType, name: file.name });
	}
	return {
		fbxBytes: fbx.bytes,
		fbxFilename: fbx.name,
		kind: "accepted",
		sidecarResources,
	};
}

function fbxTextureMimeType(
	filename: string,
): FbxSidecarResource["mimeType"] | undefined {
	if (/\.(?:jpe?g)$/i.test(filename)) return "image/jpeg";
	if (/\.png$/i.test(filename)) return "image/png";
	if (/\.webp$/i.test(filename)) return "image/webp";
	return undefined;
}

function textureExactKey(value: string): string {
	let filename = value.replaceAll("\\", "/").split("/").at(-1) ?? "";
	while (/\.(?:jpe?g|png|webp)$/i.test(filename)) {
		filename = filename.replace(/\.(?:jpe?g|png|webp)$/i, "");
	}
	return filename
		.normalize("NFKD")
		.toLocaleLowerCase("en-US")
		.replace(/[^a-z0-9]+/g, "");
}

function relaxedTextureKey(value: string): string {
	return textureExactKey(value).replace(/(?:1|2|4|8)k|(?:1024|2048|4096)/g, "");
}

function semanticTextureKey(value: string): string {
	return relaxedTextureKey(value).replace(/base(?:map|color)$/, "basecolor");
}

function isZipFilename(filename: string): boolean {
	return /\.zip$/i.test(filename);
}

function reject(
	reasonCode: Extract<FbxImportBundle, { readonly kind: "rejected" }>["reasonCode"],
): FbxImportBundle {
	return { kind: "rejected", reasonCode };
}
