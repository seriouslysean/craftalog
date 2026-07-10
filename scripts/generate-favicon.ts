import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

/**
 * One-off asset generator for issue #12 ("something to use on the site and
 * for the favicon"). Not part of the vanilla-data pipeline (parse.ts) --
 * this derives site branding from an already-generated, already-validated
 * catalog texture, not from vendor/ directly, and has no reason to re-run
 * on every data bump. Re-run by hand (`npx tsx scripts/generate-favicon.ts`)
 * if the compass frame or output sizes ever need to change.
 */

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "public/textures/item/compass_16.png");

function upscaleNearest(src: PNG, scale: number): PNG {
  const out = new PNG({ width: src.width * scale, height: src.height * scale });
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const si = (src.width * y + x) << 2;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const oi = (out.width * (y * scale + dy) + (x * scale + dx)) << 2;
          out.data[oi] = src.data[si];
          out.data[oi + 1] = src.data[si + 1];
          out.data[oi + 2] = src.data[si + 2];
          out.data[oi + 3] = src.data[si + 3];
        }
      }
    }
  }
  return out;
}

/** Minimal ICONDIR/ICONDIRENTRY writer -- ICO has supported raw PNG-compressed
 * entries (instead of legacy BMP) since Windows Vista, which every modern
 * browser also reads, so each entry below is just a full PNG byte stream. */
function buildIco(images: { size: number; png: Buffer }[]): Buffer {
  const headerSize = 6 + 16 * images.length;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = headerSize;
  images.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i;
    const dim = size >= 256 ? 0 : size;
    header.writeUInt8(dim, entry);
    header.writeUInt8(dim, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });

  return Buffer.concat([header, ...images.map((i) => i.png)]);
}

const sourcePng = PNG.sync.read(fs.readFileSync(SOURCE));
if (sourcePng.width !== 16 || sourcePng.height !== 16) {
  throw new Error(
    `generate-favicon: expected compass_16.png to be 16x16, got ${sourcePng.width}x${sourcePng.height} -- the vendored compass texture may have changed`,
  );
}

const png16 = PNG.sync.write(sourcePng);
const png32 = PNG.sync.write(upscaleNearest(sourcePng, 2));
const png48 = PNG.sync.write(upscaleNearest(sourcePng, 3));

fs.writeFileSync(path.join(ROOT, "public/favicon.png"), png32);
fs.writeFileSync(
  path.join(ROOT, "public/favicon.ico"),
  buildIco([
    { size: 16, png: png16 },
    { size: 32, png: png32 },
    { size: 48, png: png48 },
  ]),
);

console.log(
  "public/favicon.png + public/favicon.ico generated from the real compass_16 item texture",
);
