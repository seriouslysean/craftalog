import { describe, expect, it } from "vitest";
import { resolveTag } from "../scripts/lib/tags.ts";
import type { RawTagsData } from "../scripts/lib/types.ts";

describe("resolveTag", () => {
  it("resolves a flat tag of plain item ids", () => {
    const tags: RawTagsData = {
      oak_logs: {
        values: ["minecraft:oak_log", "minecraft:oak_wood", "minecraft:stripped_oak_log"],
      },
    };

    expect(resolveTag("oak_logs", tags)).toEqual(["oak_log", "oak_wood", "stripped_oak_log"]);
  });

  it("recursively resolves nested tag references", () => {
    const tags: RawTagsData = {
      oak_logs: { values: ["minecraft:oak_log", "minecraft:oak_wood"] },
      spruce_logs: { values: ["minecraft:spruce_log"] },
      logs: { values: ["#minecraft:oak_logs", "#minecraft:spruce_logs"] },
    };

    expect(resolveTag("logs", tags)).toEqual(["oak_log", "oak_wood", "spruce_log"]);
  });

  it("resolves multiple levels of nested tags", () => {
    const tags: RawTagsData = {
      a: { values: ["minecraft:item_a"] },
      b: { values: ["#minecraft:a", "minecraft:item_b"] },
      c: { values: ["#minecraft:b"] },
    };

    expect(resolveTag("c", tags)).toEqual(["item_a", "item_b"]);
  });

  it("handles values given as { id, required } objects instead of plain strings", () => {
    const tags: RawTagsData = {
      planks: {
        values: [{ id: "minecraft:oak_planks", required: false }, "minecraft:spruce_planks"],
      },
    };

    expect(resolveTag("planks", tags)).toEqual(["oak_planks", "spruce_planks"]);
  });

  it("handles nested tag references given as objects too", () => {
    const tags: RawTagsData = {
      oak_logs: { values: ["minecraft:oak_log"] },
      logs: { values: [{ id: "#minecraft:oak_logs" }] },
    };

    expect(resolveTag("logs", tags)).toEqual(["oak_log"]);
  });

  it("de-duplicates items reachable via multiple tag paths", () => {
    const tags: RawTagsData = {
      a: { values: ["minecraft:shared", "minecraft:only_a"] },
      b: { values: ["minecraft:shared", "minecraft:only_b"] },
      c: { values: ["#minecraft:a", "#minecraft:b"] },
    };

    expect(resolveTag("c", tags)).toEqual(["shared", "only_a", "only_b"]);
  });

  it("guards against reference cycles", () => {
    const tags: RawTagsData = {
      a: { values: ["#minecraft:b", "minecraft:item_a"] },
      b: { values: ["#minecraft:a", "minecraft:item_b"] },
    };

    expect(resolveTag("a", tags)).toEqual(["item_b", "item_a"]);
  });

  it("returns an empty array for an unknown tag (fail-loud enforcement lives at the ingredient boundary -- normalizeIngredient throws on a zero-item resolution)", () => {
    expect(resolveTag("does_not_exist", {})).toEqual([]);
  });

  it("accepts a tag name with or without the minecraft: prefix", () => {
    const tags: RawTagsData = { oak_logs: { values: ["minecraft:oak_log"] } };
    expect(resolveTag("minecraft:oak_logs", tags)).toEqual(["oak_log"]);
  });
});
