import { requireOfficialHttpsUrl } from "./officialUrl";

type Request = {
  apiKey: string;
  domain: string;
  fetcher?: typeof fetch;
};

async function post(
  path: string,
  body: object,
  apiKey: string,
  fetcher: typeof fetch,
): Promise<unknown> {
  const response = await fetcher(`https://api.firecrawl.dev/v2/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`FIRECRAWL_${response.status}`);
  return await response.json();
}

export async function searchOfficialPages({
  apiKey,
  domain,
  query,
  fetcher = fetch,
}: Request & { query: string }) {
  const payload = await post(
    "search",
    { query: `site:${domain} ${query}`, limit: 5 },
    apiKey,
    fetcher,
  );
  const web =
    typeof payload === "object" &&
    payload !== null &&
    "data" in payload &&
    typeof payload.data === "object" &&
    payload.data !== null &&
    "web" in payload.data &&
    Array.isArray(payload.data.web)
      ? payload.data.web
      : [];
  return web
    .flatMap((entry): Array<{ url: string; title: string }> => {
      if (
        typeof entry !== "object" ||
        entry === null ||
        !("url" in entry) ||
        typeof entry.url !== "string"
      )
        return [];
      try {
        return [
          {
            url: requireOfficialHttpsUrl(entry.url, domain),
            title:
              "title" in entry && typeof entry.title === "string"
                ? entry.title.slice(0, 200)
                : "Official school page",
          },
        ];
      } catch {
        return [];
      }
    })
    .slice(0, 5);
}

export async function scrapeOfficialPage({
  apiKey,
  domain,
  url,
  fetcher = fetch,
}: Request & { url: string }) {
  const requestedUrl = requireOfficialHttpsUrl(url, domain);
  const payload = await post(
    "scrape",
    { url: requestedUrl, formats: ["markdown"], onlyMainContent: true },
    apiKey,
    fetcher,
  );
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("data" in payload) ||
    typeof payload.data !== "object" ||
    payload.data === null
  )
    throw new Error("FIRECRAWL_INVALID_RESPONSE");
  const data = payload.data as Record<string, unknown>;
  const metadata =
    typeof data.metadata === "object" && data.metadata !== null
      ? (data.metadata as Record<string, unknown>)
      : {};
  const finalUrl = requireOfficialHttpsUrl(
    typeof metadata.url === "string" ? metadata.url : requestedUrl,
    domain,
  );
  if (typeof data.markdown !== "string")
    throw new Error("FIRECRAWL_INVALID_RESPONSE");
  return {
    url: finalUrl,
    title:
      typeof metadata.title === "string"
        ? metadata.title.slice(0, 200)
        : "Official school page",
    excerpt: data.markdown.replace(/\s+/g, " ").trim().slice(0, 500),
  };
}
