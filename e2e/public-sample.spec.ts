import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("public sample journey", () => {
  test("landing Try the sample opens synthetic UCSD / Loyola comparison", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /try the sample/i }).click();
    await expect(page).toHaveURL(/\/sample\/?$/);

    // Persistent synthetic-demo banner (Slice 2 contract).
    await expect(
      page.getByText(/synthetic demo|synthetic/i).first(),
    ).toBeVisible();

    // Two fictional schools.
    await expect(page.getByText(/UC San Diego|UCSD/i).first()).toBeVisible();
    await expect(page.getByText(/Loyola/i).first()).toBeVisible();

    // Comparison categories / money language (flexible but meaningful).
    await expect(page.getByText(/gift aid|grant/i).first()).toBeVisible();
    await expect(page.getByText(/net price/i).first()).toBeVisible();
    await expect(page.getByText(/loan/i).first()).toBeVisible();
    await expect(page.getByText(/work[\s-]?study/i).first()).toBeVisible();

    // Conservative ↔ Optimistic toggle when present (S2.4).
    const conservative = page.getByRole("radio", { name: /conservative/i });
    const optimistic = page.getByRole("radio", { name: /optimistic/i });

    if ((await conservative.count()) > 0 && (await optimistic.count()) > 0) {
      await expect(conservative).toBeVisible();
      await expect(optimistic).toBeVisible();

      await conservative.check();
      await expect(conservative).toBeChecked();

      await optimistic.check();
      await expect(optimistic).toBeChecked();
      await expect(conservative).not.toBeChecked();

      await conservative.check();
      await expect(conservative).toBeChecked();
    } else {
      // Fallback: labeled buttons / tabs if radios are not used.
      const conservativeControl = page.getByRole("button", {
        name: /conservative/i,
      });
      const optimisticControl = page.getByRole("button", {
        name: /optimistic/i,
      });
      if (
        (await conservativeControl.count()) > 0 &&
        (await optimisticControl.count()) > 0
      ) {
        await optimisticControl.click();
        await expect(page.getByText(/optimistic/i).first()).toBeVisible();
        await conservativeControl.click();
        await expect(page.getByText(/conservative/i).first()).toBeVisible();
      }
    }
  });

  test("sample page has no critical or serious axe violations", async ({
    page,
  }) => {
    await page.goto("/sample");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    expect(
      blocking,
      blocking
        .map(
          (v) => `${v.impact}: ${v.id} — ${v.help} (${v.nodes.length} node(s))`,
        )
        .join("\n") || "no blocking violations",
    ).toEqual([]);
  });
});
