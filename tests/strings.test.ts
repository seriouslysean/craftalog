import { describe, expect, it } from "vitest";
import { sortKeysDeep, stripMcPrefix, titleCaseFromId } from "../scripts/lib/strings.ts";

describe("stripMcPrefix", () => {
  it("strips a leading minecraft: prefix", () => {
    expect(stripMcPrefix("minecraft:oak_log")).toBe("oak_log");
  });

  it("leaves a value without the prefix unchanged", () => {
    expect(stripMcPrefix("oak_log")).toBe("oak_log");
  });
});

describe("titleCaseFromId", () => {
  it("title-cases underscore-separated ids", () => {
    expect(titleCaseFromId("oak_log")).toBe("Oak Log");
    expect(titleCaseFromId("light_gray_banner")).toBe("Light Gray Banner");
  });
});

describe("sortKeysDeep", () => {
  it("sorts object keys alphabetically, recursively", () => {
    const input = { b: 1, a: { d: 1, c: 2 } };
    expect(JSON.stringify(sortKeysDeep(input))).toBe('{"a":{"c":2,"d":1},"b":1}');
  });

  it("preserves array element order while sorting keys of objects nested inside arrays", () => {
    const input = {
      list: [
        { b: 1, a: 2 },
        { z: 1, y: 2 },
      ],
    };
    expect(JSON.stringify(sortKeysDeep(input))).toBe('{"list":[{"a":2,"b":1},{"y":2,"z":1}]}');
  });

  it("leaves primitives untouched", () => {
    expect(sortKeysDeep(5)).toBe(5);
    expect(sortKeysDeep("hi")).toBe("hi");
    expect(sortKeysDeep(null)).toBe(null);
  });
});
