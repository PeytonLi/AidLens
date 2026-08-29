export function requireOfficialHttpsUrl(
  value: string,
  officialDomain: string,
): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("UNSAFE_OFFICIAL_URL");
  }
  const domain = officialDomain
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !domain.includes(".") ||
    (!host.endsWith(`.${domain}`) && host !== domain)
  ) {
    throw new Error("UNSAFE_OFFICIAL_URL");
  }
  return url.href;
}
