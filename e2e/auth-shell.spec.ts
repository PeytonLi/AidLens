import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("private account shell", () => {
  test("a signed-out private route renders sign-in without private content", async ({
    page,
  }) => {
    await page.goto("/workspace");

    await expect(
      page.getByRole("heading", { name: "Sign in to AidLens" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Your private workspace" }),
    ).toHaveCount(0);
  });

  test("the sign-in page has no critical or serious axe violations", async ({
    page,
  }) => {
    await page.goto("/auth");
    await expect(
      page.getByRole("heading", { name: "Sign in to AidLens" }),
    ).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.filter(
        ({ impact }) => impact === "critical" || impact === "serious",
      ),
    ).toEqual([]);
  });
});
