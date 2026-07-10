import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { withBase } from "../utils/with-base";
import { iconSwapTextures, isIconGeometryUniform } from "../utils/icon-faces";
import type { ItemData } from "../content.config";
import {
  canonicalRecipePath,
  collapseVariantGroups,
  groupDisplayName,
  groupItemSlug,
  groupRecipes,
} from "../utils/recipe-groups";

/**
 * Lazily-fetched data for the homepage's client-side search "face-swap"
 * (see index.astro): searching a color/material adjective that names
 * exactly one variant of a collapsed card (e.g. "acacia" -> Acacia Boat)
 * swaps that card's default face to the matched variant instead of always
 * showing the family's curated default. Deliberately a separate static
 * JSON endpoint, fetched only on the first search keystroke, rather than
 * inlined into every homepage load or pre-rendered as hidden markup --
 * pre-rendering every variant's full icon markup on the homepage itself was
 * measured to nearly triple its HTML weight (+181%, ~1.45MB) for a search
 * refinement most page loads never use. This payload is texture URLs only
 * (no markup): within one collapsed group every variant shares identical
 * geometry, so the client only ever swaps which texture an
 * already-rendered slot points at -- see iconSwapTextures and
 * index.astro's applyTextures.
 *
 * Not every group's members are actually geometry-identical (see
 * isIconGeometryUniform's doc comment -- the "trapdoors" group's oak/
 * dark_oak members use a different uv template than every other wood, a
 * real vanilla data split). For a non-uniform group, every member gets an empty
 * `textures` array instead -- the client treats that as "no swap data" and
 * leaves the card showing its curated default, rather than risk swapping in
 * a mismatched crop.
 */
export const GET: APIRoute = async () => {
  const recipeEntries = await getCollection("recipes");
  const itemEntries = await getCollection("items");
  const itemsMap = new Map(itemEntries.map((entry) => [entry.id, entry.data]));
  const getItemName = (id: string) => itemsMap.get(id)?.name ?? id;

  const groups = groupRecipes(
    recipeEntries.map((entry) => entry.data),
    getItemName,
  );
  const { variantGroups } = collapseVariantGroups(groups);

  const manifest: Record<
    string,
    Array<{ resultId: string; name: string; href: string; textures: string[] }>
  > = {};

  for (const variantGroup of variantGroups) {
    const icons = variantGroup.variants
      .map((variant) => itemsMap.get(variant.resultId)?.icon)
      .filter((icon): icon is ItemData["icon"] => icon !== undefined);
    const swappable = isIconGeometryUniform(icons);

    manifest[variantGroup.groupKey] = variantGroup.variants.map((variant) => {
      const item = itemsMap.get(variant.resultId);
      return {
        resultId: variant.resultId,
        name: groupDisplayName(variant, itemsMap),
        href: withBase(canonicalRecipePath(groupItemSlug(variant, itemsMap))),
        textures:
          swappable && item ? iconSwapTextures(item.icon).map((texture) => withBase(texture)) : [],
      };
    });
  }

  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/json" },
  });
};
