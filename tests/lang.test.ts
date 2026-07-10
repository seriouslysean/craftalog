import { describe, expect, it } from "vitest";
import { getItemName, resolveLangKey } from "../scripts/lib/lang.ts";

describe("resolveLangKey", () => {
  it("prefers the <key>.new variant when present", () => {
    const enUs = { "item.minecraft.foo": "Old Name", "item.minecraft.foo.new": "New Name" };
    expect(resolveLangKey("item.minecraft.foo", enUs)).toBe("New Name");
  });

  it("falls back to the base key when no .new variant exists", () => {
    const enUs = { "item.minecraft.foo": "Old Name" };
    expect(resolveLangKey("item.minecraft.foo", enUs)).toBe("Old Name");
  });

  it("returns undefined when neither the base key nor the .new key exists", () => {
    expect(resolveLangKey("item.minecraft.foo", {})).toBeUndefined();
  });
});

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

  it("prefers item.minecraft.<id>.new over the plain item key -- e.g. smithing template renames", () => {
    const enUs = {
      "item.minecraft.netherite_upgrade_smithing_template": "Smithing Template",
      "item.minecraft.netherite_upgrade_smithing_template.new": "Netherite Upgrade",
    };
    expect(getItemName("netherite_upgrade_smithing_template", enUs)).toBe("Netherite Upgrade");
  });

  it("prefers block.minecraft.<id>.new over the plain block key when no item key exists", () => {
    const enUs = {
      "block.minecraft.oak_log": "Oak Log",
      "block.minecraft.oak_log.new": "Oak Log Renamed",
    };
    expect(getItemName("oak_log", enUs)).toBe("Oak Log Renamed");
  });
});
