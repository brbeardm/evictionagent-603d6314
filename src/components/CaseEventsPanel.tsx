import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Check, Plus, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, titleize } from "@/lib/format";
import { EVENT_TYPES, relativeLabel, toDateInput, type EventType } from "@/lib/events";

type EventRow = {
  id: string;
  event_type: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
  next_step: string | null;
  auto_generated: boolean;
};

export function CaseEventsPanel({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    event_type: "task" as EventType,
    due_date: "",
    next_step: "",
  });

  const key = ["admin", "case-events", caseId];

  const { data: events = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_events")
        .select("id, event_type, title, due_date, completed_at, next_step, auto_generated")
        .eq("case_id", caseId)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });

  const done = () => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    setAdding(false);
    setEditingId(null);
    setForm({ title: "", event_type: "task", due_date: "", next_step: "" });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Title is required");
      const payload = {
        title: form.title.trim(),
        event_type: form.event_type,
        due_date: form.due_date || null,
        next_step: form.next_step.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase.from("case_events").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("case_events")
          .insert({ ...payload, case_id: caseId, auto_generated: false });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Event updated" : "Event added");
      done();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: { due_date?: string | null; completed_at?: string | null };
    }) => {
      const { error } = await supabase.from("case_events").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarClock className="h-4 w-4 text-primary" /> Case events
        </h2>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setForm({ title: "", event_type: "task", due_date: "", next_step: "" });
            setAdding((v) => !v);
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
        >
          <Plus className="h-3.5 w-3.5" /> Add event
        </button>
      </div>

      {(adding || editingId) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="mt-4 grid gap-3 rounded-xl border border-border bg-secondary/40 p-4 sm:grid-cols-2"
        >
          <input
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <select
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={form.event_type}
            onChange={(e) => setForm({ ...form, event_type: e.target.value as EventType })}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {titleize(t)}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          />
          <input
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Next step"
            value={form.next_step}
            onChange={(e) => setForm({ ...form, next_step: e.target.value })}
          />
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              {editingId ? "Save changes" : "Add event"}
            </button>
            <button
              type="button"
              onClick={done}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : events.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No events recorded yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border/60">
          {events.map((e) => (
            <li key={e.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[14rem] flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {e.title}
                    {e.auto_generated && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        <Sparkles className="h-3 w-3" /> Auto
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {titleize(e.event_type)} · {formatDate(e.due_date)}
                    {!e.completed_at && e.due_date ? ` · ${relativeLabel(e.due_date)}` : ""}
                    {e.completed_at ? ` · Completed ${formatDate(e.completed_at)}` : ""}
                  </p>
                  {e.next_step && (
                    <p className="mt-1 text-sm text-muted-foreground">Next step: {e.next_step}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    aria-label="Reschedule"
                    value={toDateInput(e.due_date)}
                    onChange={(ev) =>
                      ev.target.value &&
                      patch.mutate({ id: e.id, values: { due_date: ev.target.value } })
                    }
                    className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false);
                      setEditingId(e.id);
                      setForm({
                        title: e.title,
                        event_type: (e.event_type as EventType) ?? "task",
                        due_date: toDateInput(e.due_date),
                        next_step: e.next_step ?? "",
                      });
                    }}
                    className="rounded-lg border border-border px-2 py-1 text-xs text-foreground hover:bg-secondary"
                  >
                    Edit
                  </button>
                  {e.completed_at ? (
                    <button
                      type="button"
                      onClick={() => patch.mutate({ id: e.id, values: { completed_at: null } })}
                      className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground"
                    >
                      Reopen
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        patch.mutate({
                          id: e.id,
                          values: { completed_at: new Date().toISOString() },
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
                    >
                      <Check className="h-3.5 w-3.5" /> Done
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
