import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Mail, MoreHorizontal, ShieldOff, ShieldCheck, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PasswordChecklist, PasswordInput } from "@/components/PasswordInput";
import { passwordIsStrong } from "@/lib/password";
import { sendPasswordReset, setUserBanned, setUserPassword } from "@/lib/account.functions";

export type AccountStatus = "active" | "disabled" | "none" | "missing";

export function StatusBadge({ status }: { status: AccountStatus }) {
  const map: Record<AccountStatus, { label: string; className: string }> = {
    active: { label: "Active", className: "bg-primary/10 text-primary" },
    disabled: { label: "Disabled", className: "bg-destructive/10 text-destructive" },
    none: { label: "No account", className: "bg-muted text-muted-foreground" },
    missing: { label: "No login", className: "bg-muted text-muted-foreground" },
  };
  const s = map[status];
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}

type Props = {
  userId: string | null;
  email: string | null;
  status: AccountStatus;
  /** Label shown in the purge dialog, e.g. "Jane Doe". */
  name: string;
  /** Extra warning lines for the purge dialog. */
  purgeWarning: string;
  onPurge: () => Promise<void>;
  onChanged: () => void | Promise<void>;
};

export function AccountControls({
  userId,
  email,
  status,
  name,
  purgeWarning,
  onPurge,
  onChanged,
}: Props) {
  const setPassword = useServerFn(setUserPassword);
  const sendReset = useServerFn(sendPasswordReset);
  const setBanned = useServerFn(setUserBanned);

  const [pwOpen, setPwOpen] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  const hasLogin = Boolean(userId) && status !== "none" && status !== "missing";

  async function run(fn: () => Promise<unknown>, ok: string, close: () => void) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      close();
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary">
          Manage <MoreHorizontal className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
            {email ?? "No email on file"}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {hasLogin ? (
            <>
              <DropdownMenuItem onSelect={() => setPwOpen(true)}>
                <KeyRound className="mr-2 h-4 w-4" /> Set new password
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!email}
                onSelect={() =>
                  void run(
                    () => sendReset({ data: { email: email! } }),
                    "Password reset email sent",
                    () => {},
                  )
                }
              >
                <Mail className="mr-2 h-4 w-4" /> Send reset email
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setBanOpen(true)}>
                {status === "disabled" ? (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" /> Reactivate account
                  </>
                ) : (
                  <>
                    <ShieldOff className="mr-2 h-4 w-4" /> Disable account
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => {
              setConfirmText("");
              setPurgeOpen(true);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Permanently purge
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Set password */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set a new password</DialogTitle>
            <DialogDescription>
              This immediately replaces the password for {name}. Share it with them securely.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <PasswordInput value={pw} onChange={setPw} placeholder="New password" />
            <PasswordChecklist value={pw} />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setPwOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !passwordIsStrong(pw) || !userId}
              onClick={() =>
                void run(
                  () => setPassword({ data: { userId: userId!, newPassword: pw } }),
                  "Password updated",
                  () => {
                    setPw("");
                    setPwOpen(false);
                  },
                )
              }
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Set password"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable / reactivate */}
      <Dialog open={banOpen} onOpenChange={setBanOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {status === "disabled" ? "Reactivate this account?" : "Disable this account?"}
            </DialogTitle>
            <DialogDescription>
              {status === "disabled"
                ? `${name} will be able to sign in again.`
                : `${name} will no longer be able to sign in. All of their records — cases, orders and payment history — are kept and this can be undone at any time.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setBanOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !userId}
              onClick={() =>
                void run(
                  () => setBanned({ data: { userId: userId!, banned: status !== "disabled" } }),
                  status === "disabled" ? "Account reactivated" : "Account disabled",
                  () => setBanOpen(false),
                )
              }
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 ${
                status === "disabled" ? "bg-primary" : "bg-destructive"
              }`}
            >
              {busy ? "Working…" : status === "disabled" ? "Reactivate" : "Disable"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent purge */}
      <Dialog open={purgeOpen} onOpenChange={setPurgeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Permanently purge {name}?</DialogTitle>
            <DialogDescription>
              This cannot be undone. {purgeWarning} If you only want to stop them signing in, disable
              the account instead — that keeps everything.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Type <span className="font-mono text-destructive">PURGE</span> to confirm
            </label>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/30"
              placeholder="PURGE"
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setPurgeOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || confirmText !== "PURGE"}
              onClick={() =>
                void run(onPurge, "Permanently purged", () => setPurgeOpen(false))
              }
              className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Purging…" : "Purge permanently"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
