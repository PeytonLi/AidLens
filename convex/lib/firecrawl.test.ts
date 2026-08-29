import { expect, it, vi } from "vitest";
import { scrapeOfficialPage, searchOfficialPages } from "./firecrawl";

it("S7.4: searches with a bounded official-domain query and drops snippets", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        success: true,
        data: {
          web: [
            {
              url: "https://aid.example.edu/grants",
              title: "Aid",
              description: "untrusted snippet",
            },
          ],
        },
      }),
      { status: 200 },
    ),
  );
  await expect(
    searchOfficialPages({
      apiKey: "test",
      domain: "example.edu",
      query: "renewal",
      fetcher,
    }),
  ).resolves.toEqual([{ url: "https://aid.example.edu/grants", title: "Aid" }]);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
    query: "site:example.edu renewal",
    limit: 5,
  });
});

it("S7.5: scrapes one official page and returns only bounded evidence metadata", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        success: true,
        data: {
          markdown: `Renewal requires full-time enrollment. ${"x".repeat(1_000)}`,
          metadata: {
            title: "Scholarship renewal",
            sourceURL: "https://example.edu/aid",
            url: "https://www.example.edu/aid",
          },
        },
      }),
      { status: 200 },
    ),
  );
  const result = await scrapeOfficialPage({
    apiKey: "test",
    domain: "example.edu",
    url: "https://example.edu/aid",
    fetcher,
  });
  expect(result).toMatchObject({
    url: "https://www.example.edu/aid",
    title: "Scholarship renewal",
  });
  expect(result.excerpt.length).toBeLessThanOrEqual(500);
  expect(result).not.toHaveProperty("markdown");
});
