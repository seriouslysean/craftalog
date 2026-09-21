/**
 * Finds multi-line CSS comments inside an .astro file's `<style>` blocks,
 * returning the 1-based line each one starts on.
 *
 * prettier-plugin-astro 1.0.1 re-indents the continuation lines of such a
 * comment on EVERY pass, so `npm run format` never reaches a fixed point and
 * `npm run format:check` can never pass. A comment that fits on one line is
 * stable; longer notes stack several of them. oxlint only sees the script
 * parts of .astro files, so nothing else in the toolchain catches this.
 */
export function findMultilineStyleComments(source: string): number[] {
  const lines: number[] = [];
  for (const style of source.matchAll(/<style[^>]*>(.*?)<\/style>/gs)) {
    const blockStart = style.index + style[0].indexOf(style[1]);
    for (const comment of style[1].matchAll(/\/\*.*?\*\//gs)) {
      if (!comment[0].includes("\n")) continue;
      lines.push(source.slice(0, blockStart + comment.index).split("\n").length);
    }
  }
  return lines;
}
