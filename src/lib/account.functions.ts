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

const staffCustomerSchema = z.object({
  customerId: z.string().uuid(),
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().default(""),
  address: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
  zip: z.string().trim().max(12).optional().default(""),
  precinct: z.string().trim().max(40).optional().default(""),
});

async function requireStaff(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("profiles")
    .select("id, role")
    .eq("id", context.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !["staff", "admin"].includes(data.role)) throw new Error("Forbidden");
}

/** Staff/admin update a customer's registration + contact record. */
export const updateCustomerByStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => staffCustomerSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("customers")
      .update({
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email.toLowerCase(),
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        zip: data.zip || null,
        precinct: data.precinct || null,
      })
      .eq("id", data.customerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Admin account management                                            */
/* ------------------------------------------------------------------ */

type AuthUserLike = {
  id: string;
  email?: string | null;
  banned_until?: string | null;
  user_metadata?: Record<string, unknown>;
};

function isBanned(u: AuthUserLike | null | undefined) {
  const until = u?.banned_until;
  if (!until) return false;
  const t = Date.parse(until);
  return Number.isNaN(t) ? true : t > Date.now();
}

async function loadAuthUser(admin: any, id: string): Promise<AuthUserLike | null> {
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error) return null;
  return (data?.user ?? null) as AuthUserLike | null;
}

async function adminCount(admin: any) {
  const { data, error } = await admin.from("profiles").select("id").eq("role", "admin");
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string }[];
}

async function assertNotLastAdmin(admin: any, userId: string) {
  const admins = await adminCount(admin);
  if (admins.some((a) => a.id === userId) && admins.length <= 1) {
    throw new Error("There must be at least one active admin.");
  }
}

/** Staff list enriched with email + login status. */
export const listStaffAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, role, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const enriched = await Promise.all(
      rows.map(async (p) => {
        const u = await loadAuthUser(supabaseAdmin, p.id);
        return {
          ...p,
          email: u?.email ?? null,
          status: !u ? ("missing" as const) : isBanned(u) ? ("disabled" as const) : ("active" as const),
        };
      }),
    );
    return enriched;
  });

/** Customers with login + account status + order count. */
export const listCustomerAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("customers")
      .select("id, first_name, last_name, email, phone, city, precinct, user_id, created_at, orders(id)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as any[];
    return await Promise.all(
      rows.map(async (c) => {
        let status: "active" | "disabled" | "none" = "none";
        if (c.user_id) {
          const u = await loadAuthUser(supabaseAdmin, c.user_id);
          status = !u ? "none" : isBanned(u) ? "disabled" : "active";
        }
        return {
          id: c.id as string,
          first_name: c.first_name as string,
          last_name: c.last_name as string,
          email: c.email as string,
          phone: (c.phone ?? null) as string | null,
          city: (c.city ?? null) as string | null,
          precinct: (c.precinct ?? null) as string | null,
          user_id: (c.user_id ?? null) as string | null,
          created_at: c.created_at as string,
          order_count: Array.isArray(c.orders) ? c.orders.length : 0,
          status,
        };
      }),
    );
  });

/** Admin sets a user's password directly. */
export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), newPassword: z.string().min(8).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin emails a password reset link. */
export const sendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ email: z.string().trim().email().max(255) }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const site = (process.env["SITE_URL"] ?? "").replace(/\/$/, "");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email.toLowerCase(), {
      redirectTo: `${site}/reset-password`,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Ban (disable) or unban (reactivate) an auth login. Records are retained. */
export const setUserBanned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), banned: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.banned) {
      if (data.userId === context.userId) throw new Error("You cannot disable your own account.");
      await assertNotLastAdmin(supabaseAdmin, data.userId);
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.banned ? "876000h" : "none",
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Permanently delete a customer: auth login (if any) + case/order/event records. */
export const purgeCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ customerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: customer, error } = await supabaseAdmin
      .from("customers")
      .select("id, user_id")
      .eq("id", data.customerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!customer) throw new Error("Customer not found.");

    const { data: cases } = await supabaseAdmin
      .from("cases")
      .select("id")
      .eq("customer_id", customer.id);
    const caseIds = (cases ?? []).map((c) => c.id);

    if (caseIds.length) {
      const { error: evErr } = await supabaseAdmin
        .from("case_events")
        .delete()
        .in("case_id", caseIds);
      if (evErr) throw new Error(evErr.message);
    }

    const { error: ordErr } = await supabaseAdmin
      .from("orders")
      .delete()
      .eq("customer_id", customer.id);
    if (ordErr) throw new Error(ordErr.message);

    const { error: caseErr } = await supabaseAdmin
      .from("cases")
      .delete()
      .eq("customer_id", customer.id);
    if (caseErr) throw new Error(caseErr.message);

    const { error: custErr } = await supabaseAdmin.from("customers").delete().eq("id", customer.id);
    if (custErr) throw new Error(custErr.message);

    if (customer.user_id) {
      if (customer.user_id === context.userId) throw new Error("You cannot purge your own account.");
      await supabaseAdmin.auth.admin.deleteUser(customer.user_id);
    }
    return { ok: true };
  });

/** Permanently delete a staff member: auth user + profiles row. */
export const purgeStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot purge your own account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertNotLastAdmin(supabaseAdmin, data.userId);

    const { error } = await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    if (error) throw new Error(error.message);
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });
