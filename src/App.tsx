export default function App() {
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <header className="site-header">
        <div className="site-header__inner">
          <p className="brand-mark" aria-hidden="true">
            AidLens
          </p>
          <nav aria-label="Primary">
            <a href="/sample">Sample</a>
            <a href="/auth">Sign in</a>
          </nav>
        </div>
      </header>

      <main id="main" className="landing">
        <section className="hero" aria-labelledby="brand-heading">
          <h1 id="brand-heading" className="brand-hero">
            AidLens
          </h1>
          <p className="hero-headline">
            Know what each college will really cost.
          </p>
          <p className="hero-support">
            Forward your financial-aid offers. AidLens separates free aid from
            borrowing, estimates the four-year cost, flags missing terms, and
            helps you get answers from each school.
          </p>
          <div className="hero-actions">
            <a href="/sample" className="btn btn-primary">
              Try the sample
            </a>
            <a href="/auth" className="btn btn-secondary">
              Compare my offers
            </a>
          </div>
        </section>

        <section className="how-it-works" aria-labelledby="how-heading">
          <h2 id="how-heading">How it works</h2>
          <ol className="steps">
            <li>
              <span className="step-num">1</span>
              <div>
                <h3>Bring your offers</h3>
                <p>Upload letters or forward them to your AidLens inbox.</p>
              </div>
            </li>
            <li>
              <span className="step-num">2</span>
              <div>
                <h3>Compare real costs</h3>
                <p>
                  See grants, loans, and estimated four-year cost side by side.
                </p>
              </div>
            </li>
            <li>
              <span className="step-num">3</span>
              <div>
                <h3>Ask the school</h3>
                <p>
                  Draft a precise question, approve the send, and update when
                  they reply.
                </p>
              </div>
            </li>
          </ol>
        </section>
      </main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <p className="trust-line">
            Every number links back to the offer, an official school page, or a
            school reply.
          </p>
          <p className="privacy-line">
            Your offers stay in your private workspace. AidLens never sells your
            data or recommends a school.
          </p>
          <p className="sponsors">
            Built with Convex · OpenAI · Firecrawl · AgentMail
          </p>
        </div>
      </footer>
    </div>
  );
}
