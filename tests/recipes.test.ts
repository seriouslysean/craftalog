import { describe, expect, it } from "vitest";
import { collectRecipeItemIds, transformRecipe } from "../scripts/lib/recipes.ts";
import type { RecipeTypeAudit } from "../scripts/lib/recipes.ts";
import type { RawRecipeEntry, RawTagsData } from "../scripts/lib/types.ts";

function emptyAudit(): RecipeTypeAudit {
  return { pendingSpecialTypes: new Set(), excludedUnknownTypes: new Set() };
}

const tags: RawTagsData = {
  oak_logs: {
    values: [
      "minecraft:oak_log",
      "minecraft:oak_wood",
      "minecraft:stripped_oak_log",
      "minecraft:stripped_oak_wood",
    ],
  },
};

describe("transformRecipe — crafting_shaped", () => {
  it("transforms the torch recipe (key with a tag-less array ingredient)", () => {
    const raw: RawRecipeEntry = {
      type: "minecraft:crafting_shaped",
      key: { "#": "minecraft:stick", X: ["minecraft:coal", "minecraft:charcoal"] },
      pattern: ["X", "#"],
      result: { count: 4, id: "minecraft:torch" },
    };

    expect(transformRecipe("torch", raw, tags)).toEqual({
      id: "torch",
      type: "shaped",
      category: "misc",
      result: { id: "torch", count: 4 },
      pattern: ["X", "#"],
      key: {
        "#": { items: ["stick"] },
        X: { items: ["coal", "charcoal"] },
      },
    });
  });

  it("defaults category to 'misc' when absent, and preserves group when present", () => {
    const raw: RawRecipeEntry = {
      type: "minecraft:crafting_shaped",
      key: { A: "minecraft:stick" },
      pattern: ["A"],
      group: "some_group",
      result: { id: "minecraft:stick" },
    };

    const recipe = transformRecipe("with_group", raw, tags);
    expect(recipe?.category).toBe("misc");
    expect(recipe?.group).toBe("some_group");
  });

  it("defaults result count to 1 when absent", () => {
    const raw: RawRecipeEntry = {
      type: "minecraft:crafting_shaped",
      key: { A: "minecraft:stick" },
      pattern: ["A"],
      result: { id: "minecraft:stick" },
    };

    expect(transformRecipe("x", raw, tags)?.result).toEqual({ id: "stick", count: 1 });
  });

  it("throws for a malformed shaped recipe missing key/pattern", () => {
    const raw: RawRecipeEntry = {
      type: "minecraft:crafting_shaped",
      result: { id: "minecraft:stick" },
    };
    expect(() => transformRecipe("broken", raw, tags)).toThrow();
  });
});

describe("transformRecipe — crafting_shapeless", () => {
  it("transforms the oak_planks recipe (single tag ingredient)", () => {
    const raw: RawRecipeEntry = {
      type: "minecraft:crafting_shapeless",
      category: "building",
      group: "planks",
      ingredients: ["#minecraft:oak_logs"],
      result: { count: 4, id: "minecraft:oak_planks" },
    };

    expect(transformRecipe("oak_planks", raw, tags)).toEqual({
      id: "oak_planks",
      type: "shapeless",
      category: "building",
      group: "planks",
      result: { id: "oak_planks", count: 4 },
      ingredients: [
        {
          items: ["oak_log", "oak_wood", "stripped_oak_log", "stripped_oak_wood"],
          tag: "oak_logs",
        },
      ],
    });
  });
});

describe("transformRecipe — crafting_transmute", () => {
  it("transforms a transmute recipe into ingredients: [input, material]", () => {
    const raw: RawRecipeEntry = {
      type: "minecraft:crafting_transmute",
      category: "equipment",
      group: "bundle_dye",
      input: "#minecraft:oak_logs",
      material: "minecraft:black_dye",
      result: { id: "minecraft:black_bundle" },
    };

    const recipe = transformRecipe("black_bundle", raw, tags);
    expect(recipe?.type).toBe("transmute");
    // Only "special" carries `vanillaType` -- shaped/shapeless/transmute each
    // already map 1:1 to a single vanilla type via `type` itself (see
    // generated-schema.ts's recipeSchema).
    expect(recipe?.vanillaType).toBeUndefined();
    expect(recipe?.ingredients).toEqual([
      { items: ["oak_log", "oak_wood", "stripped_oak_log", "stripped_oak_wood"], tag: "oak_logs" },
      { items: ["black_dye"] },
    ]);
  });
});

describe("transformRecipe — special", () => {
  it("transforms a curated special recipe type with a note and no ingredients", () => {
    const raw: RawRecipeEntry = {
      type: "minecraft:crafting_special_bannerduplicate",
      banner: "minecraft:black_banner",
      result: { id: "minecraft:black_banner" },
    };

    const recipe = transformRecipe("black_banner_duplicate", raw, tags);
    expect(recipe?.type).toBe("special");
    expect(recipe?.note).toBeTruthy();
    expect(recipe?.ingredients).toBeUndefined();
    expect(recipe?.key).toBeUndefined();
    expect(recipe?.result).toEqual({ id: "black_banner", count: 1 });
    // The raw vanilla type id survives the transform (see generated-schema.ts's
    // recipeSchema) -- kept alongside the derived `selfReferential` flag so the
    // coarse `type: "special"` bucket stays traceable to its vanilla source.
    expect(recipe?.vanillaType).toBe("minecraft:crafting_special_bannerduplicate");
  });

  it("omits result entirely for crafting_special_repairitem (no result in vendored data)", () => {
    const raw: RawRecipeEntry = { type: "minecraft:crafting_special_repairitem" };
    const recipe = transformRecipe("repair_item", raw, tags);
    expect(recipe?.type).toBe("special");
    expect(recipe?.result).toBeUndefined();
    expect(recipe?.note).toBeTruthy();
    expect(recipe?.vanillaType).toBe("minecraft:crafting_special_repairitem");
  });

  it("returns undefined for known-excluded (out-of-scope) recipe types, without an audit entry", () => {
    const audit = emptyAudit();
    expect(
      transformRecipe("furnace_smelt", { type: "minecraft:smelting" }, tags, audit),
    ).toBeUndefined();
    expect(transformRecipe("saw", { type: "minecraft:stonecutting" }, tags, audit)).toBeUndefined();
    expect(audit.excludedUnknownTypes.size).toBe(0);
    expect(audit.pendingSpecialTypes.size).toBe(0);
  });

  it("INCLUDES an unknown crafting_* type with the generic note and records it in the pending audit (never throws)", () => {
    const audit = emptyAudit();
    const recipe = transformRecipe(
      "frobnicate",
      {
        type: "minecraft:crafting_special_frobnicate",
        result: { id: "minecraft:frobnicator" },
      },
      tags,
      audit,
    );
    expect(recipe?.type).toBe("special");
    expect(recipe?.note).toBe("Special crafting recipe — see the in-game recipe book.");
    expect(recipe?.result).toEqual({ id: "frobnicator", count: 1 });
    expect(recipe?.vanillaType).toBe("minecraft:crafting_special_frobnicate");
    expect(audit.pendingSpecialTypes).toEqual(new Set(["minecraft:crafting_special_frobnicate"]));
    expect(audit.excludedUnknownTypes.size).toBe(0);
  });

  it("EXCLUDES an unknown non-crafting type and records it in the excluded audit (never throws)", () => {
    const audit = emptyAudit();
    expect(
      transformRecipe("laser_smelt", { type: "minecraft:laser_smelting" }, tags, audit),
    ).toBeUndefined();
    expect(audit.excludedUnknownTypes).toEqual(new Set(["minecraft:laser_smelting"]));
    expect(audit.pendingSpecialTypes.size).toBe(0);
  });

  it("tolerates a missing audit sink (validate-time callers that only need the transform)", () => {
    expect(
      transformRecipe("laser_smelt", { type: "minecraft:laser_smelting" }, tags),
    ).toBeUndefined();
    expect(
      transformRecipe("frobnicate", { type: "minecraft:crafting_special_frobnicate" }, tags)?.type,
    ).toBe("special");
  });
});

describe("transformRecipe — selfReferential detection", () => {
  it("marks a special whose raw ingredient field equals its own result id (bannerduplicate)", () => {
    const recipe = transformRecipe(
      "black_banner_duplicate",
      {
        type: "minecraft:crafting_special_bannerduplicate",
        banner: "minecraft:black_banner",
        result: { id: "minecraft:black_banner" },
      },
      tags,
    );
    expect(recipe?.selfReferential).toBe(true);
  });

  it("marks crafting_dye (target === result) and mapextending (map === result)", () => {
    expect(
      transformRecipe(
        "leather_boots_dyed",
        {
          type: "minecraft:crafting_dye",
          dye: "#minecraft:dyes",
          group: "dyed_armor",
          target: "minecraft:leather_boots",
          result: { id: "minecraft:leather_boots" },
        },
        tags,
      )?.selfReferential,
    ).toBe(true);
    expect(
      transformRecipe(
        "map_extending",
        {
          type: "minecraft:crafting_special_mapextending",
          map: "minecraft:filled_map",
          material: "minecraft:paper",
          result: { id: "minecraft:filled_map" },
        },
        tags,
      )?.selfReferential,
    ).toBe(true);
  });

  it("omits the field entirely (not false) for specials producing a genuinely new item (imbue, firework rocket)", () => {
    const imbue = transformRecipe(
      "tipped_arrow",
      {
        type: "minecraft:crafting_imbue",
        material: "minecraft:arrow",
        source: "minecraft:lingering_potion",
        result: { count: 8, id: "minecraft:tipped_arrow" },
      },
      tags,
    );
    expect(imbue?.selfReferential).toBeUndefined();
    expect(imbue && "selfReferential" in imbue).toBe(false);

    const rocket = transformRecipe(
      "firework_rocket",
      {
        type: "minecraft:crafting_special_firework_rocket",
        fuel: "minecraft:gunpowder",
        shell: "minecraft:paper",
        star: "minecraft:firework_star",
        result: { count: 3, id: "minecraft:firework_rocket" },
      },
      tags,
    );
    expect(rocket?.selfReferential).toBeUndefined();
  });

  it("never matches a tag reference against the result id (a '#' ingredient can't false-positive)", () => {
    const recipe = transformRecipe(
      "shield_decoration",
      {
        type: "minecraft:crafting_special_shielddecoration",
        banner: "#minecraft:banners",
        target: "minecraft:shield",
        result: { id: "minecraft:shield" },
      },
      tags,
    );
    // Matches via `target`, not the tag-valued `banner` field.
    expect(recipe?.selfReferential).toBe(true);
  });
});

describe("transformRecipe — shapeless ingredient cardinality", () => {
  it("throws for a shapeless recipe with zero ingredients", () => {
    const raw: RawRecipeEntry = {
      type: "minecraft:crafting_shapeless",
      ingredients: [],
      result: { id: "minecraft:stick" },
    };
    expect(() => transformRecipe("empty", raw, tags)).toThrow(/1-9/);
  });

  it("throws for a shapeless recipe with more than 9 ingredients (a 3x3 grid)", () => {
    const raw: RawRecipeEntry = {
      type: "minecraft:crafting_shapeless",
      ingredients: Array.from({ length: 10 }, () => "minecraft:stick"),
      result: { id: "minecraft:stick" },
    };
    expect(() => transformRecipe("overfull", raw, tags)).toThrow(/1-9/);
  });

  it("accepts a full 9-ingredient shapeless recipe", () => {
    const raw: RawRecipeEntry = {
      type: "minecraft:crafting_shapeless",
      ingredients: Array.from({ length: 9 }, () => "minecraft:stick"),
      result: { id: "minecraft:stick" },
    };
    expect(transformRecipe("full_grid", raw, tags)?.ingredients).toHaveLength(9);
  });
});

describe("collectRecipeItemIds", () => {
  it("collects the result id and every ingredient item id for a shaped recipe", () => {
    const recipe = transformRecipe(
      "torch",
      {
        type: "minecraft:crafting_shaped",
        key: { "#": "minecraft:stick", X: ["minecraft:coal", "minecraft:charcoal"] },
        pattern: ["X", "#"],
        result: { count: 4, id: "minecraft:torch" },
      },
      tags,
    )!;

    expect(collectRecipeItemIds(recipe).toSorted()).toEqual(
      ["charcoal", "coal", "stick", "torch"].toSorted(),
    );
  });

  it("returns just the result id for a special recipe with no ingredients", () => {
    const recipe = transformRecipe(
      "black_banner_duplicate",
      {
        type: "minecraft:crafting_special_bannerduplicate",
        result: { id: "minecraft:black_banner" },
      },
      tags,
    )!;

    expect(collectRecipeItemIds(recipe)).toEqual(["black_banner"]);
  });

  it("returns an empty array for a special recipe with no result (repairitem)", () => {
    const recipe = transformRecipe(
      "repair_item",
      { type: "minecraft:crafting_special_repairitem" },
      tags,
    )!;
    expect(collectRecipeItemIds(recipe)).toEqual([]);
  });
});
