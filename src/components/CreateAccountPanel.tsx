import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { linkCustomerAccount } from "@/lib/account.functions";
import { PasswordChecklist, PasswordInput } from "@/components/PasswordInput";
import { passwordIsStrong } from "@/lib/password";

export function CreateAccountPanel({
  customerId,
  email,
}: {
  customerId: string;
  email: string;
}) {
  const navigate = useNavigate();
  const link = useServerFn(linkCustomerAccount);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = passwordIsStrong(password) && confirm === password && !busy;

  if (dismissed) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      if (!data.session) {
        toast.success("Check your email to confirm your account, then log in.");
        setDismissed(true);
        return;
      }
      await link({ data: { customerId } });
      toast.success("Account created — here's your case.");
      navigate({ to: "/portal" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create your account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm"
    >
      <h3 className="text-base font-semibold text-foreground">
        Create an account to track your case
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Optional. See your key dates and order status any time.
      </p>

      <div className="mt-4 max-w-sm space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Email</span>
          <input
            readOnly
            value={email}
            className="w-full rounded-lg border border-input bg-secondary/50 px-3 py-2 text-sm text-foreground"
          />
        </label>
        <PasswordInput
          value={password}
          onChange={setPassword}
          placeholder="Create a password"
          autoComplete="new-password"
        />
        <PasswordChecklist value={password} />
        <PasswordInput
          value={confirm}
          onChange={setConfirm}
          placeholder="Confirm password"
          autoComplete="new-password"
        />
        {mismatch && <p className="text-xs text-destructive">Passwords don't match yet.</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {busy ? "Creating…" : "Create account"}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            No thanks
          </button>
        </div>
      </div>
    </form>
  );
}
