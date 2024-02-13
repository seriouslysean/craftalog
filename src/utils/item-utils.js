import { itemDetails } from '@/data/item-details';
import { recipes } from '@/data/item-recipes';

export const formatCraftingTable = (recipeId) => {
  const recipe = recipes[recipeId];
  const craftingTableState = Array(9).fill(null);

  if (!recipe) {
    console.error(`Recipe with identifier "${recipeId}" not found.`);
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
    row.split('').forEach((char, colIndex) => {
      const itemOption = key[char];
      if (itemOption) {
        const item = itemOption[0]; // Use the first item associated with the character
        if (itemDetails[item]) {
          // Calculate the index for this item, considering the padding
          const baseIndex = (rowIndex + padRows) * 3 + (colIndex + padCols);
          craftingTableState[baseIndex] = { ...itemDetails[item] };
        } else {
          console.error(`Item details not found for "${item}".`);
        }
      }
    });
  });

  return craftingTableState;
};
