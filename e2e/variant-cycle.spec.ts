import { expect, test, type Locator } from "@playwright/test";

// Crafting table: every ingredient cell is a plank slot that cycles through
// all wood variants on a 1500ms interval (ItemVariants.astro).
const CYCLING_SLOT = ".crafting__grid .item-variants[data-variant-cycle]";

function visibleVariantIndex(slot: Locator): Promise<number> {
  return slot
    .locator(".item-variants__variant")
    .evaluateAll((variants) => variants.findIndex((variant) => !variant.hasAttribute("hidden")));
}

test("cycles variants on a timer and pauses while hovered", async ({ page }) => {
  // Install BEFORE goto so the fake clock captures the setInterval that
  // astro:page-load registers; pause right after load so ticks only happen
  // via fastForward. The fixed times give the load a generous window without
  // racing real elapsed time. No navigations after this point.
  await page.clock.install({ time: new Date("2026-01-01T00:00:00") });
  await page.goto("/recipe/crafting-table/");
  await page.clock.pauseAt(new Date("2026-01-01T00:01:00"));

  const slot = page.locator(CYCLING_SLOT).first();
  await expect(slot).toBeVisible();

  const before = await visibleVariantIndex(slot);
  await page.clock.fastForward(1600);
  const after = await visibleVariantIndex(slot);
  expect(after).not.toBe(before);

  // WCAG 2.2.2 pause mechanism: a hovered slot stops cycling.
  await slot.hover();
  const paused = await visibleVariantIndex(slot);
  await page.clock.fastForward(1600);
  expect(await visibleVariantIndex(slot)).toBe(paused);
});

test("prefers-reduced-motion disables cycling entirely", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/recipe/crafting-table/");

  const slot = page.locator(CYCLING_SLOT).first();
  await expect(slot).toBeVisible();

  const before = await visibleVariantIndex(slot);
  await page.clock.fastForward(10_000);
  expect(await visibleVariantIndex(slot)).toBe(before);
});
