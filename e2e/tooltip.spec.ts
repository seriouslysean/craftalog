import { expect, test, type Page } from "@playwright/test";

// Bookshelf's grid mixes cycling plank slots with static book slots — the
// book cells are the ones without [data-variant-cycle], which keeps the
// tooltip stationary while we assert on it.
function bookCell(page: Page) {
  return page
    .locator(
      ".crafting__grid .crafting__cell:has(a.item-icon-tooltip__trigger):not(:has([data-variant-cycle]))",
    )
    .first();
}

test("focusing a grid slot trigger reveals its tooltip popup", async ({ page }) => {
  await page.goto("/recipe/bookshelf/");

  const cell = bookCell(page);
  const trigger = cell.locator("a.item-icon-tooltip__trigger");
  const popup = cell.locator(".item-icon-tooltip__popup");

  await expect(popup).toHaveCSS("visibility", "hidden");
  await expect(popup).toHaveCSS("opacity", "0");

  // :focus-within on the tooltip container flips the popup visible.
  await trigger.focus();
  await expect(popup).toHaveCSS("visibility", "visible");
  await expect(popup).toHaveCSS("opacity", "1");

  await trigger.blur();
  await expect(popup).toHaveCSS("visibility", "hidden");
});

test("grid exposes a text summary, no role override, and focusable triggers", async ({ page }) => {
  await page.goto("/recipe/bookshelf/");

  // The grid's a11y story is a visually-hidden text summary, NOT
  // role="img"/aria-label on the grid (which would flatten the interactive
  // per-cell links inside).
  const summary = page.locator(".crafting p.visually-hidden").first();
  await expect(summary).toHaveText(/^3 by 3 crafting grid for .+/);
  await expect(page.locator(".crafting__grid")).not.toHaveAttribute("role");

  const trigger = bookCell(page).locator("a.item-icon-tooltip__trigger");
  await trigger.focus();
  await expect(trigger).toBeFocused();
});
