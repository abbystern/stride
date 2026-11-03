import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/AuthProvider";

type AuthMode = "login" | "signup";

type SupabaseAuthFailure = {
  message: string;
  code?: string;
  status?: number;
};

function reportAuthFailure(error: SupabaseAuthFailure, mode: AuthMode) {
  if (!import.meta.env.DEV) return;

  console.error("[Stride auth] Supabase request failed", {
    flow: mode,
    code: error.code,
    status: error.status,
    message: error.message,
  });
}

function friendlyAuthError(
  message: string,
  code: string | undefined,
  mode: AuthMode,
) {
  const normalized = `${code ?? ""} ${message}`.toLowerCase();

  if (
    normalized.includes("redirect_to") ||
    normalized.includes("redirect url") ||
    normalized.includes("redirect uri")
  ) {
    return "Supabase rejected this app’s email-confirmation redirect. Add this Replit app origin under Supabase Authentication → URL Configuration → Redirect URLs, then try again.";
  }
  if (
    mode === "signup" &&
    (normalized.includes("database error saving new user") ||
      normalized.includes("handle_new_user") ||
      normalized.includes("on_auth_user_created") ||
      normalized.includes("public.users") ||
      normalized.includes("pgrst205"))
  ) {
    return "Your account couldn’t be saved because the Supabase profile table or signup trigger is missing. Run supabase/migrations/001_auth_users.sql in the Supabase SQL Editor, then try again.";
  }
  if (
    normalized.includes("signup_disabled") ||
    normalized.includes("signups not allowed") ||
    normalized.includes("signups are disabled")
  ) {
    return "New accounts are disabled in Supabase. Enable email sign-ups under Supabase Authentication → Providers → Email.";
  }
  if (
    normalized.includes("error sending confirmation email") ||
    normalized.includes("email rate limit") ||
    normalized.includes("email rate_limit")
  ) {
    return "Supabase couldn’t send the verification email. Check the project’s SMTP settings and email limits, then try again.";
  }
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

  const safeMessage = message.replace(/\s+/g, " ").trim().slice(0, 180);
  const reference = code ? ` (${code})` : "";
  return safeMessage
    ? `Supabase couldn’t complete the request${reference}: ${safeMessage}`
    : "Supabase couldn’t complete the request. Check the project’s Auth logs and try again.";
}

function friendlyThrownError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("fetch")
  ) {
    return "Stride couldn’t reach Supabase. Check the project URL, network connection, and browser access, then try again.";
  }

  const safeMessage = message.replace(/\s+/g, " ").trim().slice(0, 180);
  return safeMessage
    ? `Stride couldn’t complete the Supabase request: ${safeMessage}`
    : "Stride couldn’t complete the Supabase request. Please try again.";
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
        reportAuthFailure(result.error, mode);
        setError(
          friendlyAuthError(
            result.error.message,
            result.error.code,
            mode,
          ),
        );
        return;
      }

      if (isSignup && !result.data.session) {
        setConfirmationEmail(email.trim());
        return;
      }

      navigate("/app", { replace: true });
    } catch (cause) {
      const thrownError =
        cause instanceof Error
          ? { message: cause.message, code: cause.name }
          : { message: String(cause) };
      reportAuthFailure(thrownError, mode);
      setError(friendlyThrownError(cause));
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
