import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/useSessionUser";
import { PasswordChecklist, PasswordInput } from "@/components/PasswordInput";
import { passwordIsStrong } from "@/lib/password";

export const Route = createFileRoute("/_authenticated/admin/account")({
  head: () => ({
    meta: [
      { title: "My Account — EvictionAgent Staff Console" },
      { name: "description", content: "Update your staff display name and password in EvictionAgent." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "My Account — EvictionAgent Staff Console" },
      { property: "og:description", content: "Update your display name and password." },
    ],
  }),
  component: MyAccountPage,
});

const inputClass =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

function MyAccountPage() {
  const { user, displayName, loading } = useSessionUser();
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    if (!loading) setName(displayName === user?.email ? "" : displayName);
  }, [loading, displayName, user?.email]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSavingName(true);
    try {
      const { error: authErr } = await supabase.auth.updateUser({
        data: { full_name: name.trim() },
      });
      if (authErr) throw authErr;
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name.trim() })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Display name updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update your name");
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSavingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setPw("");
      setConfirm("");
      toast.success("Password updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update your password");
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">My account</h1>
        <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
      </div>

      <form onSubmit={saveName} className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Display name</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className={inputClass}
          required
        />
        <button
          type="submit"
          disabled={savingName}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {savingName ? "Saving…" : "Save name"}
        </button>
      </form>

      <form onSubmit={savePassword} className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Change password</h2>
        <PasswordInput value={pw} onChange={setPw} placeholder="New password" autoComplete="new-password" />
        <PasswordChecklist value={pw} />
        <PasswordInput
          value={confirm}
          onChange={setConfirm}
          placeholder="Confirm new password"
          autoComplete="new-password"
        />
        <button
          type="submit"
          disabled={savingPw || !passwordIsStrong(pw) || pw !== confirm}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {savingPw ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
