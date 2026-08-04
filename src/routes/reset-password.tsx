import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PasswordChecklist, PasswordInput } from "@/components/PasswordInput";
import { passwordIsStrong } from "@/lib/password";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password — EvictionAgent" },
      { name: "description", content: "Choose a new password for your EvictionAgent account." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Set a new password — EvictionAgent" },
      { property: "og:description", content: "Choose a new password for your EvictionAgent account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = passwordIsStrong(password) && confirm === password && !busy;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated.");
      navigate({ to: "/portal", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
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
        <h1 className="mt-4 text-xl font-semibold text-foreground">Set a new password</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="New password"
            autoComplete="new-password"
            required
          />
          <PasswordChecklist value={password} />
          <PasswordInput
            value={confirm}
            onChange={setConfirm}
            placeholder="Confirm password"
            autoComplete="new-password"
            required
          />
          {mismatch && <p className="text-xs text-destructive">Passwords don't match yet.</p>}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
