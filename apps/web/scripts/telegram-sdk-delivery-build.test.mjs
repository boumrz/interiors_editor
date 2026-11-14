import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { rspack } from "@rspack/core";
import configure from "../rspack.telegram.config.mjs";
import { readTelegramRelease } from "./telegram-preview-server.mjs";

const sdkHash = "124bdff7ba3fe86c8ba5143467afec21e020405e74abdb92cfdda6c0ee3b5908";
const licenseHash = "1b6cf72927d4a211b66ca409e001dcaa85d29c79d04e4470ff0ced87073d483f";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("Telegram production delivery includes the exact official SDK and license in its immutable release", { timeout: 120_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "interiors-sdk-build-contract-"));
  const priorOutput = process.env.INTERIORS_TELEGRAM_OUTPUT;
  process.env.INTERIORS_TELEGRAM_OUTPUT = join(root, "dist-telegram");
  try {
    const configuration = configure({}, { mode: "production" });
    const compiler = rspack(configuration);
    await new Promise((resolve, reject) => {
      compiler.run((error, stats) => {
        compiler.close((closeError) => {
          if (error || closeError) reject(error ?? closeError);
          else if (stats.hasErrors()) reject(new Error(stats.toString({ all: false, errors: true })));
          else resolve();
        });
      });
    });
    const output = configuration.output.path;
    const release = JSON.parse(await readFile(join(output, "release-set.json"), "utf8"));
    for (const [file, hash, extension] of [["telegram-web-app", sdkHash, "js"], ["LICENSE", licenseHash, "txt"]]) {
      const path = `/telegram-sdk/${file}.${hash}.${extension}`;
      const bytes = await readFile(join(output, path.slice(1)));
      assert.equal(sha(bytes), hash);
      assert.deepEqual(release.assets.find((asset) => asset.path === path), { path, byteLength: bytes.byteLength, sha256: hash });
    }
    await readTelegramRelease(output);
    assert.equal(release.assets.some((asset) => asset.path === "/sw.js" || asset.path === "/manifest.webmanifest"), false);
  } finally {
    if (priorOutput === undefined) delete process.env.INTERIORS_TELEGRAM_OUTPUT;
    else process.env.INTERIORS_TELEGRAM_OUTPUT = priorOutput;
    await rm(root, { recursive: true, force: true });
  }
});
