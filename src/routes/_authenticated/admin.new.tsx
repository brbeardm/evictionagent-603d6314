import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PublicLayoutless } from "@/components/noop";

export const Route = createFileRoute("/_authenticated/admin/new")({
  component: () => null,
});
