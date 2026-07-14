import { expect, test, type Page } from "@playwright/test";

// The catalog filter is data-driven: search terms and expected names are read
// from the rendered page (card names, data attributes) rather than hard-coded,
// so these tests survive weekly vanilla-data bumps.

/** Name of the first catalog card — a search term guaranteed to match itself. */
async function firstCardName(page: Page): Promise<string> {
  const name = await page.locator(".catalog__item .item-card__name").first().textContent();
  expect(name?.trim()).toBeTruthy();
  return (name ?? "").trim();
}

/** Visible-result count announced in #catalog-status ("N recipes shown."). */
async function announcedCount(page: Page): Promise<number> {
  const status = page.locator("#catalog-status");
  await expect(status).toHaveText(/^\d+ recipes? shown\.$/);
  const text = (await status.textContent()) ?? "";
  return Number.parseInt(text, 10);
}

test("typing filters cards and announces the count; garbage shows the empty state", async ({
  page,
}) => {
  await page.goto("/");

  const status = page.locator("#catalog-status");
  await expect(status).toHaveAttribute("role", "status");

  const items = page.locator(".catalog__item");
  const total = await items.count();
  const term = await firstCardName(page);

  await page.fill("#recipe-filter", term);

  const shown = await announcedCount(page);
  expect(shown).toBeGreaterThanOrEqual(1);
  expect(shown).toBeLessThan(total);
  await expect(page.locator(".catalog__item:not([hidden])")).toHaveCount(shown);
  await expect(page.locator(".catalog__item[hidden]")).toHaveCount(total - shown);
  await expect(page.locator("#catalog-empty")).toBeHidden();

  await page.fill("#recipe-filter", "zzzz no such recipe zzzz");
  await expect(page.locator("#catalog-empty")).toBeVisible();
  await expect(status).toHaveText("No recipes match your search.");
  await expect(page.locator(".catalog__item:not([hidden])")).toHaveCount(0);
});

test("Enter writes ?q= to the URL and a fresh load restores the filter", async ({ page }) => {
  await page.goto("/");
  const term = await firstCardName(page);

  await page.fill("#recipe-filter", term);
  await page.press("#recipe-filter", "Enter");

  // The submit handler preventDefaults and replaceStates ?q= in place.
  await expect(page).toHaveURL(`/?${new URLSearchParams([["q", term]]).toString()}`);

  await page.goto(`/?q=${encodeURIComponent(term)}`);
  await expect(page.locator("#recipe-filter")).toHaveValue(term);
  const shown = await announcedCount(page);
  await expect(page.locator(".catalog__item:not([hidden])")).toHaveCount(shown);
  await expect(page.locator(".catalog__item[hidden]").first()).toBeAttached();
});

interface VariantIconEntry {
  resultId: string;
  name: string;
  href: string;
  textures: string[];
}

test("searching a variant term lazily fetches the manifest and face-swaps the card", async ({
  page,
}) => {
  const manifestRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/variant-icons.json")) manifestRequests.push(request.url());
  });

  await page.goto("/");
  await expect(page.locator(".catalog__item").first()).toBeVisible();
  // The manifest is lazy: nothing fetches it on page load.
  expect(manifestRequests).toHaveLength(0);

  // Load the manifest out-of-band (page.request bypasses the page's network
  // stack, so it doesn't count as the page fetching it) and pick a card +
  // variant pair where the variant's own name uniquely matches within its
  // group — fully data-driven, so weekly data bumps can't break this.
  const manifestResponse = await page.request.get("/variant-icons.json");
  const manifest = (await manifestResponse.json()) as Record<string, VariantIconEntry[]>;

  const cardData = await page.locator("[data-variant-group]").evaluateAll((cards) =>
    cards.map((card) => ({
      groupKey: card.getAttribute("data-variant-group"),
      defaultResultId: card.getAttribute("data-default-result-id"),
      defaultName: card.getAttribute("data-default-name"),
    })),
  );

  let chosen: {
    groupKey: string;
    needle: string;
    swappedName: string;
    defaultName: string;
  } | null = null;
  for (const { groupKey, defaultResultId, defaultName } of cardData) {
    if (!groupKey || !defaultResultId || !defaultName) continue;
    const variants = manifest[groupKey];
    if (!variants) continue;
    for (const variant of variants) {
      if (variant.resultId === defaultResultId) continue;
      const needle = variant.name.toLowerCase();
      const matches = variants.filter((entry) => entry.name.toLowerCase().includes(needle));
      if (matches.length === 1) {
        chosen = { groupKey, needle, swappedName: variant.name, defaultName };
        break;
      }
    }
    if (chosen) break;
  }
  if (!chosen) throw new Error("no uniquely-matchable variant found in variant-icons.json");

  const card = page.locator(`[data-variant-group="${chosen.groupKey}"]`);
  const cardName = card.locator(".item-card__name");
  await expect(cardName).toHaveText(chosen.defaultName);

  // First keystroke triggers the one-and-only manifest fetch.
  const manifestFetch = page.waitForRequest("**/variant-icons.json*");
  await page.fill("#recipe-filter", chosen.needle);
  await manifestFetch;
  await expect(cardName).toHaveText(chosen.swappedName);

  // Clearing the search reverts to the curated default name.
  await page.fill("#recipe-filter", "");
  await expect(cardName).toHaveText(chosen.defaultName);
});
