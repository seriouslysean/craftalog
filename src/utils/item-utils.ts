import { itemDetails, type ItemDetails } from "@/data/item-details";
import { recipes } from "@/data/item-recipes";

export const getCraftingTableState = (recipeId: string): (ItemDetails | null)[] => {
  const craftingTableState: (ItemDetails | null)[] = Array(9).fill(null);
  if (!recipeId) {
    return craftingTableState;
  }

  const recipe = recipes[recipeId];
  if (!recipe) {
    return craftingTableState;
  }

  const { pattern, key } = recipe;
  const numRows = pattern.length;
  const numCols = numRows > 0 ? pattern[0].length : 0;

  // Calculate padding to center the items
  const padRows = Math.floor((3 - numRows) / 2);
  const padCols = Math.floor((3 - numCols) / 2);

  // Directly map items from the pattern to the crafting grid
  pattern.forEach((row, rowIndex) => {
    row.split("").forEach((char, colIndex) => {
      const itemOption = key[char];
      if (itemOption) {
        const item = itemOption[0]; // Use the first item associated with the character
        if (itemDetails[item]) {
          // Calculate the index for this item, considering the padding
          const baseIndex = (rowIndex + padRows) * 3 + (colIndex + padCols);
          craftingTableState[baseIndex] = { ...itemDetails[item] };
        }
      }
    });
  });

  return craftingTableState;
};

export const getResultItemDetails = (recipeId: string): ItemDetails | null => {
  if (!recipeId) {
    return null;
  }
  // Get the result item details
  const result = itemDetails[recipeId];
  if (!result) {
    return null;
  }

  return result;
};
