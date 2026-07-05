import { describe, expect, it } from "vitest";
import { buildShapedGrid, buildShapelessGrid } from "../src/utils/crafting-grid";
import type { Ingredient } from "../src/content.config";

const ing = (...items: string[]): Ingredient => ({ items });

describe("buildShapedGrid", () => {
  it("centers a 1x1 pattern in the middle cell", () => {
    const grid = buildShapedGrid(["X"], { X: ing("stick") });
    expect(grid).toEqual([null, null, null, null, ing("stick"), null, null, null, null]);
  });

  it("centers a 1x2 pattern (pads rows, not columns)", () => {
    const grid = buildShapedGrid(["XY"], { X: ing("a"), Y: ing("b") });
    expect(grid).toEqual([null, null, null, ing("a"), ing("b"), null, null, null, null]);
  });

  it("anchors a 2x2 pattern top-left (no centering offset for even sizes)", () => {
    const grid = buildShapedGrid(["XY", "ZW"], {
      X: ing("a"),
      Y: ing("b"),
      Z: ing("c"),
      W: ing("d"),
    });
    expect(grid).toEqual([ing("a"), ing("b"), null, ing("c"), ing("d"), null, null, null, null]);
  });

  it("fills every cell for a full 3x3 pattern", () => {
    const key: Record<string, Ingredient> = { M: ing("melon") };
    const grid = buildShapedGrid(["MMM", "MMM", "MMM"], key);
    expect(grid).toEqual(Array(9).fill(ing("melon")));
  });

  it("centers an asymmetric 2x1 pattern like the torch recipe", () => {
    const grid = buildShapedGrid(["X", "#"], {
      X: ing("coal", "charcoal"),
      "#": ing("stick"),
    });
    expect(grid).toEqual([
      null,
      ing("coal", "charcoal"),
      null,
      null,
      ing("stick"),
      null,
      null,
      null,
      null,
    ]);
  });

  it("skips pattern symbols with no matching key (blank cells)", () => {
    const grid = buildShapedGrid([" X "], { X: ing("stick") });
    expect(grid.filter(Boolean)).toEqual([ing("stick")]);
  });
});

describe("buildShapelessGrid", () => {
  it("fills ingredients in reading order starting at cell 0", () => {
    const grid = buildShapelessGrid([ing("oak_log"), ing("stick")]);
    expect(grid).toEqual([ing("oak_log"), ing("stick"), null, null, null, null, null, null, null]);
  });

  it("truncates to 9 ingredients if somehow given more", () => {
    const ingredients = Array.from({ length: 12 }, (_, i) => ing(`item_${i}`));
    const grid = buildShapelessGrid(ingredients);
    expect(grid).toHaveLength(9);
    expect(grid.every((cell) => cell !== null)).toBe(true);
  });

  it("returns an all-null grid for no ingredients", () => {
    expect(buildShapelessGrid([])).toEqual(Array(9).fill(null));
  });
});
