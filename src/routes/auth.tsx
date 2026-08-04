import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PasswordInput } from "@/components/PasswordInput";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Log in — EvictionAgent" },
      { name: "description", content: "Log in to track your Texas eviction case or open the EvictionAgent staff console." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Log in — EvictionAgent" },
      { property: "og:description", content: "Track your case or open the staff console." },
    ],
  }),
  component: AuthPage,
});

const inputClass =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

async function routeByRole(userId: string) {
  const { data } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  return data ? "/admin" : "/";
}

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resetMode, setResetMode] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const to = await routeByRole(data.session.user.id);
        navigate({ to, replace: true });
      }
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(
          err.message.toLowerCase().includes("invalid")
            ? "That email and password don't match. Please check them and try again."
            : err.message,
        );
        return;
      }
      const to = await routeByRole(data.user.id);
      navigate({ to, replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      toast.success("If that email has an account, a reset link is on its way.");
      setResetMode(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← EvictionAgent
        </Link>
        <h1 className="mt-4 text-xl font-semibold text-foreground">
          {resetMode ? "Reset your password" : "Log in"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {resetMode
            ? "We'll email you a link to set a new password."
            : "Customers can track their case. Staff go straight to the console."}
        </p>

        {resetMode ? (
          <form onSubmit={handleReset} className="mt-6 space-y-3">
            <input
              className={inputClass}
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
            <button
              type="button"
              onClick={() => setResetMode(false)}
              className="w-full text-sm text-primary underline-offset-4 hover:underline"
            >
              Back to log in
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignIn} className="mt-6 space-y-3">
            <input
              className={inputClass}
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <PasswordInput
              value={password}
              onChange={setPassword}
              required
              autoComplete="current-password"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Please wait…" : "Log in"}
            </button>
            <button
              type="button"
              onClick={() => setResetMode(true)}
              className="w-full text-sm text-primary underline-offset-4 hover:underline"
            >
              Forgot your password?
            </button>
          </form>
        )}

        <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
          No account yet?{" "}
          <Link to="/start" className="text-primary underline-offset-4 hover:underline">
            Start your intake
          </Link>{" "}
          — you can create an account at the end.
        </p>
      </div>
    </div>
  );
}
