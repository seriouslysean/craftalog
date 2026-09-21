import { describe, expect, it } from "vitest";

import { findMultilineStyleComments } from "../scripts/lib/astro-style-lint.ts";

describe("findMultilineStyleComments", () => {
  it("reports the starting line of each multi-line comment in a <style> block", () => {
    const source = [
      "---",
      "---",
      "<div></div>",
      "<style>",
      "  .a {",
      "    /* spans",
      "       two lines */",
      "    color: red;",
      "  }",
      "</style>",
    ].join("\n");

    expect(findMultilineStyleComments(source)).toEqual([6]);
  });

  it("accepts single-line comments, stacked or not", () => {
    const source = "<style>\n  /* one */\n  /* two */\n  .a { color: red; /* three */ }\n</style>";
    expect(findMultilineStyleComments(source)).toEqual([]);
  });

  it("ignores multi-line comments outside <style> (frontmatter, scripts, markup)", () => {
    const source =
      "---\n/* a\n   b */\n---\n<script>\n/* c\n   d */\n</script>\n<style>.a{}</style>";
    expect(findMultilineStyleComments(source)).toEqual([]);
  });

  it("checks every <style> block, including attributed ones", () => {
    const source = "<style>.a{}</style>\n<style is:global>\n/* x\n y */\n</style>";
    expect(findMultilineStyleComments(source)).toEqual([3]);
  });
});
