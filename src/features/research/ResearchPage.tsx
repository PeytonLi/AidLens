import { useState } from "react";

export type ResearchData = {
  run: { state: string; failureCode?: string } | null;
  sources: Array<{
    _id: string;
    kind: "official_page";
    title: string;
    url: string;
    excerpt: string;
    retrievedAt: number;
  }>;
};

export default function ResearchPage({
  schoolName,
  data,
  onStart,
}: {
  schoolName: string;
  data: ResearchData;
  onStart: () => Promise<unknown>;
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string>();
  const active = data.run?.state === "queued" || data.run?.state === "running";

  async function start() {
    setStarting(true);
    setError(undefined);
    try {
      await onStart();
    } catch {
      setError("Official-source research could not start. Try again or add a source manually.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <main id="main" className="research-page">
      <p className="eyebrow">Verified evidence</p>
      <h1>{schoolName} sources</h1>
      <p>Only pages on the confirmed official school domain appear here.</p>
      {error ? <p role="alert">{error}</p> : null}
      {active ? <p role="status">Researching official pages…</p> : null}
      {data.run?.state === "failed" ? (
        <p role="alert">Research is unavailable right now. Existing offer facts are unchanged.</p>
      ) : null}
      {data.sources.length === 0 ? <p>No official pages researched yet.</p> : null}
      <button type="button" disabled={starting || active} onClick={() => void start()}>
        {data.run?.state === "failed" ? "Retry official research" : "Research official sources"}
      </button>
      <section aria-label="Official sources">
        {data.sources.map((source) => (
          <article key={source._id} className="source-item source-item--official">
            <p>Official school page</p>
            <h2>{source.title}</h2>
            <p>{source.excerpt}</p>
            <a href={source.url} target="_blank" rel="noreferrer">
              Open {source.title} (external site)
            </a>
          </article>
        ))}
      </section>
    </main>
  );
}
