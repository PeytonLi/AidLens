import { useEffect, useRef, useState, type FormEvent } from "react";

export type AuthMode = "signIn" | "register";

export interface AuthCredentials {
  email: string;
  password: string;
}

interface AuthPageProps {
  initialMode?: AuthMode;
  onBack: () => void;
  onSubmit: (
    mode: AuthMode,
    credentials: AuthCredentials,
  ) => void | Promise<void>;
  submitError?: string | null;
  submitting?: boolean;
}

export default function AuthPage({
  initialMode = "signIn",
  onBack,
  onSubmit,
  submitError,
  submitting = false,
}: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [errors, setErrors] = useState<Partial<AuthCredentials>>({});
  const [showPassword, setShowPassword] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const registering = mode === "register";

  useEffect(() => {
    if (Object.keys(errors).length > 0 || submitError) {
      summaryRef.current?.focus();
    }
  }, [errors, submitError]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const emailInput = event.currentTarget.elements.namedItem(
      "email",
    ) as HTMLInputElement;
    const passwordInput = event.currentTarget.elements.namedItem(
      "password",
    ) as HTMLInputElement;
    const credentials = {
      email: emailInput.value.trim(),
      password: passwordInput.value,
    };
    const nextErrors: Partial<AuthCredentials> = {};
    if (!credentials.email) nextErrors.email = "Enter your email address.";
    else if (!emailInput.validity.valid)
      nextErrors.email = "Enter a valid email address.";
    if (!credentials.password) nextErrors.password = "Enter your password.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    void onSubmit(mode, {
      email: credentials.email,
      password: credentials.password,
    });
  }

  return (
    <main id="main" className="auth-page">
      <button type="button" onClick={onBack}>
        Back
      </button>
      <h1>
        {registering ? "Create your AidLens account" : "Sign in to AidLens"}
      </h1>
      <form onSubmit={handleSubmit} noValidate>
        {Object.keys(errors).length > 0 || submitError ? (
          <div ref={summaryRef} role="alert" tabIndex={-1}>
            <strong>
              {Object.keys(errors).length > 0
                ? "Check the highlighted fields."
                : "We couldn't complete that request."}
            </strong>
            {submitError ? <p>{submitError}</p> : null}
          </div>
        ) : null}
        <label htmlFor="auth-email">Email address</label>
        <input
          id="auth-email"
          name="email"
          type="email"
          autoComplete="email"
          disabled={submitting}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "auth-email-error" : undefined}
        />
        {errors.email ? <p id="auth-email-error">{errors.email}</p> : null}

        <label htmlFor="auth-password">Password</label>
        <input
          id="auth-password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete={registering ? "new-password" : "current-password"}
          disabled={submitting}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "auth-password-error" : undefined}
        />
        {errors.password ? (
          <p id="auth-password-error">{errors.password}</p>
        ) : null}
        <button
          type="button"
          disabled={submitting}
          onClick={() => setShowPassword((value) => !value)}
        >
          {showPassword ? "Hide password" : "Show password"}
        </button>

        <button type="submit" disabled={submitting}>
          {submitting
            ? registering
              ? "Creating account…"
              : "Signing in…"
            : registering
              ? "Create account"
              : "Sign in"}
        </button>
      </form>
      <p>{registering ? "Already have an account?" : "New to AidLens?"}</p>
      <button
        type="button"
        disabled={submitting}
        onClick={() => setMode(registering ? "signIn" : "register")}
      >
        {registering ? "Sign in instead" : "Create an account"}
      </button>
    </main>
  );
}
