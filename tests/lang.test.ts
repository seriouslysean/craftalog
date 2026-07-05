import { describe, expect, it } from "vitest";
import { getItemName } from "../scripts/lib/lang.ts";

describe("getItemName", () => {
  it("prefers the item.minecraft.<id> key", () => {
    const enUs = { "item.minecraft.stick": "Stick", "block.minecraft.stick": "Wrong" };
    expect(getItemName("stick", enUs)).toBe("Stick");
  });

  it("falls back to block.minecraft.<id> when no item key exists", () => {
    const enUs = { "block.minecraft.oak_log": "Oak Log" };
    expect(getItemName("oak_log", enUs)).toBe("Oak Log");
  });

  it("falls back to a title-cased id when neither lang key exists", () => {
    expect(getItemName("some_unknown_item", {})).toBe("Some Unknown Item");
  });
});
