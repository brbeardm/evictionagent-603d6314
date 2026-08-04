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

  const caseStage =
    service.stage === "post_judgment" ? "judgment" : service.stage === "move_out" ? "move_out" : data.trial_date ? "trial_set" : "pre_trial";

  const { data: caseRow, error: caseError } = await supabaseAdmin
    .from("cases")
    .insert({
      customer_id: customer.id,
      cause_number: data.cause_number || null,
      court_precinct: data.precinct || null,
      trial_date: data.trial_date || null,
      stage: caseStage as "pre_trial" | "trial_set" | "judgment" | "move_out",
      notes: data.notes || null,
    })
    .select("id")
    .single();
  if (caseError) throw new Error(caseError.message);

  const { error: orderError } = await supabaseAdmin.from("orders").insert({
    customer_id: customer.id,
    case_id: caseRow.id,
    service_id: service.id,
    amount_cents: service.price_cents,
    payment_status: "unpaid",
    disposition: "new",
  });
  if (orderError) throw new Error(orderError.message);

  return { customerId: customer.id as string, caseId: caseRow.id as string };
}

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
