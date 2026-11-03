import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";

type AuthMode = "login" | "signup";

function friendlyAuthError(message: string, code?: string) {
  const normalized = `${code ?? ""} ${message}`.toLowerCase();

  if (
    normalized.includes("invalid_credentials") ||
    normalized.includes("invalid login credentials")
  ) {
    return "That email or password doesn’t look right. Check your details and try again.";
  }
  if (
    normalized.includes("weak_password") ||
    normalized.includes("password should be") ||
    normalized.includes("password is too short")
  ) {
    return "Choose a stronger password. Use at least 8 characters.";
  }
  if (
    normalized.includes("email_address_invalid") ||
    normalized.includes("invalid email")
  ) {
    return "Enter a valid email address and try again.";
  }
  if (
    normalized.includes("user_already_exists") ||
    normalized.includes("already registered")
  ) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (normalized.includes("email_not_confirmed")) {
    return "Please verify your email using the link we sent before signing in.";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "There have been too many attempts. Please wait a moment and try again.";
  }
  return "We couldn’t complete that request. Please check your connection and try again.";
}

export default function AuthPage({ mode }: { mode: AuthMode }) {
  const isSignup = mode === "signup";
  const navigate = useNavigate();
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");

  useEffect(() => {
    if (session) navigate("/app", { replace: true });
  }, [navigate, session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setConfirmationEmail("");

    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }

    setPending(true);

    if (!supabase) {
      setError("Stride isn’t connected to Supabase yet. Please try again later.");
      setPending(false);
      return;
    }

    try {
      const result = isSignup
        ? await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: window.location.origin },
          })
        : await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

      if (result.error) {
        setError(friendlyAuthError(result.error.message, result.error.code));
        return;
      }

      if (isSignup && !result.data.session) {
        setConfirmationEmail(email.trim());
        return;
      }

      navigate("/app", { replace: true });
    } catch {
      setError("We couldn’t connect to Stride. Check your internet and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout>
      {confirmationEmail ? (
        <section className="confirmation-card" aria-live="polite">
          <span className="confirmation-icon">
            <Mail size={22} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="eyebrow">One last step</span>
          <h1>Check your inbox.</h1>
          <p>
            We sent a verification link to <strong>{confirmationEmail}</strong>.
            Confirm your email to finish creating your account.
          </p>
          <button
            className="text-button"
            type="button"
            onClick={() => setConfirmationEmail("")}
          >
            Back to sign up
          </button>
        </section>
      ) : (
        <>
          <div className="form-heading">
            <span className="eyebrow">
              {isSignup ? "START YOUR JOURNEY" : "WELCOME BACK"}
            </span>
            <h1>{isSignup ? "Make room to move." : "Good to have you back."}</h1>
            <p>
              {isSignup
                ? "Create your account and find a rhythm that feels like yours."
                : "Sign in to pick up right where you left off."}
            </p>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Account access">
            <Link
              role="tab"
              aria-selected={!isSignup}
              className={!isSignup ? "active" : ""}
              to="/login"
            >
              Sign in
            </Link>
            <Link
              role="tab"
              aria-selected={isSignup}
              className={isSignup ? "active" : ""}
              to="/signup"
            >
              Create account
            </Link>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="form-error" role="alert">
                <span className="error-mark">!</span>
                <span>{error}</span>
              </div>
            )}

            <label className="field-label" htmlFor="email">
              Email address
            </label>
            <div className="input-wrap">
              <Mail
                className="input-icon"
                size={18}
                strokeWidth={1.7}
                aria-hidden="true"
              />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={254}
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="password-label-row">
              <label className="field-label" htmlFor="password">
                Password
              </label>
              {!isSignup && (
                <span className="password-hint">At least 8 characters</span>
              )}
            </div>
            <div className="input-wrap">
              <LockKeyhole
                className="input-icon"
                size={18}
                strokeWidth={1.7}
                aria-hidden="true"
              />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                minLength={8}
                maxLength={72}
                placeholder="••••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>

            <button className="submit-button" type="submit" disabled={pending}>
              {pending ? (
                <>
                  <LoaderCircle className="spinner" size={18} aria-hidden="true" />
                  {isSignup ? "Creating your account…" : "Signing you in…"}
                </>
              ) : (
                <>
                  {isSignup ? "Create your account" : "Sign in"}
                  <span className="submit-arrow" aria-hidden="true">
                    →
                  </span>
                </>
              )}
            </button>
          </form>

          <p className="privacy-note">
            <LockKeyhole size={13} strokeWidth={1.8} aria-hidden="true" />
            Your account and training data stay private.
          </p>
        </>
      )}
    </AuthLayout>
  );
}
