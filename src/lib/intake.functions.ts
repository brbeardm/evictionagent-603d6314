import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const intakeSchema = z.object({
  service_id: z.string().uuid(),
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().default(""),
  address: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
  zip: z.string().trim().max(12).optional().default(""),
  precinct: z.string().trim().max(40).optional().default(""),
  cause_number: z.string().trim().max(80).optional().default(""),
  trial_date: z.string().trim().max(20).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
});

export type IntakeInput = z.input<typeof intakeSchema>;

function caseStageFor(stage: string, trialDate: string) {
  if (stage === "post_judgment") return "judgment" as const;
  if (stage === "move_out") return "move_out" as const;
  return (trialDate ? "trial_set" : "pre_trial") as "trial_set" | "pre_trial";
}

async function createIntake(
  data: z.output<typeof intakeSchema>,
  source: "web" | "manual",
  createdBy: string | null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: service, error: serviceError } = await supabaseAdmin
    .from("services")
    .select("id, price_cents, stage")
    .eq("id", data.service_id)
    .eq("active", true)
    .maybeSingle();
  if (serviceError) throw new Error(serviceError.message);
  if (!service) throw new Error("That service is not available.");

  const { data: customer, error: customerError } = await supabaseAdmin
    .from("customers")
    .insert({
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone || null,
      address: data.address || null,
      city: data.city || null,
      zip: data.zip || null,
      precinct: data.precinct || null,
      source,
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (customerError) throw new Error(customerError.message);

  const caseStage = caseStageFor(service.stage, data.trial_date);

  const { data: caseRow, error: caseError } = await supabaseAdmin
    .from("cases")
    .insert({
      customer_id: customer.id,
      cause_number: data.cause_number || null,
      court_precinct: data.precinct || null,
      trial_date: data.trial_date || null,
      stage: caseStage,
      notes: data.notes || null,
    })
    .select("id")
    .single();
  if (caseError) throw new Error(caseError.message);

  const { data: orderRow, error: orderError } = await supabaseAdmin
    .from("orders")
    .insert({
      customer_id: customer.id,
      case_id: caseRow.id,
      service_id: service.id,
      amount_cents: service.price_cents,
      payment_status: "unpaid",
      disposition: "new",
    })
    .select("id")
    .single();
  if (orderError) throw new Error(orderError.message);

  return {
    customerId: customer.id as string,
    caseId: caseRow.id as string,
    orderId: orderRow.id as string,
  };
}

/** Logged-in customer places a new order on their existing customer record. */
export const submitCustomerIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => intakeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: customer, error: customerErr } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (customerErr) throw new Error(customerErr.message);
    if (!customer) throw new Error("No customer record is linked to your account.");

    const { data: service, error: serviceError } = await supabaseAdmin
      .from("services")
      .select("id, price_cents, stage")
      .eq("id", data.service_id)
      .eq("active", true)
      .maybeSingle();
    if (serviceError) throw new Error(serviceError.message);
    if (!service) throw new Error("That service is not available.");

    const { error: updateErr } = await supabaseAdmin
      .from("customers")
      .update({
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        zip: data.zip || null,
        precinct: data.precinct || null,
      })
      .eq("id", customer.id)
      .eq("user_id", context.userId);
    if (updateErr) throw new Error(updateErr.message);

    let caseId: string | null = null;
    if (data.cause_number) {
      const { data: existing, error: existingErr } = await supabaseAdmin
        .from("cases")
        .select("id")
        .eq("customer_id", customer.id)
        .eq("cause_number", data.cause_number)
        .maybeSingle();
      if (existingErr) throw new Error(existingErr.message);
      caseId = existing?.id ?? null;
    }

    if (!caseId) {
      const { data: caseRow, error: caseError } = await supabaseAdmin
        .from("cases")
        .insert({
          customer_id: customer.id,
          cause_number: data.cause_number || null,
          court_precinct: data.precinct || null,
          trial_date: data.trial_date || null,
          stage: caseStageFor(service.stage, data.trial_date),
          notes: data.notes || null,
        })
        .select("id")
        .single();
      if (caseError) throw new Error(caseError.message);
      caseId = caseRow.id;
    }

    const { data: orderRow, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_id: customer.id,
        case_id: caseId,
        service_id: service.id,
        amount_cents: service.price_cents,
        payment_status: "unpaid",
        disposition: "new",
      })
      .select("id")
      .single();
    if (orderError) throw new Error(orderError.message);

    return {
      customerId: customer.id as string,
      caseId: caseId as string,
      orderId: orderRow.id as string,
    };
  });

export const submitIntake = createServerFn({ method: "POST" })
  .inputValidator((input) => intakeSchema.parse(input))
  .handler(async ({ data }) => createIntake(data, "web", null));

export const submitManualIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => intakeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile) throw new Error("Forbidden");
    return createIntake(data, "manual", context.userId);
  });
