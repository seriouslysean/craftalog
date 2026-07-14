import { expect, test } from "@playwright/test";

test("copy-link copies the canonical URL and reverts after the timeout", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.clock.install({ time: new Date("2026-01-01T00:00:00") });
  await page.goto("/recipe/bookshelf/");
  // Freeze time so the 1500ms revert can't fire mid-assertion.
  await page.clock.pauseAt(new Date("2026-01-01T00:01:00"));

  const button = page.locator(".recipe__copy-link");
  const label = page.locator(".recipe__copy-link-label");
  const status = page.locator("[data-copy-status]");

  // The button ships hidden and is unhidden by JS on astro:page-load.
  await expect(button).toBeVisible();
  await expect(status).toHaveAttribute("role", "status");

  // The button copies its data-url (the canonical production URL from
  // Astro.site), not location.href — assert against the attribute.
  const canonicalUrl = await button.getAttribute("data-url");
  expect(canonicalUrl).toBeTruthy();

  await button.click();
  await expect(label).toHaveText("Copied");
  await expect(status).toHaveText("Link copied");
  await expect(button).toBeDisabled();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(canonicalUrl);

  await page.clock.fastForward(1600);
  await expect(label).toHaveText("Copy link");
  await expect(status).toHaveText("");
  await expect(button).toBeEnabled();
});

test("scripts rebind across view transitions and the pager navigates", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");

  // Soft navigation via ClientRouter: poll the URL — never waitForNavigation
  // or networkidle (prefetchAll keeps the network busy).
  await page.locator("a.catalog__link").first().click();
  await expect(page).toHaveURL(/\/recipe\/[^/]+\/$/);
  const firstRecipeUrl = page.url();

  // Copy-link working post-VT proves scripts rebound on astro:page-load.
  const button = page.locator(".recipe__copy-link");
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator(".recipe__copy-link-label")).toHaveText("Copied");

  // Pager "next" lands on some other recipe page — the specific slug is
  // data-dependent (alphabetical neighbors shift with weekly data bumps).
  await page.locator("a.recipe__pager-link--next").click();
  await expect(page).not.toHaveURL(firstRecipeUrl);
  await expect(page).toHaveURL(/\/recipe\/[^/]+\/$/);
});
