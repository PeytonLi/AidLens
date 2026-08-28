import { Link, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import AccountRoutes from "./features/auth/AccountRoutes";
import SamplePage from "./features/sample/SamplePage";

function LandingPage() {
  return (
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
          <Link to="/sample" className="btn btn-primary">
            Try the sample
          </Link>
          <Link to="/auth" className="btn btn-secondary">
            Compare my offers
          </Link>
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
                Draft a precise question, approve the send, and update when they
                reply.
              </p>
            </div>
          </li>
        </ol>
      </section>
    </main>
  );
}

function AppShell({ children }: { children: ReactNode }) {
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
            <Link to="/sample">Sample</Link>
            <Link to="/auth">Sign in</Link>
          </nav>
        </div>
      </header>

      {children}

      <footer className="site-footer">
        <div className="site-footer__inner">
          <p className="trust-line">
            Every number links back to the offer, an official school page, or a
            school reply.
          </p>
          <p id="privacy" className="privacy-line">
            Your offers stay in your private workspace. AidLens never sells your
            data or recommends a school.
          </p>
          <p id="service-providers" className="sponsors">
            Built with Convex · OpenAI · Firecrawl · AgentMail
          </p>
        </div>
      </footer>
    </div>
  );
}

function NotFoundPage() {
  return (
    <main id="main" className="not-found-page">
      <h1>Not found</h1>
      <p>That AidLens page does not exist.</p>
      <Link to="/">Return home</Link>
    </main>
  );
}

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/sample" element={<SamplePage />} />
        <Route path="/auth" element={<AccountRoutes />} />
        <Route path="/age" element={<AccountRoutes />} />
        <Route path="/workspace" element={<AccountRoutes />} />
        <Route path="/offers/:offerId/review" element={<AccountRoutes />} />
        <Route path="/compare" element={<AccountRoutes />} />
        <Route path="/schools/:schoolId" element={<AccountRoutes />} />
        <Route
          path="/questions/:questionId/draft"
          element={<AccountRoutes />}
        />
        <Route path="/decision" element={<AccountRoutes />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}
