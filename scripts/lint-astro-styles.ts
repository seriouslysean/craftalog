import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { findMultilineStyleComments } from "./lib/astro-style-lint.ts";

/**
 * The CSS half of `npm run lint`: fails on any multi-line comment in an
 * .astro `<style>` block (see findMultilineStyleComments for why).
 */

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const astroFiles = fs
  .globSync("src/**/*.astro", { cwd: ROOT })
  .toSorted((a, b) => a.localeCompare(b));

const problems = astroFiles.flatMap((file) =>
  findMultilineStyleComments(fs.readFileSync(path.join(ROOT, file), "utf8")).map(
    (line) => `${file}:${line}`,
  ),
);

if (problems.length > 0) {
  console.error(
    `Multi-line CSS comment(s) in <style> blocks -- prettier-plugin-astro re-indents them on ` +
      `every format pass. Use one /* ... */ per line instead:\n` +
      problems.map((problem) => `  ${problem}`).join("\n"),
  );
  process.exit(1);
}
console.log(`astro styles: ${astroFiles.length} files, 0 multi-line CSS comments`);
