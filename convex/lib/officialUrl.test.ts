import { expect, it } from "vitest";
import { requireOfficialHttpsUrl } from "./officialUrl";

it("S7.3: accepts exact official hosts and subdomains", () => {
  expect(
    requireOfficialHttpsUrl("https://example.edu/aid", "example.edu"),
  ).toBe("https://example.edu/aid");
  expect(
    requireOfficialHttpsUrl(
      "https://financialaid.example.edu/grants",
      "example.edu",
    ),
  ).toBe("https://financialaid.example.edu/grants");
});

it.each([
  "http://example.edu/aid",
  "https://example.edu.evil.test/aid",
  "https://evil-example.edu/aid",
  "https://127.0.0.1/aid",
  "https://user:pass@example.edu/aid",
  "https://example.edu:8443/aid",
])("S7.3: rejects unsafe or off-domain URL %s", (url) => {
  expect(() => requireOfficialHttpsUrl(url, "example.edu")).toThrow(
    "UNSAFE_OFFICIAL_URL",
  );
});
