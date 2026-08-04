import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { money, stageLabel, type PublicService } from "@/lib/format";
import { submitIntake, submitManualIntake } from "@/lib/intake.functions";
import { CreateAccountPanel } from "@/components/CreateAccountPanel";


type Form = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  zip: string;
  precinct: string;
  cause_number: string;
  trial_date: string;
  notes: string;
};

const empty: Form = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  zip: "",
  precinct: "",
  cause_number: "",
  trial_date: "",
  notes: "",
};

const inputClass =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30";

export function IntakeWizard({
  services,
  mode,
  initialServiceSlug,
  onComplete,
}: {
  services: PublicService[];
  mode: "web" | "manual";
  initialServiceSlug?: string;
  onComplete?: () => void;
}) {
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState<string>(
    services.find((s) => s.slug === initialServiceSlug)?.id ?? "",
  );
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ customerId: string; email: string } | null>(null);

  const submitPublic = useServerFn(submitIntake);
  const submitManual = useServerFn(submitManualIntake);
  const selected = services.find((s) => s.id === serviceId);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const step2Valid =
    form.first_name.trim() && form.last_name.trim() && /^\S+@\S+\.\S+$/.test(form.email.trim());

  async function handleSubmit() {
    if (!serviceId || !step2Valid) return;
    setSaving(true);
    try {
      const payload = { ...form, service_id: serviceId };
      if (mode === "manual") {
        await submitManual({ data: payload });
        toast.success("Intake submitted");
        setForm(empty);
        setServiceId("");
        setStep(1);
        onComplete?.();
      } else {
        const result = await submitPublic({ data: payload });
        toast.success("Intake submitted");
        setDone({ customerId: result.customerId, email: form.email.trim() });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div>
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-foreground">
            We've got your information.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">Here's what happens next:</p>
          <ol className="mt-4 space-y-3 text-sm text-foreground">
            <li>
              <span className="font-semibold">1. Intake review (within 1 business day).</span> A
              case specialist checks your dates against the Harris County court record.
            </li>
            <li>
              <span className="font-semibold">2. We call or text you.</span> We confirm your
              deadline, explain your options, and collect anything still missing.
            </li>
            <li>
              <span className="font-semibold">3. Documents prepared and filed.</span> You review
              and sign; we file with your JP precinct court as your authorized agent.
            </li>
            <li>
              <span className="font-semibold">4. You get every key date.</span> Trial date, appeal
              deadline, and the earliest a writ can issue — tracked for you.
            </li>
          </ol>
          <p className="mt-5 text-xs text-muted-foreground">
            No payment has been collected. Nothing is filed until you approve it.
          </p>
        </div>
        <CreateAccountPanel customerId={done.customerId} email={done.email} />
      </div>
    );
  }



  return (
    <div>
      <ol className="mb-6 flex items-center gap-2 text-xs font-medium">
        {["Your situation", "Your details", "Review"].map((label, i) => {
          const n = i + 1;
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  step >= n ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                {n}
              </span>
              <span className={step >= n ? "text-foreground" : "text-muted-foreground"}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Which situation fits you best?
          </h2>
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setServiceId(s.id)}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                serviceId === s.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{s.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stageLabel(s.stage)}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-foreground">
                  {money(s.price_cents)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">How can we reach you?</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="First name" required>
                <input className={inputClass} value={form.first_name} onChange={set("first_name")} />
              </Field>
              <Field label="Last name" required>
                <input className={inputClass} value={form.last_name} onChange={set("last_name")} />
              </Field>
              <Field label="Email" required>
                <input type="email" className={inputClass} value={form.email} onChange={set("email")} />
              </Field>
              <Field label="Phone">
                <input className={inputClass} value={form.phone} onChange={set("phone")} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Street address">
                  <input className={inputClass} value={form.address} onChange={set("address")} />
                </Field>
              </div>
              <Field label="City">
                <input className={inputClass} value={form.city} onChange={set("city")} />
              </Field>
              <Field label="ZIP">
                <input className={inputClass} value={form.zip} onChange={set("zip")} />
              </Field>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Your case <span className="text-sm font-normal text-muted-foreground">(if you know it)</span>
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Cause number">
                <input className={inputClass} value={form.cause_number} onChange={set("cause_number")} />
              </Field>
              <Field label="Court date">
                <input type="date" className={inputClass} value={form.trial_date} onChange={set("trial_date")} />
              </Field>
              <Field label="JP precinct">
                <input className={inputClass} value={form.precinct} onChange={set("precinct")} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Anything else we should know?">
                  <textarea rows={3} className={inputClass} value={form.notes} onChange={set("notes")} />
                </Field>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Review and submit</h2>
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            <Row label="Service" value={selected ? `${selected.name} — ${money(selected.price_cents)}` : "—"} />
            <Row label="Name" value={`${form.first_name} ${form.last_name}`} />
            <Row label="Email" value={form.email} />
            <Row label="Phone" value={form.phone || "—"} />
            <Row
              label="Address"
              value={[form.address, form.city, form.zip].filter(Boolean).join(", ") || "—"}
            />
            <Row label="Cause number" value={form.cause_number || "—"} />
            <Row label="Court date" value={form.trial_date || "—"} />
            <Row label="Precinct" value={form.precinct || "—"} />
          </div>
          <p className="text-xs text-muted-foreground">
            Submitting does not collect payment and does not create an attorney-client
            relationship.
          </p>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={step === 1}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        {step < 3 ? (
          <button
            type="button"
            disabled={(step === 1 && !serviceId) || (step === 2 && !step2Valid)}
            onClick={() => setStep((s) => s + 1)}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            Continue <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? "Submitting…" : "Submit intake"}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
