import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Links the signed-in user to a customer record created during anonymous intake. */
export const linkCustomerAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ customerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (userErr || !userRes.user?.email) throw new Error("Could not verify your account.");
    const email = userRes.user.email.trim().toLowerCase();

    const { data: customer, error } = await supabaseAdmin
      .from("customers")
      .select("id, email, user_id")
      .eq("id", data.customerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!customer) throw new Error("Record not found.");
    if (customer.user_id) throw new Error("This record is already linked to an account.");
    if ((customer.email ?? "").trim().toLowerCase() !== email) {
      throw new Error("That record belongs to a different email address.");
    }

    const { error: updateErr } = await supabaseAdmin
      .from("customers")
      .update({ user_id: context.userId })
      .eq("id", customer.id)
      .is("user_id", null);
    if (updateErr) throw new Error(updateErr.message);

    return { ok: true };
  });

const contactSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).optional().default(""),
  address: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
  zip: z.string().trim().max(12).optional().default(""),
});

/** A customer updates their own contact fields (never email, source or ownership). */
export const updateMyContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => contactSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("customers")
      .update({
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        zip: data.zip || null,
      })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("profiles")
    .select("id, role")
    .eq("id", context.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.role !== "admin") throw new Error("Forbidden");
}

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, role, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), role: z.enum(["staff", "admin"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.role !== "admin") {
      const { data: admins, error: adminErr } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("role", "admin");
      if (adminErr) throw new Error(adminErr.message);
      const remaining = (admins ?? []).filter((a) => a.id !== data.id);
      if (remaining.length === 0) throw new Error("There must be at least one admin.");
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ role: data.role })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addStaffByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ email: z.string().trim().email().max(255) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();

    let match: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null = null;
    for (let page = 1; page <= 10 && !match; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      match = list.users.find((u) => (u.email ?? "").toLowerCase() === email) ?? null;
      if (list.users.length < 200) break;
    }
    if (!match) {
      throw new Error("Ask them to create an account first, then add them here.");
    }

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", match.id)
      .maybeSingle();
    if (existingErr) throw new Error(existingErr.message);
    if (existing) return { ok: true, message: "Already on the team." };

    const fullName =
      (match.user_metadata?.["full_name"] as string | undefined) || match.email || "Staff member";

    const { error } = await supabaseAdmin
      .from("profiles")
      .insert({ id: match.id, full_name: fullName, role: "staff" });
    if (error) throw new Error(error.message);
    return { ok: true, message: "Staff member added" };
  });
