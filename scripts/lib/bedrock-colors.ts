/**
 * Maps a Java dye colorId (e.g. from a bed item's model chain, see
 * scripts/lib/model.ts's "bed" IconCandidate) to the filename suffix Bedrock
 * Edition uses for the same color under vendor/bedrock-samples/resource_pack/textures/items/bed_<name>.png.
 *
 * Every color matches 1:1 except one legacy naming holdout: Bedrock still
 * calls the color Java renamed to "light_gray" by its original name, "silver".
 */
const JAVA_TO_BEDROCK_COLOR: Record<string, string> = {
  light_gray: "silver",
};

/** Resolves a Java colorId to the Bedrock texture filename suffix for the same color. */
export function toBedrockColorName(javaColorId: string): string {
  return JAVA_TO_BEDROCK_COLOR[javaColorId] ?? javaColorId;
}
