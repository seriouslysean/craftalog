import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { firstAnimationFrame } from "../scripts/lib/texture-frame.ts";

/** Builds a PNG buffer from a row-major grid of [r, g, b, a] pixels. */
function buildPng(
  width: number,
  height: number,
  pixels: [number, number, number, number][],
): Buffer {
  const png = new PNG({ width, height });
  pixels.forEach(([r, g, b, a], i) => {
    png.data[i * 4] = r;
    png.data[i * 4 + 1] = g;
    png.data[i * 4 + 2] = b;
    png.data[i * 4 + 3] = a;
  });
  return PNG.sync.write(png);
}

const RED: [number, number, number, number] = [255, 0, 0, 255];
const GREEN: [number, number, number, number] = [0, 255, 0, 255];
const BLUE: [number, number, number, number] = [0, 0, 255, 255];

describe("firstAnimationFrame", () => {
  it("crops a vertical strip (height > width) to its first square frame", () => {
    // 2x6 strip = three 2x2 frames: red, green, blue.
    const strip = buildPng(2, 6, [
      RED,
      RED,
      RED,
      RED,
      GREEN,
      GREEN,
      GREEN,
      GREEN,
      BLUE,
      BLUE,
      BLUE,
      BLUE,
    ]);

    const result = PNG.sync.read(firstAnimationFrame(strip));

    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    // Every pixel of the kept frame is the first frame's red.
    for (let i = 0; i < 4; i++) {
      expect([result.data[i * 4], result.data[i * 4 + 1], result.data[i * 4 + 2]]).toEqual([
        255, 0, 0,
      ]);
    }
  });

  it("passes square textures through byte-identical (any resolution, e.g. 32x32 shelves)", () => {
    const square = buildPng(2, 2, [RED, GREEN, BLUE, RED]);
    expect(firstAnimationFrame(square)).toBe(square);
  });

  it("passes wide textures (height < width) through byte-identical", () => {
    const wide = buildPng(4, 2, [RED, RED, GREEN, GREEN, BLUE, BLUE, RED, RED]);
    expect(firstAnimationFrame(wide)).toBe(wide);
  });

  it("passes a TALL texture through byte-identical when the animation sidecar is known absent -- tall static art is not a strip", () => {
    const tall = buildPng(2, 6, [
      RED,
      RED,
      RED,
      RED,
      GREEN,
      GREEN,
      GREEN,
      GREEN,
      BLUE,
      BLUE,
      BLUE,
      BLUE,
    ]);
    expect(firstAnimationFrame(tall, false)).toBe(tall);
  });

  it("crops a tall texture when the animation sidecar is known present", () => {
    const strip = buildPng(2, 4, [RED, RED, RED, RED, GREEN, GREEN, GREEN, GREEN]);
    const result = PNG.sync.read(firstAnimationFrame(strip, true));
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
  });

  it("still passes a square texture through byte-identical even WITH a sidecar (leaves/glass carry non-animation sidecars)", () => {
    const square = buildPng(2, 2, [RED, GREEN, BLUE, RED]);
    expect(firstAnimationFrame(square, true)).toBe(square);
  });
});
