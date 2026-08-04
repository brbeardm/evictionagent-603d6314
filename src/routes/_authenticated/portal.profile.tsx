import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { updateMyContact } from "@/lib/account.functions";
import { PasswordChecklist, PasswordInput } from "@/components/PasswordInput";
import { passwordIsStrong } from "@/lib/password";

export const Route = createFileRoute("/_authenticated/portal/profile")({
  head: () => ({
    meta: [
      { title: "Profile — EvictionAgent" },
      { name: "description", content: "Update your contact details and password for your EvictionAgent account." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Profile — EvictionAgent" },
      { property: "og:description", content: "Update your contact details and password." },
    ],
  }),
  component: ProfilePage,
});

const inputClass =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

type Contact = {
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  city: string;
  zip: string;
};

const emptyContact: Contact = {
  first_name: "",
  last_name: "",
  phone: "",
  address: "",
  city: "",
  zip: "",
};

async function loadMe() {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return null;
  const { data } = await supabase
    .from("customers")
    .select("id, first_name, last_name, email, phone, address, city, zip")
    .eq("user_id", uid)
    .maybeSingle();
  return { email: userRes.user?.email ?? "", customer: data };
}

function ProfilePage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["portal-profile"], queryFn: loadMe });
  const save = useServerFn(updateMyContact);

  const [form, setForm] = useState<Contact>(emptyContact);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    const c = data?.customer;
    if (c) {
      setForm({
        first_name: c.first_name ?? "",
        last_name: c.last_name ?? "",
        phone: c.phone ?? "",
        address: c.address ?? "",
        city: c.city ?? "",
        zip: c.zip ?? "",
      });
    }
  }, [data]);

  const set = (k: keyof Contact) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await save({ data: form });
      toast.success("Contact details saved");
      await queryClient.invalidateQueries({ queryKey: ["portal-profile"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const mismatch = confirm.length > 0 && confirm !== password;
  const canChangePw = passwordIsStrong(password) && confirm === password && !pwBusy;

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!canChangePw) return;
    setPwBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirm("");
      toast.success("Password updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setPwBusy(false);
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">{data?.email}</p>
      </div>

      {data?.customer ? (
        <form onSubmit={handleSave} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-foreground">Contact details</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="First name">
              <input className={inputClass} value={form.first_name} onChange={set("first_name")} required />
            </Field>
            <Field label="Last name">
              <input className={inputClass} value={form.last_name} onChange={set("last_name")} required />
            </Field>
            <Field label="Phone">
              <input className={inputClass} value={form.phone} onChange={set("phone")} />
            </Field>
            <Field label="City">
              <input className={inputClass} value={form.city} onChange={set("city")} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Street address">
                <input className={inputClass} value={form.address} onChange={set("address")} />
              </Field>
            </div>
            <Field label="ZIP">
              <input className={inputClass} value={form.zip} onChange={set("zip")} />
            </Field>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-4 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </form>
      ) : (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          No customer record is linked to this account yet.
        </p>
      )}

      <form onSubmit={handlePassword} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">Change password</h2>
        <div className="mt-4 max-w-sm space-y-3">
          <PasswordInput value={password} onChange={setPassword} placeholder="New password" autoComplete="new-password" />
          <PasswordChecklist value={password} />
          <PasswordInput value={confirm} onChange={setConfirm} placeholder="Confirm password" autoComplete="new-password" />
          {mismatch && <p className="text-xs text-destructive">Passwords don't match yet.</p>}
          <button
            type="submit"
            disabled={!canChangePw}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {pwBusy ? "Saving…" : "Update password"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
