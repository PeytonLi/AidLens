import { expect, test } from "@playwright/test";

test("private upload, preview, raw deletion, and workspace deletion", async ({
  page,
}) => {
  const email = `aidlens-smoke-${Date.now()}@example.test`;

  await page.goto("/auth");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill("Synthetic-test-only-42!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();

  try {
    await expect(
      page.getByRole("heading", { name: "Confirm your age" }),
    ).toBeVisible();
    await page.getByRole("checkbox", { name: /at least 18/ }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByRole("heading", { name: "Your private workspace" }),
    ).toBeVisible();

    await page.getByLabel("Upload an offer").setInputFiles({
      name: "synthetic-offer.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\nsynthetic AidLens smoke offer\n%%EOF"),
    });
    const card = page.locator("[data-testid^='processing-status-']");
    await expect(
      card.getByText("Ready for extraction", { exact: true }),
    ).toBeVisible();
    await expect(page.getByTitle("synthetic-offer.pdf preview")).toBeVisible();

    await page
      .getByRole("button", { name: "Delete raw synthetic-offer.pdf" })
      .click();
    await expect(page.getByText(/Raw file deleted/)).toBeVisible();
    await expect(page.getByTitle("synthetic-offer.pdf preview")).toHaveCount(0);
  } finally {
    const deleteButton = page.getByRole("button", { name: "Delete workspace" });
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      await page.getByRole("button", { name: "Delete permanently" }).click();
      await expect(page).toHaveURL(/\/$/);
    }
  }
});
