import { useEffect, useRef, useState, type FormEvent } from "react";

interface AgeConfirmationPageProps {
  onConfirm: () => void | Promise<void>;
  onSignOut: () => void;
  submitError?: string | null;
  submitting?: boolean;
}

export default function AgeConfirmationPage({
  onConfirm,
  onSignOut,
  submitError,
  submitting = false,
}: AgeConfirmationPageProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [showError, setShowError] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (showError || submitError) errorRef.current?.focus();
  }, [showError, submitError]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!confirmed) {
      setShowError(true);
      return;
    }
    void onConfirm();
  }

  return (
    <main id="main" className="age-page">
      <h1>Confirm your age</h1>
      <p>AidLens workspaces are available to adults age 18 and older.</p>
      <p>
        Review <a href="/#privacy">Privacy and data handling</a> and the{" "}
        <a href="/#service-providers">Service providers</a> before continuing.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        {showError || submitError ? (
          <p ref={errorRef} id="age-error" role="alert" tabIndex={-1}>
            {showError
              ? "Confirm that you are at least 18 years old to continue."
              : submitError}
          </p>
        ) : null}
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            disabled={submitting}
            aria-invalid={showError}
            aria-describedby={showError ? "age-error" : undefined}
            onChange={(event) => {
              setConfirmed(event.currentTarget.checked);
              setShowError(false);
            }}
          />
          I am at least 18 years old.
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating workspace…" : "Continue"}
        </button>
      </form>

      <button type="button" onClick={onSignOut}>
        Sign out
      </button>
    </main>
  );
}
