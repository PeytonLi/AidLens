import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const privateRoutes = [
  "/workspace",
  "/compare",
  "/decision",
  "/offers/example/review",
  "/schools/example",
  "/questions/example/draft",
];

test.describe("private route auth boundary", () => {
  for (const route of privateRoutes) {
    test(`${route} requires sign-in and never shows private content`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(
        page.getByRole("heading", { name: "Sign in to AidLens" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Your private workspace" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Compare offers" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Your decision" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Approve and send" }),
      ).toHaveCount(0);
    });
  }

  test("auth pages stay free of critical axe violations", async ({ page }) => {
    await page.goto("/auth");
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

test.describe("approval safety on public surfaces", () => {
  test("sample never exposes send or confirm mutation controls", async ({
    page,
  }) => {
    await page.goto("/sample");
    await expect(
      page.getByRole("heading", { name: /sample comparison/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Approve and send" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Confirm update" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Delete workspace" }),
    ).toHaveCount(0);
    await expect(page.getByRole("textbox")).toHaveCount(0);
  });
});
