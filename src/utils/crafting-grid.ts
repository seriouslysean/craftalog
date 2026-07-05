import type { Ingredient } from "../content.config";

export type { Ingredient };

/** A 3x3 crafting grid, read left-to-right/top-to-bottom like the game. */
const GRID_SIZE = 3;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;

export type GridCell = Ingredient | null;

/**
 * Places a shaped recipe's pattern into a 3x3 grid, centering it the same
 * way vanilla Minecraft's recipe book does: pad rows/cols by
 * `floor((3 - size) / 2)` on the top/left.
 */
export function buildShapedGrid(pattern: string[], key: Record<string, Ingredient>): GridCell[] {
  const grid: GridCell[] = Array(CELL_COUNT).fill(null);

  const rows = pattern.length;
  const cols = rows > 0 ? Math.max(...pattern.map((row) => row.length)) : 0;
  const padRows = Math.floor((GRID_SIZE - rows) / 2);
  const padCols = Math.floor((GRID_SIZE - cols) / 2);

  pattern.forEach((row, rowIndex) => {
    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const symbol = row[colIndex];
      const ingredient = key[symbol];
      if (!ingredient) continue;

      const targetRow = rowIndex + padRows;
      const targetCol = colIndex + padCols;
      if (targetRow < 0 || targetRow >= GRID_SIZE || targetCol < 0 || targetCol >= GRID_SIZE) {
        continue;
      }

      grid[targetRow * GRID_SIZE + targetCol] = ingredient;
    }
  });

  return grid;
}

/**
 * Fills a shapeless (or transmute) recipe's ingredients into the grid in
 * reading order — arrangement doesn't matter for these recipe types.
 */
export function buildShapelessGrid(ingredients: Ingredient[]): GridCell[] {
  const grid: GridCell[] = Array(CELL_COUNT).fill(null);
  ingredients.slice(0, CELL_COUNT).forEach((ingredient, index) => {
    grid[index] = ingredient;
  });
  return grid;
}
