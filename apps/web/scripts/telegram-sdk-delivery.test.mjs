import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { telegramSdkAssetPatterns } from "./telegram-sdk-asset.mjs";

for (const [name, source, hash, extension] of [
  ["official SDK", "telegram-web-app.js", "124bdff7ba3fe86c8ba5143467afec21e020405e74abdb92cfdda6c0ee3b5908", "js"],
  ["MIT notice", "LICENSE", "1b6cf72927d4a211b66ca409e001dcaa85d29c79d04e4470ff0ced87073d483f", "txt"],
]) {
  const bytes = await readFile(`public/telegram-sdk/${source}`);
  const address = `telegram-sdk/${source === "LICENSE" ? "LICENSE" : "telegram-web-app"}.${hash}.${extension}`;
  test(`publishes ${name} at its immutable byte address without rewriting it`, () => {
    const patterns = telegramSdkAssetPatterns();
    assert.equal(patterns.length, 2);
    const pattern = patterns.find((entry) => entry.to === address);
    assert.ok(pattern);
    assert.equal(pattern.from, `./public/telegram-sdk/${source}`);
    const before = Buffer.from(bytes);
    assert.deepEqual(pattern.transform(bytes), before);
    assert.deepEqual(bytes, before);
  });
  for (const [change, changed] of [
    ["empty", Buffer.alloc(0)],
    ["truncated", bytes.subarray(0, -1)],
    ["appended", Buffer.concat([bytes, Buffer.from(" ")])],
    ["same-length changed", Buffer.from(bytes.map((value, index) => index === 3 ? value ^ 1 : value))],
  ]) {
    test(`refuses ${change} ${name} instead of reusing the original immutable address`, () => {
      const pattern = telegramSdkAssetPatterns().find((entry) => entry.to === address);
      assert.ok(pattern);
      assert.throws(() => pattern.transform(changed));
    });
  }
}
