import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Staff Login — EvictionAgent" },
      { name: "description", content: "Sign in to the EvictionAgent staff case management console." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Staff Login — EvictionAgent" },
      { property: "og:description", content: "EvictionAgent staff case management console." },
    ],
  }),
  component: AuthPage,
});

const inputClass =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/admin", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/admin", replace: true });
        else toast.success("Check your email to confirm your account.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
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
          {mode === "signin" ? "Staff sign in" : "Create staff account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Case management console for EvictionAgent staff.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          {mode === "signup" && (
            <input
              className={inputClass}
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          )}
          <input
            className={inputClass}
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className={inputClass}
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-sm text-primary underline-offset-4 hover:underline"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
