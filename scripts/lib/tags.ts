import type { RawTagsData, RawTagValue } from "./types.ts";
import { stripMcPrefix } from "./strings.ts";

function tagValueId(raw: RawTagValue): string {
  return typeof raw === "string" ? raw : raw.id;
}

/**
 * Recursively resolves an item tag (e.g. "oak_logs") into the flat list of
 * concrete item ids it contains, expanding nested tag references
 * (values starting with "#") along the way.
 *
 * Defensive against: unknown tags (returns []), tag values given as
 * `{ id, required }` objects instead of plain strings, and reference cycles
 * (guarded via `seen`).
 */
export function resolveTag(
  tagName: string,
  tags: RawTagsData,
  seen: Set<string> = new Set(),
): string[] {
  const bareName = stripMcPrefix(tagName);
  if (seen.has(bareName)) return [];
  seen.add(bareName);

  const tag = tags[bareName];
  if (!tag) return [];

  const resolved: string[] = [];
  for (const rawValue of tag.values) {
    const value = tagValueId(rawValue);
    if (value.startsWith("#")) {
      resolved.push(...resolveTag(value.slice(1), tags, seen));
    } else {
      resolved.push(stripMcPrefix(value));
    }
  }

  return Array.from(new Set(resolved));
}
