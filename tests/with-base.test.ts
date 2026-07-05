import { describe, expect, it } from "vitest";
import { withBase } from "../src/utils/with-base";

describe("withBase", () => {
  it("joins a root-absolute path under a root base", () => {
    expect(withBase("/textures/item/stick.png", "/")).toBe("/textures/item/stick.png");
  });

  it("joins a root-absolute path under a non-root base", () => {
    expect(withBase("/textures/item/stick.png", "/craftalog")).toBe(
      "/craftalog/textures/item/stick.png",
    );
  });

  it("strips a trailing slash from the base before joining", () => {
    expect(withBase("/textures/item/stick.png", "/craftalog/")).toBe(
      "/craftalog/textures/item/stick.png",
    );
  });

  it("adds a leading slash to a path missing one", () => {
    expect(withBase("recipe/torch", "/craftalog")).toBe("/craftalog/recipe/torch");
  });

  it("resolves the root link under a non-root base", () => {
    expect(withBase("/", "/craftalog")).toBe("/craftalog/");
  });

  it("resolves the root link under a root base", () => {
    expect(withBase("/", "/")).toBe("/");
  });
});
