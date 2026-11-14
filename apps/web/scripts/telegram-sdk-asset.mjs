import { createHash } from "node:crypto";

const assets = [
  {
    source: "telegram-web-app.js",
    name: "telegram-web-app",
    extension: "js",
    sha256: "124bdff7ba3fe86c8ba5143467afec21e020405e74abdb92cfdda6c0ee3b5908",
  },
  {
    source: "LICENSE",
    name: "LICENSE",
    extension: "txt",
    sha256: "1b6cf72927d4a211b66ca409e001dcaa85d29c79d04e4470ff0ced87073d483f",
  },
];

/** A changed vendor file must never reuse a previously published immutable URL. */
export function telegramSdkAssetPatterns() {
  return assets.map(({ source, name, extension, sha256 }) => ({
    from: `./public/telegram-sdk/${source}`,
    to: `telegram-sdk/${name}.${sha256}.${extension}`,
    info: { minimized: true },
    transform(bytes) {
      if (createHash("sha256").update(bytes).digest("hex") !== sha256)
        throw new Error("The pinned Telegram SDK delivery bytes have changed");
      return bytes;
    },
  }));
}
